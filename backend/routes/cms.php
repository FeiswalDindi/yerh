<?php

use App\Http\Controllers\CmsController;
use App\Http\Controllers\CmsMediaController;
use App\Http\Middleware\VerifiedWorkspaceAccount;
use Illuminate\Support\Facades\Route;

Route::prefix('api/v1/workspace/cms')
    ->middleware(['auth', VerifiedWorkspaceAccount::class, 'throttle:60,1'])
    ->group(function () {
        Route::get('/', [CmsController::class, 'index']);
        Route::put('/{section}/draft', [CmsController::class, 'saveDraft'])->where('section', '[a-z]+');
        Route::post('/{section}/publish', [CmsController::class, 'publish'])->where('section', '[a-z]+');
        Route::post('/{section}/discard', [CmsController::class, 'discardDraft'])->where('section', '[a-z]+');
        Route::post('/revisions/{id}/restore', [CmsController::class, 'restore'])->whereNumber('id');

        Route::get('/media', [CmsMediaController::class, 'index']);
        Route::post('/media', [CmsMediaController::class, 'store']);
        Route::patch('/media/{id}', [CmsMediaController::class, 'update'])->whereNumber('id');
        Route::delete('/media/{id}', [CmsMediaController::class, 'destroy'])->whereNumber('id');
    });
