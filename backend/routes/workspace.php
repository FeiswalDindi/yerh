<?php

use App\Http\Controllers\AffiliationApplicationController;
use App\Http\Controllers\CareerApplicationController;
use App\Http\Controllers\CommunicationsController;
use App\Http\Controllers\ContactMessageController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\InstitutionAgreementController;
use App\Http\Controllers\InstitutionDirectoryController;
use App\Http\Controllers\InstitutionIdentityController;
use App\Http\Controllers\InstitutionOnboardingController;
use App\Http\Controllers\VentureController;
use App\Http\Middleware\VerifiedWorkspaceAccount;
use Illuminate\Support\Facades\Route;

Route::get('/api/v1/institutions', [InstitutionDirectoryController::class, 'choices'])->middleware('throttle:60,1');
Route::post('/api/v1/institutions/apply', [InstitutionOnboardingController::class, 'apply'])->middleware('throttle:10,1');
Route::post('/api/v1/careers/apply', [CareerApplicationController::class, 'apply'])->middleware('throttle:10,1');
Route::post('/api/v1/contact', [ContactMessageController::class, 'store'])->middleware('throttle:10,1');

Route::prefix('api/v1/workspace')
    ->middleware(['auth', VerifiedWorkspaceAccount::class, 'throttle:60,1'])
    ->group(function () {
        Route::get('/summary', [DashboardController::class, 'summary']);
        Route::get('/activity', [DashboardController::class, 'activity']);
        Route::get('/users', [DashboardController::class, 'users']);
        Route::patch('/users/{id}', [DashboardController::class, 'updateAccess'])->whereNumber('id');
        Route::get('/applications', [AffiliationApplicationController::class, 'index']);
        Route::post('/applications', [AffiliationApplicationController::class, 'store']);
        Route::get('/applications/{id}/document', [AffiliationApplicationController::class, 'document'])->whereNumber('id');
        Route::post('/applications/{id}/review', [AffiliationApplicationController::class, 'review'])->whereNumber('id');
        Route::get('/institution-applications', [InstitutionOnboardingController::class, 'index']);
        Route::get('/institution-applications/{id}/document', [InstitutionOnboardingController::class, 'document'])->whereNumber('id');
        Route::post('/institution-applications/{id}/review', [InstitutionOnboardingController::class, 'review'])->whereNumber('id');
        Route::get('/career-applications', [CareerApplicationController::class, 'index']);
        Route::post('/career-applications/{id}/review', [CareerApplicationController::class, 'review'])->whereNumber('id');
        Route::get('/contact-messages', [ContactMessageController::class, 'index']);
        Route::patch('/contact-messages/{id}', [ContactMessageController::class, 'update'])->whereNumber('id');
        Route::prefix('communications')->group(function () {
            Route::get('/audience', [CommunicationsController::class, 'audience']);
            Route::post('/broadcast', [CommunicationsController::class, 'broadcast']);
            Route::post('/enquiries/{id}/reply', [CommunicationsController::class, 'replyToEnquiry'])->whereNumber('id');
            Route::get('/templates', [CommunicationsController::class, 'templates']);
            Route::post('/templates', [CommunicationsController::class, 'saveTemplate']);
            Route::patch('/templates/{id}', [CommunicationsController::class, 'saveTemplate'])->whereNumber('id');
            Route::delete('/templates/{id}', [CommunicationsController::class, 'deleteTemplate'])->whereNumber('id');
            Route::get('/history', [CommunicationsController::class, 'history']);
            Route::get('/history/{id}', [CommunicationsController::class, 'dispatchDetail'])->whereNumber('id');
            Route::get('/outbox', [CommunicationsController::class, 'outbox']);
            Route::get('/outbox/{id}', [CommunicationsController::class, 'outboxDetail'])->whereNumber('id');
        });
        Route::get('/ventures', [VentureController::class, 'index']);
        Route::get('/institution-ventures', [VentureController::class, 'institutionVentures']);
        Route::post('/ventures', [VentureController::class, 'store']);
        Route::patch('/ventures/{id}', [VentureController::class, 'resubmit'])->whereNumber('id');
        Route::post('/ventures/{id}/review', [VentureController::class, 'review'])->whereNumber('id');
        Route::get('/institutions', [InstitutionDirectoryController::class, 'index']);
        Route::post('/institutions', [InstitutionDirectoryController::class, 'create']);
        Route::post('/institutions/{slug}/activate', [InstitutionDirectoryController::class, 'activate']);
        Route::post('/institutions/{slug}/deactivate', [InstitutionDirectoryController::class, 'deactivate']);
        Route::patch('/institutions/{slug}', [InstitutionDirectoryController::class, 'update']);
        Route::get('/institutions/{slug}/staff', [InstitutionDirectoryController::class, 'staff']);
        Route::get('/institutions/{slug}/staff-candidates', [InstitutionDirectoryController::class, 'staffCandidates']);
        Route::post('/institutions/{slug}/staff', [InstitutionDirectoryController::class, 'assignStaff']);
        Route::delete('/institutions/{slug}/staff/{userId}', [InstitutionDirectoryController::class, 'removeStaff'])->whereNumber('userId');
        Route::get('/institutions/{slug}/agreements', [InstitutionAgreementController::class, 'index']);
        Route::post('/institutions/{slug}/agreements', [InstitutionAgreementController::class, 'store']);
        Route::get('/institutions/{slug}/agreements/{id}', [InstitutionAgreementController::class, 'download'])->whereNumber('id');
        Route::get('/institutions/{slug}/members', [InstitutionIdentityController::class, 'members']);
    });
