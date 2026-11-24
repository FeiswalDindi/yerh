<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Notifications\WorkspaceAlert;
use App\Support\WorkspaceNotifier;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

final class AffiliationApplicationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $actor = $request->user();
        $institutionSlug = $request->validate([
            'institution' => ['nullable', 'string', 'max:120'],
        ])['institution'] ?? null;

        $query = DB::table('affiliation_applications as application')
            ->join('institutions as institution', 'application.institution_id', '=', 'institution.id')
            ->join('users as applicant', 'application.user_id', '=', 'applicant.id')
            ->select(
                'application.id',
                'application.status',
                'application.details',
                'application.location',
                'application.decision_note',
                'institution.name as institution',
                'institution.slug as institution_slug',
                'applicant.name as applicant',
                'applicant.email as applicant_email',
            )
            ->orderByDesc('application.id');

        if ($actor->role === 'admin') {
            if ($institutionSlug) {
                $query->where('institution.slug', $institutionSlug);
            }
        } else {
            $managedInstitutions = DB::table('institution_access as access')
                ->join('institutions as inst', 'inst.id', '=', 'access.institution_id')
                ->where('access.user_id', $actor->id)
                ->where('inst.status', 'active')
                ->whereIn('inst.kind', ['university', 'hub'])
                ->pluck('inst.id');

            if ($managedInstitutions->isNotEmpty()) {
                $query->whereIn('application.institution_id', $managedInstitutions);
                if ($institutionSlug) {
                    $query->where('institution.slug', $institutionSlug);
                }
            } else {
                $query->where('application.user_id', $actor->id);
            }
        }

        return response()->json(['data' => $query->get()])->header('Cache-Control', 'no-store');
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'institution' => ['required', 'string', 'max:120'],
            'location' => ['required', 'string', 'max:120'],
            'details' => ['required', 'string', 'min:10', 'max:2000'],
            'consent' => ['accepted'],
        ]);

        [$id, $actor, $institution] = DB::transaction(function () use ($request, $data) {
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

            $id = DB::table('affiliation_applications')->insertGetId([
                'user_id' => $actor->id, 'pending_user_id' => $actor->id, 'institution_id' => $institution->id,
                'location' => $data['location'], 'details' => $data['details'], 'consented_at' => now(),
                'created_at' => now(), 'updated_at' => now(),
            ]);

            return [$id, $actor, $institution];
        }, 3);

        $coordinators = User::query()
            ->whereNull('suspended_at')
            ->whereNotNull('email_verified_at')
            ->whereIn('id', DB::table('institution_access')
                ->where('institution_id', $institution->id)
                ->where('access', 'manage')
                ->select('user_id'))
            ->get();
        if ($coordinators->isNotEmpty()) {
            Notification::send($coordinators, new WorkspaceAlert(
                "{$actor->name} applied to affiliate with {$institution->name}.",
                '/dashboard/workspace?tab=school&institution='.rawurlencode($institution->slug).'&view=requests',
            ));
        } else {
            WorkspaceNotifier::notifyAdmins(
                "{$actor->name} applied to affiliate with {$institution->name}.",
                '/dashboard/workspace?tab=approvals&view=roles',
            );
        }

        return response()->json(['data' => ['id' => $id]], 201);
    }

    public function review(Request $request, int $id): JsonResponse
    {
        $actor = $request->user();
        $data = $request->validate([
            'decision' => ['required', Rule::in(['approved', 'rejected'])],
            'note' => ['required_if:decision,rejected', 'nullable', 'string', 'max:1500'],
        ]);

        [$learner, $institutionName] = DB::transaction(function () use ($actor, $id, $data) {
            $application = DB::table('affiliation_applications')->where('id', $id)->first();
            abort_unless($application, 404);

            $canReview = $actor->role === 'admin' || DB::table('institution_access as access')
                ->join('institutions as inst', 'inst.id', '=', 'access.institution_id')
                ->where('access.institution_id', $application->institution_id)
                ->where('access.user_id', $actor->id)
                ->where('access.access', 'manage')
                ->where('inst.status', 'active')
                ->whereIn('inst.kind', ['university', 'hub'])
                ->exists();
            abort_unless($canReview, 403);

            $learner = User::query()->lockForUpdate()->findOrFail($application->user_id);
            $application = DB::table('affiliation_applications')->where('id', $id)->lockForUpdate()->first();
            abort_unless($application?->status === 'pending', 409, 'This application has already been decided.');

            $institution = DB::table('institutions')->where('id', $application->institution_id)->first();
            $institutionName = $institution?->name ?? 'your institution';

            if ($data['decision'] === 'approved') {
                $activeInstitution = DB::table('institutions')->where('id', $application->institution_id)
                    ->where('status', 'active')->whereIn('kind', ['university', 'hub'])->first();
                abort_unless($activeInstitution && $learner->role === 'guest' && $learner->isActive()
                    && $learner->hasVerifiedEmail()
                    && ! DB::table('institution_memberships')->where('user_id', $learner->id)->exists()
                    && ! DB::table('institution_access')->where('user_id', $learner->id)->exists(),
                    409, 'This account or institution is no longer eligible.');
                DB::table('institution_memberships')->insert([
                    'user_id' => $learner->id, 'institution_id' => $activeInstitution->id,
                    'location' => $application->location, 'consented_at' => $application->consented_at,
                    'created_at' => now(), 'updated_at' => now(),
                ]);
                $learner->forceFill(['role' => 'entrepreneur', 'requested_institution_id' => null])->save();
            }

            DB::table('affiliation_applications')->where('id', $id)->update([
                'status' => $data['decision'], 'pending_user_id' => null,
                'decision_note' => $data['note'] ?? null, 'reviewer_id' => $actor->id,
                'reviewed_at' => now(), 'updated_at' => now(),
            ]);

            return [$learner, $institutionName];
        }, 3);

        $learner->notify(new WorkspaceAlert(
            $data['decision'] === 'approved'
                ? "Your affiliation with {$institutionName} was approved. Your Entrepreneur dashboard is ready."
                : "Your affiliation request for {$institutionName} was declined.".(! empty($data['note']) ? ' Note: '.$data['note'] : ''),
            $data['decision'] === 'approved' ? '/dashboard' : '/account',
        ));

        return response()->json(['data' => ['status' => $data['decision']]]);
    }
}
