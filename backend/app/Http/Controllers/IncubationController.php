<?php

namespace App\Http\Controllers;

use App\Domain\Incubation\Curriculum;
use App\Domain\Incubation\PathAccess;
use App\Domain\Learning\CoursePlacements;
use App\Integrations\Moodle\MoodleClient;
use App\Integrations\Moodle\MoodleProgressSync;
use App\Models\User;
use App\Support\WorkspaceNotifier;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Throwable;

final class IncubationController extends Controller
{
    public function __construct(private readonly PathAccess $access, private readonly Curriculum $curriculum) {}

    public function index(Request $request, MoodleClient $moodle, MoodleProgressSync $sync): JsonResponse
    {
        $configured = $moodle->isConfigured();
        $rows = $this->access->visible($request->user())->addSelect(['graded_stages' => DB::table('incubation_stages')->selectRaw('count(*)')
            ->whereColumn('path_id', 'path.id')
            ->whereNotNull('graded_at')
            ->where(function ($query): void {
                $query->where('passed', true)
                    ->orWhere(function ($fallback): void {
                        $fallback->whereNull('passed')->where('score', '>=', Curriculum::PASS_MARK);
                    });
            })])->latest('path.id')->get();

        if ($configured) {
            $syncedAny = false;
            foreach ($rows as $row) {
                if (! empty($row->moodle_course_id) && $row->graduated_at === null) {
                    if ($sync->syncPathway((int) $row->id) !== null) {
                        $syncedAny = true;
                    }
                }
            }
            if ($syncedAny) {
                $rows = $this->access->visible($request->user())->addSelect(['graded_stages' => DB::table('incubation_stages')->selectRaw('count(*)')
                    ->whereColumn('path_id', 'path.id')
                    ->whereNotNull('graded_at')
                    ->where(function ($query): void {
                        $query->where('passed', true)
                            ->orWhere(function ($fallback): void {
                                $fallback->whereNull('passed')->where('score', '>=', Curriculum::PASS_MARK);
                            });
                    })])->latest('path.id')->get();
            }
        }

        $rows = $rows->map(function ($row) use ($configured) {
            $row->moodle_launch_url = ($configured && ! empty($row->moodle_course_id))
                ? '/api/v1/learning/moodle/launch?path='.$row->id
                : null;

            return $row;
        });

        return response()->json(['data' => $rows]);
    }

    public function show(Request $request, int $id, MoodleClient $moodle, MoodleProgressSync $sync): JsonResponse
    {
        $path = $this->access->find($request->user(), $id);
        if ($moodle->isConfigured() && ! empty($path->moodle_course_id) && $path->graduated_at === null) {
            if ($sync->syncPathway($id) !== null) {
                $path = $this->access->find($request->user(), $id);
            }
        }
        $path->moodle_launch_url = ($moodle->isConfigured() && ! empty($path->moodle_course_id))
            ? '/api/v1/learning/moodle/launch?path='.$id
            : null;
        $stages = DB::table('incubation_stages')->where('path_id', $id)->get()->map(function ($row) {
            $row->has_answer_attachment = ! empty($row->answer_attachment_path);
            unset($row->answer_attachment_path);

            return $row;
        })->keyBy('stage');
        $evidence = DB::table('incubation_evidence')->whereIn('stage_id', $stages->pluck('id'))->get()->map(function ($row) {
            $row->has_attachment = ! empty($row->attachment_path);
            unset($row->attachment_path);

            return $row;
        })->groupBy('stage_id');
        $payments = DB::table('programme_payments')->where('path_id', $id)->get(['purpose', 'amount', 'status', 'decision_note']);
        $credentials = DB::table('venture_credentials')->where('path_id', $id)->get(['document_id', 'kind', 'issued_at']);

        return response()->json(['data' => [
            'path' => $path,
            'stages' => array_map(function ($definition) use ($stages, $evidence) {
                $work = $stages->get($definition['id']);

                return [
                    'definition' => $definition,
                    'work' => $work,
                    'evidence' => $work ? $evidence->get($work->id, []) : [],
                ];
            }, $this->curriculum->stages()),
            'payments' => $payments,
            'credentials' => $credentials,
        ]]);
    }

