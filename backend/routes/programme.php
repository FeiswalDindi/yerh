<?php

use App\Http\Controllers\MarketplaceSectorController;
use App\Http\Controllers\IncubationController;
use App\Http\Controllers\IncubationStageController;
use App\Http\Controllers\ProgrammePaymentController;
use App\Http\Controllers\VentureCertificateController;
use App\Http\Controllers\VentureProductController;
use App\Http\Middleware\VerifiedWorkspaceAccount;
use Illuminate\Support\Facades\Route;

Route::get('api/v1/marketplace-sectors', [MarketplaceSectorController::class, 'index']);

Route::prefix('api/v1/marketplace')->middleware('throttle:60,1')->group(function () {
    Route::get('/', [VentureProductController::class, 'publicIndex']);
    Route::get('/{slug}', [VentureProductController::class, 'publicShow']);
});

Route::prefix('api/v1/workspace')
    ->middleware(['auth', VerifiedWorkspaceAccount::class, 'throttle:60,1'])
    ->group(function () {
        Route::post('/marketplace-sectors', [MarketplaceSectorController::class, 'save']);
        Route::post('/marketplace-sectors/{id}/image', [MarketplaceSectorController::class, 'save'])->whereNumber('id');
        Route::get('/incubation', [IncubationController::class, 'index']);
        Route::get('/incubation/{id}', [IncubationController::class, 'show'])->whereNumber('id');
        Route::post('/ventures/{ventureId}/launch', [IncubationController::class, 'launch'])->whereNumber('ventureId');
        Route::post('/incubation/{id}/mentor', [IncubationController::class, 'assign'])->whereNumber('id');
        Route::post('/incubation/{id}/stages/{stage}/{action}', [IncubationStageController::class, 'update'])->whereNumber('id');
        Route::get('/incubation/{id}/stages/{stage}/evidence/{step}/attachment', [IncubationStageController::class, 'evidenceAttachment'])->whereNumber('id');
        Route::get('/incubation/{id}/stages/{stage}/exam-attachment', [IncubationStageController::class, 'examAttachment'])->whereNumber('id');
        Route::get('/mentors', [IncubationController::class, 'mentors']);
        Route::get('/mentors/candidates', [IncubationController::class, 'mentorCandidates']);
        Route::post('/mentors', [IncubationController::class, 'registerMentor']);
        Route::get('/products', [VentureProductController::class, 'index']);
        Route::post('/products', [VentureProductController::class, 'store']);
        Route::get('/products/{id}/image', [VentureProductController::class, 'workspaceImage'])->whereNumber('id');
        Route::post('/products/{id}', [VentureProductController::class, 'update'])->whereNumber('id');
        Route::patch('/products/{id}', [VentureProductController::class, 'update'])->whereNumber('id');
        Route::post('/products/{id}/evidence', [VentureProductController::class, 'submitEvidence'])->whereNumber('id');
        Route::post('/products/{id}/review/{review}', [VentureProductController::class, 'review'])->whereNumber('id');
        Route::get('/programme-fees', [ProgrammePaymentController::class, 'settings']);
        Route::put('/programme-fees/{purpose}', [ProgrammePaymentController::class, 'changeSetting']);
        Route::get('/payment-instructions', [ProgrammePaymentController::class, 'instructions']);
        Route::put('/payment-instructions', [ProgrammePaymentController::class, 'updateInstructions']);
        Route::get('/programme-payments', [ProgrammePaymentController::class, 'index']);
        Route::post('/programme-payments', [ProgrammePaymentController::class, 'record']);
        Route::get('/programme-payments/{id}/receipt', [ProgrammePaymentController::class, 'receipt'])->whereNumber('id');
        Route::post('/programme-payments/{id}/review', [ProgrammePaymentController::class, 'review'])->whereNumber('id');
        Route::get('/venture-certificates', [VentureCertificateController::class, 'index']);
        Route::post('/incubation/{id}/certificates/{kind}', [VentureCertificateController::class, 'issue'])->whereNumber('id');
        Route::get('/venture-certificates/{document}/document', [VentureCertificateController::class, 'document'])->whereUuid('document');
    });
