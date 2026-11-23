<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Notifications\InstitutionInvitationIssued;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

final class InstitutionIdentityController extends Controller
{
    public function access(Request $request, string $slug): JsonResponse
    {
        $institution = $this->institution($slug);
        $access = $this->staffAccess($request->user(), $institution->id);
        abort_unless(in_array($access, ['view', 'manage'], true), 403);

        return response()->json(['data' => [
            'institution' => $institution->slug,
            'access' => $access,
        ]])->header('Cache-Control', 'no-store');
    }

    public function members(Request $request, string $slug): JsonResponse
    {
        $institution = $this->institution($slug);
        $access = $this->staffAccess($request->user(), $institution->id);
        abort_unless(in_array($access, ['view', 'manage'], true), 403);
        $members = DB::table('institution_memberships as membership')
            ->join('users', 'membership.user_id', '=', 'users.id')
            ->where('membership.institution_id', $institution->id)
            ->orderBy('users.name')->get(['users.id', 'users.name', 'membership.location', 'membership.created_at']);
        $ventures = DB::table('ventures')->where('institution_id', $institution->id)
            ->orderBy('name')->get(['id', 'owner_id', 'name', 'sector', 'status']);
        $invitations = $access === 'manage'
            ? DB::table('institution_invitations')->where('institution_id', $institution->id)->latest('id')
                ->get(['id', 'name', 'email', 'expires_at', 'accepted_at', 'revoked_at'])
            : [];

        $paths = DB::table('incubation_paths as path')->join('ventures as venture', 'venture.id', '=', 'path.venture_id')
            ->where('venture.institution_id', $institution->id)->whereIn('venture.owner_id', $members->pluck('id'))
            ->get(['path.id', 'path.venture_id', 'path.graduated_at']);
        $stages = DB::table('incubation_stages')->whereIn('path_id', $paths->pluck('id'))
            ->get(['path_id', 'stage', 'graded_at']);
        $payments = DB::table('programme_payments')->whereIn('path_id', $paths->pluck('id'))
            ->get(['path_id', 'purpose', 'status']);
        $credentials = DB::table('venture_credentials')->whereIn('path_id', $paths->pluck('id'))
            ->get(['path_id', 'kind', 'issued_at']);
        $agreement = $institution->agreement_reference;

        return response()->json(['data' => compact('access', 'members', 'ventures', 'invitations', 'paths', 'stages', 'payments', 'credentials', 'agreement')])
            ->header('Cache-Control', 'no-store');
    }

    private function invitationScope(Request $request, string $slug, bool $lock = false): object
    {
        $institution = $this->institution($slug, $lock);
        abort_unless(in_array($institution->kind, ['university', 'hub'], true)
            && $this->staffAccess($request->user(), $institution->id) === 'manage', 403);

        return $institution;
    }

    private function eligibleInvitees()
    {
        return User::query()->where('role', 'guest')->whereNotNull('email_verified_at')->whereNull('suspended_at')
            ->whereNotExists(fn ($q) => $q->from('institution_access')->whereColumn('user_id', 'users.id'))
            ->whereNotExists(fn ($q) => $q->from('institution_memberships')->whereColumn('user_id', 'users.id'))
            ->whereNotExists(fn ($q) => $q->from('institution_invitations')->whereColumn('pending_email', 'users.email')->where('expires_at', '>', now()));
    }

    public function invitees(Request $request, string $slug): JsonResponse
    {
        $this->invitationScope($request, $slug);
        $search = $request->validate(['q' => ['nullable', 'string', 'max:120']])['q'] ?? '';

        return response()->json(['data' => $this->eligibleInvitees()->whereLike('name', '%'.$search.'%')
            ->orderBy('name')->orderBy('id')->limit(50)->get(['id', 'name'])])->header('Cache-Control', 'no-store');
    }

