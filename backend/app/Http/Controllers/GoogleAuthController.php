<?php

namespace App\Http\Controllers;

use App\Domain\Identity\AffiliationResolver;
use App\Integrations\Moodle\MoodleClient;
use App\Models\User;
use App\Support\WorkspaceNotifier;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Laravel\Socialite\Facades\Socialite;
use Laravel\Socialite\Two\InvalidStateException;
use Throwable;

final class GoogleAuthController extends Controller
{
    private const OAUTH_INTENT_KEY = 'google_oauth.intent';

    public function providers(): JsonResponse
    {
        return response()->json([
            'data' => [
                'google' => $this->isConfigured(),
            ],
        ])->header('Cache-Control', 'no-store');
    }

    public function redirect(Request $request): RedirectResponse
    {
        if (! $this->isConfigured()) {
            return $this->errorRedirect('not-configured');
        }

        $data = $request->validate([
            'mode' => ['nullable', 'in:login,register'],
            'institution' => ['nullable', 'string', 'max:120'],
            'location' => ['nullable', 'string', 'max:120'],
            'redirect' => ['nullable', 'string', 'max:300'],
        ]);

        $request->session()->put(self::OAUTH_INTENT_KEY, [
            'mode' => $data['mode'] ?? 'login',
            'institution' => isset($data['institution']) ? trim($data['institution']) : '',
            'location' => isset($data['location']) ? trim($data['location']) : '',
            'redirect' => AffiliationResolver::sanitizeRedirect($data['redirect'] ?? null),
        ]);

        return Socialite::driver('google')
            ->scopes(['openid', 'profile', 'email'])
            ->with(['prompt' => 'select_account'])
            ->redirect();
    }

