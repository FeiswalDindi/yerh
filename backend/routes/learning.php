<?php

use App\Http\Controllers\CourseAuthoringController;
use App\Http\Controllers\LearningEnrollmentController;
use App\Http\Middleware\VerifiedWorkspaceAccount;
use Illuminate\Support\Facades\Route;

Route::prefix('api/v1/learning')->middleware('throttle:60,1')->group(function () {
    Route::get('/', [LearningEnrollmentController::class, 'index']);
    Route::get('/courses/{slug}', [LearningEnrollmentController::class, 'show']);
    Route::middleware(['auth', VerifiedWorkspaceAccount::class])->group(function () {
        Route::post('/courses/{slug}/enrolments', [LearningEnrollmentController::class, 'enrol']);
        Route::post('/courses/{slug}/sync-progress', [LearningEnrollmentController::class, 'syncProgress']);
        Route::put('/courses/{slug}/lessons/{lesson}', [LearningEnrollmentController::class, 'complete'])->whereNumber('lesson');
        Route::get('/certificates/{document}', [LearningEnrollmentController::class, 'document'])->whereUuid('document')->name('learning.certificate');
        Route::get('/registry', [LearningEnrollmentController::class, 'registry']);
        Route::get('/registry/{id}/receipt', [LearningEnrollmentController::class, 'receipt'])->whereNumber('id');
        Route::post('/registry/{id}/payment', [LearningEnrollmentController::class, 'reviewPayment'])->whereNumber('id');
        Route::post('/registry/{id}/certificate', [LearningEnrollmentController::class, 'issueCertificate'])->whereNumber('id');
        Route::get('/authoring', [CourseAuthoringController::class, 'index']);
        Route::get('/placements', [CourseAuthoringController::class, 'placements']);
        Route::put('/placements', [CourseAuthoringController::class, 'updatePlacements']);
        Route::post('/moodle/sync', [CourseAuthoringController::class, 'syncMoodle']);
        Route::get('/moodle/launch', [LearningEnrollmentController::class, 'launchMoodle']);
        Route::post('/authoring', [CourseAuthoringController::class, 'propose']);
        Route::get('/authoring/{id}/attachment', [CourseAuthoringController::class, 'attachment'])->whereNumber('id');
        Route::post('/authoring/{id}/review', [CourseAuthoringController::class, 'review'])->whereNumber('id');
        Route::post('/authoring/{id}/lessons', [CourseAuthoringController::class, 'addLesson'])->whereNumber('id');
        Route::post('/authoring/{id}/publish', [CourseAuthoringController::class, 'publish'])->whereNumber('id');
    });
});
