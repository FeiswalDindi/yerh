<?php

namespace Tests\Feature;

use App\Models\User;
use App\Notifications\InstitutionInvitationIssued;
use App\Notifications\ResetAccountPassword;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Notifications\AnonymousNotifiable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;
use Tests\TestCase;

final class PhaseOneHardeningTest extends TestCase
{
    use RefreshDatabase;

    public function test_forgot_reset_and_change_password_flows_work_and_revoke_sessions(): void
    {
        Notification::fake();
        $user = User::factory()->create(['email' => 'founder@example.test']);
        DB::table('sessions')->insert([
            'id' => 'stale-session-1', 'user_id' => $user->id, 'ip_address' => '127.0.0.1',
            'user_agent' => 'test', 'payload' => 'a:0:{}', 'last_activity' => time(),
        ]);

        // Nonexistent email still returns generic 200 to avoid enumeration.
        $this->postJson('/api/v1/auth/forgot-password', ['email' => 'missing@example.test'])->assertOk();
        Notification::assertNothingSent();

        $this->postJson('/api/v1/auth/forgot-password', ['email' => 'FOUNDER@example.test'])->assertOk();
        $resetNotification = Notification::sent($user, ResetAccountPassword::class)->sole();
        $actionUrl = $resetNotification->toMail($user)->actionUrl;
        parse_str((string) parse_url($actionUrl, PHP_URL_QUERY), $query);
        $this->assertNotEmpty($query['token'] ?? null);
        $this->assertSame('founder@example.test', $query['email'] ?? null);

        $this->postJson('/api/v1/auth/reset-password', [
            'token' => $query['token'],
            'email' => $user->email,
            'password' => 'NewPass123!',
            'password_confirmation' => 'NewPass123!',
        ])->assertOk();

        $this->assertTrue(Hash::check('NewPass123!', $user->fresh()->password));
        $this->assertDatabaseMissing('sessions', ['id' => 'stale-session-1']);

        // Change password rejects wrong current password and updates when valid.
        $this->actingAs($user->fresh())->postJson('/api/v1/auth/change-password', [
            'current_password' => 'wrong-pass',
            'password' => 'ChangedPass456!',
            'password_confirmation' => 'ChangedPass456!',
        ])->assertUnprocessable()->assertJsonValidationErrors('current_password');

        $this->actingAs($user->fresh())->postJson('/api/v1/auth/change-password', [
            'current_password' => 'NewPass123!',
            'password' => 'ChangedPass456!',
            'password_confirmation' => 'ChangedPass456!',
        ])->assertOk();

        $this->assertTrue(Hash::check('ChangedPass456!', $user->fresh()->password));
    }

    public function test_pending_institution_staff_can_still_sign_in_under_yerh_and_suspension_revokes_sessions(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $staff = User::factory()->create();

        $this->actingAs($admin)->postJson('/api/v1/workspace/institutions', [
            'name' => 'Pending Campus', 'kind' => 'university',
        ])->assertCreated();
        $this->postJson('/api/v1/workspace/institutions/pending-campus/staff', [
            'user_id' => $staff->id, 'access' => 'manage',
        ])->assertOk();
        $this->postJson('/api/v1/auth/logout')->assertNoContent();

        // Pending institution staff must not be locked out of YERH login.
        $this->postJson('/api/v1/auth/login', [
            'email' => $staff->email, 'password' => 'password', 'institution' => 'yerh', 'remember' => true,
        ])->assertOk();

        DB::table('sessions')->insert([
            'id' => 'active-staff-session', 'user_id' => $staff->id, 'ip_address' => '127.0.0.1',
            'user_agent' => 'test', 'payload' => 'a:0:{}', 'last_activity' => time(),
        ]);

        $this->actingAs($admin)->patchJson('/api/v1/workspace/users/'.$staff->id, [
            'role' => 'school_admin', 'suspended' => true,
        ])->assertOk();
        $this->assertDatabaseMissing('sessions', ['id' => 'active-staff-session']);
    }

