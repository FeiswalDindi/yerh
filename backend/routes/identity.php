<?php

use App\Http\Controllers\IdentityController;
use App\Http\Controllers\InstitutionIdentityController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::prefix('api/v1/auth')->group(function () {
    Route::get('/csrf', fn (Request $request) => response()->json([
        'csrf_token' => $request->session()->token(),
    ])->header('Cache-Control', 'no-store'));
    Route::middleware('throttle:5,1')->group(function () {
        Route::post('/register', [IdentityController::class, 'register']);
        Route::post('/login', [IdentityController::class, 'login']);
    });
    Route::get('/verify-email/{id}/{hash}', [IdentityController::class, 'verify'])
        ->whereNumber('id')
        ->where('hash', '[a-f0-9]{40}')
        ->middleware(['signed', 'throttle:6,1'])
        ->name('verification.verify');
    Route::middleware('auth')->group(function () {
        Route::get('/me', [IdentityController::class, 'show']);
        Route::patch('/me', [IdentityController::class, 'updateProfile']);
        Route::post('/logout', [IdentityController::class, 'logout']);
        Route::post('/verify-email/local-link', [IdentityController::class, 'localVerificationLink'])
            ->middleware('throttle:6,1,local-verification');
        Route::post('/verify-email/resend', [IdentityController::class, 'resend'])
            ->middleware('throttle:3,1');
    });
});

Route::prefix('api/v1/identity')->middleware(['auth', 'throttle:30,1,institution-access'])->group(function () {
    Route::get('/institutions/{slug}/access', [InstitutionIdentityController::class, 'access']);
    Route::get('/institutions/{slug}/invitees', [InstitutionIdentityController::class, 'invitees']);
    Route::post('/institutions/{slug}/invitations', [InstitutionIdentityController::class, 'issue'])
        ->middleware('throttle:5,1,institution-operation');
    Route::delete('/institutions/{slug}/invitations/{id}', [InstitutionIdentityController::class, 'revoke'])
        ->whereNumber('id');
    Route::post('/invitations/accept', [InstitutionIdentityController::class, 'accept'])
        ->middleware('throttle:5,1,institution-operation');
});
