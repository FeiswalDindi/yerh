<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Notifications\WorkspaceAlert;
use App\Support\WorkspaceNotifier;
use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Auth\Events\Registered;
use Illuminate\Auth\Events\Verified;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Password as PasswordBroker;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\ValidationException;

final class IdentityController extends Controller
{
    private const PENDING_VERIFICATION = 'email_verification.pending';

    public function register(Request $request): JsonResponse
    {
        $this->normalizeEmail($request);
        $data = $request->validate([
            'name' => ['required', 'string', 'min:2', 'max:120'],
            'email' => ['required', 'email', 'max:254', 'unique:users,email'],
            'password' => ['required', 'string', 'max:128', 'confirmed', Password::min(6)],
            'institution' => ['nullable', 'string', 'max:120'],
            'location' => ['nullable', 'string', 'min:2', 'max:120'],
            'role' => ['prohibited'],
        ]);

        $requestedInstitution = null;
        $slug = isset($data['institution']) ? trim($data['institution']) : '';
        if ($slug !== '' && $slug !== 'yerh') {
            $requestedInstitution = DB::table('institutions')
                ->where('slug', $slug)
                ->where('status', 'active')
                ->whereIn('kind', ['university', 'hub'])
                ->first(['id', 'slug', 'name']);
            if (! $requestedInstitution) {
                throw ValidationException::withMessages([
                    'institution' => 'Choose an active university or hub.',
                ]);
            }
        }

        try {
            $user = User::query()->create([
                'name' => trim($data['name']),
                'email' => $data['email'],
                'password' => $data['password'],
            ]);
            if ($requestedInstitution || ! empty($data['location'])) {
                $user->forceFill([
                    'requested_institution_id' => $requestedInstitution?->id,
                    'location' => isset($data['location']) ? trim($data['location']) : null,
                ])->save();
            }
        } catch (UniqueConstraintViolationException) {
            throw ValidationException::withMessages(['email' => __('validation.unique', ['attribute' => 'email'])]);
        }

        Auth::login($user);
        $request->session()->regenerate();
        event(new Registered($user));

        return $this->profile($user->refresh(), 201);
    }

    public function login(Request $request): JsonResponse
    {
        $this->normalizeEmail($request);
        $data = $request->validate([
            'email' => ['required', 'email', 'max:254'],
            'password' => ['required', 'string', 'max:128'],
            'institution' => ['sometimes', 'required', 'string', 'max:120'],
            'remember' => ['sometimes', 'boolean'],
        ]);
        $credentials = ['email' => $data['email'], 'password' => $data['password']];

        if (! Auth::attempt([...$credentials, 'suspended_at' => null], (bool) ($data['remember'] ?? false))) {
            throw ValidationException::withMessages(['email' => __('auth.failed')]);
        }

        $request->session()->regenerate();

        $user = $request->user();
        $affiliation = $this->affiliation($user);
        $staff = $this->staff($user);
        $allowed = [];
        if ($affiliation && $affiliation->status === 'active') {
            $allowed[] = $affiliation->slug;
        }
        if ($staff->isNotEmpty()) {
            $allowed = [...$allowed, ...$staff->pluck('slug')->all()];
        }
        if ($user->role === 'admin' || $allowed === []) {
            $allowed[] = 'yerh';
        }
        $requested = $this->requestedInstitution($user);
        if ($requested) {
            $allowed[] = $requested->slug;
        }
        $allowed = array_values(array_unique($allowed));

        if (! in_array($data['institution'] ?? 'yerh', $allowed, true)) {
            Auth::logout();
            $request->session()->invalidate();
            $request->session()->regenerateToken();
            throw ValidationException::withMessages(['institution' => 'Sign in using the institution associated with this account.']);
        }

        $pending = $request->session()->pull(self::PENDING_VERIFICATION);
        if ($pending && $pending['expires'] >= now()->getTimestamp()
            && $this->matchesVerification($user, $pending['id'], $pending['hash'])) {
            $this->verifyEmail($user);
        }

        return $this->profile($user->refresh());
    }

