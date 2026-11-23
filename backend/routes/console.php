<?php

use App\Models\User;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

Artisan::command('yerh:bootstrap-admin {email}', function () {
    if (! app()->environment('local')) {
        $this->error('This command is available only in the local environment.');

        return 1;
    }

    $email = Str::lower(trim($this->argument('email')));
    $promoted = DB::transaction(function () use ($email) {
        if (User::query()->where('role', 'admin')->lockForUpdate()->first()) {
            return false;
        }
        $user = User::query()->where('email', $email)->lockForUpdate()->first();
        if (! $user || $user->role !== 'guest' || ! $user->isActive() || ! $user->hasVerifiedEmail()) {
            return false;
        }
        $user->forceFill(['role' => 'admin'])->save();

        return true;
    }, 3);
    if (! $promoted) {
        $this->error('A verified active guest is required, and this database must have no platform administrator.');

        return 1;
    }

    $this->info('The local platform administrator is ready. Refresh the account page.');

    return 0;
})->purpose('Promote a verified local account as the first YERH platform administrator');
