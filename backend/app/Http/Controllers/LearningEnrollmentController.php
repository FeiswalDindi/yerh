<?php

namespace App\Http\Controllers;

use App\Domain\Incubation\PathAccess;
use App\Domain\Learning\CoursePlacements;
use App\Integrations\Moodle\MoodleClient;
use App\Integrations\Moodle\MoodleProgressSync;
use App\Models\User;
use App\Notifications\CourseCertificateIssued;
use App\Notifications\WorkspaceAlert;
use App\Support\WorkspaceNotifier;
use Illuminate\Database\Query\Builder;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Throwable;

final class LearningEnrollmentController extends Controller
{
    public function index(Request $request, CoursePlacements $placements): JsonResponse
    {
        $publicKeys = $placements->publicKeys();
        $courses = $publicKeys === []
            ? collect()
            : DB::table('learning_courses')
                ->where('status', 'published')
                ->whereIn('placement', $publicKeys)
                ->orderByDesc('featured')
                ->orderBy('title')
                ->get(['id', 'slug', 'title', 'description', 'level', 'price', 'discount', 'featured', 'cover_image', 'moodle_course_id']);

        $account = $request->user();
        $enrolments = collect();
        if ($courses->isNotEmpty() && $account && $account->isActive() && $account->hasVerifiedEmail() && $this->canLearn($account)) {
            $enrolments = DB::table('learning_enrolments')
                ->where('learner_id', $account->id)
                ->whereIn('course_id', $courses->pluck('id'))
                ->get(['id', 'course_id', 'payment_status', 'completed_at', 'moodle_progress'])
                ->keyBy('course_id');
        }

        $localCourses = $courses->filter(fn ($course) => empty($course->moodle_course_id))->pluck('id');
        $lessonCounts = $localCourses->isEmpty()
            ? collect()
            : DB::table('learning_lessons')
                ->whereIn('course_id', $localCourses)
                ->groupBy('course_id')
                ->selectRaw('course_id, count(*) as total')
                ->pluck('total', 'course_id');

        $confirmedEnrolmentIds = $enrolments
            ->filter(fn ($row) => $row->payment_status === 'confirmed' && $row->completed_at === null)
            ->pluck('id');
        $completedCounts = $confirmedEnrolmentIds->isEmpty()
            ? collect()
            : DB::table('learning_completions')
                ->whereIn('enrolment_id', $confirmedEnrolmentIds)
                ->groupBy('enrolment_id')
                ->selectRaw('enrolment_id, count(*) as total')
                ->pluck('total', 'enrolment_id');

        $payload = $courses->map(function ($course) use ($enrolments, $lessonCounts, $completedCounts) {
            $enrolment = $enrolments->get($course->id);
            $progress = null;
            if ($enrolment && $enrolment->payment_status === 'confirmed') {
                if ($enrolment->completed_at !== null) {
                    $progress = 100;
                } elseif (! empty($course->moodle_course_id)) {
                    $progress = (int) ($enrolment->moodle_progress ?? 0);
                } else {
                    $total = (int) ($lessonCounts->get($course->id) ?? 0);
                    $done = (int) ($completedCounts->get($enrolment->id) ?? 0);
                    $progress = $total > 0 ? min(100, (int) round(($done / $total) * 100)) : 0;
                }
            }

            $item = Arr::only((array) $course, ['slug', 'title', 'description', 'level', 'price', 'discount', 'featured', 'cover_image', 'moodle_course_id']);
            if ($accountStatus = $enrolment?->payment_status) {
                $item['enrolment_status'] = $accountStatus;
                $item['enrolment_progress'] = $progress;
                $item['enrolment_completed'] = $enrolment->completed_at !== null;
            }

            return $item;
        })->values();

        return response()->json(['data' => $payload])->header('Cache-Control', 'private, no-store');
    }

