<?php

namespace Tests\Feature;

use App\Domain\Incubation\Curriculum;
use App\Models\User;
use App\Notifications\InstitutionOnboardingDecision;
use App\Notifications\WorkspaceAlert;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Notifications\AnonymousNotifiable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

final class PhaseThreeFeatureTest extends TestCase
{
    use RefreshDatabase;

    public function test_institution_onboarding_application_review_and_auto_provisioning(): void
    {
        Storage::fake('local');
        Notification::fake();

        $admin = User::factory()->create(['role' => 'admin']);
        $coordinator = User::factory()->create(['email' => 'coord@greenhub.example', 'role' => 'guest']);

        $mou = UploadedFile::fake()->create('mou.pdf', 16, 'application/pdf');
        $applyPayload = [
            'institution_name' => 'Green Innovation Hub',
            'kind' => 'hub',
            'contact_name' => 'Sarah Coordinator',
            'contact_email' => 'coord@greenhub.example',
            'contact_phone' => '+254712345678',
            'website' => 'https://greenhub.example',
            'allowed_domains' => 'students.greenhub.example, greenhub.example',
            'agreement_reference' => 'MOU-2026-01',
            'agreement' => $mou,
            'notes' => 'Applying for campus hub onboarding.',
        ];

        $appId = $this->post('/api/v1/institutions/apply', $applyPayload, ['Accept' => 'application/json'])
            ->assertCreated()
            ->json('data.id');

        Notification::assertSentTo($admin, WorkspaceAlert::class);

        // Duplicate pending application for same institution name/slug is rejected.
        $this->post('/api/v1/institutions/apply', $applyPayload, ['Accept' => 'application/json'])
            ->assertUnprocessable();

        $this->actingAs($coordinator)->getJson('/api/v1/workspace/institution-applications')->assertForbidden();

        $this->actingAs($admin)->getJson('/api/v1/workspace/summary')
            ->assertOk()
            ->assertJsonPath('data.metrics.onboarding', 1)
            ->assertJsonPath('data.metrics.approvals', 1);

        $this->getJson('/api/v1/workspace/institution-applications')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.has_document', true)
            ->assertJsonPath('data.0.allowed_domains.0', 'students.greenhub.example');

        $this->get("/api/v1/workspace/institution-applications/{$appId}/document")->assertOk();

        // Rejecting requires a note; approving provisions institution, copies MOU, and promotes coordinator.
        $this->postJson("/api/v1/workspace/institution-applications/{$appId}/review", [
            'decision' => 'rejected',
        ])->assertUnprocessable();

        $this->postJson("/api/v1/workspace/institution-applications/{$appId}/review", [
            'decision' => 'approved',
            'note' => 'Welcome aboard.',
            'activate' => true,
        ])->assertOk()
            ->assertJsonPath('data.status', 'approved')
            ->assertJsonPath('data.institution_slug', 'green-innovation-hub');

        $institution = DB::table('institutions')->where('slug', 'green-innovation-hub')->first();
        $this->assertNotNull($institution);
        $this->assertSame('active', $institution->status);
        $this->assertDatabaseHas('institution_agreement_documents', [
            'institution_id' => $institution->id,
            'reference' => 'MOU-2026-01',
        ]);
        $this->assertSame('school_admin', $coordinator->fresh()->role);
        $this->assertDatabaseHas('institution_access', [
            'institution_id' => $institution->id,
            'user_id' => $coordinator->id,
            'access' => 'manage',
        ]);

        Notification::assertSentTo($coordinator, WorkspaceAlert::class);
        Notification::assertSentOnDemand(
            InstitutionOnboardingDecision::class,
            fn ($notification, $channels, $notifiable) => $notifiable instanceof AnonymousNotifiable
                && $notifiable->routeNotificationFor('mail') === 'coord@greenhub.example',
        );

        // Rejection path leaves no institution created.
        $secondId = $this->postJson('/api/v1/institutions/apply', [
            'institution_name' => 'Incomplete Polytechnic',
            'kind' => 'university',
            'contact_name' => 'Pat Test',
            'contact_email' => 'pat@incomplete.example',
            'contact_phone' => '+254700000001',
        ])->assertCreated()->json('data.id');

        $this->actingAs($admin)->postJson("/api/v1/workspace/institution-applications/{$secondId}/review", [
            'decision' => 'rejected',
            'note' => 'Missing official coordinator letter.',
        ])->assertOk();

        $this->assertDatabaseMissing('institutions', ['slug' => 'incomplete-polytechnic']);
    }

