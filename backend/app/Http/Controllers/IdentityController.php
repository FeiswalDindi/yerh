<?php

namespace App\Http\Controllers;

use App\Models\User;
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
            'name' => ['required', 'string', 'max:120'],
            'email' => ['required', 'email', 'max:254', 'unique:users,email'],
            'password' => ['required', 'string', 'max:128', 'confirmed', Password::min(6)],
            'role' => ['prohibited'],
        ]);

        try {
            $user = User::query()->create($data);
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
        ]);
        $credentials = ['email' => $data['email'], 'password' => $data['password']];

        if (! Auth::attempt([...$credentials, 'suspended_at' => null])) {
            throw ValidationException::withMessages(['email' => __('auth.failed')]);
        }

        $request->session()->regenerate();

        $user = $request->user();
        $affiliation = $this->affiliation($user);
        $staff = $this->staff($user);
        $allowed = $affiliation ? [$affiliation->slug] : $staff->pluck('slug')->all();
        if (! $affiliation && ! DB::table('institution_access')->where('user_id', $user->id)->exists()) {
            $allowed = ['yerh'];
        }
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

        return $this->profile($user);
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

        return $request->expectsJson()
            ? $this->profile($user)
            : $this->verificationRedirect('/account?verification=verified');
    }

    private function matchesVerification(User $user, string $id, string $hash): bool
    {
        return hash_equals((string) $user->getKey(), $id)
            && hash_equals(sha1($user->getEmailForVerification()), $hash);
    }

    private function verifyEmail(User $user): void
    {
        if (! $user->hasVerifiedEmail() && $user->markEmailAsVerified()) {
            event(new Verified($user));
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
            'staff' => $this->staff($user),
        ]], $status)->header('Cache-Control', 'no-store');
    }
}
