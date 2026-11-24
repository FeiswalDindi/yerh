<?php

use App\Http\Controllers\CmsController;
use App\Http\Controllers\CmsMediaController;
use App\Http\Controllers\EditorialContentController;
use App\Http\Controllers\MarketplaceSectorController;
use App\Http\Controllers\VentureProductController;
use Illuminate\Support\Facades\Route;

Route::get('/v1/status', fn () => response()->json(['status' => 'ok']));

Route::prefix('v1/cms')->middleware('throttle:120,1')->group(function () {
    Route::get('/public', [CmsController::class, 'publicPayload']);
    Route::get('/media/{uuid}', [CmsMediaController::class, 'show'])->whereUuid('uuid');
});

Route::get('/v1/marketplace-sectors/{id}/image', [MarketplaceSectorController::class, 'image'])
    ->whereNumber('id');

Route::get('/v1/marketplace/{slug}/image', [VentureProductController::class, 'publicImage']);

Route::get('/v1/editorial', [EditorialContentController::class, 'publicIndex'])
    ->middleware('throttle:120,1');