    public function test_registration_auto_approves_verified_institution_domain_and_falls_back_to_coordinator_approval(): void
    {
        Notification::fake();
        $admin = User::factory()->create(['role' => 'admin']);
        $coordinator = User::factory()->create();
        $otherCoordinator = User::factory()->create();

        $this->actingAs($admin)->postJson('/api/v1/workspace/institutions', [
            'name' => 'KCA University',
            'kind' => 'university',
            'allowed_domains' => ['students.kcau.ac.ke', '@kcau.ac.ke'],
            'agreement_reference' => 'MOU-2026-KCA',
            'contact_email' => 'hub@kcau.ac.ke',
        ])->assertCreated();
        $this->postJson('/api/v1/workspace/institutions/kca-university/activate', [])->assertOk();
        $this->postJson('/api/v1/workspace/institutions/kca-university/staff', [
            'user_id' => $coordinator->id, 'access' => 'manage',
        ])->assertOk();

        $this->postJson('/api/v1/workspace/institutions', ['name' => 'Other Hub', 'kind' => 'hub'])->assertCreated();
        $this->postJson('/api/v1/workspace/institutions/other-hub/activate', [])->assertOk();
        $this->postJson('/api/v1/workspace/institutions/other-hub/staff', [
            'user_id' => $otherCoordinator->id, 'access' => 'manage',
        ])->assertOk();
        $this->postJson('/api/v1/auth/logout')->assertNoContent();

        // 1. Domain-matching student auto-approves on email verification.
        $this->postJson('/api/v1/auth/register', [
            'name' => 'Alice Student',
            'email' => 'alice@students.kcau.ac.ke',
            'password' => 'SecurePass99',
            'password_confirmation' => 'SecurePass99',
            'institution' => 'kca-university',
            'location' => 'Nairobi',
        ])->assertCreated()->assertJsonPath('data.requested_institution.slug', 'kca-university');

        $alice = User::query()->where('email', 'alice@students.kcau.ac.ke')->sole();
        $verifyAlice = URL::temporarySignedRoute('verification.verify', now()->addMinutes(5), [
            'id' => $alice->id, 'hash' => sha1($alice->email),
        ]);
        $this->getJson($verifyAlice)->assertOk()
            ->assertJsonPath('data.role', 'entrepreneur')
            ->assertJsonPath('data.affiliation.slug', 'kca-university');
        $this->postJson('/api/v1/auth/logout')->assertNoContent();

        // 2. Non-domain student falls back to coordinator + admin review.
        $this->postJson('/api/v1/auth/register', [
            'name' => 'Bob Student',
            'email' => 'bob@gmail.com',
            'password' => 'SecurePass99',
            'password_confirmation' => 'SecurePass99',
            'institution' => 'kca-university',
            'location' => 'Kiambu',
        ])->assertCreated();

        $bob = User::query()->where('email', 'bob@gmail.com')->sole();
        $verifyBob = URL::temporarySignedRoute('verification.verify', now()->addMinutes(5), [
            'id' => $bob->id, 'hash' => sha1($bob->email),
        ]);
        $this->getJson($verifyBob)->assertOk()
            ->assertJsonPath('data.role', 'guest')
            ->assertJsonPath('data.affiliation', null);

        $applicationId = DB::table('affiliation_applications')->where('user_id', $bob->id)->value('id');
        $this->assertNotNull($applicationId);

        // Unrelated coordinator cannot approve KCA's student.
        $this->actingAs($otherCoordinator->fresh())
            ->postJson("/api/v1/workspace/applications/{$applicationId}/review", ['decision' => 'approved'])
            ->assertForbidden();

        // KCA coordinator can see and approve Bob's request.
        $this->actingAs($coordinator->fresh())
            ->getJson('/api/v1/workspace/applications')
            ->assertOk()
            ->assertJsonPath('data.0.id', $applicationId);
        $this->postJson("/api/v1/workspace/applications/{$applicationId}/review", ['decision' => 'approved'])
            ->assertOk();
        $this->assertSame('entrepreneur', $bob->fresh()->role);

        // Admin can remove coordinator and suspend institution.
        $this->actingAs($admin)->deleteJson('/api/v1/workspace/institutions/kca-university/staff/'.$coordinator->id)
            ->assertNoContent();
        $this->assertSame('guest', $coordinator->fresh()->role);
        $this->postJson('/api/v1/workspace/institutions/kca-university/deactivate', [])
            ->assertOk()->assertJsonPath('data.status', 'suspended');
    }

    public function test_invitation_preview_returns_institution_without_leaking_email(): void
    {
        Notification::fake();
        $admin = User::factory()->create(['role' => 'admin']);
        DB::table('institutions')->insert([
            'slug' => 'preview-hub', 'name' => 'Preview Hub', 'kind' => 'hub', 'status' => 'active',
        ]);
        $this->actingAs($admin)->postJson('/api/v1/identity/institutions/preview-hub/invitations', [
            'name' => 'Invited Founder', 'email' => 'secret@example.test',
        ])->assertCreated();

        $mail = Notification::sent(new AnonymousNotifiable, InstitutionInvitationIssued::class)->sole()
            ->toMail(new AnonymousNotifiable);
        $token = collect($mail->introLines)->last();
        $this->assertStringContainsString('/account/invitations/'.$token, $mail->actionUrl);

        $this->postJson('/api/v1/auth/logout')->assertNoContent();
        $this->getJson('/api/v1/identity/invitations/preview/'.$token)
            ->assertOk()
            ->assertJsonPath('data.institution_name', 'Preview Hub')
            ->assertJsonPath('data.valid', true)
            ->assertJsonMissing(['email' => 'secret@example.test']);
    }

