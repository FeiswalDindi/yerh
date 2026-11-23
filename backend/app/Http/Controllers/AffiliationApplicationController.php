<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

final class AffiliationApplicationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $actor = $request->user();
        $query = DB::table('affiliation_applications as application')
            ->join('institutions as institution', 'application.institution_id', '=', 'institution.id')
            ->join('users as applicant', 'application.user_id', '=', 'applicant.id')
            ->select('application.id', 'application.status', 'application.details', 'application.location',
                'application.decision_note', 'institution.name as institution', 'applicant.name as applicant')
            ->orderByDesc('application.id');

        if ($actor->role !== 'admin') {
            $query->where('application.user_id', $actor->id);
        }

        return response()->json(['data' => $query->get()]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'institution' => ['required', 'string', 'max:120'],
            'location' => ['required', 'string', 'max:120'],
            'details' => ['required', 'string', 'min:10', 'max:2000'],
            'consent' => ['accepted'],
        ]);

        $id = DB::transaction(function () use ($request, $data) {
            $actor = User::query()->lockForUpdate()->findOrFail($request->user()->id);
            abort_unless($actor->role === 'guest' && $actor->isActive() && $actor->hasVerifiedEmail(), 403);
            $institution = DB::table('institutions')->where('slug', $data['institution'])
                ->where('status', 'active')->whereIn('kind', ['university', 'hub'])->first();
            if (! $institution) {
                throw ValidationException::withMessages(['institution' => 'Choose an active university or hub.']);
            }
            if (DB::table('affiliation_applications')->where('pending_user_id', $actor->id)->exists()
                || DB::table('institution_memberships')->where('user_id', $actor->id)->exists()
                || DB::table('institution_access')->where('user_id', $actor->id)->exists()) {
                throw ValidationException::withMessages(['institution' => 'You already have a pending application or institution affiliation.']);
            }

            return DB::table('affiliation_applications')->insertGetId([
                'user_id' => $actor->id, 'pending_user_id' => $actor->id, 'institution_id' => $institution->id,
                'location' => $data['location'], 'details' => $data['details'], 'consented_at' => now(),
                'created_at' => now(), 'updated_at' => now(),
            ]);
        }, 3);

        return response()->json(['data' => ['id' => $id]], 201);
    }

    public function review(Request $request, int $id): JsonResponse
    {
        abort_unless($request->user()->role === 'admin', 403);
        $data = $request->validate([
            'decision' => ['required', Rule::in(['approved', 'rejected'])],
            'note' => ['required_if:decision,rejected', 'nullable', 'string', 'max:1500'],
        ]);

        DB::transaction(function () use ($request, $id, $data) {
            $application = DB::table('affiliation_applications')->where('id', $id)->first();
            abort_unless($application, 404);
            $learner = User::query()->lockForUpdate()->findOrFail($application->user_id);
            $application = DB::table('affiliation_applications')->where('id', $id)->lockForUpdate()->first();
            abort_unless($application?->status === 'pending', 409, 'This application has already been decided.');

            if ($data['decision'] === 'approved') {
                $institution = DB::table('institutions')->where('id', $application->institution_id)
                    ->where('status', 'active')->whereIn('kind', ['university', 'hub'])->first();
                abort_unless($institution && $learner->role === 'guest' && $learner->isActive()
                    && $learner->hasVerifiedEmail()
                    && ! DB::table('institution_memberships')->where('user_id', $learner->id)->exists()
                    && ! DB::table('institution_access')->where('user_id', $learner->id)->exists(),
                    409, 'This account or institution is no longer eligible.');
                DB::table('institution_memberships')->insert([
                    'user_id' => $learner->id, 'institution_id' => $institution->id,
                    'location' => $application->location, 'consented_at' => $application->consented_at,
                    'created_at' => now(), 'updated_at' => now(),
                ]);
                $learner->forceFill(['role' => 'entrepreneur'])->save();
            }

            DB::table('affiliation_applications')->where('id', $id)->update([
                'status' => $data['decision'], 'pending_user_id' => null,
                'decision_note' => $data['note'] ?? null, 'reviewer_id' => $request->user()->id,
                'reviewed_at' => now(), 'updated_at' => now(),
            ]);
        }, 3);

        return response()->json(['data' => ['status' => $data['decision']]]);
    }
}
