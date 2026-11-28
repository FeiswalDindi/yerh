<?php

namespace App\Http\Controllers;

use App\Domain\Learning\CoursePlacements;
use App\Integrations\Moodle\MoodleClient;
use App\Support\WorkspaceNotifier;
use Illuminate\Database\Query\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Throwable;

final class CourseAuthoringController extends Controller
{
    public function index(Request $request, MoodleClient $moodle, CoursePlacements $placements): JsonResponse
    {
        $rows = $this->accessible($request)
            ->leftJoin('users as author', 'author.id', '=', 'learning_courses.author_id')
            ->latest('learning_courses.updated_at')
            ->get([
                'learning_courses.id',
                'learning_courses.slug',
                'learning_courses.title',
                'learning_courses.description',
                'learning_courses.level',
                'learning_courses.price',
                'learning_courses.discount',
                'learning_courses.status',
                'learning_courses.review_notes',
                'learning_courses.royalty_rate',
                'learning_courses.author_id',
                'author.name as author_name',
                'author.role as author_role',
                'learning_courses.moodle_course_id',
                'learning_courses.moodle_shortname',
                'learning_courses.placement',
                'learning_courses.featured',
                'learning_courses.institution_id',
                'learning_courses.cover_image',
                'learning_courses.moodle_synced_at',
                DB::raw('CASE WHEN learning_courses.proposal_file IS NULL THEN 0 ELSE 1 END as has_attachment'),
            ]);
        $courseIds = $rows->pluck('id');
        $lessons = DB::table('learning_lessons')->whereIn('course_id', $courseIds)->orderBy('position')->get(['id', 'course_id', 'title']);
        $royalties = DB::table('learning_enrolments')
            ->whereIn('course_id', $courseIds)
            ->groupBy('course_id')
            ->selectRaw(
                "course_id,
                sum(case when payment_status = 'confirmed' then 1 else 0 end) as enrolments,
                sum(case when payment_status = 'confirmed' then price_paid else 0 end) as gross_revenue,
                sum(case when payment_status = 'confirmed' then price_paid * royalty_rate else 0 end) / 100.0 as accrued,
                sum(case when payment_status = 'pending' then 1 else 0 end) as pending_enrolments,
                sum(case when payment_status = 'pending' then price_paid * royalty_rate else 0 end) / 100.0 as pending_accrued"
            )
            ->get();

        $ledger = $courseIds->isEmpty()
            ? collect()
            : DB::table('learning_enrolments as e')
                ->join('learning_courses as c', 'c.id', '=', 'e.course_id')
                ->join('users as learner', 'learner.id', '=', 'e.learner_id')
                ->leftJoin('users as author', 'author.id', '=', 'c.author_id')
                ->whereIn('e.course_id', $courseIds)
                ->orderByDesc('e.updated_at')
                ->limit(200)
                ->get([
                    'e.id',
                    'e.course_id',
                    'c.title as course_title',
                    'c.author_id',
                    'author.name as author_name',
                    'learner.name as learner_name',
                    'e.payment_status',
                    'e.price_paid',
                    'e.royalty_rate',
                    'e.created_at',
                    'e.updated_at',
                ])
                ->map(static fn ($entry) => [
                    'id' => (int) $entry->id,
                    'course_id' => (int) $entry->course_id,
                    'course_title' => $entry->course_title,
                    'author_id' => $entry->author_id ? (int) $entry->author_id : null,
                    'author_name' => $entry->author_name,
                    'learner_name' => $entry->learner_name,
                    'payment_status' => $entry->payment_status,
                    'price_paid' => (int) $entry->price_paid,
                    'royalty_rate' => (int) $entry->royalty_rate,
                    'royalty_amount' => round(((int) $entry->price_paid * (int) $entry->royalty_rate) / 100, 2),
                    'created_at' => $entry->created_at,
                    'updated_at' => $entry->updated_at,
                ])
                ->values();

        $earningsSummary = [
            'total_courses' => $rows->count(),
            'published_courses' => $rows->where('status', 'published')->count(),
            'confirmed_enrolments' => (int) $royalties->sum('enrolments'),
            'pending_enrolments' => (int) $royalties->sum('pending_enrolments'),
            'gross_revenue' => round((float) $royalties->sum('gross_revenue'), 2),
            'accrued_royalties' => round((float) $royalties->sum('accrued'), 2),
            'pending_royalties' => round((float) $royalties->sum('pending_accrued'), 2),
        ];

        $mentors = $request->user()->role === 'admin'
            ? DB::table('users')
                ->where('role', 'mentor')
                ->whereNull('suspended_at')
                ->whereNotNull('email_verified_at')
                ->orderBy('name')
                ->get(['id', 'name', 'email'])
            : collect();

        return response()->json([
            'data' => [
                'rows' => $rows,
                'lessons' => $lessons,
                'royalties' => $royalties,
                'ledger' => $ledger,
                'earnings_summary' => $earningsSummary,
                'mentors' => $mentors,
                'placements' => $placements->all(),
                'moodle' => [
                    'configured' => $moodle->isConfigured(),
                    'url' => $moodle->siteUrl(),
                ],
            ],
        ])->header('Cache-Control', 'no-store');
    }

