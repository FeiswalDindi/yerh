<?php

use App\Http\Controllers\GoogleAuthController;
use App\Http\Controllers\IdentityController;
use App\Http\Controllers\InstitutionIdentityController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::prefix('api/v1/auth')->group(function () {
    Route::get('/csrf', fn (Request $request) => response()->json([
        'csrf_token' => $request->session()->token(),
    ])->header('Cache-Control', 'no-store'));
    Route::get('/providers', [GoogleAuthController::class, 'providers']);
    Route::middleware('throttle:auth-oauth')->group(function () {
        Route::get('/google/redirect', [GoogleAuthController::class, 'redirect']);
        Route::get('/google/callback', [GoogleAuthController::class, 'callback']);
    });
    Route::post('/register', [IdentityController::class, 'register'])->middleware('throttle:auth-register');
    Route::post('/login', [IdentityController::class, 'login'])->middleware('throttle:auth-login');
    Route::middleware('throttle:auth-password-reset')->group(function () {
        Route::post('/forgot-password', [IdentityController::class, 'forgotPassword']);
        Route::post('/reset-password', [IdentityController::class, 'resetPassword']);
    });
    Route::get('/verify-email/{id}/{hash}', [IdentityController::class, 'verify'])
        ->whereNumber('id')
        ->where('hash', '[a-f0-9]{40}')
        ->middleware(['signed', 'throttle:6,1'])
        ->name('verification.verify');
    Route::middleware('auth')->group(function () {
        Route::get('/me', [IdentityController::class, 'show']);
        Route::patch('/me', [IdentityController::class, 'updateProfile']);
        Route::post('/change-password', [IdentityController::class, 'changePassword'])
            ->middleware('throttle:5,1');
        Route::post('/logout', [IdentityController::class, 'logout']);
        Route::post('/verify-email/local-link', [IdentityController::class, 'localVerificationLink'])
            ->middleware('throttle:6,1,local-verification');
        Route::post('/verify-email/resend', [IdentityController::class, 'resend'])
            ->middleware('throttle:3,1');
    });
});

Route::get('/api/v1/identity/invitations/preview/{token}', [InstitutionIdentityController::class, 'preview'])
    ->where('token', '[a-f0-9]{64}')
    ->middleware('throttle:20,1');

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
