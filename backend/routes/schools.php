<?php

use App\Http\Controllers\SchoolCertificateController;
use App\Http\Controllers\SchoolPortalController;
use App\Http\Middleware\VerifiedWorkspaceAccount;
use Illuminate\Support\Facades\Route;

Route::prefix('api/v1/workspace')->middleware(['auth', VerifiedWorkspaceAccount::class, 'throttle:60,1'])->group(function () {
    Route::prefix('schools/{slug}')->group(function () {
        Route::get('/', [SchoolPortalController::class, 'index']);
        Route::post('/students', [SchoolPortalController::class, 'saveStudent']);
        Route::patch('/students/{student}', [SchoolPortalController::class, 'saveStudent'])->whereNumber('student');
        Route::post('/cohorts', [SchoolPortalController::class, 'addCohort']);
        Route::prefix('cohorts/{cohortId}')->where(['cohortId' => '[0-9]+'])->group(function () {
            Route::get('/', [SchoolPortalController::class, 'cohort']);
            Route::post('/teams', [SchoolPortalController::class, 'addTeam']);
            Route::post('/classes', [SchoolPortalController::class, 'addClass']);
            Route::put('/results/{student}/{stage}', [SchoolPortalController::class, 'recordResult'])->whereNumber('student');
            Route::post('/certificates/{kind}', [SchoolCertificateController::class, 'submit']);
        });
    });
    Route::get('/school-certificates', [SchoolCertificateController::class, 'index']);
    Route::post('/school-certificates/{id}/review', [SchoolCertificateController::class, 'review'])->whereNumber('id');
    Route::get('/school-certificates/{document}/document', [SchoolCertificateController::class, 'document'])->whereUuid('document');
});
