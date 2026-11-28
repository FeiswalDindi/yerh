<?php

use App\Http\Controllers\EditorialContentController;
use App\Http\Controllers\FrontendController;
use App\Http\Controllers\WorkspaceNotificationController;
use App\Http\Middleware\RecordWorkspaceActivity;
use App\Http\Middleware\VerifiedWorkspaceAccount;
use Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse;
use Illuminate\Cookie\Middleware\EncryptCookies;
use Illuminate\Foundation\Http\Middleware\ValidateCsrfToken;
use Illuminate\Session\Middleware\StartSession;
use Illuminate\Support\Facades\Route;
use Illuminate\View\Middleware\ShareErrorsFromSession;

require __DIR__.'/identity.php';
require __DIR__.'/workspace.php';
require __DIR__.'/programme.php';
require __DIR__.'/schools.php';
require __DIR__.'/learning.php';
require __DIR__.'/engagement.php';
require __DIR__.'/community.php';
require __DIR__.'/cms.php';

Route::prefix('api/v1/notifications')->middleware(['auth', VerifiedWorkspaceAccount::class, 'throttle:60,1'])->group(function () {
    Route::get('/', [WorkspaceNotificationController::class, 'index']);
    Route::post('/read-all', [WorkspaceNotificationController::class, 'readAll']);
    Route::post('/{id}/read', [WorkspaceNotificationController::class, 'read'])->whereUuid('id');
});

Route::prefix('api/v1/workspace/editorial')->middleware(['auth', VerifiedWorkspaceAccount::class, 'throttle:60,1'])->group(function () {
    Route::get('/', [EditorialContentController::class, 'index']);
    Route::post('/', [EditorialContentController::class, 'save']);
    Route::patch('/{id}', [EditorialContentController::class, 'save'])->whereNumber('id');
    Route::delete('/{id}', [EditorialContentController::class, 'destroy'])->whereNumber('id');
});

// Preserve root-relative URLs already used by the content fixtures.
Route::get('/media/{file}', fn (string $file) => redirect('/ui/media/'.$file, 301, [
    'Cache-Control' => 'public, max-age=86400',
]))
    ->where('file', '(?:[A-Za-z0-9_-]+/)*[A-Za-z0-9_.-]+\.[A-Za-z0-9]+')
    ->withoutMiddleware([
        EncryptCookies::class,
        AddQueuedCookiesToResponse::class,
        StartSession::class,
        ShareErrorsFromSession::class,
        ValidateCsrfToken::class,
        RecordWorkspaceActivity::class,
    ]);
Route::redirect('/yerh-loader.css', '/ui/yerh-loader.css');
Route::redirect('/favicon.svg', '/ui/favicon.svg');
Route::get('/login', FrontendController::class)->name('login');

Route::get('/{path?}', FrontendController::class)
    ->where('path', '(?!(?:api|ui|media|storage)(?:/|$)).*');
