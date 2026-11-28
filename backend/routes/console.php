<?php

use App\Integrations\Moodle\MoodleClient;
use App\Integrations\Moodle\MoodleProgressSync;
use App\Models\User;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schedule;
use Illuminate\Support\Str;

Artisan::command('yerh:bootstrap-admin {email} {--verify : Mark the account email as verified if unverified}', function () {
    $email = Str::lower(trim($this->argument('email')));
    $verify = (bool) $this->option('verify');
    $promoted = DB::transaction(function () use ($email, $verify) {
        if (User::query()->where('role', 'admin')->lockForUpdate()->first()) {
            return 'exists';
        }
        $user = User::query()->where('email', $email)->lockForUpdate()->first();
        if (! $user || $user->role !== 'guest' || ! $user->isActive()) {
            return 'ineligible';
        }
        if (! $user->hasVerifiedEmail()) {
            if (! $verify) {
                return 'unverified';
            }
            $user->forceFill(['email_verified_at' => now()]);
        }
        $user->forceFill(['role' => 'admin'])->save();

        return 'ok';
    }, 3);

    if ($promoted === 'exists') {
        $this->error('A platform administrator already exists in this database.');

        return 1;
    }
    if ($promoted === 'unverified') {
        $this->error('Verify this account email first, or pass --verify to bootstrap on a fresh server.');

        return 1;
    }
    if ($promoted !== 'ok') {
        $this->error('An active guest account matching that email is required.');

        return 1;
    }

    $this->info('The platform administrator is ready. Refresh the account page.');

    return 0;
})->purpose('Promote an active guest account as the first YERH platform administrator when none exists');

Artisan::command('moodle:sync-progress', function (MoodleProgressSync $sync) {
    $result = $sync->syncAllActive();
    $this->info("Synced {$result['enrolments']} enrolment(s) and {$result['pathways']} incubation pathway(s).");

    return 0;
})->purpose('Synchronize active Moodle course and incubation pathway progress into YERH');

Artisan::command('moodle:sync-users', function (MoodleClient $moodle) {
    if (! $moodle->isConfigured()) {
        $this->error('Moodle is not configured in .env.');

        return 1;
    }

    $synced = 0;
    User::query()->orderBy('id')->chunkById(100, function ($users) use ($moodle, &$synced): void {
        foreach ($users as $user) {
            if ($moodle->syncUserAccount($user) !== null) {
                $synced++;
            }
        }
    });

    $this->info("Synchronized {$synced} YERH account(s) with Moodle.");

    return 0;
})->purpose('Provision and synchronize all YERH users with Moodle');

Schedule::command('moodle:sync-progress')->everyTenMinutes()->withoutOverlapping();