    public function forgotPassword(Request $request): JsonResponse
    {
        $this->normalizeEmail($request);
        $data = $request->validate([
            'email' => ['required', 'email', 'max:254'],
        ]);

        $user = User::query()->where('email', $data['email'])->first();
        if ($user && $user->isActive()) {
            PasswordBroker::broker()->sendResetLink(['email' => $user->email]);
        }

        return response()->json([
            'data' => [
                'message' => 'If an account matches that email address, a password reset link has been sent.',
            ],
        ])->header('Cache-Control', 'no-store');
    }

    public function resetPassword(Request $request): JsonResponse
    {
        $this->normalizeEmail($request);
        $data = $request->validate([
            'token' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:254'],
            'password' => ['required', 'string', 'max:128', 'confirmed', Password::min(6)],
        ]);

        $status = PasswordBroker::broker()->reset(
            $request->only('email', 'password', 'password_confirmation', 'token'),
            function (User $user, string $password): void {
                abort_unless($user->isActive(), 403, 'This account is unavailable.');
                $user->forceFill([
                    'password' => $password,
                    'remember_token' => Str::random(60),
                ])->save();
                DB::table('sessions')->where('user_id', $user->id)->delete();
                event(new PasswordReset($user));
            }
        );

        if ($status !== PasswordBroker::PASSWORD_RESET) {
            throw ValidationException::withMessages([
                'email' => __($status),
            ]);
        }

        return response()->json([
            'data' => [
                'message' => 'Your password has been reset. You can now sign in with your new password.',
            ],
        ])->header('Cache-Control', 'no-store');
    }

    public function changePassword(Request $request): JsonResponse
    {
        $actor = $request->user();
        abort_unless($actor->isActive(), 403, 'This account is unavailable.');

        $data = $request->validate([
            'current_password' => ['required', 'string', 'current_password'],
            'password' => ['required', 'string', 'max:128', 'confirmed', 'different:current_password', Password::min(6)],
        ]);

        $actor->forceFill([
            'password' => $data['password'],
            'remember_token' => Str::random(60),
        ])->save();

        DB::table('sessions')
            ->where('user_id', $actor->id)
            ->where('id', '!=', $request->session()->getId())
            ->delete();

        return response()->json([
            'data' => [
                'message' => 'Your password has been updated.',
            ],
        ])->header('Cache-Control', 'no-store');
    }

    public function show(Request $request): JsonResponse
    {
        return $this->profile($request->user());
    }

    public function logout(Request $request): Response
    {
        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->noContent();
    }

    public function verify(Request $request, string $id, string $hash): JsonResponse|RedirectResponse
    {
        $user = $request->user();
        if (! $user) {
            abort_if($request->expectsJson(), 401);

            // Only the signed route can store proof for the next sign-in.
            $request->session()->put(self::PENDING_VERIFICATION, [
                'id' => $id,
                'hash' => $hash,
                'expires' => (int) $request->query('expires'),
            ]);

            return $this->verificationRedirect(route('login', ['verification' => 'continue'], absolute: false));
        }

        abort_unless($user->isActive(), 403);
        if (! $this->matchesVerification($user, $id, $hash)) {
            abort_if($request->expectsJson(), 403);

            return $this->verificationRedirect(route('login', ['verification' => 'wrong-account'], absolute: false));
        }

        $this->verifyEmail($user);
        $fresh = $user->refresh();

        return $request->expectsJson()
            ? $this->profile($fresh)
            : $this->verificationRedirect($fresh->role === 'entrepreneur' ? '/dashboard' : '/account?verification=verified');
    }

    private function matchesVerification(User $user, string $id, string $hash): bool
    {
        return hash_equals((string) $user->getKey(), $id)
            && hash_equals(sha1($user->getEmailForVerification()), $hash);
    }