    public function test_editing_approved_product_preserves_evidence_and_mpesa_receipts_stream_securely(): void
    {
        Storage::fake('local');
        $admin = User::factory()->create(['role' => 'admin']);
        $mentor = User::factory()->create(['role' => 'mentor']);
        $founder = User::factory()->create(['role' => 'entrepreneur']);
        $outsider = User::factory()->create(['role' => 'entrepreneur']);

        $instId = DB::table('institutions')->insertGetId([
            'slug' => 'receipt-uni', 'name' => 'Receipt Uni', 'kind' => 'university', 'status' => 'active',
        ]);
        DB::table('institution_memberships')->insert([
            'institution_id' => $instId, 'user_id' => $founder->id, 'location' => 'Nairobi', 'consented_at' => now(),
        ]);
        $ventureId = DB::table('ventures')->insertGetId([
            'owner_id' => $founder->id, 'institution_id' => $instId, 'name' => 'Solar Dryers',
            'sector' => 'Agribusiness', 'location' => 'Nairobi', 'description' => 'Clean solar produce dryers.',
            'status' => 'approved', 'created_at' => now(), 'updated_at' => now(),
        ]);
        $productId = $this->actingAs($founder)->postJson('/api/v1/workspace/products', [
            'venture_id' => $ventureId, 'name' => 'Dryer V1', 'description' => 'Compact solar dryer for farmers.', 'price' => '4500',
        ])->assertCreated()->json('data.id');
        $pathId = $this->postJson("/api/v1/workspace/ventures/{$ventureId}/launch", ['product_ids' => [$productId]])
            ->assertCreated()->json('data.id');
        $this->actingAs($admin)->postJson("/api/v1/workspace/incubation/{$pathId}/mentor", ['mentor_id' => $mentor->id])->assertOk();
        $this->actingAs($founder)->postJson("/api/v1/workspace/products/{$productId}/evidence", [
            'evidence' => 'Tested across 10 small farms with positive results.',
        ])->assertOk();
        $this->actingAs($mentor)->postJson("/api/v1/workspace/products/{$productId}/review/evidence", [
            'decision' => 'approved',
        ])->assertOk();

        // Editing product description/price must preserve mentor evidence approval!
        $this->actingAs($founder)->patchJson("/api/v1/workspace/products/{$productId}", [
            'name' => 'Dryer V1 Plus', 'description' => 'Updated durable compact solar dryer.', 'price' => '4800',
        ])->assertOk();
        $this->assertDatabaseHas('venture_products', [
            'id' => $productId,
            'moderation' => 'pending',
            'evidence_status' => 'approved',
        ]);

        // M-Pesa instructions update & payment receipt upload/download.
        $this->actingAs($admin)->putJson('/api/v1/workspace/payment-instructions', [
            'provider' => 'M-Pesa Paybill',
            'paybill_number' => '400200',
            'account_number' => 'YERH-INCUBATION',
            'recipient_name' => 'YERH Kenya',
            'instructions' => 'Use Lipa na M-Pesa Paybill 400200 and upload your confirmation screenshot.',
        ])->assertOk()->assertJsonPath('data.paybill_number', '400200');

        $receipt = UploadedFile::fake()->create('mpesa-receipt.pdf', 120, 'application/pdf');
        $paymentId = $this->actingAs($founder)->post('/api/v1/workspace/programme-payments', [
            'purpose' => 'marketplace',
            'target_id' => $productId,
            'reference' => 'SLK98MPESA',
            'receipt' => $receipt,
        ], ['Accept' => 'application/json'])->assertCreated()->json('data.id');

        $this->actingAs($admin)->getJson('/api/v1/workspace/programme-payments')
            ->assertOk()
            ->assertJsonPath('data.0.has_receipt', true);
        $this->actingAs($admin)->get("/api/v1/workspace/programme-payments/{$paymentId}/receipt")->assertOk();
        $this->actingAs($founder)->get("/api/v1/workspace/programme-payments/{$paymentId}/receipt")->assertOk();
        $this->actingAs($outsider)->get("/api/v1/workspace/programme-payments/{$paymentId}/receipt")->assertForbidden();
    }

