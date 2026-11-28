<?php

use App\Http\Controllers\CommunityController;
use App\Http\Middleware\VerifiedWorkspaceAccount;
use Illuminate\Support\Facades\Route;

Route::prefix('api/v1/community')->middleware('throttle:90,1')->group(function () {
    Route::get('/forums', [CommunityController::class, 'forums']);
    Route::get('/groups', [CommunityController::class, 'groups']);
    Route::get('/groups/{slug}', [CommunityController::class, 'showGroup']);
    Route::get('/members/{id}', [CommunityController::class, 'memberProfile'])->whereNumber('id');
    Route::get('/threads/{id}', [CommunityController::class, 'showThread'])->whereNumber('id');
    Route::get('/articles/{contentId}/engagement', [CommunityController::class, 'articleEngagement'])
        ->where('contentId', '[A-Za-z0-9_.-]+');
    Route::get('/sidebar', [CommunityController::class, 'sidebar']);

    Route::middleware(['auth', VerifiedWorkspaceAccount::class])->group(function () {
        // Verified users (including verified Guests) can participate in public Forums, Groups & Articles
        Route::post('/threads', [CommunityController::class, 'storeThread']);
        Route::post('/threads/{id}/replies', [CommunityController::class, 'storeReply'])->whereNumber('id');
        Route::post('/replies/{id}/vote', [CommunityController::class, 'toggleVote'])->whereNumber('id');
        Route::post('/threads/{id}/solution', [CommunityController::class, 'markSolution'])->whereNumber('id');
        Route::post('/groups/{slug}/membership', [CommunityController::class, 'toggleGroupMembership']);

        Route::post('/articles/{contentId}/like', [CommunityController::class, 'toggleArticleLike'])
            ->where('contentId', '[A-Za-z0-9_.-]+');
        Route::post('/articles/{contentId}/comments', [CommunityController::class, 'storeArticleComment'])
            ->where('contentId', '[A-Za-z0-9_.-]+');
        Route::delete('/articles/comments/{id}', [CommunityController::class, 'deleteArticleComment'])->whereNumber('id');

        // Dashboard-only community features (verified Guests receive 403)
        Route::get('/leaderboard', [CommunityController::class, 'leaderboard']);

        // Moderation & Admin/Content Manager governance
        Route::post('/manage/forums', [CommunityController::class, 'saveForum']);
        Route::patch('/manage/forums/{id}', [CommunityController::class, 'saveForum'])->whereNumber('id');
        Route::post('/manage/groups', [CommunityController::class, 'saveGroup']);
        Route::patch('/manage/groups/{id}', [CommunityController::class, 'saveGroup'])->whereNumber('id');
        Route::get('/manage/moderation', [CommunityController::class, 'moderation']);
        Route::patch('/manage/threads/{id}', [CommunityController::class, 'moderateThread'])->whereNumber('id');
        Route::patch('/manage/replies/{id}', [CommunityController::class, 'moderateReply'])->whereNumber('id');
        Route::patch('/manage/comments/{id}', [CommunityController::class, 'moderateComment'])->whereNumber('id');
    });
});
