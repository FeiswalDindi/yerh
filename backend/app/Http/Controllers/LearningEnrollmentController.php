<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Notifications\CourseCertificateIssued;
use App\Notifications\WorkspaceAlert;
use App\Support\WorkspaceNotifier;
use Illuminate\Database\Query\Builder;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Throwable;

final class LearningEnrollmentController extends Controller
{
    public function index(): JsonResponse
    {
        $courses = DB::table('learning_courses')
            ->where('status', 'published')
            ->where('placement', 'public')
            ->orderByDesc('featured')
            ->orderBy('title')
            ->get(['slug', 'title', 'description', 'level', 'price', 'discount', 'featured', 'cover_image']);

        return response()->json(['data' => $courses]);
    }

    public function show(Request $request, string $slug): JsonResponse
    {
        $course = $this->courses()->where('slug', $slug)->first() ?? abort(404);
        $account = $request->user();
        $enrolment = $account && $account->isActive() && $account->hasVerifiedEmail() && $this->canLearn($account)
            ? $this->enrolments($course->id, $account->id)->first() : null;
        $access = $enrolment?->payment_status === 'confirmed';
        $lessons = DB::table('learning_lessons')->where('course_id', $course->id)->orderBy('position')
            ->get($access ? ['id', 'title', 'content', 'url'] : ['id', 'title']);
        $completed = $access ? DB::table('learning_completions')->where('enrolment_id', $enrolment->id)->pluck('lesson_id') : [];

        return response()->json(['data' => [
            'course' => Arr::only((array) $course, ['slug', 'title', 'description', 'level', 'price', 'discount', 'featured', 'cover_image']),
            'enrolment' => $enrolment ? Arr::only((array) $enrolment, ['payment_status', 'payment_note', 'completed_at', 'certificate_id']) : null,
            'lessons' => $lessons, 'completed' => $completed,
        ]])->header('Cache-Control', 'private, no-store');
    }

    public function enrol(Request $request, string $slug): JsonResponse
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
        try {
            DB::transaction(function () use ($account, $slug, $data, $storedPath, $receiptName, &$replacedPath, &$paidSubmission) {
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
                } else {
                    DB::table('learning_enrolments')->insert($values + [
                        'course_id' => $course->id, 'learner_id' => $account->id, 'created_at' => now(),
                    ]);
                }
                if ($price > 0) {
                    $paidSubmission = $course->title;
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

        if ($paidSubmission !== null) {
            WorkspaceNotifier::notifyAdmins(
                "{$account->name} submitted payment verification for course: {$paidSubmission}.",
                '/dashboard/certificates?tab=courses',
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

    public function reviewPayment(Request $request, int $id): JsonResponse
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
            ->first(['e.id', 'e.learner_id', 'c.title', 'c.slug']);
        abort_unless($row, 409, 'This payment is no longer awaiting review.');

        $updated = DB::table('learning_enrolments')->where('id', $id)->where('payment_status', 'pending')->update([
            'payment_status' => $data['decision'], 'payment_note' => $data['note'] ?? null, 'updated_at' => now(),
        ]);
        abort_unless($updated, 409, 'This payment is no longer awaiting review.');

        User::query()->find($row->learner_id)?->notify(new WorkspaceAlert(
            $data['decision'] === 'confirmed'
                ? "Your payment for {$row->title} was confirmed. You can now open the lessons."
                : "Your payment for {$row->title} was declined.".(! empty($data['note']) ? ' Note: '.$data['note'] : ''),
            '/learn/'.$row->slug,
        ));

        return response()->json(['data' => ['saved' => true]]);
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