    public function launch(Request $request, int $ventureId): JsonResponse
    {
        abort_unless($request->user()->role === 'entrepreneur', 403);
        $data = $request->validate([
            'product_ids' => ['sometimes', 'array', 'max:30'],
            'product_ids.*' => ['required', 'integer', 'distinct'],
        ]);
        [$id, $ventureName] = DB::transaction(function () use ($request, $ventureId, $data) {
            $venture = DB::table('ventures')->where('id', $ventureId)
                ->where('owner_id', $request->user()->id)->lockForUpdate()->first() ?? abort(404);
            abort_unless($venture->status === 'approved', 409, 'Get the venture approved before launching it.');
            $existing = DB::table('incubation_paths')->where('venture_id', $ventureId)->first();
            abort_if($existing, 409, 'This venture already has an incubation pathway.');
            $products = $data['product_ids'] ?? [];
            $selection = DB::table('venture_products')->where('venture_id', $ventureId)->whereIn('id', $products);
            abort_unless($selection->count() === count($products), 422, 'Choose products belonging to this venture.');
            $id = DB::table('incubation_paths')->insertGetId([
                'venture_id' => $ventureId, 'created_at' => now(), 'updated_at' => now(),
            ]);
            $selection->update(['included_path_id' => $id]);

            return [$id, $venture->name];
        }, 3);

        WorkspaceNotifier::notifyAdmins(
            "{$request->user()->name} launched incubation for {$ventureName} and needs a mentor assigned.",
            '/dashboard/workspace?tab=approvals&view=incubation',
        );

        return response()->json(['data' => ['id' => $id]], 201);
    }

    public function mentors(Request $request): JsonResponse
    {
        abort_unless($request->user()->role === 'admin', 403);

        return response()->json(['data' => User::query()->where('role', 'mentor')
            ->whereNull('suspended_at')->whereNotNull('email_verified_at')->orderBy('name')->get(['id', 'name', 'email'])]);
    }

    public function mentorCandidates(Request $request): JsonResponse
    {
        abort_unless($request->user()->role === 'admin', 403);
        $data = $request->validate(['q' => ['nullable', 'string', 'max:120']]);
        $query = trim($data['q'] ?? '');
        $like = '%'.addcslashes($query, '\\%_').'%';

        return response()->json(['data' => $this->eligibleMentorCandidates()
            ->when($query !== '', fn ($builder) => $builder->where(
                fn ($nested) => $nested->whereLike('name', $like)->orWhereLike('email', $like)
            ))
            ->orderBy('name')->orderBy('id')->limit(24)->get(['id', 'name'])]);
    }

    private function eligibleMentorCandidates(): Builder
    {
        return User::query()->where('role', 'guest')->whereNull('suspended_at')->whereNotNull('email_verified_at')
            ->whereNotExists(fn ($query) => $query->from('institution_access')
                ->whereColumn('institution_access.user_id', 'users.id'))
            ->whereNotExists(fn ($query) => $query->from('institution_memberships')
                ->whereColumn('institution_memberships.user_id', 'users.id'))
            ->whereNotExists(fn ($query) => $query->from('affiliation_applications')
                ->whereColumn('affiliation_applications.pending_user_id', 'users.id'));
    }

    public function registerMentor(Request $request): JsonResponse
    {
        abort_unless($request->user()->role === 'admin', 403);
        $data = $request->validate(['user_id' => ['required', 'integer', 'min:1']]);
        DB::transaction(function () use ($data) {
            $user = User::query()->whereKey($data['user_id'])->lockForUpdate()->first();
            if (! $user || ! $this->eligibleMentorCandidates()->whereKey($user->id)->exists()) {
                throw ValidationException::withMessages(['user_id' => 'Choose a verified, unaffiliated guest without a pending affiliation application.']);
            }
            $user->forceFill(['role' => 'mentor'])->save();
        }, 3);

        return response()->json(['data' => ['role' => 'mentor']], 201);
    }