    public function show(Request $request, string $slug, MoodleClient $moodle, MoodleProgressSync $sync): JsonResponse
    {
        $course = $this->courses()->where('slug', $slug)->first() ?? abort(404);
        $account = $request->user();
        $enrolment = $account && $account->isActive() && $account->hasVerifiedEmail() && $this->canLearn($account)
            ? $this->enrolments($course->id, $account->id)->first() : null;
        $access = $enrolment?->payment_status === 'confirmed';

        if ($access && ! empty($course->moodle_course_id) && $enrolment->completed_at === null && $moodle->isConfigured()) {
            if ($sync->syncEnrolment((int) $enrolment->id) !== null) {
                $enrolment = $this->enrolments($course->id, $account->id)->first() ?? $enrolment;
            }
        }

        $lessons = DB::table('learning_lessons')->where('course_id', $course->id)->orderBy('position')
            ->get($access ? ['id', 'title', 'content', 'url'] : ['id', 'title']);
        $completed = $access ? DB::table('learning_completions')->where('enrolment_id', $enrolment->id)->pluck('lesson_id') : [];
        $launchUrl = ($access && ! empty($course->moodle_course_id) && $moodle->isConfigured())
            ? '/api/v1/learning/moodle/launch?slug='.rawurlencode($course->slug)
            : null;
        $charge = max(0, (int) $course->price - (int) $course->discount);

        $sections = [];
        if (! empty($course->moodle_course_id) && $moodle->isConfigured()) {
            $sections = $moodle->courseContents((int) $course->moodle_course_id);
        }
        if ($sections === [] && $lessons->isNotEmpty()) {
            $sections = $lessons->map(fn ($lesson) => [
                'title' => $lesson->title,
                'summary' => '',
                'activities' => [['name' => $lesson->title, 'type' => 'Lesson']],
            ])->values()->all();
        }
        $overview = $this->courseOverview($sections);

        $enrolmentPayload = null;
        if ($enrolment) {
            $enrolmentPayload = [
                ...Arr::only((array) $enrolment, ['id', 'payment_status', 'payment_reference', 'payment_note', 'completed_at', 'certificate_id', 'moodle_enrolled_at', 'moodle_progress', 'moodle_synced_at']),
                'has_receipt' => ! empty($enrolment->receipt_path),
                'moodle_launch_url' => $launchUrl,
            ];
        }

        return response()->json(['data' => [
            'course' => Arr::only((array) $course, ['slug', 'title', 'description', 'level', 'price', 'discount', 'featured', 'cover_image', 'moodle_course_id']),
            'enrolment' => $enrolmentPayload,
            'lessons' => $lessons,
            'completed' => $completed,
            'overview' => $overview,
            'payment_instructions' => $charge > 0 ? ProgrammePaymentController::resolvedInstructions() : null,
        ]])->header('Cache-Control', 'private, no-store');
    }

    /**
     * @param  list<array{title: string, summary: string, activities: list<array{name: string, type: string}>}>  $sections
     * @return array{estimated_duration: string, module_count: int, activity_count: int, format: string, sections: list<array{title: string, summary: string, activities: list<array{name: string, type: string}>}>}
     */
    private function courseOverview(array $sections): array
    {
        $activityCount = 0;
        $minutes = 0;
        foreach ($sections as $section) {
            foreach ($section['activities'] as $activity) {
                $activityCount++;
                $minutes += match ($activity['type']) {
                    'Quiz' => 20,
                    'Assignment' => 30,
                    'Lesson & Notes', 'Lesson' => 30,
                    default => 15,
                };
            }
            if ($section['activities'] === []) {
                $minutes += 20;
            }
        }

        if ($minutes <= 0) {
            $duration = 'Self-paced';
        } elseif ($minutes < 60) {
            $duration = "Approx. {$minutes} mins";
        } else {
            $hours = round($minutes / 60, 1);
            $label = fmod($hours, 1.0) === 0.0 ? (string) (int) $hours : (string) $hours;
            $duration = "Approx. {$label} ".($hours === 1.0 ? 'hour' : 'hours');
        }

        return [
            'estimated_duration' => $duration,
            'module_count' => count($sections),
            'activity_count' => $activityCount,
            'format' => 'Self-paced online · Certificate on completion',
            'sections' => $sections,
        ];
    }

