<?php

namespace App\Http\Controllers;

use App\Domain\Incubation\Curriculum;
use App\Domain\Incubation\PathAccess;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

final class IncubationStageController extends Controller
{
    public function __construct(private readonly PathAccess $access, private readonly Curriculum $curriculum) {}

    public function update(Request $request, int $id, string $stage, string $action): JsonResponse
    {
        $definition = $this->curriculum->stage($stage);
        $data = $request->validate(match ($action) {
            'evidence' => [
                'step' => ['required', Rule::in(array_column($definition['steps'], 'id'))],
                'body' => ['required', 'string', 'min:10', 'max:5000'],
                'request_feedback' => ['sometimes', 'boolean'],
            ],
            'feedback' => [
                'step' => ['required', Rule::in(array_column($definition['steps'], 'id'))],
                'note' => ['required', 'string', 'min:5', 'max:2000'],
            ],
            'meeting' => ['meeting_at' => ['required', 'date'], 'location' => ['required', 'string', 'max:240']],
            'open-exam', 'revise' => ['note' => ['required', 'string', 'min:5', 'max:2000']],
            'submit' => ['answer' => ['required', 'string', 'min:10', 'max:8000']],
            'grade' => ['score' => ['required', 'integer', 'between:0,100'], 'note' => ['required', 'string', 'min:5', 'max:2000']],
            'request-review' => [],
            default => abort(404),
        });

        DB::transaction(function () use ($request, $id, $definition, $stage, $action, $data) {
            $actor = $request->user();
            $path = $this->access->find($actor, $id, lock: true);
            $ownerAction = in_array($action, ['evidence', 'request-review', 'submit'], true);
            abort_unless($ownerAction
                ? $actor->role === 'entrepreneur' && (int) $path->owner_id === $actor->id
                : $actor->role === 'mentor' && (int) $path->mentor_id === $actor->id, 403);
            abort_unless($path->mentor_id, 409, 'A platform administrator must assign a mentor.');
            abort_unless($this->access->completed($id, $this->curriculum->prerequisites($stage)), 409, 'Complete the previous stage first.');

            $key = ['path_id' => $id, 'stage' => $stage];
            $work = DB::table('incubation_stages')->where($key)->first();
            if (! $work) {
                abort_unless($action === 'evidence', 409, 'Save the required stage evidence first.');
                $workId = DB::table('incubation_stages')->insertGetId([...$key, 'created_at' => now(), 'updated_at' => now()]);
                $work = DB::table('incubation_stages')->where('id', $workId)->first();
            }

            $evidence = DB::table('incubation_evidence')->where('stage_id', $work->id);
            switch ($action) {
                case 'evidence':
                    abort_if($work->review_requested_at || $work->exam_opened_at, 409, 'This stage is under review.');
                    $step = ['stage_id' => $work->id, 'step_key' => $data['step']];
                    DB::table('incubation_evidence')->upsert([[
                        ...$step, 'body' => $data['body'], 'feedback_requested' => $data['request_feedback'] ?? false,
                        'created_at' => now(), 'updated_at' => now(),
                    ]], ['stage_id', 'step_key'], ['body', 'feedback_requested', 'updated_at']);

                    return;
                case 'feedback':
                    $given = $evidence->where('step_key', $data['step'])->where('feedback_requested', true)
                        ->update(['feedback' => $data['note'], 'feedback_requested' => false, 'updated_at' => now()]);
                    abort_unless($given, 409, 'This step has no pending feedback request.');

                    return;
                case 'request-review':
                    abort_if($work->review_requested_at || $work->exam_opened_at, 409, 'The stage review is already open.');
                    abort_unless($evidence->count() === count($definition['steps']), 409, 'Save evidence for every required step.');
                    $changes = ['review_requested_at' => now(), 'meeting_note' => null];
                    break;
                case 'meeting':
                    abort_unless($work->review_requested_at && ! $work->exam_opened_at, 409, 'Choose a stage that is awaiting review.');
                    $changes = ['meeting_at' => now()->parse($data['meeting_at'])->utc(), 'meeting_location' => $data['location']];
                    break;
                case 'open-exam':
                case 'revise':
                    abort_unless($work->review_requested_at && $work->meeting_at && ! $work->exam_opened_at, 409, 'Schedule the mentor review first.');
                    $changes = $action === 'open-exam'
                        ? ['exam_opened_at' => now(), 'meeting_note' => $data['note']]
                        : ['review_requested_at' => null, 'meeting_at' => null, 'meeting_location' => null, 'meeting_note' => $data['note']];
                    break;
                case 'submit':
                    abort_unless($work->exam_opened_at && ! $work->submitted_at, 409, 'An open exam is required and may only be submitted once.');
                    $changes = ['answer' => $data['answer'], 'submitted_at' => now()];
                    break;
                case 'grade':
                    abort_unless($work->submitted_at && ! $work->graded_at, 409, 'Choose an ungraded submission.');
                    $changes = ['score' => $data['score'], 'grade_note' => $data['note'], 'graded_at' => now()];
                    if ($stage === 'funding') {
                        DB::table('incubation_paths')->where('id', $id)->update(['graduated_at' => now(), 'updated_at' => now()]);
                    }
                    break;
            }

            DB::table('incubation_stages')->where('id', $work->id)->update([...$changes, 'updated_at' => now()]);
        }, 3);

        return response()->json(['data' => ['stage' => $stage]]);
    }
}