    public function issue(Request $request, string $slug): JsonResponse
    {
        $this->invitationScope($request, $slug);
        $batch = $request->has('user_ids');
        $data = $request->validate($batch ? [
            'user_ids' => ['required', 'array', 'min:1', 'max:50'],
            'user_ids.*' => ['required', 'integer', 'min:1', 'distinct'],
        ] : [
            'email' => ['required', 'email', 'max:254'],
            'name' => ['required', 'string', 'min:2', 'max:80'],
        ]);
        try {
            $ids = DB::transaction(function () use ($slug, $request, $batch, $data) {
                $institution = $this->invitationScope($request, $slug, true);
                if ($batch) {
                    $recipients = $this->eligibleInvitees()->whereKey($data['user_ids'])->orderBy('id')->lockForUpdate()->get(['name', 'email']);
                    if ($recipients->count() !== count($data['user_ids'])) {
                        throw ValidationException::withMessages(['user_ids' => 'One or more accounts are no longer eligible. Refresh the list and try again.']);
                    }
                } else {
                    $recipients = [(object) $data];
                }
                $ids = [];
                foreach ($recipients as $recipient) {
                    $email = Str::lower(trim($recipient->email));
                    $token = bin2hex(random_bytes(32));
                    DB::table('institution_invitations')->where('pending_email', $email)
                        ->where('expires_at', '<=', now())->update(['pending_email' => null]);
                    $ids[] = DB::table('institution_invitations')->insertGetId([
                        'institution_id' => $institution->id, 'invited_by' => $request->user()->id,
                        'name' => $recipient->name, 'email' => $email, 'pending_email' => $email,
                        'token_hash' => hash('sha256', $token), 'expires_at' => now()->addDays(7),
                        'created_at' => now(), 'updated_at' => now(),
                    ]);
                    DB::afterCommit(fn () => Notification::route('mail', $email)
                        ->notify(new InstitutionInvitationIssued($institution->name, $token)));
                }

                return $ids;
            }, 3);
        } catch (UniqueConstraintViolationException) {
            throw ValidationException::withMessages([$batch ? 'user_ids' : 'email' => 'A recipient already has a pending invitation.']);
        }

        return response()->json(['data' => $batch ? ['ids' => $ids] : ['id' => $ids[0]]], 201)->header('Cache-Control', 'no-store');
    }

    public function revoke(Request $request, string $slug, int $id): Response
    {
        $institution = $this->institution($slug);
        abort_unless($this->staffAccess($request->user(), $institution->id) === 'manage', 403);
        $changed = DB::table('institution_invitations')->where('id', $id)
            ->where('institution_id', $institution->id)->whereNotNull('pending_email')
            ->where('expires_at', '>', now())
            ->update(['pending_email' => null, 'revoked_at' => now(), 'updated_at' => now()]);
        abort_unless($changed === 1, 404);

        return response()->noContent();
    }

    public function accept(Request $request): JsonResponse
    {
        $data = $request->validate([
            'token' => ['required', 'string', 'size:64', 'regex:/^[a-f0-9]+$/D'],
            'location' => ['required', 'string', 'max:120'],
            'consent' => ['accepted'],
        ]);
        $institution = DB::transaction(function () use ($request, $data) {
            $actor = User::query()->lockForUpdate()->findOrFail($request->user()->id);
            abort_unless($actor->hasVerifiedEmail() && $actor->isActive()
                && in_array($actor->role, ['guest', 'entrepreneur'], true), 403);
            $invite = DB::table('institution_invitations')->where('token_hash', hash('sha256', $data['token']))
                ->where('pending_email', Str::lower($actor->email))->where('expires_at', '>', now())
                ->lockForUpdate()->first();
            if (! $invite) {
                throw ValidationException::withMessages(['token' => 'This invitation is invalid or no longer available.']);
            }
            $institution = DB::table('institutions')->where('id', $invite->institution_id)
                ->where('status', 'active')->whereIn('kind', ['university', 'hub'])->first();
            abort_unless($institution, 403);
            abort_if(DB::table('institution_access')->where('user_id', $actor->id)->exists(), 403);
            if (DB::table('institution_memberships')->where('user_id', $actor->id)->exists()) {
                throw ValidationException::withMessages(['token' => 'This account already has an institution affiliation.']);
            }
            DB::table('institution_memberships')->insert([
                'institution_id' => $institution->id,
                'user_id' => $actor->id,
                'location' => $data['location'],
                'consented_at' => now(),
                'created_at' => now(),
                'updated_at' => now(),
            ]);
            $actor->forceFill(['role' => 'entrepreneur'])->save();
            DB::table('affiliation_applications')->where('pending_user_id', $actor->id)->update([
                'status' => 'withdrawn', 'pending_user_id' => null,
                'decision_note' => 'The learner joined an institution by invitation.', 'updated_at' => now(),
            ]);
            DB::table('institution_invitations')->where('id', $invite->id)->update([
                'pending_email' => null,
                'accepted_by' => $actor->id,
                'accepted_at' => now(),
                'updated_at' => now(),
            ]);

            return $institution->slug;
        }, 3);

        return response()->json(['data' => ['institution' => $institution, 'role' => 'entrepreneur']])
            ->header('Cache-Control', 'no-store');
    }

    private function institution(string $slug, bool $lock = false): object
    {
        $query = DB::table('institutions')->where('slug', $slug)->where('status', 'active');
        $institution = ($lock ? $query->lockForUpdate() : $query)->first();
        abort_unless($institution, 404);

        return $institution;
    }

    private function staffAccess(User $actor, int $institution): ?string
    {
        if (! $actor->isActive() || ! $actor->hasVerifiedEmail()) {
            return null;
        }

        return $actor->role === 'admin' ? 'manage' : DB::table('institution_access')
            ->where('institution_id', $institution)->where('user_id', $actor->id)->value('access');
    }
}