    public function placements(Request $request, CoursePlacements $placements): JsonResponse
    {
        abort_unless(in_array($request->user()->role, ['mentor', 'partner', 'admin'], true), 403);

        return response()->json(['data' => $placements->all()])->header('Cache-Control', 'no-store');
    }

    public function updatePlacements(Request $request, CoursePlacements $placements): JsonResponse
    {
        abort_unless($request->user()->role === 'admin', 403);
        $data = $request->validate([
            'placements' => ['required', 'array', 'min:1', 'max:24'],
            'placements.*.key' => ['nullable', 'string', 'max:40'],
            'placements.*.label' => ['required', 'string', 'max:80'],
            'placements.*.description' => ['nullable', 'string', 'max:300'],
            'placements.*.visible_on_public_learn' => ['boolean'],
            'placements.*.auto_attach_incubation' => ['boolean'],
            'placements.*.institution_scoped' => ['boolean'],
            'placements.*.is_draft' => ['boolean'],
        ]);

        return response()->json([
            'data' => $placements->save($data['placements'], $request->user()->id),
        ])->header('Cache-Control', 'no-store');
    }

    public function syncMoodle(Request $request, MoodleClient $moodle): JsonResponse
    {
        abort_unless($request->user()->role === 'admin', 403);
        abort_unless($moodle->isConfigured(), 422, 'Configure MOODLE_URL and MOODLE_TOKEN before syncing.');

        $courses = $moodle->listCourses();
        $created = 0;
        $updated = 0;

        DB::transaction(function () use ($courses, &$created, &$updated): void {
            $now = now();
            foreach ($courses as $course) {
                $existing = DB::table('learning_courses')
                    ->where('moodle_course_id', $course['id'])
                    ->lockForUpdate()
                    ->first();

                $title = Str::limit($course['fullname'], 140, '');
                $description = Str::limit($course['summary'], 5000, '');
                $shortname = Str::limit($course['shortname'], 120, '');

                if ($existing) {
                    DB::table('learning_courses')->where('id', $existing->id)->update([
                        'title' => $title,
                        'description' => $description,
                        'moodle_shortname' => $shortname,
                        'moodle_category_id' => $course['categoryid'],
                        'moodle_synced_at' => $now,
                        'updated_at' => $now,
                    ]);
                    $updated++;
                } else {
                    $slugBase = Str::slug(Str::limit($course['shortname'], 90, '')) ?: 'moodle-course';
                    DB::table('learning_courses')->insert([
                        'slug' => $slugBase.'-'.Str::lower(Str::random(8)),
                        'title' => $title,
                        'description' => $description,
                        'level' => 'Moodle',
                        'price' => 0,
                        'discount' => 0,
                        'royalty_rate' => 0,
                        'status' => 'approved',
                        'placement' => 'draft',
                        'moodle_course_id' => $course['id'],
                        'moodle_shortname' => $shortname,
                        'moodle_category_id' => $course['categoryid'],
                        'cover_image' => $course['cover_image'] ? Str::limit($course['cover_image'], 500, '') : null,
                        'moodle_synced_at' => $now,
                        'created_at' => $now,
                        'updated_at' => $now,
                    ]);
                    $created++;
                }
            }
        });

        return response()->json([
            'data' => [
                'synced' => count($courses),
                'created' => $created,
                'updated' => $updated,
            ],
        ]);
    }