    public function callback(Request $request, MoodleClient $moodle): RedirectResponse
    {
        if (! $this->isConfigured()) {
            return $this->errorRedirect('not-configured');
        }

        if ($request->filled('error')) {
            $request->session()->forget(self::OAUTH_INTENT_KEY);

            return $this->errorRedirect('cancelled');
        }

        /** @var array{mode?: string, institution?: string, location?: string, redirect?: string|null} $intent */
        $intent = (array) $request->session()->pull(self::OAUTH_INTENT_KEY, []);

        try {
            $googleUser = Socialite::driver('google')->user();
        } catch (InvalidStateException) {
            return $this->errorRedirect('state-mismatch');
        } catch (Throwable $exception) {
            Log::warning('Google OAuth callback failed.', [
                'exception' => $exception::class,
                'message' => $exception->getMessage(),
            ]);

            return $this->errorRedirect('failed');
        }

        $raw = match (true) {
            method_exists($googleUser, 'getRaw') => (array) $googleUser->getRaw(),
            is_array($googleUser->user ?? null) => $googleUser->user,
            default => [],
        };
        $googleId = trim((string) ($googleUser->getId() ?: ($raw['sub'] ?? '')));
        $email = Str::lower(trim((string) $googleUser->getEmail()));
        $emailVerified = filter_var(
            $raw['email_verified'] ?? $raw['verified_email'] ?? false,
            FILTER_VALIDATE_BOOLEAN,
        );

        if ($googleId === '' || $email === '') {
            return $this->errorRedirect('missing-email');
        }

        $avatar = trim((string) ($googleUser->getAvatar() ?? ($raw['picture'] ?? '')));
        if ($avatar !== '' && ! str_starts_with($avatar, 'https://')) {
            $avatar = '';
        }
        $avatar = $avatar !== '' ? mb_substr($avatar, 0, 500) : null;

        $givenName = trim((string) ($raw['given_name'] ?? ''));
        $familyName = trim((string) ($raw['family_name'] ?? ''));
        $displayName = trim((string) ($googleUser->getName() ?: ($raw['name'] ?? '')));

        $outcome = DB::transaction(function () use (
            $googleId,
            $email,
            $emailVerified,
            $avatar,
            $givenName,
            $familyName,
            $displayName,
            $intent,
        ): array {
            $user = User::query()->where('google_id', $googleId)->lockForUpdate()->first();
            $isNew = false;
            $newlyVerified = false;
            $hadRequestedInstitution = false;

            if ($user) {
                if (! $user->isActive()) {
                    return ['error' => 'suspended'];
                }

                $updates = [];
                if ($avatar !== null && $user->avatar !== $avatar) {
                    $updates['avatar'] = $avatar;
                }
                if (! $user->hasVerifiedEmail() && $emailVerified) {
                    $updates['email_verified_at'] = now();
                    $newlyVerified = true;
                }
                if ($updates !== []) {
                    $user->forceFill($updates)->save();
                }

                return [
                    'user' => $user,
                    'is_new' => false,
                    'newly_verified' => $newlyVerified,
                    'had_requested_institution' => ! empty($user->requested_institution_id),
                ];
            }

            $existing = User::query()->where('email', $email)->lockForUpdate()->first();
            if ($existing) {
                if (! $emailVerified) {
                    return ['error' => 'unverified-email'];
                }
                if (! $existing->isActive()) {
                    return ['error' => 'suspended'];
                }
                if (! empty($existing->google_id) && $existing->google_id !== $googleId) {
                    return ['error' => 'account-conflict'];
                }

                $updates = ['google_id' => $googleId];
                if ($avatar !== null && empty($existing->avatar)) {
                    $updates['avatar'] = $avatar;
                }
                if (! $existing->hasVerifiedEmail()) {
                    $updates['email_verified_at'] = now();
                    $newlyVerified = true;
                }
                $existing->forceFill($updates)->save();

                return [
                    'user' => $existing,
                    'is_new' => false,
                    'newly_verified' => $newlyVerified,
                    'had_requested_institution' => ! empty($existing->requested_institution_id),
                ];
            }

            if (! $emailVerified) {
                return ['error' => 'unverified-email'];
            }

            $first = $givenName !== '' ? mb_substr($givenName, 0, 80) : '';
            $last = $familyName !== '' ? mb_substr($familyName, 0, 80) : '';
            if ($first === '' || $last === '') {
                [$splitFirst, $splitLast] = User::splitFullName($displayName !== '' ? $displayName : Str::before($email, '@'));
                $first = $first !== '' ? $first : $splitFirst;
                $last = $last !== '' ? $last : $splitLast;
            }
            $fullName = trim($first.' '.$last);

            $requestedInstitution = null;
            $slug = trim((string) ($intent['institution'] ?? ''));
            if ($slug !== '' && $slug !== 'yerh') {
                $requestedInstitution = DB::table('institutions')
                    ->where('slug', $slug)
                    ->where('status', 'active')
                    ->whereIn('kind', ['university', 'hub'])
                    ->first(['id']);
            }
            $hadRequestedInstitution = $requestedInstitution !== null;
            $intentLocation = trim((string) ($intent['location'] ?? ''));

            $user = User::query()->create([
                'name' => $fullName,
                'first_name' => $first,
                'last_name' => $last,
                'email' => $email,
                'password' => null,
            ]);

            $user->forceFill([
                'google_id' => $googleId,
                'avatar' => $avatar,
                'email_verified_at' => now(),
                'terms_accepted_at' => now(),
                'requested_institution_id' => $requestedInstitution?->id,
                'location' => $intentLocation !== '' ? mb_substr($intentLocation, 0, 120) : null,
            ])->save();

            $isNew = true;

            return [
                'user' => $user,
                'is_new' => $isNew,
                'newly_verified' => false,
                'had_requested_institution' => $hadRequestedInstitution,
            ];
        }, 3);

        if (isset($outcome['error'])) {
            return $this->errorRedirect((string) $outcome['error']);
        }

        /** @var User $user */
        $user = $outcome['user'];
        $isNew = (bool) $outcome['is_new'];
        $newlyVerified = (bool) $outcome['newly_verified'];
        $hadRequestedInstitution = (bool) $outcome['had_requested_institution'];

        if ($isNew || $newlyVerified) {
            AffiliationResolver::resolve($user->refresh());
            if ($isNew && ! $hadRequestedInstitution) {
                WorkspaceNotifier::notifyUser(
                    $user->id,
                    'Welcome to the Youth Entrepreneurship Resource Hub! Your Google account is connected and ready.',
                    '/account',
                    'Welcome to YERH',
                    'Open YERH Account',
                );
            }
        }

        $fresh = $user->refresh();
        Auth::login($fresh, true);
        $request->session()->regenerate();
        $moodle->syncUserAccount($fresh);

        $destination = $intent['redirect'] ?? AffiliationResolver::defaultDestination($fresh);

        return $this->safeRedirect($destination);
    }

    private function isConfigured(): bool
    {
        return filled(config('services.google.client_id'))
            && filled(config('services.google.client_secret'));
    }

    private function errorRedirect(string $code): RedirectResponse
    {
        return $this->safeRedirect(route('login', ['oauth_error' => $code], absolute: false));
    }

    private function safeRedirect(string $path): RedirectResponse
    {
        return redirect($path, headers: [
            'Cache-Control' => 'no-store',
            'Referrer-Policy' => 'no-referrer',
        ]);
    }
}
