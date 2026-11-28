<?php

namespace App\Http\Controllers;

use App\Domain\Identity\AffiliationResolver;
use App\Integrations\Moodle\MoodleClient;
use App\Models\User;
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
use Illuminate\Support\Facades\Password as PasswordBroker;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\ValidationException;

final class IdentityController extends Controller
{
    private const PENDING_VERIFICATION = 'email_verification.pending';

    public function register(Request $request, MoodleClient $moodle): JsonResponse
    {
        $this->normalizeEmail($request);
        $data = $request->validate([
            'first_name' => ['required_without:name', 'nullable', 'string', 'min:1', 'max:80'],
            'last_name' => ['required_without:name', 'nullable', 'string', 'min:1', 'max:80'],
            'name' => ['required_without_all:first_name,last_name', 'nullable', 'string', 'min:1', 'max:120'],
            'email' => ['required', 'email', 'max:254', 'unique:users,email'],
            'password' => ['required', 'string', 'max:128', 'confirmed', Password::min(6)],
            'institution' => ['nullable', 'string', 'max:120'],
            'location' => ['nullable', 'string', 'min:2', 'max:120'],
            'terms' => ['sometimes', 'accepted'],
            'role' => ['prohibited'],
        ]);

        $first = trim((string) ($data['first_name'] ?? ''));
        $last = trim((string) ($data['last_name'] ?? ''));
        if ($first === '' || $last === '') {
            [$splitFirst, $splitLast] = User::splitFullName((string) ($data['name'] ?? ''));
            $first = $first !== '' ? $first : $splitFirst;
            $last = $last !== '' ? $last : $splitLast;
        }
        $fullName = trim($first.' '.$last);

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
                'name' => $fullName,
                'first_name' => $first,
                'last_name' => $last,
                'email' => $data['email'],
                'password' => $data['password'],
            ]);
            $extra = [];
            if ($requestedInstitution) {
                $extra['requested_institution_id'] = $requestedInstitution->id;
            }
            if (! empty($data['location'])) {
                $extra['location'] = trim($data['location']);
            }
            if ($request->has('terms')) {
                $extra['terms_accepted_at'] = now();
            }
            if ($extra !== []) {
                $user->forceFill($extra)->save();
            }
        } catch (UniqueConstraintViolationException) {
            throw ValidationException::withMessages(['email' => __('validation.unique', ['attribute' => 'email'])]);
        }

        Auth::login($user);
        $request->session()->regenerate();
        event(new Registered($user));

        $fresh = $user->refresh();
        $moodle->syncUserAccount($fresh, $data['password']);

        return $this->profile($fresh->refresh(), 201);
    }

    public function login(Request $request, MoodleClient $moodle): JsonResponse
    {
        $this->normalizeEmail($request);
        $data = $request->validate([
            'email' => ['required', 'email', 'max:254'],
            'password' => ['required', 'string', 'max:128'],
            'institution' => ['sometimes', 'nullable', 'string', 'max:120'],
            'remember' => ['sometimes', 'boolean'],
        ]);
        $credentials = ['email' => $data['email'], 'password' => $data['password']];

        if (! Auth::attempt([...$credentials, 'suspended_at' => null], (bool) ($data['remember'] ?? false))) {
            throw ValidationException::withMessages(['email' => __('auth.failed')]);
        }

        $request->session()->regenerate();

        $user = $request->user();
        $explicitInstitution = is_string($data['institution'] ?? null) ? trim($data['institution']) : '';
        if ($explicitInstitution !== '') {
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

            if (! in_array($explicitInstitution, $allowed, true)) {
                $pendingVerification = $request->session()->get(self::PENDING_VERIFICATION);
                Auth::logout();
                $request->session()->invalidate();
                $request->session()->regenerateToken();
                if ($pendingVerification) {
                    $request->session()->put(self::PENDING_VERIFICATION, $pendingVerification);
                }
                throw ValidationException::withMessages(['institution' => 'Sign in using the institution associated with this account.']);
            }
        }

        $pending = $request->session()->pull(self::PENDING_VERIFICATION);
        if ($pending && $pending['expires'] >= now()->getTimestamp()
            && $this->matchesVerification($user, $pending['id'], $pending['hash'])) {
            $this->verifyEmail($user);
        }

        $moodle->syncUserAccount($user, $data['password']);

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

    public function resetPassword(Request $request, MoodleClient $moodle): JsonResponse
    {
        $this->normalizeEmail($request);
        $data = $request->validate([
            'token' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:254'],
            'password' => ['required', 'string', 'max:128', 'confirmed', Password::min(6)],
        ]);

        $resetUser = null;
        $status = PasswordBroker::broker()->reset(
            $request->only('email', 'password', 'password_confirmation', 'token'),
            function (User $user, string $password) use (&$resetUser): void {
                abort_unless($user->isActive(), 403, 'This account is unavailable.');
                $user->forceFill([
                    'password' => $password,
                    'remember_token' => Str::random(60),
                ])->save();
                DB::table('sessions')->where('user_id', $user->id)->delete();
                event(new PasswordReset($user));
                $resetUser = $user;
            }
        );

        if ($status !== PasswordBroker::PASSWORD_RESET) {
            throw ValidationException::withMessages([
                'email' => __($status),
            ]);
        }

        if ($resetUser instanceof User) {
            $moodle->syncUserAccount($resetUser, $data['password']);
        }

        return response()->json([
            'data' => [
                'message' => 'Your password has been reset. You can now sign in with your new password.',
            ],
        ])->header('Cache-Control', 'no-store');
    }

    public function changePassword(Request $request, MoodleClient $moodle): JsonResponse
    {
        $actor = $request->user();
        abort_unless($actor->isActive(), 403, 'This account is unavailable.');

        $hadPassword = $actor->hasPassword();
        $data = $request->validate($hadPassword ? [
            'current_password' => ['required', 'string', 'current_password'],
            'password' => ['required', 'string', 'max:128', 'confirmed', 'different:current_password', Password::min(6)],
        ] : [
            'password' => ['required', 'string', 'max:128', 'confirmed', Password::min(6)],
        ]);

        $actor->forceFill([
            'password' => $data['password'],
            'remember_token' => Str::random(60),
        ])->save();

        DB::table('sessions')
            ->where('user_id', $actor->id)
            ->where('id', '!=', $request->session()->getId())
            ->delete();

        $moodle->syncUserAccount($actor, $data['password']);

        return response()->json([
            'data' => [
                'message' => $hadPassword
                    ? 'Your password has been updated.'
                    : 'Your password has been set.',
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

        AffiliationResolver::resolve($user);

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

    public function updateProfile(Request $request, MoodleClient $moodle): JsonResponse
    {
        $actor = $request->user();
        abort_unless($actor->isActive() && $actor->hasVerifiedEmail(), 403);
        $data = $request->validate([
            'first_name' => ['sometimes', 'nullable', 'string', 'min:1', 'max:80'],
            'last_name' => ['sometimes', 'nullable', 'string', 'min:1', 'max:80'],
            'name' => ['required_without_all:first_name,last_name', 'nullable', 'string', 'min:1', 'max:80'],
            'location' => ['required', 'string', 'min:2', 'max:80'],
            'headline' => ['required', 'string', 'min:3', 'max:120'],
            'bio' => ['required', 'string', 'min:10', 'max:600'],
        ]);

        $first = trim((string) ($data['first_name'] ?? ''));
        $last = trim((string) ($data['last_name'] ?? ''));
        if ($first !== '' && $last !== '') {
            $name = trim($first.' '.$last);
        } else {
            $name = trim((string) ($data['name'] ?? $actor->name));
            [$splitFirst, $splitLast] = User::splitFullName($name);
            $first = $first !== '' ? $first : $splitFirst;
            $last = $last !== '' ? $last : $splitLast;
        }

        $actor->forceFill([
            'name' => $name,
            'first_name' => $first,
            'last_name' => $last,
            'location' => $data['location'],
            'headline' => $data['headline'],
            'bio' => $data['bio'],
        ])->save();

        $fresh = $actor->refresh();
        $moodle->syncUserProfile($fresh);

        return $this->profile($fresh);
    }

    private function profile(User $user, int $status = 200): JsonResponse
    {
        abort_unless($user->isActive(), 403);
        $names = $user->moodleNames();

        return response()->json(['data' => [
            'id' => $user->getKey(),
            'name' => $user->name,
            'first_name' => $user->first_name ?? $names['firstname'],
            'last_name' => $user->last_name ?? $names['lastname'],
            'email' => $user->email,
            'location' => $user->location ?? '',
            'headline' => $user->headline ?? '',
            'bio' => $user->bio ?? '',
            'email_verified' => $user->hasVerifiedEmail(),
            'local_verification_available' => ! $user->hasVerifiedEmail() && $this->allowsLocalVerification(request()),
            'has_password' => $user->hasPassword(),
            'google_connected' => ! empty($user->google_id),
            'avatar' => $user->avatar,
            'role' => $user->role,
            'moodle_user_id' => $user->moodle_user_id ? (int) $user->moodle_user_id : null,
            'affiliation' => $this->affiliation($user),
            'requested_institution' => $this->requestedInstitution($user),
            'staff' => $this->staff($user),
        ]], $status)->header('Cache-Control', 'no-store');
    }
}