    public function propose(Request $request): JsonResponse
    {
        $user = $request->user();
        $isProposer = in_array($user->role, ['mentor', 'partner'], true);
        abort_unless($isProposer || $user->role === 'admin', 403);
        $data = $request->validate([
            'title' => ['required', 'string', 'max:140'],
            'description' => ['required', 'string', 'max:5000'],
            'level' => ['required', 'string', 'max:80'],
            'proposal' => [$isProposer ? 'required' : 'nullable', 'file', 'mimes:pdf', 'max:5120'],
        ]);
        $proposal = $request->file('proposal')?->store('course-proposals', 'local');
        abort_if($proposal === false, 500, 'The proposal could not be saved.');
        try {
            $id = DB::table('learning_courses')->insertGetId([
                'title' => $data['title'], 'description' => $data['description'], 'level' => $data['level'],
                'slug' => (Str::slug(Str::limit($data['title'], 100, '')) ?: 'course').'-'.Str::lower(Str::random(10)),
                'status' => $user->role === 'admin' ? 'approved' : 'proposed',
                'author_id' => $isProposer ? $user->id : null, 'proposal_file' => $proposal,
                'created_at' => now(), 'updated_at' => now(),
            ]);
        } catch (Throwable $exception) {
            if ($proposal) {
                Storage::disk('local')->delete($proposal);
            }
            throw $exception;
        }

        if ($isProposer) {
            WorkspaceNotifier::notifyAdmins(
                "{$user->name} proposed a new course: {$data['title']}.",
                '/dashboard/workspace?tab=approvals&view=courses',
            );
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
        $course = DB::table('learning_courses')->where('id', $id)->where('status', 'proposed')->first(['author_id', 'title']);
        abort_unless($course, 409, 'The proposal has already been reviewed.');

        $changed = DB::table('learning_courses')->where('id', $id)->where('status', 'proposed')->update([
            'status' => $data['decision'], 'review_notes' => $data['note'] ?? null, 'updated_at' => now(),
        ]);
        abort_unless($changed, 409, 'The proposal has already been reviewed.');

        if ($course->author_id) {
            $noteSuffix = ! empty($data['note']) ? ' Note: '.$data['note'] : '';
            WorkspaceNotifier::notifyUser(
                (int) $course->author_id,
                "Your course proposal \"{$course->title}\" was {$data['decision']}.{$noteSuffix}",
                '/dashboard/workspace?tab=courses',
            );
        }

        return response()->json(['data' => ['saved' => true]]);
    }

    public function addLesson(Request $request, int $id): JsonResponse
    {
        abort_unless(in_array($request->user()->role, ['mentor', 'admin'], true), 403, 'Partners can submit course proposals only.');
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

    public function publish(Request $request, int $id, CoursePlacements $placements): JsonResponse
    {
        abort_unless($request->user()->role === 'admin', 403);
        $data = $request->validate([
            'price' => ['required', 'integer', 'between:0,1000000'],
            'discount' => ['required', 'integer', 'min:0', 'lte:price'],
            'royalty_rate' => ['required', 'integer', 'between:0,100'],
            'author_id' => ['sometimes', 'nullable', 'integer', 'exists:users,id'],
            'placement' => ['sometimes', Rule::in($placements->keys())],
            'featured' => ['sometimes', 'boolean'],
            'institution_id' => ['nullable', 'integer', 'exists:institutions,id'],
            'cover_image' => ['nullable', 'string', 'max:500'],
        ]);
        $published = DB::transaction(function () use ($id, $data, $placements) {
            $course = DB::table('learning_courses')->where('id', $id)->lockForUpdate()->first() ?? abort(404);
            abort_unless(in_array($course->status, ['approved', 'published'], true), 409, 'Approve this course first.');
            $hasLessons = DB::table('learning_lessons')->where('course_id', $id)->exists();
            abort_unless($course->moodle_course_id !== null || $hasLessons, 409, 'Add a lesson before publishing.');

            if (array_key_exists('author_id', $data)) {
                if ($data['author_id'] !== null) {
                    $validMentor = DB::table('users')
                        ->where('id', $data['author_id'])
                        ->whereIn('role', ['mentor', 'partner'])
                        ->whereNull('suspended_at')
                        ->whereNotNull('email_verified_at')
                        ->exists();
                    if (! $validMentor) {
                        throw ValidationException::withMessages([
                            'author_id' => 'Select an active verified mentor or partner account for royalties.',
                        ]);
                    }
                    $effectiveAuthorId = (int) $data['author_id'];
                } else {
                    $effectiveAuthorId = null;
                }
            } else {
                $effectiveAuthorId = $course->author_id ? (int) $course->author_id : null;
            }

            if (! $effectiveAuthorId) {
                $data['royalty_rate'] = 0;
            }
            $placement = $data['placement']
                ?? ($course->placement && ! $placements->isDraft($course->placement) ? $course->placement : 'public');
            $update = [
                'price' => $data['price'],
                'discount' => $data['discount'],
                'royalty_rate' => $data['royalty_rate'],
                'placement' => $placement,
                'featured' => array_key_exists('featured', $data) ? (bool) $data['featured'] : (bool) ($course->featured ?? false),
                'status' => $placements->isDraft($placement) ? 'approved' : 'published',
                'updated_at' => now(),
            ];
            if (array_key_exists('author_id', $data)) {
                $update['author_id'] = $effectiveAuthorId;
            }
            if (array_key_exists('institution_id', $data)) {
                $update['institution_id'] = $data['institution_id'];
            }
            if (array_key_exists('cover_image', $data)) {
                $update['cover_image'] = $data['cover_image'];
            }
            DB::table('learning_courses')->where('id', $id)->update($update);

            return [
                'title' => $course->title,
                'author_id' => $effectiveAuthorId,
                'royalty_rate' => (int) $data['royalty_rate'],
                'net_price' => max(0, (int) $data['price'] - (int) $data['discount']),
            ];
        });

        if ($published['author_id']) {
            $royaltyNote = $published['royalty_rate'] > 0
                ? " Assigned royalty: {$published['royalty_rate']}% (net price KES ".number_format($published['net_price']).').'
                : '';
            WorkspaceNotifier::notifyUser(
                (int) $published['author_id'],
                "Your course \"{$published['title']}\" has been published.{$royaltyNote}",
                '/dashboard/workspace?tab=earnings',
            );
        }

        return response()->json(['data' => ['published' => true]]);
    }

    private function accessible(Request $request): Builder
    {
        $user = $request->user();
        abort_unless(in_array($user->role, ['mentor', 'partner', 'admin'], true), 403);

        return DB::table('learning_courses')->when(in_array($user->role, ['mentor', 'partner'], true),
            fn (Builder $builder) => $builder->where('learning_courses.author_id', $user->id));
    }
}
