<?php

namespace App\Http\Controllers;

use App\Support\WorkspaceNotifier;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

final class VentureController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $actor = $request->user();
        abort_unless(in_array($actor->role, ['entrepreneur', 'admin'], true), 403);
        $query = DB::table('ventures')->join('institutions', 'ventures.institution_id', '=', 'institutions.id')
            ->join('users', 'ventures.owner_id', '=', 'users.id')
            ->select('ventures.id', 'ventures.name', 'ventures.sector', 'ventures.location', 'ventures.description',
                'ventures.status', 'ventures.decision_note', 'institutions.name as institution', 'users.name as owner')
            ->orderByDesc('ventures.id');
        if ($actor->role === 'entrepreneur') {
            $query->where('ventures.owner_id', $actor->id);
        }

        return response()->json(['data' => $query->get()]);
    }

    public function institutionVentures(Request $request): JsonResponse
    {
        abort_unless($request->user()->role === 'admin', 403);
        $teams = DB::table('school_ventures as team')
            ->join('school_cohorts as cohort', 'cohort.id', '=', 'team.cohort_id')
            ->join('institutions as institution', 'institution.id', '=', 'cohort.institution_id')
            ->select('team.id', 'team.name', 'team.description', 'team.sector', 'institution.name as institution',
                'institution.slug', 'cohort.name as cohort', 'cohort.id as cohort_id')
            ->orderBy('institution.name')->orderBy('team.name')->get();

        return response()->json(['data' => $teams]);
    }

    public function store(Request $request): JsonResponse
    {
        $actor = $request->user();
        abort_unless($actor->role === 'entrepreneur', 403);
        $institution = DB::table('institution_memberships as membership')
            ->join('institutions as institution', 'membership.institution_id', '=', 'institution.id')
            ->where('membership.user_id', $actor->id)->where('institution.status', 'active')
            ->whereIn('institution.kind', ['university', 'hub'])->value('institution.id');
        abort_unless($institution, 403, 'An active institution affiliation is required.');

        $data = $this->validateVenture($request);
        $id = DB::table('ventures')->insertGetId([
            ...$data, 'owner_id' => $actor->id, 'institution_id' => $institution,
            'created_at' => now(), 'updated_at' => now(),
        ]);

        WorkspaceNotifier::notifyAdmins(
            "{$actor->name} submitted a new venture for approval: {$data['name']}.",
            '/dashboard/workspace?tab=approvals&view=ventures',
        );

        return response()->json(['data' => ['id' => $id]], 201);
    }

    public function resubmit(Request $request, int $id): JsonResponse
    {
        abort_unless($request->user()->role === 'entrepreneur', 403);
        $data = $this->validateVenture($request);
        $venture = DB::table('ventures')->where('id', $id)->where('owner_id', $request->user()->id);
        abort_unless((clone $venture)->exists(), 404);
        $changed = $venture->where('status', 'rejected')->update([
            ...$data, 'status' => 'pending', 'decision_note' => null,
            'reviewer_id' => null, 'reviewed_at' => null, 'updated_at' => now(),
        ]);
        abort_unless($changed === 1, 409, 'Only a rejected venture can be resubmitted.');

        WorkspaceNotifier::notifyAdmins(
            "{$request->user()->name} resubmitted venture {$data['name']} for approval.",
            '/dashboard/workspace?tab=approvals&view=ventures',
        );

        return response()->json(['data' => ['status' => 'pending']]);
    }

    public function review(Request $request, int $id): JsonResponse
    {
        abort_unless($request->user()->role === 'admin', 403);
        $data = $request->validate([
            'expected_status' => ['sometimes', Rule::in(['pending', 'approved', 'rejected'])],
            'decision' => ['required', Rule::in($request->has('expected_status') ? ['pending', 'approved', 'rejected'] : ['approved', 'rejected'])],
            'note' => ['required_if:decision,rejected', 'nullable', 'string', 'max:1500'],
        ]);
        $venture = DB::table('ventures')->where('id', $id);
        $record = (clone $venture)->first(['owner_id', 'name']) ?? abort(404);
        $changed = $venture->where('status', $data['expected_status'] ?? 'pending')->update([
            'status' => $data['decision'], 'decision_note' => $data['note'] ?? null,
            'reviewer_id' => $request->user()->id, 'reviewed_at' => now(), 'updated_at' => now(),
        ]);
        abort_unless($changed === 1, 409, 'The venture has changed. Refresh the registry before reviewing again.');

        if ($data['decision'] !== 'pending') {
            $noteSuffix = ! empty($data['note']) ? ' Note: '.$data['note'] : '';
            WorkspaceNotifier::notifyUser(
                (int) $record->owner_id,
                "Your venture {$record->name} was {$data['decision']}.{$noteSuffix}",
                '/dashboard/workspace?tab=ventures',
            );
        }

        return response()->json(['data' => ['status' => $data['decision']]]);
    }

    private function validateVenture(Request $request): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'min:2', 'max:120'],
            'sector' => ['required', 'string', 'max:100', 'exists:marketplace_sectors,name'],
            'location' => ['required', 'string', 'max:120'],
            'description' => ['required', 'string', 'min:10', 'max:2000'],
        ]);
    }
}
