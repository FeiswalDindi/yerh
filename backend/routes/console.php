<?php

use App\Models\User;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
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