    public function test_incubation_evidence_exam_and_opportunity_attachments_with_rbac(): void
    {
        Storage::fake('local');

        $admin = User::factory()->create(['role' => 'admin']);
        $mentor = User::factory()->create(['role' => 'mentor']);
        $founder = User::factory()->create(['role' => 'entrepreneur']);
        $outsider = User::factory()->create(['role' => 'entrepreneur']);

        $instId = DB::table('institutions')->insertGetId([
            'slug' => 'tech-uni', 'name' => 'Tech Uni', 'kind' => 'university', 'status' => 'active',
        ]);
        DB::table('institution_memberships')->insert([
            'institution_id' => $instId, 'user_id' => $founder->id, 'location' => 'Nairobi', 'consented_at' => now(),
        ]);
        DB::table('marketplace_sectors')->insertOrIgnore(['name' => 'Technology']);

        $ventureId = $this->actingAs($founder)->postJson('/api/v1/workspace/ventures', [
            'name' => 'Solar Pack', 'sector' => 'Technology', 'location' => 'Nairobi', 'description' => 'Modular solar kits for campuses.',
        ])->assertCreated()->json('data.id');
        $this->actingAs($admin)->postJson("/api/v1/workspace/ventures/{$ventureId}/review", ['decision' => 'approved'])->assertOk();
        $pathId = $this->actingAs($founder)->postJson("/api/v1/workspace/ventures/{$ventureId}/launch", [])->assertCreated()->json('data.id');
        $this->actingAs($admin)->postJson("/api/v1/workspace/incubation/{$pathId}/mentor", ['mentor_id' => $mentor->id])->assertOk();

        $steps = app(Curriculum::class)->stage('getting-started')['steps'];
        $firstStep = $steps[0]['id'];

        $evidenceFile = UploadedFile::fake()->create('market-research.pdf', 20, 'application/pdf');
        $this->actingAs($founder)->post("/api/v1/workspace/incubation/{$pathId}/stages/getting-started/evidence", [
            'step' => $firstStep,
            'body' => 'Detailed customer discovery interviews from three hostels.',
            'attachment' => $evidenceFile,
        ], ['Accept' => 'application/json'])->assertOk();

        $this->actingAs($founder)->get("/api/v1/workspace/incubation/{$pathId}/stages/getting-started/evidence/{$firstStep}/attachment")->assertOk();
        $this->actingAs($mentor)->get("/api/v1/workspace/incubation/{$pathId}/stages/getting-started/evidence/{$firstStep}/attachment")->assertOk();
        $outsiderResp = $this->actingAs($outsider)->get("/api/v1/workspace/incubation/{$pathId}/stages/getting-started/evidence/{$firstStep}/attachment");
        $this->assertTrue(in_array($outsiderResp->getStatusCode(), [403, 404], true));

        // Add remaining steps, submit review, open exam, upload exam attachment.
        foreach (array_slice($steps, 1) as $step) {
            $this->actingAs($founder)->postJson("/api/v1/workspace/incubation/{$pathId}/stages/getting-started/evidence", [
                'step' => $step['id'],
                'body' => 'Validated venture plan step evidence for '.$step['id'],
            ])->assertOk();
        }
        $this->actingAs($founder)->postJson("/api/v1/workspace/incubation/{$pathId}/stages/getting-started/request-review", [])->assertOk();
        $this->actingAs($mentor)->postJson("/api/v1/workspace/incubation/{$pathId}/stages/getting-started/meeting", [
            'meeting_at' => now()->addDay()->toIso8601String(), 'location' => 'Google Meet',
        ])->assertOk();
        $this->actingAs($mentor)->postJson("/api/v1/workspace/incubation/{$pathId}/stages/getting-started/open-exam", [
            'note' => 'Exam opened after pitch check.',
        ])->assertOk();

        $examDeck = UploadedFile::fake()->create('pitch-deck.pdf', 24, 'application/pdf');
        $this->actingAs($founder)->post("/api/v1/workspace/incubation/{$pathId}/stages/getting-started/submit", [
            'answer' => 'See attached pitch deck along with our revenue projections.',
            'attachment' => $examDeck,
        ], ['Accept' => 'application/json'])->assertOk();

        $this->actingAs($founder)->getJson("/api/v1/workspace/incubation/{$pathId}")
            ->assertOk()
            ->assertJsonPath('data.stages.0.work.has_answer_attachment', true)
            ->assertJsonPath('data.stages.0.work.answer_attachment_name', 'pitch-deck.pdf');

        $this->actingAs($mentor)->get("/api/v1/workspace/incubation/{$pathId}/stages/getting-started/exam-attachment")->assertOk();

        // Reopening exam cleans up previous exam attachment.
        $this->actingAs($mentor)->postJson("/api/v1/workspace/incubation/{$pathId}/stages/getting-started/grade", [
            'score' => 42, 'note' => 'Add financial sensitivity table.',
        ])->assertOk();
        $this->actingAs($mentor)->postJson("/api/v1/workspace/incubation/{$pathId}/stages/getting-started/reopen-exam", [
            'note' => 'Please resubmit updated deck.',
        ])->assertOk();

        $this->actingAs($founder)->getJson("/api/v1/workspace/incubation/{$pathId}")
            ->assertOk()
            ->assertJsonPath('data.stages.0.work.has_answer_attachment', false);
        $this->actingAs($founder)->get("/api/v1/workspace/incubation/{$pathId}/stages/getting-started/exam-attachment")
            ->assertNotFound();

        // Opportunity application with attachment.
        $this->actingAs($admin)->postJson('/api/v1/engagement/manage/opportunities', [
            'title' => 'Campus Green Fund',
            'category' => 'Grant',
            'organiser' => 'Youth Innovation Network',
            'description' => 'Seed funding for campus sustainability startups.',
            'status' => 'published',
        ])->assertOk();
        $oppSlug = DB::table('engagement_opportunities')->value('slug');

        $oppAppId = $this->actingAs($founder)->post("/api/v1/engagement/opportunities/{$oppSlug}/applications", [
            'venture_id' => $ventureId,
            'motivation' => 'Expanding our solar kit distribution to five partner campuses.',
            'attachment' => UploadedFile::fake()->create('grant-deck.pdf', 15, 'application/pdf'),
        ], ['Accept' => 'application/json'])->assertCreated()->json('data.id');

        $this->actingAs($admin)->getJson('/api/v1/engagement/applications')
            ->assertOk()
            ->assertJsonPath('data.0.has_attachment', true)
            ->assertJsonPath('data.0.attachment_name', 'grant-deck.pdf');

        $this->actingAs($founder)->get("/api/v1/engagement/applications/{$oppAppId}/attachment")->assertOk();
        $this->actingAs($admin)->get("/api/v1/engagement/applications/{$oppAppId}/attachment")->assertOk();
        $this->actingAs($outsider)->get("/api/v1/engagement/applications/{$oppAppId}/attachment")->assertForbidden();
    }