    public function enrol(Request $request, string $slug, MoodleClient $moodle): JsonResponse
    {
        $account = $request->user();
        abort_unless($this->canLearn($account), 403);
        $data = $request->validate([
            'reference' => ['nullable', 'string', 'max:120'],
            'receipt' => ['nullable', 'file', 'mimes:jpeg,jpg,png,webp,pdf', 'max:5120'],
        ]);
        $receiptFile = $request->file('receipt');
        $storedPath = $receiptFile?->store('course-receipts', 'local');
        abort_if($storedPath === false, 500, 'Could not store the payment receipt.');
        $receiptName = $receiptFile ? mb_substr($receiptFile->getClientOriginalName(), 0, 180) : null;
        $replacedPath = null;

        $paidSubmission = null;
        $moodleSyncTarget = null;
        try {
            DB::transaction(function () use ($account, $slug, $data, $storedPath, $receiptName, &$replacedPath, &$paidSubmission, &$moodleSyncTarget) {
                $course = $this->courses()->where('slug', $slug)->lockForUpdate()->first() ?? abort(404);
                $enrolments = $this->enrolments($course->id, $account->id);
                $previous = (clone $enrolments)->lockForUpdate()->first();
                if ($previous && $previous->payment_status !== 'rejected') {
                    return;
                }
                $price = $course->price - $course->discount;
                $reference = isset($data['reference']) ? trim($data['reference']) : null;
                if ($price > 0 && ! $reference) {
                    throw ValidationException::withMessages(['reference' => 'Enter the transaction reference for this course.']);
                }
                if ($price > 0 && $storedPath === null) {
                    throw ValidationException::withMessages(['receipt' => 'Upload a payment receipt screenshot or PDF.']);
                }
                $values = [
                    'price_paid' => $price, 'royalty_rate' => $course->royalty_rate,
                    'payment_reference' => $price > 0 ? $reference : null,
                    'payment_status' => $price > 0 ? 'pending' : 'confirmed',
                    'payment_note' => null, 'updated_at' => now(),
                ];
                if ($price > 0 && $storedPath !== null) {
                    $values['receipt_path'] = $storedPath;
                    $values['receipt_name'] = $receiptName;
                }
                if ($previous) {
                    if ($price > 0 && $storedPath !== null && $previous->receipt_path) {
                        $replacedPath = $previous->receipt_path;
                    }
                    $enrolments->update($values);
                    $enrolmentId = $previous->id;
                } else {
                    $enrolmentId = DB::table('learning_enrolments')->insertGetId($values + [
                        'course_id' => $course->id, 'learner_id' => $account->id, 'created_at' => now(),
                    ]);
                }
                if ($price > 0) {
                    $paidSubmission = $course->title;
                } elseif (! empty($course->moodle_course_id)) {
                    $moodleSyncTarget = ['enrolment_id' => $enrolmentId, 'moodle_course_id' => (int) $course->moodle_course_id];
                }
            });
        } catch (Throwable $exception) {
            if ($storedPath) {
                Storage::disk('local')->delete($storedPath);
            }
            if ($exception instanceof UniqueConstraintViolationException) {
                throw ValidationException::withMessages(['reference' => 'That transaction reference is already in use for a course.']);
            }
            throw $exception;
        }

        if ($replacedPath) {
            Storage::disk('local')->delete($replacedPath);
        }

        if ($moodleSyncTarget !== null && $moodle->isConfigured()) {
            $this->provisionMoodleEnrolment($moodle, $account, $moodleSyncTarget['moodle_course_id'], $moodleSyncTarget['enrolment_id']);
        }

        if ($paidSubmission !== null) {
            WorkspaceNotifier::notifyAdmins(
                "{$account->name} submitted payment verification for course: {$paidSubmission}.",
                '/dashboard/workspace?tab=payments&view=course-payments',
            );
        }

        return response()->json(['data' => ['saved' => true]]);
    }

