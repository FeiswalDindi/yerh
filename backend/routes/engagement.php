<?php

use App\Http\Controllers\EngagementEventController;
use App\Http\Controllers\OpportunityController;
use App\Http\Middleware\VerifiedWorkspaceAccount;
use Illuminate\Support\Facades\Route;

Route::prefix('api/v1/engagement')->middleware('throttle:60,1')->group(function () {
    Route::get('/events', [EngagementEventController::class, 'index']);
    Route::get('/events/{slug}', [EngagementEventController::class, 'show']);
    Route::get('/opportunities', [OpportunityController::class, 'index']);
    Route::get('/opportunities/{slug}', [OpportunityController::class, 'show']);
    Route::middleware(['auth', VerifiedWorkspaceAccount::class])->group(function () {
        Route::match(['post', 'delete'], '/events/{slug}/booking', [EngagementEventController::class, 'reserve']);
        Route::get('/manage/events', [EngagementEventController::class, 'index'])->defaults('admin', true);
        Route::post('/manage/events', [EngagementEventController::class, 'save']);
        Route::patch('/manage/events/{id}', [EngagementEventController::class, 'save'])->whereNumber('id');
        Route::post('/manage/event-categories', [EngagementEventController::class, 'category']);
        Route::patch('/manage/event-categories/{id}', [EngagementEventController::class, 'category'])->whereNumber('id');
        Route::post('/opportunities/{slug}/applications', [OpportunityController::class, 'apply']);
        Route::get('/applications', [OpportunityController::class, 'submissions']);
        Route::get('/applications/{id}/attachment', [OpportunityController::class, 'attachment'])->whereNumber('id');
        Route::post('/applications/{id}/decision', [OpportunityController::class, 'decide'])->whereNumber('id');
        Route::get('/manage/opportunities', [OpportunityController::class, 'index'])->defaults('admin', true);
        Route::post('/manage/opportunities', [OpportunityController::class, 'save']);
        Route::patch('/manage/opportunities/{id}', [OpportunityController::class, 'save'])->whereNumber('id');
    });
});
