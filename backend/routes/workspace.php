<?php

use App\Http\Controllers\AffiliationApplicationController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\InstitutionAgreementController;
use App\Http\Controllers\InstitutionDirectoryController;
use App\Http\Controllers\InstitutionIdentityController;
use App\Http\Controllers\VentureController;
use App\Http\Middleware\VerifiedWorkspaceAccount;
use Illuminate\Support\Facades\Route;

Route::get('/api/v1/institutions', [InstitutionDirectoryController::class, 'choices'])->middleware('throttle:60,1');

Route::prefix('api/v1/workspace')
    ->middleware(['auth', VerifiedWorkspaceAccount::class, 'throttle:60,1'])
    ->group(function () {
        Route::get('/summary', [DashboardController::class, 'summary']);
        Route::get('/activity', [DashboardController::class, 'activity']);
        Route::get('/users', [DashboardController::class, 'users']);
        Route::patch('/users/{id}', [DashboardController::class, 'updateAccess'])->whereNumber('id');
        Route::get('/applications', [AffiliationApplicationController::class, 'index']);
        Route::post('/applications', [AffiliationApplicationController::class, 'store']);
        Route::post('/applications/{id}/review', [AffiliationApplicationController::class, 'review'])->whereNumber('id');
        Route::get('/ventures', [VentureController::class, 'index']);
        Route::get('/institution-ventures', [VentureController::class, 'institutionVentures']);
        Route::post('/ventures', [VentureController::class, 'store']);
        Route::patch('/ventures/{id}', [VentureController::class, 'resubmit'])->whereNumber('id');
        Route::post('/ventures/{id}/review', [VentureController::class, 'review'])->whereNumber('id');
        Route::get('/institutions', [InstitutionDirectoryController::class, 'index']);
        Route::post('/institutions', [InstitutionDirectoryController::class, 'create']);
        Route::post('/institutions/{slug}/activate', [InstitutionDirectoryController::class, 'activate']);
        Route::patch('/institutions/{slug}', [InstitutionDirectoryController::class, 'update']);
        Route::get('/institutions/{slug}/staff', [InstitutionDirectoryController::class, 'staff']);
        Route::get('/institutions/{slug}/staff-candidates', [InstitutionDirectoryController::class, 'staffCandidates']);
        Route::post('/institutions/{slug}/staff', [InstitutionDirectoryController::class, 'assignStaff']);
        Route::get('/institutions/{slug}/agreements', [InstitutionAgreementController::class, 'index']);
        Route::post('/institutions/{slug}/agreements', [InstitutionAgreementController::class, 'store']);
        Route::get('/institutions/{slug}/agreements/{id}', [InstitutionAgreementController::class, 'download'])->whereNumber('id');
        Route::get('/institutions/{slug}/members', [InstitutionIdentityController::class, 'members']);
    });