    public function complete(Request $request, string $slug, int $lesson): JsonResponse
    {
        abort_unless($this->canLearn($request->user()), 403);
        $complete = DB::transaction(function () use ($request, $slug, $lesson) {
            $course = $this->courses()->where('slug', $slug)->first() ?? abort(404);
            $enrolment = $this->enrolments($course->id, $request->user()->id)->lockForUpdate()->first();
            abort_unless($enrolment?->payment_status === 'confirmed', 403);
            $lessons = DB::table('learning_lessons')->where('course_id', $course->id);
            abort_unless((clone $lessons)->where('id', $lesson)->exists(), 404);
            DB::table('learning_completions')->insertOrIgnore([
                'enrolment_id' => $enrolment->id, 'lesson_id' => $lesson, 'completed_at' => now(),
            ]);
            $complete = DB::table('learning_completions')->where('enrolment_id', $enrolment->id)->count() === $lessons->count();
            if ($complete && ! $enrolment->completed_at) {
                DB::table('learning_enrolments')->where('id', $enrolment->id)->update(['completed_at' => now(), 'updated_at' => now()]);
            }

            return $complete;
        });

        return response()->json(['data' => ['completed' => $complete]]);
    }

    public function registry(Request $request): JsonResponse
    {
        abort_unless($request->user()->role === 'admin', 403);

        $rows = $this->records()->latest('enrolment.updated_at')->get([
            'enrolment.*', 'recipient.name as learner', 'course.title as course',
        ])->map(function ($row) {
            $row->has_receipt = ! empty($row->receipt_path);
            unset($row->receipt_path);

            return $row;
        });

        return response()->json(['data' => $rows])->header('Cache-Control', 'no-store');
    }

    public function receipt(Request $request, int $id): StreamedResponse
    {
        $actor = $request->user();
        $enrolment = DB::table('learning_enrolments')->where('id', $id)->first(['learner_id', 'receipt_path', 'receipt_name']) ?? abort(404);
        abort_unless($actor->role === 'admin' || (int) $enrolment->learner_id === $actor->id, 403);
        abort_unless($enrolment->receipt_path && Storage::disk('local')->exists($enrolment->receipt_path), 404);

        return Storage::disk('local')->response($enrolment->receipt_path, $enrolment->receipt_name ?: 'course-receipt', [
            'X-Content-Type-Options' => 'nosniff',
            'Cache-Control' => 'private, no-store',
        ]);
    }

    public function launchMoodle(Request $request, MoodleClient $moodle, PathAccess $access): RedirectResponse|JsonResponse
    {
        $actor = $request->user();
        abort_unless($moodle->isConfigured(), 422, 'Moodle integration is not configured.');

        $respond = static function (string $url) use ($request): RedirectResponse|JsonResponse {
            if ($request->query('format') === 'json') {
                return response()
                    ->json(['data' => ['url' => $url]])
                    ->header('Cache-Control', 'no-store');
            }

            return redirect()->away($url);
        };

        if ($request->filled('slug')) {
            $slug = trim((string) $request->query('slug'));
            $course = $this->courses()->where('slug', $slug)->first() ?? abort(404);
            abort_unless(! empty($course->moodle_course_id), 409, 'This course is not linked to Moodle.');

            if ($actor->role !== 'admin') {
                abort_unless($this->canLearn($actor), 403);
                $enrolment = $this->enrolments($course->id, $actor->id)->first();
                abort_unless($enrolment?->payment_status === 'confirmed', 403);
            }

            $moodleUserId = $moodle->ensureUser($actor);
            if ($actor->role === 'admin') {
                $moodle->enrolMentor($moodleUserId, (int) $course->moodle_course_id);
            } else {
                $moodle->enrolUser($moodleUserId, (int) $course->moodle_course_id);
            }

            return $respond($moodle->signedLaunchUrl($moodleUserId, (int) $course->moodle_course_id));
        }

        if ($request->filled('path')) {
            $pathId = (int) $request->query('path');
            abort_if($pathId < 1, 404);
            $path = $access->find($actor, $pathId);
            abort_unless(! empty($path->moodle_course_id), 409, 'This pathway is not linked to a Moodle course.');

            $moodleUserId = $moodle->ensureUser($actor);
            if ($actor->role === 'entrepreneur') {
                $moodle->enrolUser($moodleUserId, (int) $path->moodle_course_id);
            } else {
                $moodle->enrolMentor($moodleUserId, (int) $path->moodle_course_id);
            }
            if (! empty($path->moodle_group_id)) {
                $moodle->addGroupMembers((int) $path->moodle_group_id, [$moodleUserId]);
            }

            return $respond($moodle->signedLaunchUrl($moodleUserId, (int) $path->moodle_course_id));
        }

        if ($request->boolean('school_guide')) {
            $hasSchoolAccess = $actor->role === 'admin'
                || DB::table('institution_access as access')
                    ->join('institutions as institution', 'institution.id', '=', 'access.institution_id')
                    ->where('access.user_id', $actor->id)
                    ->where('institution.kind', 'high-school')
                    ->where('institution.status', 'active')
                    ->whereIn('access.access', ['view', 'manage'])
                    ->exists();
            abort_unless($hasSchoolAccess, 403);

            $guideCourseId = DB::table('learning_courses')
                ->where('status', 'published')
                ->where(fn ($query) => $query->where('slug', 'high-school-facilitator-guide')
                    ->orWhere('moodle_shortname', 'YERH-SCHOOL-GUIDE'))
                ->value('moodle_course_id');
            abort_unless(! empty($guideCourseId), 404, 'The High School Facilitator Guide is not linked to Moodle yet.');

            $moodleUserId = $moodle->ensureUser($actor);
            if ($actor->role === 'admin') {
                $moodle->enrolMentor($moodleUserId, (int) $guideCourseId);
            } else {
                $moodle->enrolUser($moodleUserId, (int) $guideCourseId);
            }

            return $respond($moodle->signedLaunchUrl($moodleUserId, (int) $guideCourseId));
        }

        $moodleUserId = $moodle->ensureUser($actor);
        $isAdmin = $actor->role === 'admin';

        return $respond($moodle->signedLaunchUrl(
            $moodleUserId,
            null,
            $isAdmin ? 'admin' : 'courses',
            allowAdmin: $isAdmin,
        ));
    }