    public function assign(Request $request, int $id, MoodleClient $moodle, CoursePlacements $placements): JsonResponse
    {
        abort_unless($request->user()->role === 'admin', 403);
        $data = $request->validate(['mentor_id' => ['required', 'integer']]);
        [$path, $mentor] = DB::transaction(function () use ($request, $id, $data) {
            $path = $this->access->find($request->user(), $id, lock: true);
            abort_if($path->graduated_at, 409, 'This pathway has graduated.');
            $mentor = User::query()->where('role', 'mentor')->find($data['mentor_id']);
            abort_unless($mentor && $mentor->isActive() && $mentor->hasVerifiedEmail(), 422, 'Choose an active, verified mentor.');
            DB::table('incubation_paths')->where('id', $id)->update(['mentor_id' => $mentor->id, 'updated_at' => now()]);

            return [$path, $mentor];
        }, 3);

        $incubationKeys = $placements->incubationKeys();
        $moodleCourseId = $path->moodle_course_id ?: ($incubationKeys === []
            ? null
            : DB::table('learning_courses')
                ->where('status', 'published')
                ->whereIn('placement', $incubationKeys)
                ->whereNotNull('moodle_course_id')
                ->orderBy('id')
                ->value('moodle_course_id'));

        if ($moodleCourseId && $moodle->isConfigured()) {
            try {
                $owner = User::query()->findOrFail($path->owner_id);
                $ownerMoodleId = $moodle->ensureUser($owner);
                $mentorMoodleId = $moodle->ensureUser($mentor);
                $moodle->enrolUser($ownerMoodleId, (int) $moodleCourseId);
                $moodle->enrolMentor($mentorMoodleId, (int) $moodleCourseId);
                $groupId = $moodle->ensureCourseGroup(
                    (int) $moodleCourseId,
                    Str::limit("Venture: {$path->venture} (#{$id})", 254, ''),
                    "yerh_path_{$id}",
                );
                $previousMentorId = $path->mentor_id ? (int) $path->mentor_id : null;
                if ($previousMentorId && $previousMentorId !== (int) $mentor->id) {
                    $prevMentor = User::query()->find($previousMentorId);
                    if ($prevMentor && $prevMentor->moodle_user_id) {
                        try {
                            $moodle->removeGroupMembers($groupId, [(int) $prevMentor->moodle_user_id]);
                        } catch (Throwable $cleanupException) {
                            Log::warning('Could not remove previous mentor from Moodle incubation group.', [
                                'path_id' => $id,
                                'previous_mentor_id' => $previousMentorId,
                                'group_id' => $groupId,
                                'error' => $cleanupException->getMessage(),
                            ]);
                        }
                    }
                }
                $moodle->addGroupMembers($groupId, [$ownerMoodleId, $mentorMoodleId]);
                $now = now();
                DB::table('incubation_paths')->where('id', $id)->update([
                    'moodle_course_id' => (int) $moodleCourseId,
                    'moodle_group_id' => $groupId,
                    'updated_at' => $now,
                ]);
            } catch (Throwable $exception) {
                Log::warning('Moodle Model A incubation provisioning failed.', [
                    'path_id' => $id,
                    'moodle_course_id' => $moodleCourseId,
                    'error' => $exception->getMessage(),
                ]);
            }
        }

        WorkspaceNotifier::notifyUser(
            $mentor->id,
            "You have been assigned as mentor for {$path->venture}.",
            '/dashboard/workspace?tab=incubation&path='.$id,
        );
        WorkspaceNotifier::notifyUser(
            (int) $path->owner_id,
            "{$mentor->name} has been assigned as mentor for {$path->venture}.",
            '/dashboard/workspace?tab=incubation&path='.$id,
        );

        return response()->json(['data' => ['id' => $id]]);
    }

    public function syncMoodle(Request $request, int $id, MoodleClient $moodle, MoodleProgressSync $sync): JsonResponse
    {
        $actor = $request->user();
        $path = $this->access->find($actor, $id);
        abort_unless($path->moodle_course_id, 409, 'This pathway is not linked to a Moodle course.');
        abort_unless($moodle->isConfigured(), 422, 'Moodle integration is not configured.');

        $result = $sync->syncPathway($id, force: true);
        if ($result === null) {
            abort(502, 'Could not sync Moodle progress.');
        }

        return response()->json(['data' => $result]);
    }
}
