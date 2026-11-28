<?php

namespace App\Domain\Identity;

use App\Models\User;
use App\Notifications\WorkspaceAlert;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;

final class AffiliationResolver
{
    public static function resolve(User $user): void
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

            $domains = self::parseDomains($institution->allowed_domains ?? null);
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
    public static function parseDomains(mixed $raw): array
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

    public static function sanitizeRedirect(?string $redirect): ?string
    {
        if (! is_string($redirect)) {
            return null;
        }

        $trimmed = trim($redirect);
        if ($trimmed === '' || ! str_starts_with($trimmed, '/') || str_starts_with($trimmed, '//') || preg_match('/[\\\\\s]/', $trimmed)) {
            return null;
        }

        $path = parse_url($trimmed, PHP_URL_PATH);
        if (! is_string($path) || str_starts_with($path, '//') || preg_match('#^/(login|register|demo)(/|$)#i', $path)) {
            return null;
        }

        return $trimmed;
    }

    public static function defaultDestination(User $user): string
    {
        if (! $user->hasVerifiedEmail()) {
            return '/account';
        }

        if ($user->role !== 'guest' || DB::table('institution_access')->where('user_id', $user->id)->exists()) {
            return '/dashboard';
        }

        return '/account';
    }
}
