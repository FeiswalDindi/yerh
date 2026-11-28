<?php

namespace App\Http\Controllers;

use App\Integrations\Moodle\MoodleClient;
use App\Models\User;
use App\Support\WorkspaceNotifier;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

final class CareerApplicationController extends Controller
{
    private const TRACK_LABELS = [
        'partnership' => 'Partnership',
        'mentorship' => 'Mentorship',
        'investor' => 'Investment & Funding',
    ];

    private const PROMOTABLE_ROLES = [
        'partnership' => 'partner',
        'mentorship' => 'mentor',
        'investor' => 'investor',
    ];

    public function apply(Request $request): JsonResponse
    {
        $data = $request->validate([
            'track' => ['required', Rule::in(array_keys(self::TRACK_LABELS))],
            'applicant_name' => ['required', 'string', 'min:2', 'max:120'],
            'applicant_email' => ['required', 'email', 'max:254'],
            'applicant_phone' => ['required', 'string', 'min:6', 'max:40'],
            'organization' => ['nullable', 'string', 'max:160'],
            'website' => ['nullable', 'url:http,https', 'max:300'],
            'linkedin_url' => ['nullable', 'url:http,https', 'max:300'],
            'focus_area' => ['nullable', 'string', 'max:140'],
            'message' => ['required', 'string', 'min:15', 'max:3000'],
        ]);

        $track = $data['track'];
        $trackLabel = self::TRACK_LABELS[$track];
        $name = trim($data['applicant_name']);
        $email = Str::lower(trim($data['applicant_email']));
        $org = isset($data['organization']) && trim($data['organization']) !== '' ? trim($data['organization']) : null;
        $website = isset($data['website']) && trim($data['website']) !== '' ? trim($data['website']) : null;
        $linkedin = isset($data['linkedin_url']) && trim($data['linkedin_url']) !== '' ? trim($data['linkedin_url']) : null;
        $focus = isset($data['focus_area']) && trim($data['focus_area']) !== '' ? trim($data['focus_area']) : null;

        $id = DB::table('career_applications')->insertGetId([
            'track' => $track,
            'applicant_name' => $name,
            'applicant_email' => $email,
            'applicant_phone' => trim($data['applicant_phone']),
            'organization' => $org,
            'website' => $website,
            'linkedin_url' => $linkedin,
            'focus_area' => $focus,
            'message' => trim($data['message']),
            'user_id' => $request->user()?->id,
            'status' => 'pending',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $orgSuffix = $org ? " ({$org})" : '';
        WorkspaceNotifier::notifyAdmins(
            "New {$trackLabel} request from {$name}{$orgSuffix}.",
            '/dashboard/workspace?tab=approvals&view=careers',
            "New {$trackLabel} request from {$name}",
            'Review in Approval Queue',
        );

        WorkspaceNotifier::notifyExternalEmail(
            $email,
            $name,
            "YERH received your {$trackLabel} request",
            "Thank you for reaching out to Youth Entrepreneurship Resource Hub regarding {$trackLabel}.\n\nOur administration team has received your request (#{$id}) and will review it shortly.",
            'Explore YERH Careers',
            '/careers',
        );

        return response()->json([
            'data' => [
                'id' => $id,
                'track' => $track,
                'status' => 'pending',
            ],
        ], 201);
    }

    public function index(Request $request): JsonResponse
    {
        abort_unless($request->user()->role === 'admin', 403);

        $rows = DB::table('career_applications as app')
            ->leftJoin('users as reviewer', 'reviewer.id', '=', 'app.reviewer_id')
            ->select(
                'app.id',
                'app.track',
                'app.applicant_name',
                'app.applicant_email',
                'app.applicant_phone',
                'app.organization',
                'app.website',
                'app.linkedin_url',
                'app.focus_area',
                'app.message',
                'app.user_id',
                'app.status',
                'app.decision_note',
                'app.reviewed_at',
                'app.created_at',
                'reviewer.name as reviewer_name',
            )
            ->orderByRaw("CASE WHEN app.status = 'pending' THEN 0 ELSE 1 END")
            ->orderByDesc('app.id')
            ->get();

        $emails = $rows->pluck('applicant_email')->map(fn ($e) => Str::lower((string) $e))->unique()->values()->all();
        $userIds = $rows->pluck('user_id')->filter()->unique()->values()->all();

        $matchedUsers = DB::table('users')
            ->where(function ($q) use ($emails, $userIds): void {
                if ($emails !== []) {
                    $q->whereIn(DB::raw('LOWER(email)'), $emails);
                }
                if ($userIds !== []) {
                    $q->orWhereIn('id', $userIds);
                }
            })
            ->whereNull('suspended_at')
            ->whereNotNull('email_verified_at')
            ->get(['id', 'email', 'role'])
            ->map(function ($u) {
                $u->can_promote = $u->role === 'guest'
                    && ! DB::table('institution_memberships')->where('user_id', $u->id)->exists()
                    && ! DB::table('institution_access')->where('user_id', $u->id)->exists();

                return $u;
            });

        $byId = $matchedUsers->keyBy('id');
        $byEmail = $matchedUsers->keyBy(fn ($u) => Str::lower((string) $u->email));

        $payload = $rows->map(function ($row) use ($byId, $byEmail) {
            $matched = ($row->user_id ? $byId->get($row->user_id) : null)
                ?? $byEmail->get(Str::lower((string) $row->applicant_email));
            $row->matched_user_id = $matched ? (int) $matched->id : null;
            $row->matched_user_role = $matched?->role;
            $row->can_promote = (bool) ($matched?->can_promote ?? false);

            return $row;
        });

        return response()->json(['data' => $payload])->header('Cache-Control', 'private, no-store');
    }

    public function review(Request $request, int $id, MoodleClient $moodle): JsonResponse
    {
        abort_unless($request->user()->role === 'admin', 403);

        $data = $request->validate([
            'decision' => ['required', Rule::in(['approved', 'rejected'])],
            'note' => ['required_if:decision,rejected', 'nullable', 'string', 'max:1500'],
            'promote_account' => ['sometimes', 'boolean'],
        ]);

        $actor = $request->user();
        $promotedUserId = null;
        $targetRole = null;

        $app = DB::transaction(function () use ($actor, $id, $data, &$promotedUserId, &$targetRole) {
            $row = DB::table('career_applications')->where('id', $id)->lockForUpdate()->first() ?? abort(404);
            abort_unless($row->status === 'pending', 409, 'This request has already been reviewed.');

            $note = isset($data['note']) && trim($data['note']) !== '' ? trim($data['note']) : null;

            if ($data['decision'] === 'approved' && (bool) ($data['promote_account'] ?? false)) {
                $targetRole = self::PROMOTABLE_ROLES[$row->track] ?? null;
                if ($targetRole !== null) {
                    $candidate = DB::table('users')
                        ->where(function ($q) use ($row): void {
                            if ($row->user_id) {
                                $q->where('id', $row->user_id);
                            } else {
                                $q->whereRaw('LOWER(email) = ?', [Str::lower((string) $row->applicant_email)]);
                            }
                        })
                        ->where('role', 'guest')
                        ->whereNull('suspended_at')
                        ->whereNotNull('email_verified_at')
                        ->lockForUpdate()
                        ->first();

                    if ($candidate
                        && ! DB::table('institution_memberships')->where('user_id', $candidate->id)->exists()
                        && ! DB::table('institution_access')->where('user_id', $candidate->id)->exists()) {
                        DB::table('users')->where('id', $candidate->id)->update([
                            'role' => $targetRole,
                            'requested_institution_id' => null,
                            'updated_at' => now(),
                        ]);
                        $promotedUserId = (int) $candidate->id;
                    }
                }
            }

            DB::table('career_applications')->where('id', $id)->update([
                'status' => $data['decision'],
                'decision_note' => $note,
                'reviewer_id' => $actor->id,
                'reviewed_at' => now(),
                'updated_at' => now(),
            ]);

            return $row;
        }, 3);

        if ($promotedUserId !== null) {
            $promotedUser = User::query()->find($promotedUserId);
            if ($promotedUser) {
                $moodle->syncUserProfile($promotedUser);
            }
        }

        $trackLabel = self::TRACK_LABELS[$app->track] ?? ucfirst($app->track);
        $decisionWord = $data['decision'] === 'approved' ? 'approved' : 'declined';
        $noteText = isset($data['note']) && trim($data['note']) !== '' ? "\n\nReviewer note: ".trim($data['note']) : '';

        if ($promotedUserId !== null && $targetRole !== null) {
            $roleTitle = ucfirst($targetRole);
            WorkspaceNotifier::notifyUser(
                $promotedUserId,
                "Your {$trackLabel} request was approved and your YERH account is now active as a {$roleTitle}.{$noteText}",
                '/dashboard',
                "Your {$trackLabel} request was approved",
                'Open Dashboard',
            );
        }

        WorkspaceNotifier::notifyExternalEmail(
            $app->applicant_email,
            $app->applicant_name,
            "Update on your YERH {$trackLabel} request",
            "Hello {$app->applicant_name},\n\nYour {$trackLabel} request (#{$app->id}) has been {$decisionWord} by the YERH administration team.{$noteText}",
            'Visit YERH',
            '/careers',
        );

        return response()->json([
            'data' => [
                'id' => $id,
                'status' => $data['decision'],
                'promoted_user_id' => $promotedUserId,
                'promoted_role' => $targetRole,
            ],
        ]);
    }
}