    public function test_marketplace_product_photos_webp_optimization_and_seller_inquiry_fields(): void
    {
        Storage::fake('local');

        $admin = User::factory()->create(['role' => 'admin']);
        $founder = User::factory()->create(['role' => 'entrepreneur']);
        $instId = DB::table('institutions')->insertGetId([
            'slug' => 'agro-hub', 'name' => 'Agro Hub', 'kind' => 'hub', 'status' => 'active',
        ]);
        DB::table('institution_memberships')->insert([
            'institution_id' => $instId, 'user_id' => $founder->id, 'location' => 'Eldoret', 'consented_at' => now(),
        ]);
        DB::table('marketplace_sectors')->insertOrIgnore(['name' => 'Agribusiness']);

        $ventureId = DB::table('ventures')->insertGetId([
            'owner_id' => $founder->id, 'institution_id' => $instId, 'name' => 'SolarDryers Co',
            'sector' => 'Agribusiness', 'location' => 'Eldoret', 'description' => 'Clean crop drying equipment.',
            'status' => 'approved', 'created_at' => now(), 'updated_at' => now(),
        ]);
        DB::table('incubation_paths')->insert([
            'venture_id' => $ventureId, 'graduated_at' => now(), 'created_at' => now(), 'updated_at' => now(),
        ]);

        $png = file_get_contents(base_path('../frontend/public/media/health-c8d73354.png'));
        $photo = UploadedFile::fake()->createWithContent('dryer.png', $png);

        $productId = $this->actingAs($founder)->post('/api/v1/workspace/products', [
            'venture_id' => $ventureId,
            'name' => 'Portable Solar Crop Dryer',
            'description' => 'Weatherproof solar dryer built for smallholder farmers.',
            'price' => '18500.00',
            'whatsapp' => '+254799000111',
            'contact_phone' => '+254722333444',
            'contact_email' => 'sales@solardry.example',
            'photo' => $photo,
        ], ['Accept' => 'application/json'])->assertCreated()->json('data.id');

        $slug = DB::table('venture_products')->where('id', $productId)->value('slug');

        // Unpublished product image is hidden publicly, but accessible in workspace.
        $this->get("/api/v1/marketplace/{$slug}/image")->assertNotFound();
        $this->actingAs($founder)->get("/api/v1/workspace/products/{$productId}/image")->assertOk();

        // Approve listing & evidence via direct update + listing review.
        DB::table('venture_products')->where('id', $productId)->update([
            'evidence' => 'Tested across 10 farms in Uasin Gishu.', 'evidence_status' => 'approved',
        ]);
        $this->actingAs($admin)->postJson("/api/v1/workspace/products/{$productId}/review/listing", [
            'decision' => 'approved',
        ])->assertOk();

        $publicResp = $this->getJson('/api/v1/marketplace')->assertOk();
        $publicResp->assertJsonPath('data.0.whatsapp', '+254799000111')
            ->assertJsonPath('data.0.seller_email', 'sales@solardry.example')
            ->assertJsonPath('data.0.seller_phone', '+254722333444')
            ->assertJsonPath('data.0.institution', 'Agro Hub');

        $imageUrl = $publicResp->json('data.0.image_url');
        $this->assertStringContainsString("/api/v1/marketplace/{$slug}/image", (string) $imageUrl);

        $imgResp = $this->get($imageUrl.'&w=480', ['Accept' => 'image/webp,image/png,*/*'])
            ->assertOk();
        $this->assertSame('image/webp', $imgResp->headers->get('Content-Type'));
        $this->assertStringContainsString('Accept', (string) $imgResp->headers->get('Vary'));

        $dims = getimagesize($imgResp->baseResponse->getFile()->getPathname());
        $this->assertIsArray($dims);
        $this->assertLessThanOrEqual(480, $dims[0]);

        $etag = $imgResp->headers->get('ETag');
        $this->assertNotEmpty($etag);

        $this->get($imageUrl.'&w=480', [
            'Accept' => 'image/webp,image/png,*/*',
            'If-None-Match' => $etag,
        ])->assertStatus(304);

        // Replacing product photo purges image cache and updates hash version.
        $replacement = UploadedFile::fake()->createWithContent('dryer-v2.png', $png);
        $this->actingAs($founder)->post("/api/v1/workspace/products/{$productId}", [
            'name' => 'Portable Solar Crop Dryer v2',
            'description' => 'Updated aluminum frame with digital hygrometer.',
            'price' => '19500.00',
            'photo' => $replacement,
        ], ['Accept' => 'application/json'])->assertOk();

        $this->assertEmpty(Storage::disk('local')->files("image-cache/product-{$productId}"));
    }

