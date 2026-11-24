<?php

namespace App\Http\Controllers;

use App\Domain\Incubation\Curriculum;
use App\Domain\Incubation\PathAccess;
use App\Models\User;
use App\Notifications\WorkspaceAlert;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Throwable;

final class IncubationStageController extends Controller
{
    public function __construct(private readonly PathAccess $access, private readonly Curriculum $curriculum) {}

    public function update(Request $request, int $id, string $stage, string $action): JsonResponse
    {
        $definition = $this->curriculum->stage($stage);
        $attachmentRule = ['nullable', 'file', 'mimes:pdf,ppt,pptx,doc,docx,xls,xlsx,jpg,jpeg,png,webp', 'max:8192'];
        $data = $request->validate(match ($action) {
            'evidence' => [
                'step' => ['required', Rule::in(array_column($definition['steps'], 'id'))],
                'body' => ['required', 'string', 'min:10', 'max:5000'],
                'request_feedback' => ['sometimes', 'boolean'],
                'attachment' => $attachmentRule,
                'remove_attachment' => ['sometimes', 'boolean'],
            ],
            'feedback' => [
                'step' => ['required', Rule::in(array_column($definition['steps'], 'id'))],
                'note' => ['required', 'string', 'min:5', 'max:2000'],
            ],
            'meeting' => ['meeting_at' => ['required', 'date'], 'location' => ['required', 'string', 'max:240']],
            'open-exam', 'reopen-exam', 'approve-progression', 'revise' => ['note' => ['required', 'string', 'min:5', 'max:2000']],
            'submit' => ['answer' => ['required', 'string', 'min:10', 'max:8000'], 'attachment' => $attachmentRule],
            'grade' => ['score' => ['required', 'integer', 'between:0,100'], 'note' => ['required', 'string', 'min:5', 'max:2000']],
            'request-review' => [],
            default => abort(404),
        });

        $uploadedFile = in_array($action, ['evidence', 'submit'], true) ? $request->file('attachment') : null;
        $uploadedPath = $uploadedFile?->store($action === 'evidence' ? 'incubation-evidence' : 'incubation-exams', 'local');
        abort_if($uploadedPath === false, 500, 'Could not store the uploaded attachment.');
        $uploadedName = $uploadedFile ? mb_substr($uploadedFile->getClientOriginalName(), 0, 180) : null;
        $obsoletePaths = [];

        try {
            $notification = DB::transaction(function () use ($request, $id, $definition, $stage, $action, $data, $uploadedPath, $uploadedName, &$obsoletePaths) {
                $actor = $request->user();
                $path = $this->access->find($actor, $id, lock: true);
                $ownerAction = in_array($action, ['evidence', 'request-review', 'submit'], true);
                abort_unless($ownerAction
                    ? $actor->role === 'entrepreneur' && (int) $path->owner_id === $actor->id
                    : $actor->role === 'mentor' && (int) $path->mentor_id === $actor->id, 403);
                abort_unless($path->venture_status === 'approved', 409, 'This venture must be approved before progressing.');
                abort_unless($path->institution_status === 'active', 409, 'The affiliated institution is not active.');
                abort_unless($path->mentor_id, 409, 'A platform administrator must assign a mentor.');
                abort_unless($this->access->completed($id, $this->curriculum->prerequisites($stage)), 409, 'Pass the previous stage first.');

                $key = ['path_id' => $id, 'stage' => $stage];
                $work = DB::table('incubation_stages')->where($key)->first();
                if (! $work) {
                    abort_unless($action === 'evidence', 409, 'Save the required stage evidence first.');
                    $workId = DB::table('incubation_stages')->insertGetId([...$key, 'attempt' => 1, 'created_at' => now(), 'updated_at' => now()]);
                    $work = DB::table('incubation_stages')->where('id', $workId)->first();
                }

                $evidence = DB::table('incubation_evidence')->where('stage_id', $work->id);
                $stagePassed = $work->graded_at !== null
                    && ($work->passed === true || $work->passed === 1 || ($work->passed === null && (int) $work->score >= Curriculum::PASS_MARK));
                $failed = $work->graded_at !== null && ! $stagePassed;
                $notify = null;

                switch ($action) {
                    case 'evidence':
                        abort_if($work->review_requested_at || $work->exam_opened_at, 409, 'This stage is under review.');
                        $step = ['stage_id' => $work->id, 'step_key' => $data['step']];
                        $existingEvidence = DB::table('incubation_evidence')->where($step)->lockForUpdate()->first();
                        $removeAttachment = (bool) ($data['remove_attachment'] ?? false);
                        $nextAttachmentPath = $existingEvidence?->attachment_path ?? null;
                        $nextAttachmentName = $existingEvidence?->attachment_name ?? null;

                        if ($uploadedPath !== null) {
                            if ($nextAttachmentPath) {
                                $obsoletePaths[] = $nextAttachmentPath;
                            }
                            $nextAttachmentPath = $uploadedPath;
                            $nextAttachmentName = $uploadedName;
                        } elseif ($removeAttachment) {
                            if ($nextAttachmentPath) {
                                $obsoletePaths[] = $nextAttachmentPath;
                            }
                            $nextAttachmentPath = null;
                            $nextAttachmentName = null;
                        }

                        DB::table('incubation_evidence')->upsert([[
                            ...$step,
                            'body' => $data['body'],
                            'feedback_requested' => $data['request_feedback'] ?? false,
                            'attachment_path' => $nextAttachmentPath,
                            'attachment_name' => $nextAttachmentName,
                            'created_at' => now(),
                            'updated_at' => now(),
                        ]], ['stage_id', 'step_key'], ['body', 'feedback_requested', 'attachment_path', 'attachment_name', 'updated_at']);

                        return null;
                    case 'feedback':
                        $given = $evidence->where('step_key', $data['step'])->where('feedback_requested', true)
                            ->update(['feedback' => $data['note'], 'feedback_requested' => false, 'updated_at' => now()]);
                        abort_unless($given, 409, 'This step has no pending feedback request.');

                        return [
                            'user_id' => (int) $path->owner_id,
                            'message' => "Your mentor left feedback on {$definition['title']} for {$path->venture}.",
                            'url' => '/dashboard/workspace?tab=incubation&path='.$id,
                        ];
                    case 'request-review':
                        abort_if($work->review_requested_at || $work->exam_opened_at, 409, 'The stage review is already open.');
                        abort_unless($evidence->count() === count($definition['steps']), 409, 'Save evidence for every required step.');
                        $changes = ['review_requested_at' => now(), 'meeting_note' => null];
                        $notify = [
                            'user_id' => (int) $path->mentor_id,
                            'message' => "{$path->owner} requested stage review for {$path->venture} ({$definition['title']}).",
                            'url' => '/dashboard/workspace?tab=incubation&path='.$id,
                        ];
                        break;
                    case 'meeting':
                        abort_unless($work->review_requested_at && ! $work->exam_opened_at, 409, 'Choose a stage that is awaiting review.');
                        $changes = ['meeting_at' => now()->parse($data['meeting_at'])->utc(), 'meeting_location' => $data['location']];
                        $notify = [
                            'user_id' => (int) $path->owner_id,
                            'message' => "Your mentor scheduled a review meeting for {$definition['title']} ({$path->venture}).",
                            'url' => '/dashboard/workspace?tab=incubation&path='.$id,
                        ];
                        break;
                    case 'open-exam':
                        abort_unless($work->review_requested_at && $work->meeting_at && ! $work->exam_opened_at, 409, 'Schedule the mentor review first.');
                        $changes = ['exam_opened_at' => now(), 'meeting_note' => $data['note']];
                        $notify = [
                            'user_id' => (int) $path->owner_id,
                            'message' => "The {$definition['title']} assessment is now open for {$path->venture}.",
                            'url' => '/dashboard/workspace?tab=incubation&path='.$id,
                        ];
                        break;
                    case 'reopen-exam':
                        abort_unless($failed, 409, 'Only an assessment scored below the pass mark can be reopened for a retake.');
                        if ($work->answer_attachment_path) {
                            $obsoletePaths[] = $work->answer_attachment_path;
                        }
                        $changes = [
                            'exam_opened_at' => now(),
                            'meeting_note' => $data['note'],
                            'answer' => null,
                            'answer_attachment_path' => null,
                            'answer_attachment_name' => null,
                            'submitted_at' => null,
                            'score' => null,
                            'passed' => null,
                            'grade_note' => null,
                            'graded_at' => null,
                            'attempt' => ((int) ($work->attempt ?? 1)) + 1,
                        ];
                        $notify = [
                            'user_id' => (int) $path->owner_id,
                            'message' => "Your mentor opened an exam retake for {$definition['title']} ({$path->venture}).",
                            'url' => '/dashboard/workspace?tab=incubation&path='.$id,
                        ];
                        break;
                    case 'approve-progression':
                        abort_unless($failed, 409, 'Only an assessment scored below the pass mark can be approved to continue.');
                        $existingNote = trim((string) ($work->grade_note ?? ''));
                        $progressionNote = 'Progression approved: '.$data['note'];
                        $changes = [
                            'passed' => true,
                            'grade_note' => $existingNote !== '' ? $existingNote.' · '.$progressionNote : $progressionNote,
                        ];
                        if ($stage === 'funding') {
                            DB::table('incubation_paths')->where('id', $id)->update(['graduated_at' => now(), 'updated_at' => now()]);
                        }
                        $notify = [
                            'user_id' => (int) $path->owner_id,
                            'message' => $stage === 'funding'
                                ? "Your mentor approved graduation for {$path->venture} ({$definition['title']})."
                                : "Your mentor approved you to continue past {$definition['title']} for {$path->venture}.",
                            'url' => '/dashboard/workspace?tab=incubation&path='.$id,
                        ];
                        break;
                    case 'revise':
                        abort_unless(
                            ($work->review_requested_at && $work->meeting_at && ! $work->exam_opened_at) || $failed,
                            409,
                            'Schedule the mentor review first or choose a stage that did not pass.',
                        );
                        if ($work->answer_attachment_path) {
                            $obsoletePaths[] = $work->answer_attachment_path;
                        }
                        $changes = [
                            'review_requested_at' => null,
                            'meeting_at' => null,
                            'meeting_location' => null,
                            'meeting_note' => $data['note'],
                            'exam_opened_at' => null,
                            'answer' => null,
                            'answer_attachment_path' => null,
                            'answer_attachment_name' => null,
                            'submitted_at' => null,
                            'score' => null,
                            'passed' => null,
                            'grade_note' => null,
                            'graded_at' => null,
                            'attempt' => $failed ? ((int) ($work->attempt ?? 1)) + 1 : ((int) ($work->attempt ?? 1)),
                        ];
                        $notify = [
                            'user_id' => (int) $path->owner_id,
                            'message' => "Your mentor requested revisions on {$definition['title']} for {$path->venture}.",
                            'url' => '/dashboard/workspace?tab=incubation&path='.$id,
                        ];
                        break;
                    case 'submit':
                        abort_unless($work->exam_opened_at && ! $work->submitted_at, 409, 'An open exam is required and may only be submitted once.');
                        $changes = [
                            'answer' => $data['answer'],
                            'answer_attachment_path' => $uploadedPath,
                            'answer_attachment_name' => $uploadedName,
                            'submitted_at' => now(),
                        ];
                        $notify = [
                            'user_id' => (int) $path->mentor_id,
                            'message' => "{$path->owner} submitted the {$definition['title']} assessment for {$path->venture}.",
                            'url' => '/dashboard/workspace?tab=incubation&path='.$id,
                        ];
                        break;
                    case 'grade':
                        abort_unless($work->submitted_at && ! $work->graded_at, 409, 'Choose an ungraded submission.');
                        $passed = $data['score'] >= Curriculum::PASS_MARK;
                        $changes = [
                            'score' => $data['score'],
                            'passed' => $passed,
                            'grade_note' => $data['note'],
                            'graded_at' => now(),
                        ];
                        if ($stage === 'funding' && $passed) {
                            DB::table('incubation_paths')->where('id', $id)->update(['graduated_at' => now(), 'updated_at' => now()]);
                        }
                        $notify = [
                            'user_id' => (int) $path->owner_id,
                            'message' => $passed
                                ? "You passed {$definition['title']} ({$data['score']}%) for {$path->venture}."
                                : "Your {$definition['title']} assessment scored {$data['score']}% (below the ".Curriculum::PASS_MARK."% pass mark). Review mentor notes to retake.",
                            'url' => '/dashboard/workspace?tab=incubation&path='.$id,
                        ];
                        break;
                }

                DB::table('incubation_stages')->where('id', $work->id)->update([...$changes, 'updated_at' => now()]);

                return $notify;
            }, 3);
        } catch (Throwable $exception) {
            if ($uploadedPath) {
                Storage::disk('local')->delete($uploadedPath);
            }
            throw $exception;
        }

        foreach ($obsoletePaths as $oldPath) {
            Storage::disk('local')->delete($oldPath);
        }

        if ($notification) {
            User::query()->find($notification['user_id'])?->notify(
                new WorkspaceAlert($notification['message'], $notification['url'])
            );
        }

        return response()->json(['data' => ['stage' => $stage]]);
    }

