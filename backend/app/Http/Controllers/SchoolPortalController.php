<?php

namespace App\Http\Controllers;

use App\Domain\Incubation\Curriculum;
use App\Domain\Incubation\SchoolAccess;
use App\Integrations\Moodle\MoodleClient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Throwable;

final class SchoolPortalController extends Controller
{
    public function __construct(private SchoolAccess $schools) {}

    public function index(Request $request, string $slug, MoodleClient $moodle): JsonResponse
    {
        [$school, $access] = $this->schools->scope($request->user(), $slug);
        $guide = DB::table('learning_courses')
            ->where('status', 'published')
            ->where(fn ($query) => $query->where('slug', 'high-school-facilitator-guide')
                ->orWhere('moodle_shortname', 'YERH-SCHOOL-GUIDE'))
            ->first(['title', 'description', 'moodle_course_id']);

        $moodleGuide = null;
        if ($guide && ! empty($guide->moodle_course_id) && $moodle->isConfigured()) {
            $sections = $moodle->courseContents((int) $guide->moodle_course_id);
            $progress = ['progress' => 0, 'completed' => false];
            if (! empty($request->user()->moodle_user_id)) {
                try {
                    $stats = $moodle->courseProgress((int) $request->user()->moodle_user_id, (int) $guide->moodle_course_id);
                    $progress = ['progress' => $stats['progress'], 'completed' => $stats['completed']];
                } catch (Throwable) {
                    // Keep default progress if Moodle is temporarily unreachable.
                }
            }

            $moodleGuide = [
                'title' => $guide->title,
                'description' => $guide->description,
                'launch_url' => '/api/v1/learning/moodle/launch?school_guide=1',
                'progress' => $progress['progress'],
                'completed' => $progress['completed'],
                'sections' => $sections,
            ];
        }

        return response()->json(['data' => [
            'access' => $access,
            'cohorts' => DB::table('school_cohorts')->where('institution_id', $school->id)->latest('starts_on')->get(),
            'students' => DB::table('school_students')->where('institution_id', $school->id)->orderBy('name')->get(),
            'moodle_guide' => $moodleGuide,
        ]])->header('Cache-Control', 'no-store');
    }