    public function test_public_contact_form_stores_message_and_notifies_content_team(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $editor = User::factory()->create(['role' => 'content_manager']);
        $founder = User::factory()->create(['role' => 'entrepreneur']);

        $msgId = $this->postJson('/api/v1/contact', [
            'name' => 'Amina Buyer',
            'email' => 'amina@example.org.ke',
            'topic' => 'Partnership',
            'message' => 'We would like to sponsor a cohort hackathon this year.',
        ])->assertCreated()->json('data.id');

        $this->assertDatabaseHas('contact_messages', ['id' => $msgId, 'status' => 'new']);
        $this->assertSame(1, $admin->notifications()->count());
        $this->assertSame(1, $editor->notifications()->count());

        $this->actingAs($editor)->getJson('/api/v1/workspace/summary')
            ->assertOk()
            ->assertJsonPath('data.metrics.enquiries', 1);

        $this->actingAs($founder)->getJson('/api/v1/workspace/contact-messages')->assertForbidden();

        $this->actingAs($editor)->getJson('/api/v1/workspace/contact-messages')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.status', 'new');

        $this->patchJson("/api/v1/workspace/contact-messages/{$msgId}", [
            'status' => 'resolved',
            'admin_notes' => 'Scheduled call for Tuesday morning.',
        ])->assertOk()->assertJsonPath('data.status', 'resolved');

        $this->actingAs($editor)->getJson('/api/v1/workspace/summary')
            ->assertOk()
            ->assertJsonPath('data.metrics.enquiries', 0);
    }