    public function evidenceAttachment(Request $request, int $id, string $stage, string $step): StreamedResponse
    {
        $definition = $this->curriculum->stage($stage);
        abort_unless(in_array($step, array_column($definition['steps'], 'id'), true), 404);

        $this->access->find($request->user(), $id);
        $stageRow = DB::table('incubation_stages')->where('path_id', $id)->where('stage', $stage)->first(['id']) ?? abort(404);
        $evidence = DB::table('incubation_evidence')
            ->where('stage_id', $stageRow->id)
            ->where('step_key', $step)
            ->first(['attachment_path', 'attachment_name']) ?? abort(404);

        abort_unless($evidence->attachment_path && Storage::disk('local')->exists($evidence->attachment_path), 404);

        return Storage::disk('local')->response($evidence->attachment_path, $evidence->attachment_name ?: 'evidence-attachment', [
            'X-Content-Type-Options' => 'nosniff',
            'Cache-Control' => 'private, no-store',
        ]);
    }

    public function examAttachment(Request $request, int $id, string $stage): StreamedResponse
    {
        $this->curriculum->stage($stage);
        $this->access->find($request->user(), $id);
        $stageRow = DB::table('incubation_stages')
            ->where('path_id', $id)
            ->where('stage', $stage)
            ->first(['answer_attachment_path', 'answer_attachment_name']) ?? abort(404);

        abort_unless($stageRow->answer_attachment_path && Storage::disk('local')->exists($stageRow->answer_attachment_path), 404);

        return Storage::disk('local')->response($stageRow->answer_attachment_path, $stageRow->answer_attachment_name ?: 'exam-attachment', [
            'X-Content-Type-Options' => 'nosniff',
            'Cache-Control' => 'private, no-store',
        ]);
    }
}