    public function saveStudent(Request $request, string $slug, ?int $student = null): JsonResponse
    {
        [$school] = $this->schools->scope($request->user(), $slug, write: true);
        $students = DB::table('school_students')->where('institution_id', $school->id);
        if ($student !== null) {
            abort_unless((clone $students)->where('id', $student)->exists(), 404);
        }
        $reference = Rule::unique('school_students')->where('institution_id', $school->id);
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'reference' => ['required', 'string', 'max:60', $student === null ? $reference : $reference->ignore($student)],
            'age' => ['nullable', 'integer', 'between:5,30'],
            'gender' => ['nullable', 'string', 'max:60'],
            'grade' => ['required', 'string', 'max:60'],
        ]);
        if ($student === null) {
            $student = DB::table('school_students')->insertGetId($data + [
                'institution_id' => $school->id, 'created_at' => now(), 'updated_at' => now(),
            ]);
        } else {
            $students->where('id', $student)->update($data + ['updated_at' => now()]);
        }

        return response()->json(['data' => ['id' => $student]]);
    }

    public function addCohort(Request $request, string $slug): JsonResponse
    {
        [$school] = $this->schools->scope($request->user(), $slug, write: true);
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120', Rule::unique('school_cohorts')
                ->where('institution_id', $school->id)->where('starts_on', $request->input('starts_on'))],
            'starts_on' => ['required', 'date_format:Y-m-d'],
            'ends_on' => ['required', 'date_format:Y-m-d', 'after_or_equal:starts_on'],
        ]);
        $id = DB::table('school_cohorts')->insertGetId($data + [
            'institution_id' => $school->id, 'created_at' => now(), 'updated_at' => now(),
        ]);

        return response()->json(['data' => ['id' => $id]], 201);
    }

    public function cohort(Request $request, string $slug, int $cohortId): JsonResponse
    {
        [$school] = $this->schools->scope($request->user(), $slug);
        $cohort = $this->schools->cohort($school->id, $cohortId);
        $teams = $this->schools->teams($cohort->id)->orderBy('name')->get();
        $members = DB::table('school_venture_students as enrolment')
            ->join('school_students as student', 'student.id', '=', 'enrolment.student_id')
            ->where('enrolment.cohort_id', $cohort->id)
            ->orderBy('student.name')->get(['enrolment.venture_id', 'student.id', 'student.name', 'student.grade']);
        $classes = DB::table('school_classes')->where('cohort_id', $cohort->id)->latest('class_date')->get();
        $classTeams = DB::table('school_class_teams')->whereIn('class_id', $classes->pluck('id'))->get();
        $results = DB::table('school_results')->whereIn('venture_id', $teams->pluck('id'))->get();
        $credentials = DB::table('school_credentials')->whereIn('venture_id', $teams->pluck('id'))->get();

        return response()->json(['data' => compact('cohort', 'teams', 'members', 'classes', 'classTeams', 'results', 'credentials')])
            ->header('Cache-Control', 'no-store');
    }

    public function addTeam(Request $request, string $slug, int $cohortId): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'sector' => ['required', 'string', 'max:120', 'exists:marketplace_sectors,name'],
            'description' => ['required', 'string', 'max:3000'],
            'students' => ['required', 'array', 'min:1', 'max:100'],
            'students.*' => ['required', 'integer', 'distinct'],
        ]);
        $id = DB::transaction(function () use ($request, $slug, $cohortId, $data) {
            [$school] = $this->schools->scope($request->user(), $slug, write: true, lock: true);
            $cohort = $this->schools->cohort($school->id, $cohortId);
            $ids = $data['students'];
            $found = DB::table('school_students')->where('institution_id', $school->id)->whereIn('id', $ids)->count();
            $assigned = DB::table('school_venture_students')->where('cohort_id', $cohort->id)->whereIn('student_id', $ids)->exists();
            if ($found !== count($ids) || $assigned) {
                throw ValidationException::withMessages(['students' => 'Select only unassigned students from this school.']);
            }

            $id = DB::table('school_ventures')->insertGetId(Arr::except($data, 'students') + [
                'cohort_id' => $cohort->id, 'created_at' => now(), 'updated_at' => now(),
            ]);
            DB::table('school_venture_students')->insert(array_map(fn ($student) => [
                'student_id' => $student, 'venture_id' => $id, 'cohort_id' => $cohort->id,
            ], $ids));

            return $id;
        });

        return response()->json(['data' => ['id' => $id]], 201);
    }

    public function addClass(Request $request, string $slug, int $cohortId): JsonResponse
    {
        $data = $request->validate([
            'title' => ['required', 'string', 'max:160'],
            'class_date' => ['required', 'date_format:Y-m-d'],
            'notes' => ['nullable', 'string', 'max:3000'],
            'teams' => ['required', 'array', 'min:1', 'max:500'],
            'teams.*' => ['required', 'integer', 'distinct'],
        ]);
        $id = DB::transaction(function () use ($request, $slug, $cohortId, $data) {
            [$school] = $this->schools->scope($request->user(), $slug, write: true, lock: true);
            $cohort = $this->schools->cohort($school->id, $cohortId);
            if ($this->schools->teams($cohort->id)->whereIn('id', $data['teams'])->count() !== count($data['teams'])) {
                throw ValidationException::withMessages(['teams' => 'Select teams from this cohort.']);
            }
            $id = DB::table('school_classes')->insertGetId(Arr::except($data, 'teams') + [
                'cohort_id' => $cohort->id, 'created_at' => now(), 'updated_at' => now(),
            ]);
            DB::table('school_class_teams')->insert(array_map(fn ($team) => [
                'venture_id' => $team, 'class_id' => $id,
            ], $data['teams']));

            return $id;
        });

        return response()->json(['data' => ['id' => $id]], 201);
    }

    public function recordResult(Request $request, string $slug, int $cohortId, int $student, string $stage, Curriculum $curriculum): JsonResponse
    {
        $prerequisites = $curriculum->prerequisites($stage);
        $data = $request->validate([
            'score' => ['required', 'numeric', 'between:0,100', 'decimal:0,2'],
            'notes' => ['nullable', 'string', 'max:3000'],
        ]);
        DB::transaction(function () use ($request, $slug, $cohortId, $student, $stage, $prerequisites, $data) {
            [$school] = $this->schools->scope($request->user(), $slug, write: true, lock: true);
            $cohort = $this->schools->cohort($school->id, $cohortId);
            $venture = DB::table('school_venture_students')->where('cohort_id', $cohort->id)
                ->where('student_id', $student)->value('venture_id') ?? abort(404);
            $keys = ['venture_id' => $venture, 'student_id' => $student, 'stage' => $stage];
            $results = DB::table('school_results')->where('venture_id', $venture)->where('student_id', $student);
            if ((clone $results)->whereIn('stage', $prerequisites)->count() !== count($prerequisites)) {
                throw ValidationException::withMessages(['score' => 'Record the previous stages first.']);
            }

            $certificates = DB::table('school_credentials')->where('venture_id', $venture)->where('student_id', $student)
                ->whereIn('kind', [$stage, 'venture'])->whereIn('status', ['pending', 'issued']);
            if ($certificates->exists()) {
                throw ValidationException::withMessages(['score' => 'This mark is on a pending or issued certificate.']);
            }

            DB::table('school_results')->upsert([$keys + $data + [
                'recorded_by' => $request->user()->id, 'created_at' => now(), 'updated_at' => now(),
            ]], ['venture_id', 'student_id', 'stage'], ['score', 'notes', 'recorded_by', 'updated_at']);
        });

        return response()->json(['data' => ['saved' => true]]);
    }
}
