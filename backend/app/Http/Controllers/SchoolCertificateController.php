<?php

namespace App\Http\Controllers;

use App\Domain\Incubation\Curriculum;
use App\Domain\Incubation\SchoolAccess;
use Illuminate\Database\Query\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

final class SchoolCertificateController extends Controller
{
    public function __construct(private SchoolAccess $schools, private Curriculum $curriculum) {}

    public function index(Request $request): JsonResponse
    {
        abort_unless($request->user()->role === 'admin', 403);

        return response()->json(['data' => $this->records()->orderByRaw("CASE WHEN credential.status = 'pending' THEN 0 ELSE 1 END")
            ->latest('credential.updated_at')->get([
                'credential.*', 'school.name as institution', 'cohort.name as cohort', 'student.name as student',
                'team.name as venture', 'result.notes as assessment_notes',
            ])])->header('Cache-Control', 'no-store');
    }

    public function submit(Request $request, string $slug, int $cohortId, string $kind): JsonResponse
    {
        $prerequisites = $this->curriculum->credentialStages($kind);
        $data = $request->validate(['student_id' => ['nullable', 'integer', 'min:1']]);
        $requested = DB::transaction(function () use ($request, $slug, $cohortId, $kind, $prerequisites, $data) {
            [$school] = $this->schools->scope($request->user(), $slug, write: true, lock: true);
            $cohort = $this->schools->cohort($school->id, $cohortId);
            $members = DB::table('school_venture_students')->where('cohort_id', $cohort->id)
                ->when(isset($data['student_id']), fn (Builder $query) => $query->where('student_id', $data['student_id']))
                ->get();
            $results = DB::table('school_results')->whereIn('venture_id', $members->pluck('venture_id')->unique())
                ->whereIn('student_id', $members->pluck('student_id'))
                ->whereIn('stage', $prerequisites)->get()->groupBy('student_id');
            $existing = DB::table('school_credentials')->whereIn('venture_id', $members->pluck('venture_id')->unique())
                ->whereIn('student_id', $members->pluck('student_id'))->where('kind', $kind)
                ->lockForUpdate()->get()->keyBy('student_id');
            $entries = [];
            foreach ($members as $member) {
                $studentResults = $results->get($member->student_id, collect())->pluck('score', 'stage');
                if ($studentResults->count() !== count($prerequisites)
                    || in_array($existing->get($member->student_id)?->status, ['pending', 'issued'], true)) {
                    continue;
                }

                $score = $this->schools->studentScore($studentResults, $kind);
                $entries[] = [
                    'venture_id' => $member->venture_id, 'student_id' => $member->student_id, 'kind' => $kind,
                    'score' => $score, 'classification' => $this->schools->classification($score),
                    'status' => 'pending', 'requested_by' => $request->user()->id, 'reviewed_by' => null,
                    'review_notes' => null, 'created_at' => now(), 'updated_at' => now(),
                ];
            }

            if ($entries === []) {
                throw ValidationException::withMessages(['student_id' => 'No eligible certificates are ready to request for this stage.']);
            }

            DB::table('school_credentials')->upsert($entries, ['venture_id', 'student_id', 'kind'], [
                'score', 'classification', 'status', 'requested_by', 'reviewed_by', 'review_notes', 'updated_at',
            ]);

            return count($entries);
        });

        return response()->json(['data' => ['requested' => $requested]], 201);
    }

    public function review(Request $request, int $id): JsonResponse
    {
        abort_unless($request->user()->role === 'admin', 403);
        $data = $request->validate([
            'decision' => ['required', 'in:approved,rejected'],
            'note' => ['required_if:decision,rejected', 'nullable', 'string', 'max:1500'],
        ]);
        $approved = $data['decision'] === 'approved';
        $changed = DB::table('school_credentials')->where('id', $id)->where('status', 'pending')->update([
            'status' => $approved ? 'issued' : 'rejected',
            'document_id' => $approved ? Str::uuid()->toString() : null,
            'issued_at' => $approved ? now() : null,
            'review_notes' => $data['note'] ?? null,
            'reviewed_by' => $request->user()->id,
            'updated_at' => now(),
        ]);
        abort_unless($changed, 409, 'This request has already been reviewed.');

        return response()->json(['data' => ['reviewed' => true]]);
    }

    public function document(Request $request, string $document): Response
    {
        $record = $this->records()->where('credential.document_id', $document)->where('credential.status', 'issued')
            ->first(['credential.*', 'school.slug', 'school.name as institution', 'student.name as recipient', 'team.name as venture'])
            ?? abort(404);
        $this->schools->scope($request->user(), $record->slug);
        $title = $record->kind === 'venture' ? 'Venture Incubation Certificate' : $this->curriculum->stage($record->kind)['title'].' Certificate';

        return response()->view('venture-certificate', [
            'record' => $record,
            'title' => $title,
            'achievements' => [$record->institution, $record->classification],
        ])->header('Cache-Control', 'private, no-store');
    }

    private function records(): Builder
    {
        return DB::table('school_credentials as credential')
            ->join('school_students as student', 'student.id', '=', 'credential.student_id')
            ->join('school_ventures as team', 'team.id', '=', 'credential.venture_id')
            ->join('school_cohorts as cohort', 'cohort.id', '=', 'team.cohort_id')
            ->join('institutions as school', 'school.id', '=', 'cohort.institution_id')
            ->leftJoin('school_results as result', function ($join) {
                $join->on('result.venture_id', '=', 'credential.venture_id')->on('result.student_id', '=', 'credential.student_id')
                    ->on('result.stage', '=', 'credential.kind');
            });
    }
}