    public function test_bootstrap_admin_command_works_once_in_production_when_no_admin_exists(): void
    {
        $this->app->detectEnvironment(fn () => 'production');
        $user = User::factory()->unverified()->create(['email' => 'owner@example.test']);

        $this->artisan('yerh:bootstrap-admin', ['email' => 'owner@example.test'])->assertExitCode(1);
        $this->artisan('yerh:bootstrap-admin', ['email' => 'owner@example.test', '--verify' => true])->assertExitCode(0);
        $this->assertSame('admin', $user->fresh()->role);
        $this->assertNotNull($user->fresh()->email_verified_at);

        // Once an admin exists, second invocation is rejected.
        $second = User::factory()->create(['email' => 'second@example.test']);
        $this->artisan('yerh:bootstrap-admin', ['email' => $second->email])->assertExitCode(1);
        $this->assertSame('guest', $second->fresh()->role);
    }

    public function test_mentor_can_approve_progression_below_pass_mark_and_institution_index_returns_tab_counts(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $mentor = User::factory()->create(['role' => 'mentor']);
        $founder = User::factory()->create(['role' => 'entrepreneur']);
        $staff = User::factory()->create();

        $this->actingAs($admin)->postJson('/api/v1/workspace/institutions', [
            'name' => 'Counts Uni', 'kind' => 'university',
        ])->assertCreated();
        $this->postJson('/api/v1/workspace/institutions/counts-uni/activate', [])->assertOk();
        $this->postJson('/api/v1/workspace/institutions/counts-uni/staff', [
            'user_id' => $staff->id, 'access' => 'manage',
        ])->assertOk();

        $instId = DB::table('institutions')->where('slug', 'counts-uni')->value('id');
        DB::table('institution_memberships')->insert([
            'institution_id' => $instId, 'user_id' => $founder->id, 'location' => 'Nairobi', 'consented_at' => now(),
        ]);
        $ventureId = DB::table('ventures')->insertGetId([
            'owner_id' => $founder->id, 'institution_id' => $instId, 'name' => 'Override Venture',
            'sector' => 'Agribusiness', 'location' => 'Nairobi', 'description' => 'Fresh farm produce delivery.',
            'status' => 'approved', 'created_at' => now(), 'updated_at' => now(),
        ]);

        // Verify directory returns live tab counters.
        $this->actingAs($admin)->getJson('/api/v1/workspace/institutions')
            ->assertOk()
            ->assertJsonPath('data.0.staff_count', 1)
            ->assertJsonPath('data.0.students_count', 1)
            ->assertJsonPath('data.0.ventures_count', 1);

        // Launch path, grade Stage 1 below 50%, verify Stage 2 is locked until mentor approves progression.
        $pathId = $this->actingAs($founder)->postJson("/api/v1/workspace/ventures/{$ventureId}/launch", [])
            ->assertCreated()->json('data.id');
        $this->actingAs($admin)->postJson("/api/v1/workspace/incubation/{$pathId}/mentor", ['mentor_id' => $mentor->id])->assertOk();

        $stage1 = "/api/v1/workspace/incubation/{$pathId}/stages/getting-started";
        $this->actingAs($founder)->postJson($stage1.'/evidence', ['step' => 'discovery', 'body' => 'Interviewed twenty farmers.'])->assertOk();
        $this->postJson($stage1.'/evidence', ['step' => 'offer', 'body' => 'Weekly subscription produce crate.'])->assertOk();
        $this->postJson($stage1.'/request-review')->assertOk();
        $this->actingAs($mentor)->postJson($stage1.'/meeting', ['meeting_at' => now()->addHour()->toIso8601String(), 'location' => 'Meet'])->assertOk();
        $this->postJson($stage1.'/open-exam', ['note' => 'Ready for exam.'])->assertOk();
        $this->actingAs($founder)->postJson($stage1.'/submit', ['answer' => 'Short exam response covering customer validation.'])->assertOk();
        $this->actingAs($mentor)->postJson($stage1.'/grade', ['score' => 42, 'note' => 'Needs stronger financials.'])->assertOk();

        // Stage 2 still locked right after failing grade.
        $this->actingAs($founder)->postJson("/api/v1/workspace/incubation/{$pathId}/stages/advanced/evidence", [
            'step' => 'pilot', 'body' => 'Trying to enter stage two before mentor approval.',
        ])->assertConflict();

        // Mentor explicitly approves progression to next stage despite 42%.
        $this->actingAs($mentor)->postJson($stage1.'/approve-progression', [
            'note' => 'Strong practical field traction; approved to proceed.',
        ])->assertOk();

        // Stage 2 is now unlocked!
        $this->actingAs($founder)->postJson("/api/v1/workspace/incubation/{$pathId}/stages/advanced/evidence", [
            'step' => 'pilot', 'body' => 'Pilot completed with fifteen paying customers.',
        ])->assertOk();
    }
}
