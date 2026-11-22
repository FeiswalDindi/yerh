<?php

use App\Http\Controllers\FrontendController;
use Illuminate\Support\Facades\Route;

// Preserve root-relative URLs already used by the content fixtures.
Route::get('/media/{file}', fn (string $file) => redirect('/ui/media/'.$file))
    ->where('file', '(?:[A-Za-z0-9_-]+/)*[A-Za-z0-9_.-]+\.[A-Za-z0-9]+');
Route::redirect('/yerh-loader.css', '/ui/yerh-loader.css');
Route::redirect('/favicon.svg', '/ui/favicon.svg');

Route::get('/{path?}', FrontendController::class)
    ->where('path', '(?!(?:api|ui|media|storage)(?:/|$)).*');