    private function verifyEmail(User $user): void
    {
        $hadRequestedInstitution = ! empty($user->requested_institution_id);
        $newlyVerified = false;

        if (! $user->hasVerifiedEmail() && $user->markEmailAsVerified()) {
            $newlyVerified = true;
            event(new Verified($user));
        }

        $this->resolveRequestedAffiliation($user);

        if ($newlyVerified && ! $hadRequestedInstitution) {
            WorkspaceNotifier::notifyUser(
                $user->id,
                'Welcome to the Youth Entrepreneurship Resource Hub! Your email is verified and your account is ready.',
                '/account',
                'Welcome to YERH — Email Verified',
                'Open YERH Account',
            );
        }
    }

    private function resolveRequestedAffiliation(User $user): void
    {
        if (! $user->requested_institution_id) {
            return;
        }

        $outcome = DB::transaction(function () use ($user) {
            $actor = User::query()->lockForUpdate()->find($user->id);
            if (! $actor || ! $actor->requested_institution_id || ! $actor->hasVerifiedEmail() || ! $actor->isActive()) {
                return null;
            }

            $institution = DB::table('institutions')
                ->where('id', $actor->requested_institution_id)
                ->where('status', 'active')
                ->whereIn('kind', ['university', 'hub'])
                ->first();

            $actor->forceFill(['requested_institution_id' => null])->save();

            if (! $institution || $actor->role !== 'guest'
                || DB::table('institution_memberships')->where('user_id', $actor->id)->exists()
                || DB::table('institution_access')->where('user_id', $actor->id)->exists()
                || DB::table('affiliation_applications')->where('pending_user_id', $actor->id)->exists()) {
                return null;
            }

            $domains = $this->parseDomains($institution->allowed_domains ?? null);
            $emailDomain = Str::after(Str::lower($actor->email), '@');
            $location = trim((string) ($actor->location ?? '')) ?: 'Not specified';

            if ($domains !== [] && in_array($emailDomain, $domains, true)) {
                DB::table('institution_memberships')->insert([
                    'user_id' => $actor->id,
                    'institution_id' => $institution->id,
                    'location' => $location,
                    'consented_at' => now(),
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
                $actor->forceFill(['role' => 'entrepreneur'])->save();

                return ['type' => 'approved', 'actor' => $actor, 'institution' => $institution];
            }

            DB::table('affiliation_applications')->insert([
                'user_id' => $actor->id,
                'pending_user_id' => $actor->id,
                'institution_id' => $institution->id,
                'location' => $location,
                'details' => 'Requested institution affiliation during account registration.',
                'consented_at' => now(),
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            return ['type' => 'pending', 'actor' => $actor, 'institution' => $institution];
        }, 3);

        if (! $outcome) {
            return;
        }

        /** @var User $actor */
        $actor = $outcome['actor'];
        $institution = $outcome['institution'];

        if ($outcome['type'] === 'approved') {
            $actor->notify(new WorkspaceAlert(
                "Your {$institution->name} email was verified automatically. Your Entrepreneur dashboard is now unlocked.",
                '/dashboard',
            ));

            return;
        }

        $actor->notify(new WorkspaceAlert(
            "Your affiliation request for {$institution->name} has been sent to the institution coordinator and YERH admin for review.",
            '/account',
        ));

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
                "{$actor->name} requested affiliation with {$institution->name}.",
                '/dashboard/workspace?tab=school&institution='.rawurlencode($institution->slug).'&view=requests',
            ));
        }

        $admins = User::query()->where('role', 'admin')->whereNull('suspended_at')->whereNotNull('email_verified_at')->get();
        if ($admins->isNotEmpty()) {
            Notification::send($admins, new WorkspaceAlert(
                "{$actor->name} requested affiliation with {$institution->name}.",
                '/dashboard/workspace?tab=approvals&view=roles',
            ));
        }
    }

    /**
     * @return list<string>
     */
    private function parseDomains(mixed $raw): array
    {
        if (is_string($raw)) {
            $decoded = json_decode($raw, true);
            $raw = is_array($decoded) ? $decoded : [];
        }

        if (! is_array($raw)) {
            return [];
        }

        return array_values(array_filter(array_map(
            static fn ($domain) => is_string($domain) ? Str::lower(ltrim(trim($domain), '@')) : '',
            $raw
        )));
    }

    private function verificationRedirect(string $path): RedirectResponse
    {
        return redirect($path, headers: ['Cache-Control' => 'no-store', 'Referrer-Policy' => 'no-referrer']);
    }

    public function localVerificationLink(Request $request): JsonResponse
    {
        $user = $request->user();
        abort_unless($this->allowsLocalVerification($request), 404);
        abort_unless($user->isActive(), 403);

        $url = $user->hasVerifiedEmail()
            ? '/account'
            : URL::temporarySignedRoute('verification.verify', now()->addMinutes(10), [
                'id' => $user->getKey(),
                'hash' => sha1($user->getEmailForVerification()),
            ]);

        return response()->json(['data' => ['url' => $url]])->header('Cache-Control', 'no-store');
    }

    private function allowsLocalVerification(Request $request): bool
    {
        return app()->environment('local')
            && config('app.local_email_verification')
            && config('mail.default') === 'log'
            && in_array($request->getHost(), ['localhost', '127.0.0.1', '[::1]'], true)
            && in_array($request->ip(), ['127.0.0.1', '::1'], true);
    }

    public function resend(Request $request): Response
    {
        abort_unless($request->user()->isActive(), 403);

        if (! $request->user()->hasVerifiedEmail()) {
            $request->user()->sendEmailVerificationNotification();
        }

        return response()->noContent();
    }

    private function normalizeEmail(Request $request): void
    {
        $email = $request->input('email');
        if (is_string($email)) {
            $request->merge(['email' => Str::lower(trim($email))]);
        }
    }

    private function affiliation(User $user): ?object
    {
        return DB::table('institution_memberships as membership')
            ->join('institutions as institution', 'membership.institution_id', '=', 'institution.id')
            ->where('membership.user_id', $user->id)
            ->first(['institution.slug', 'institution.name', 'institution.kind', 'institution.status']);
    }

    private function requestedInstitution(User $user): ?object
    {
        if (! $user->requested_institution_id) {
            return null;
        }

        return DB::table('institutions')
            ->where('id', $user->requested_institution_id)
            ->where('status', 'active')
            ->first(['slug', 'name', 'kind']);
    }

    private function staff(User $user): Collection
    {
        return DB::table('institution_access as staff')
            ->join('institutions as institution', 'staff.institution_id', '=', 'institution.id')
            ->where('staff.user_id', $user->id)->where('institution.status', 'active')->orderBy('institution.name')
            ->get(['institution.slug', 'institution.name', 'institution.kind', 'staff.access']);
    }

    public function updateProfile(Request $request): JsonResponse
    {
        $actor = $request->user();
        abort_unless($actor->isActive() && $actor->hasVerifiedEmail(), 403);
        $actor->forceFill($request->validate([
            'name' => ['required', 'string', 'min:2', 'max:80'],
            'location' => ['required', 'string', 'min:2', 'max:80'],
            'headline' => ['required', 'string', 'min:3', 'max:120'],
            'bio' => ['required', 'string', 'min:10', 'max:600'],
        ]))->save();

        return $this->profile($actor->refresh());
    }

    private function profile(User $user, int $status = 200): JsonResponse
    {
        abort_unless($user->isActive(), 403);

        return response()->json(['data' => [
            'id' => $user->getKey(),
            'name' => $user->name,
            'email' => $user->email,
            'location' => $user->location ?? '',
            'headline' => $user->headline ?? '',
            'bio' => $user->bio ?? '',
            'email_verified' => $user->hasVerifiedEmail(),
            'local_verification_available' => ! $user->hasVerifiedEmail() && $this->allowsLocalVerification(request()),
            'role' => $user->role,
            'affiliation' => $this->affiliation($user),
            'requested_institution' => $this->requestedInstitution($user),
            'staff' => $this->staff($user),
        ]], $status)->header('Cache-Control', 'no-store');
    }
}