    public function syncProgress(Request $request, string $slug, MoodleClient $moodle, MoodleProgressSync $sync): JsonResponse
    {
        $actor = $request->user();
        abort_unless($this->canLearn($actor) || $actor->role === 'admin', 403);
        $course = $this->courses()->where('slug', $slug)->first() ?? abort(404);
        abort_unless($course->moodle_course_id, 409, 'This course is not linked to Moodle.');
        abort_unless($moodle->isConfigured(), 422, 'Moodle integration is not configured.');

        $learnerId = $actor->role === 'admin'
            ? (int) ($request->validate(['learner_id' => ['required', 'integer', 'min:1']])['learner_id'])
            : $actor->id;

        $enrolment = $this->enrolments($course->id, $learnerId)->first();
        abort_unless($enrolment?->payment_status === 'confirmed', 403);

        $progress = $sync->syncEnrolment((int) $enrolment->id, force: true);
        if ($progress === null) {
            abort(502, 'Could not sync progress from Moodle.');
        }

        $completedAt = DB::table('learning_enrolments')->where('id', $enrolment->id)->value('completed_at');

        return response()->json([
            'data' => [
                'progress' => $progress['progress'],
                'completed' => $progress['completed'],
                'score' => $progress['score'],
                'completed_at' => $completedAt,
            ],
        ]);
    }

    public function reviewPayment(Request $request, int $id, MoodleClient $moodle): JsonResponse
    {
        abort_unless($request->user()->role === 'admin', 403);
        $data = $request->validate([
            'decision' => ['required', 'in:confirmed,rejected'],
            'note' => ['required_if:decision,rejected', 'nullable', 'string', 'max:1500'],
        ]);
        $row = DB::table('learning_enrolments as e')
            ->join('learning_courses as c', 'c.id', '=', 'e.course_id')
            ->where('e.id', $id)
            ->where('e.payment_status', 'pending')
            ->first(['e.id', 'e.learner_id', 'c.title', 'c.slug', 'c.moodle_course_id']);
        abort_unless($row, 409, 'This payment is no longer awaiting review.');

        $updated = DB::table('learning_enrolments')->where('id', $id)->where('payment_status', 'pending')->update([
            'payment_status' => $data['decision'], 'payment_note' => $data['note'] ?? null, 'updated_at' => now(),
        ]);
        abort_unless($updated, 409, 'This payment is no longer awaiting review.');

        if ($data['decision'] === 'confirmed' && ! empty($row->moodle_course_id) && $moodle->isConfigured()) {
            $learner = User::query()->find($row->learner_id);
            if ($learner) {
                $this->provisionMoodleEnrolment($moodle, $learner, (int) $row->moodle_course_id, (int) $row->id);
            }
        }

        User::query()->find($row->learner_id)?->notify(new WorkspaceAlert(
            $data['decision'] === 'confirmed'
                ? "Your payment for {$row->title} was confirmed. You can now open the lessons."
                : "Your payment for {$row->title} was declined.".(! empty($data['note']) ? ' Note: '.$data['note'] : ''),
            '/learn/'.$row->slug,
        ));

        return response()->json(['data' => ['saved' => true]]);
    }