    public function test_workflow_notifications_sent_across_key_transitions(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $mentor = User::factory()->create(['role' => 'mentor']);
        $founder = User::factory()->create(['role' => 'entrepreneur']);

        $instId = DB::table('institutions')->insertGetId([
            'slug' => 'notify-uni', 'name' => 'Notify Uni', 'kind' => 'university', 'status' => 'active',
        ]);
        DB::table('institution_memberships')->insert([
            'institution_id' => $instId, 'user_id' => $founder->id, 'location' => 'Nairobi', 'consented_at' => now(),
        ]);
        DB::table('marketplace_sectors')->insertOrIgnore(['name' => 'Technology']);

        $ventureId = $this->actingAs($founder)->postJson('/api/v1/workspace/ventures', [
            'name' => 'Notify Venture', 'sector' => 'Technology', 'location' => 'Nairobi', 'description' => 'Automated notification test venture.',
        ])->assertCreated()->json('data.id');
        $this->assertGreaterThanOrEqual(1, $admin->notifications()->count());

        $this->actingAs($admin)->postJson("/api/v1/workspace/ventures/{$ventureId}/review", ['decision' => 'approved'])->assertOk();
        $this->assertGreaterThanOrEqual(1, $founder->notifications()->count());

        $pathId = $this->actingAs($founder)->postJson("/api/v1/workspace/ventures/{$ventureId}/launch", [])->assertCreated()->json('data.id');
        $this->actingAs($admin)->postJson("/api/v1/workspace/incubation/{$pathId}/mentor", ['mentor_id' => $mentor->id])->assertOk();
        $this->assertGreaterThanOrEqual(1, $mentor->notifications()->count());
        $this->assertGreaterThanOrEqual(2, $founder->notifications()->count());

        $productId = $this->actingAs($founder)->postJson('/api/v1/workspace/products', [
            'venture_id' => $ventureId, 'name' => 'Widget X', 'description' => 'Compact gadget for students.', 'price' => '1200.00',
        ])->assertCreated()->json('data.id');
        $this->actingAs($admin)->postJson("/api/v1/workspace/products/{$productId}/review/listing", ['decision' => 'approved'])->assertOk();
        $this->assertGreaterThanOrEqual(3, $founder->notifications()->count());

        Storage::fake('local');
        $courseId = $this->actingAs($mentor)->post('/api/v1/learning/authoring', [
            'title' => 'Scaling Startups', 'description' => 'Growth systems for founders.', 'level' => 'Intermediate',
            'proposal' => UploadedFile::fake()->create('proposal.pdf', 12, 'application/pdf'),
        ], ['Accept' => 'application/json'])->assertCreated()->json('data.id');
        $this->actingAs($admin)->postJson("/api/v1/learning/authoring/{$courseId}/review", ['decision' => 'approved'])->assertOk();
        $this->assertGreaterThanOrEqual(2, $mentor->notifications()->count());
    }
}
