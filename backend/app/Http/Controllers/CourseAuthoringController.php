<?php

namespace App\Http\Controllers;

use Illuminate\Database\Query\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Throwable;

final class CourseAuthoringController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $rows = $this->accessible($request)->latest('updated_at')->get([
            'id', 'slug', 'title', 'description', 'level', 'price', 'discount', 'status', 'review_notes', 'royalty_rate',
            DB::raw('CASE WHEN proposal_file IS NULL THEN 0 ELSE 1 END as has_attachment'),
        ]);
        $lessons = DB::table('learning_lessons')->whereIn('course_id', $rows->pluck('id'))->orderBy('position')->get(['id', 'course_id', 'title']);
        $royalties = DB::table('learning_enrolments')->whereIn('course_id', $rows->pluck('id'))
            ->where('payment_status', 'confirmed')->groupBy('course_id')
            ->selectRaw('course_id, count(*) as enrolments, sum(price_paid * royalty_rate) / 100 as accrued')->get();

        return response()->json(['data' => compact('rows', 'lessons', 'royalties')])->header('Cache-Control', 'no-store');
    }

    public function propose(Request $request): JsonResponse
    {
        $user = $request->user();
        abort_unless(in_array($user->role, ['mentor', 'admin'], true), 403);
        $data = $request->validate([
            'title' => ['required', 'string', 'max:140'],
            'description' => ['required', 'string', 'max:5000'],
            'level' => ['required', 'string', 'max:80'],
            'proposal' => [$user->role === 'mentor' ? 'required' : 'nullable', 'file', 'mimes:pdf', 'max:5120'],
        ]);
        $proposal = $request->file('proposal')?->store('course-proposals', 'local');
        abort_if($proposal === false, 500, 'The proposal could not be saved.');
        try {
            $id = DB::table('learning_courses')->insertGetId([
                'title' => $data['title'], 'description' => $data['description'], 'level' => $data['level'],
                'slug' => (Str::slug(Str::limit($data['title'], 100, '')) ?: 'course').'-'.Str::lower(Str::random(10)),
                'status' => $user->role === 'admin' ? 'approved' : 'proposed',
                'author_id' => $user->role === 'mentor' ? $user->id : null, 'proposal_file' => $proposal,
                'created_at' => now(), 'updated_at' => now(),
            ]);
        } catch (Throwable $exception) {
            if ($proposal) {
                Storage::disk('local')->delete($proposal);
            }
            throw $exception;
        }

        return response()->json(['data' => ['id' => $id]], 201);
    }

    public function attachment(Request $request, int $id): StreamedResponse
    {
        $path = $this->accessible($request)->where('id', $id)->value('proposal_file') ?? abort(404);
        abort_unless(Storage::disk('local')->exists($path), 404);

        return Storage::disk('local')->download($path, 'course-proposal.pdf', ['Cache-Control' => 'private, no-store']);
    }

    public function review(Request $request, int $id): JsonResponse
    {
        abort_unless($request->user()->role === 'admin', 403);
        $data = $request->validate([
            'decision' => ['required', 'in:approved,rejected'],
            'note' => ['required_if:decision,rejected', 'nullable', 'string', 'max:1500'],
        ]);
        $changed = DB::table('learning_courses')->where('id', $id)->where('status', 'proposed')->update([
            'status' => $data['decision'], 'review_notes' => $data['note'] ?? null, 'updated_at' => now(),
        ]);
        abort_unless($changed, 409, 'The proposal has already been reviewed.');

        return response()->json(['data' => ['saved' => true]]);
    }

    public function addLesson(Request $request, int $id): JsonResponse
    {
        $data = $request->validate([
            'title' => ['required', 'string', 'max:160'],
            'content' => ['required_without:url', 'nullable', 'string', 'max:10000'],
            'url' => ['required_without:content', 'nullable', 'url:http,https', 'max:500'],
        ]);
        $lesson = DB::transaction(function () use ($request, $id, $data) {
            $course = $this->accessible($request)->where('id', $id)->lockForUpdate()->first() ?? abort(404);
            abort_unless($course->status === 'approved', 409, 'Lessons can be added to approved drafts.');
            $position = DB::table('learning_lessons')->where('course_id', $id)->max('position') + 1;
            if ($position > 500) {
                throw ValidationException::withMessages(['title' => 'A standalone course can contain up to 500 lessons.']);
            }

            return DB::table('learning_lessons')->insertGetId($data + ['course_id' => $id, 'position' => $position]);
        });

        return response()->json(['data' => ['id' => $lesson]], 201);
    }

    public function publish(Request $request, int $id): JsonResponse
    {
        abort_unless($request->user()->role === 'admin', 403);
        $data = $request->validate([
            'price' => ['required', 'integer', 'between:0,1000000'],
            'discount' => ['required', 'integer', 'min:0', 'lte:price'],
            'royalty_rate' => ['required', 'integer', 'between:0,100'],
        ]);
        DB::transaction(function () use ($id, $data) {
            $course = DB::table('learning_courses')->where('id', $id)->lockForUpdate()->first() ?? abort(404);
            abort_unless(in_array($course->status, ['approved', 'published'], true), 409, 'Approve this course first.');
            abort_unless(DB::table('learning_lessons')->where('course_id', $id)->exists(), 409, 'Add a lesson before publishing.');
            if (! $course->author_id) {
                $data['royalty_rate'] = 0;
            }
            DB::table('learning_courses')->where('id', $id)->update($data + ['status' => 'published', 'updated_at' => now()]);
        });

        return response()->json(['data' => ['published' => true]]);
    }

    private function accessible(Request $request): Builder
    {
        $user = $request->user();
        abort_unless(in_array($user->role, ['mentor', 'admin'], true), 403);

        return DB::table('learning_courses')->when($user->role === 'mentor',
            fn (Builder $builder) => $builder->where('author_id', $user->id));
    }
}