    private function provisionMoodleEnrolment(MoodleClient $moodle, User $learner, int $moodleCourseId, int $enrolmentId): void
    {
        try {
            $moodleUserId = $moodle->ensureUser($learner);
            $moodle->enrolUser($moodleUserId, $moodleCourseId);
            $now = now();
            DB::table('learning_enrolments')->where('id', $enrolmentId)->update([
                'moodle_enrolled_at' => $now,
                'updated_at' => $now,
            ]);
        } catch (Throwable $exception) {
            Log::warning('Moodle course enrolment sync failed.', [
                'enrolment_id' => $enrolmentId,
                'moodle_course_id' => $moodleCourseId,
                'user_id' => $learner->id,
                'error' => $exception->getMessage(),
            ]);
        }
    }

    public function issueCertificate(Request $request, int $id): JsonResponse
    {
        abort_unless($request->user()->role === 'admin', 403);
        $certificate = DB::transaction(function () use ($id) {
            $enrolment = DB::table('learning_enrolments')->where('id', $id)->lockForUpdate()->first() ?? abort(404);
            abort_unless($enrolment->completed_at && $enrolment->payment_status === 'confirmed', 409, 'The course must be completed first.');
            if ($enrolment->certificate_id) {
                return $enrolment->certificate_id;
            }
            $certificate = Str::uuid()->toString();
            DB::table('learning_enrolments')->where('id', $id)->update([
                'certificate_id' => $certificate, 'issued_at' => now(), 'updated_at' => now(),
            ]);
            $title = DB::table('learning_courses')->where('id', $enrolment->course_id)->value('title');
            User::query()->findOrFail($enrolment->learner_id)->notify(new CourseCertificateIssued(
                $title, route('learning.certificate', ['document' => $certificate]),
            ));

            return $certificate;
        });

        return response()->json(['data' => ['certificate_id' => $certificate]]);
    }

    public function document(Request $request, string $document): Response
    {
        $query = $this->records()->where('enrolment.certificate_id', $document);
        if ($request->user()->role !== 'admin') {
            $query->where('enrolment.learner_id', $request->user()->id);
        }
        $record = $query->first([
            'enrolment.issued_at', 'enrolment.certificate_id as document_id', 'recipient.name as recipient',
            'course.title as activity',
        ]) ?? abort(404);
        $record->citation = 'For completing '.$record->activity.'.';

        return response()->view('venture-certificate', [
            'title' => 'Course Completion Certificate', 'record' => $record, 'achievements' => [$record->activity],
        ])->header('Cache-Control', 'private, no-store');
    }

    private function canLearn(User $account): bool
    {
        return in_array($account->role, ['guest', 'entrepreneur'], true);
    }

    private function courses(): Builder
    {
        return DB::table('learning_courses')->where('status', 'published');
    }

    private function enrolments(int $course, int $learner): Builder
    {
        return DB::table('learning_enrolments')->where('course_id', $course)->where('learner_id', $learner);
    }

    private function records(): Builder
    {
        return DB::table('learning_enrolments as enrolment')
            ->join('learning_courses as course', 'course.id', '=', 'enrolment.course_id')
            ->join('users as recipient', 'recipient.id', '=', 'enrolment.learner_id');
    }
}
