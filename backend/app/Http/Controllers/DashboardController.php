<?php

namespace App\Http\Controllers;

use App\Integrations\Moodle\MoodleClient;
use App\Models\User;
use App\Support\WorkspaceNotifier;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class DashboardController extends Controller
{
    public function summary(Request $request, MoodleClient $moodle): JsonResponse
    {
        $actor = $request->user();
        $metrics = match ($actor->role) {
            'admin' => $this->administration(),
            'entrepreneur' => [
                'ventures' => DB::table('ventures')->where('owner_id', $actor->id)->count(),
                'enrolments' => DB::table('learning_enrolments')->where('learner_id', $actor->id)->count(),
                'paths' => DB::table('incubation_paths')->whereIn('venture_id',
                    DB::table('ventures')->where('owner_id', $actor->id)->select('id'))->count(),
                'opportunities' => DB::table('opportunity_submissions')->where('applicant_id', $actor->id)->count(),
            ],
            'mentor' => [
                'assigned' => DB::table('incubation_paths')->where('mentor_id', $actor->id)->whereNull('graduated_at')->count(),
                'graduated' => DB::table('incubation_paths')->where('mentor_id', $actor->id)->whereNotNull('graduated_at')->count(),
                'authoredCourses' => DB::table('learning_courses')->where('author_id', $actor->id)->count(),
                'courseEnrolments' => DB::table('learning_enrolments as e')
                    ->join('learning_courses as c', 'c.id', '=', 'e.course_id')
                    ->where('c.author_id', $actor->id)
                    ->where('e.payment_status', 'confirmed')
                    ->count(),
                'accruedRoyalties' => round((float) DB::table('learning_enrolments as e')
                    ->join('learning_courses as c', 'c.id', '=', 'e.course_id')
                    ->where('c.author_id', $actor->id)
                    ->where('e.payment_status', 'confirmed')
                    ->selectRaw('coalesce(sum(e.price_paid * e.royalty_rate) / 100.0, 0) as total')
                    ->value('total'), 2),
            ],
            'content_manager' => [
                'editorial' => DB::table('editorial_content')->count(),
                'media' => DB::table('cms_media')->count(),
                'events' => DB::table('engagement_events')->count(),
                'opportunities' => DB::table('engagement_opportunities')->count(),
                'enquiries' => DB::table('contact_messages')->where('status', 'new')->count(),
            ],
            'partner' => [
                'myEvents' => DB::table('engagement_events')->where('organizer_id', $actor->id)->count(),
                'publishedEvents' => DB::table('engagement_events')->where('organizer_id', $actor->id)->where('status', 'published')->count(),
                'eventBookings' => DB::table('event_bookings as b')
                    ->join('engagement_events as e', 'e.id', '=', 'b.event_id')
                    ->where('e.organizer_id', $actor->id)
                    ->count(),
                'courseProposals' => DB::table('learning_courses')->where('author_id', $actor->id)->count(),
            ],
            default => [],
        };
        $staff = DB::table('institution_access as access')
            ->join('institutions as institution', 'institution.id', '=', 'access.institution_id')
            ->where('access.user_id', $actor->id)->where('institution.status', 'active')
            ->get(['institution.id', 'institution.slug', 'institution.kind']);
        $portals = [];
        foreach ($staff as $institution) {
            $portals[$institution->slug] = $institution->kind === 'high-school' ? [
                'students' => DB::table('school_students')->where('institution_id', $institution->id)->count(),
                'cohorts' => DB::table('school_cohorts')->where('institution_id', $institution->id)->count(),
            ] : [
                'members' => DB::table('institution_memberships')->where('institution_id', $institution->id)->count(),
                'affiliatedVentures' => DB::table('ventures')->where('institution_id', $institution->id)->count(),
                'pendingRequests' => DB::table('affiliation_applications')
                    ->where('institution_id', $institution->id)
                    ->where('status', 'pending')
                    ->count(),
            ];
        }

        return response()->json(['data' => [
            'metrics' => (object) $metrics,
            'portals' => (object) $portals,
            'moodle_configured' => $moodle->isConfigured(),
        ]])->header('Cache-Control', 'no-store');
    }

    private function administration(): array
    {
        $pendingCoursePayments = DB::table('learning_enrolments')->where('payment_status', 'pending')->count();
        $pendingPartnerEvents = DB::table('engagement_events')->where('status', 'pending_review')->count();
        $pendingCourseProposals = DB::table('learning_courses')->where('status', 'proposed')->count();
        $pendingCareerApplications = DB::table('career_applications')->where('status', 'pending')->count();
        $metrics = [
            'listings' => DB::table('venture_products')->where('moderation', 'pending')->count(),
            'roles' => DB::table('affiliation_applications')->where('status', 'pending')->count(),
            'onboarding' => DB::table('institution_onboarding_applications')->where('status', 'pending')->count(),
            'careerRequests' => $pendingCareerApplications,
            'enquiries' => DB::table('contact_messages')->where('status', 'new')->count(),
            'accounts' => DB::table('users')->whereNull('suspended_at')->count(),
            'payments' => DB::table('programme_payments')->where('status', 'pending')->count() + $pendingCoursePayments,
            'institutions' => DB::table('institutions')->count(),
            'partnerEvents' => $pendingPartnerEvents,
            'courseProposals' => $pendingCourseProposals,
        ];
        $metrics['approvals'] = $metrics['roles'] + $metrics['listings'] + $metrics['onboarding']
            + $pendingCareerApplications
            + $pendingCoursePayments
            + $pendingPartnerEvents
            + $pendingCourseProposals
            + DB::table('venture_products')->where('evidence_status', 'pending')->count()
            + DB::table('ventures')->where('status', 'pending')->count()
            + DB::table('incubation_paths')->whereNull('mentor_id')->whereNull('graduated_at')->count();

        return $metrics;
    }

    public function updateAccess(Request $request, int $id, MoodleClient $moodle): JsonResponse
    {
        $actor = $request->user();
        abort_unless($actor->role === 'admin' && $actor->id !== $id, 403);
        $data = $request->validate(['suspended' => ['required', 'boolean'], 'role' => ['required', 'string']]);
        $outcome = DB::transaction(function () use ($id, $data, $actor) {
            // Lock both accounts in a consistent order, then recheck the actor before writing.
            $users = DB::table('users')->whereIn('id', [$actor->id, $id])->orderBy('id')->lockForUpdate()->get()->keyBy('id');
            $administrator = $users->get($actor->id);
            abort_unless($administrator && $administrator->role === 'admin' && ! $administrator->suspended_at, 403);
            $member = $users->get($id);
            abort_unless($member, 404);
            if ($data['role'] !== $member->role) {
                abort_unless(in_array($member->role, ['guest', 'content_manager', 'partner', 'admin'], true)
                    && in_array($data['role'], ['guest', 'content_manager', 'partner', 'admin'], true)
                    && $member->email_verified_at && ! $member->suspended_at
                    && ! DB::table('institution_access')->where('user_id', $id)->exists()
                    && ! DB::table('institution_memberships')->where('user_id', $id)->exists()
                    && ! DB::table('affiliation_applications')->where('pending_user_id', $id)->exists(),
                    422, 'Use the corresponding institution, affiliation or mentor workflow for this account.');
            }
            $updates = [
                'role' => $data['role'],
                'suspended_at' => $data['suspended'] ? ($member->suspended_at ?? now()) : null,
                'updated_at' => now(),
            ];
            if ($data['suspended']) {
                $updates['remember_token'] = Str::random(60);
            }
            DB::table('users')->where('id', $id)->update($updates);
            if ($data['suspended']) {
                DB::table('sessions')->where('user_id', $id)->delete();
            }

            return [
                'name' => $member->name,
                'email' => $member->email,
                'verified' => ! empty($member->email_verified_at),
                'role_changed' => $data['role'] !== $member->role,
                'new_role' => $data['role'],
                'newly_suspended' => $data['suspended'] && $member->suspended_at === null,
                'reactivated' => ! $data['suspended'] && $member->suspended_at !== null,
            ];
        }, 3);

        $targetUser = User::query()->find($id);
        if ($targetUser) {
            $moodle->syncUserProfile($targetUser);
        }

        $roleLabel = match ($outcome['new_role']) {
            'admin' => 'Platform Administrator',
            'content_manager' => 'Content Manager',
            'partner' => 'Partner',
            default => ucwords(str_replace('_', ' ', $outcome['new_role'])),
        };

        if ($outcome['newly_suspended']) {
            WorkspaceNotifier::notifyExternalEmail(
                $outcome['email'],
                $outcome['name'],
                'Your YERH account access has been suspended',
                'Your YERH account access has been temporarily suspended by an administrator. If you believe this is an error, please reach out via the Contact Us page.',
                'Contact Support',
                '/contact',
            );
        } elseif ($outcome['verified']) {
            if ($outcome['reactivated']) {
                WorkspaceNotifier::notifyUser(
                    $id,
                    'Your YERH account access has been restored. You can sign in again.',
                    '/dashboard',
                    'Your YERH account has been reactivated',
                    'Sign in to YERH',
                );
            }
            if ($outcome['role_changed']) {
                WorkspaceNotifier::notifyUser(
                    $id,
                    "Your YERH account role has been updated to {$roleLabel}.",
                    '/dashboard',
                    'Your YERH account role was updated',
                    'Open YERH',
                );
            }
        }

        return response()->json(['data' => ['id' => $id]]);
    }

    public function activity(Request $request): JsonResponse
    {
        abort_unless($request->user()->role === 'admin', 403);

        $slug = $request->validate(['institution' => ['nullable', 'string', 'regex:/^[a-z0-9-]+$/', 'max:120']])['institution'] ?? null;

        return response()->json(['data' => DB::table('workspace_activity as activity')
            ->when($slug, function ($query) use ($slug) {
                $query->where(function ($scope) use ($slug) {
                    foreach (['workspace/institutions/', 'workspace/schools/', 'identity/institutions/'] as $prefix) {
                        $scope->orWhere('activity.target', $prefix.$slug)->orWhereLike('activity.target', $prefix.$slug.'/%');
                    }
                });
            })
            ->leftJoin('users', 'users.id', '=', 'activity.actor_id')->latest('activity.id')
            ->get(['activity.id', 'users.name as actor', 'activity.action', 'activity.target', 'activity.created_at'])])
            ->header('Cache-Control', 'no-store');
    }

    public function users(Request $request): JsonResponse
    {
        abort_unless($request->user()->role === 'admin', 403);

        $users = DB::table('users')
            ->orderBy('name')
            ->get([
                'id',
                'name',
                'first_name',
                'last_name',
                'email',
                'role',
                'location',
                'email_verified_at',
                'suspended_at',
                'google_id',
                'password',
                'moodle_user_id',
                'created_at',
            ]);

        $memberships = DB::table('institution_memberships as m')
            ->join('institutions as i', 'i.id', '=', 'm.institution_id')
            ->get(['m.user_id', 'i.id as institution_id', 'i.name as institution_name'])
            ->keyBy('user_id');

        $staff = DB::table('institution_access as a')
            ->join('institutions as i', 'i.id', '=', 'a.institution_id')
            ->get(['a.user_id', 'i.id as institution_id', 'i.name as institution_name'])
            ->groupBy('user_id');

        $ventures = DB::table('ventures')
            ->get(['id', 'owner_id', 'status'])
            ->groupBy('owner_id');

        $incubationByVenture = DB::table('incubation_paths')
            ->get(['venture_id', 'graduated_at'])
            ->groupBy('venture_id');

        $rows = $users->map(function ($u) use ($memberships, $staff, $ventures, $incubationByVenture) {
            $affiliation = $memberships->get($u->id) ?? ($staff->get($u->id)?->first());
            $userVentures = $ventures->get($u->id) ?? collect();

            $ventureStatus = 'none';
            if ($userVentures->contains(static fn ($v) => $v->status === 'approved')) {
                $ventureStatus = 'approved';
            } elseif ($userVentures->contains(static fn ($v) => $v->status === 'pending')) {
                $ventureStatus = 'pending';
            } elseif ($userVentures->contains(static fn ($v) => $v->status === 'rejected')) {
                $ventureStatus = 'rejected';
            }

            $incubationStatus = 'none';
            foreach ($userVentures as $v) {
                $paths = $incubationByVenture->get($v->id) ?? collect();
                if ($paths->contains(static fn ($p) => $p->graduated_at !== null)) {
                    $incubationStatus = 'graduated';
                    break;
                }
                if ($paths->isNotEmpty()) {
                    $incubationStatus = 'active';
                }
            }

            return [
                'id' => (int) $u->id,
                'name' => $u->name,
                'first_name' => $u->first_name,
                'last_name' => $u->last_name,
                'email' => $u->email,
                'role' => $u->role,
                'location' => $u->location,
                'email_verified_at' => $u->email_verified_at,
                'suspended_at' => $u->suspended_at,
                'google_connected' => ! empty($u->google_id),
                'has_password' => is_string($u->password) && $u->password !== '',
                'moodle_linked' => ! empty($u->moodle_user_id),
                'institution_id' => $affiliation ? (int) $affiliation->institution_id : null,
                'institution_name' => $affiliation?->institution_name,
                'venture_count' => $userVentures->count(),
                'venture_status' => $ventureStatus,
                'incubation_status' => $incubationStatus,
                'created_at' => $u->created_at,
            ];
        })->values();

        return response()->json(['data' => $rows])->header('Cache-Control', 'no-store');
    }
}
