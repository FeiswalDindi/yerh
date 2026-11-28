<?php

namespace Tests\Feature;

use App\Models\User;
use App\Notifications\CourseCertificateIssued;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

final class StandaloneLearningTest extends TestCase
{
    use RefreshDatabase;

    public function test_mentor_proposal_payment_completion_and_certificate(): void
    {
        Notification::fake();
        Storage::fake('local');
        $admin = User::factory()->create(['role' => 'admin']);
        $mentor = User::factory()->create(['role' => 'mentor']);
        $otherMentor = User::factory()->create(['role' => 'mentor']);
        $student = User::factory()->create(['role' => 'guest']);
        $otherGuest = User::factory()->create(['role' => 'guest']);
        $base = '/api/v1/learning';
        $this->actingAs($mentor);
        $course = $this->post($base.'/authoring', [
            'title' => 'Enterprise workshop', 'description' => 'Foundations and assessment',
            'level' => 'Introduction', 'proposal' => UploadedFile::fake()->create('outline.pdf', 10, 'application/pdf'),
        ], ['Accept' => 'application/json'])->assertCreated()->json('data.id');
        $slug = DB::table('learning_courses')->where('id', $course)->value('slug');
        $this->postJson($base."/authoring/$course/lessons", ['title' => 'Lesson', 'content' => 'Example'])->assertConflict();
        $this->actingAs($otherMentor)->get($base."/authoring/$course/attachment")->assertNotFound();
        $this->actingAs($admin)->get($base."/authoring/$course/attachment")->assertOk();
        $this->postJson($base."/authoring/$course/review", ['decision' => 'approved'])->assertOk();
        $lesson = $this->actingAs($mentor)->postJson($base."/authoring/$course/lessons", [
            'title' => 'Lesson', 'content' => 'Example',
        ])->assertCreated()->json('data.id');
        $this->actingAs($admin)->postJson($base."/authoring/$course/publish", [
            'price' => 1000, 'discount' => 200, 'royalty_rate' => 40,
        ])->assertOk();

        $url = $base.'/courses/'.$slug;
        $this->postJson($url.'/enrolments', ['reference' => 'INVALID ROLE'])->assertForbidden();
        $this->actingAs($student)->getJson($url)->assertJsonMissing(['content' => 'Example']);
        $this->post($url.'/enrolments', [
            'reference' => 'TEST LEARNING REFERENCE',
            'price' => 0,
            'receipt' => UploadedFile::fake()->image('receipt.png'),
        ], ['Accept' => 'application/json'])->assertOk();
        $this->putJson($url."/lessons/$lesson")->assertForbidden();
        $row = $this->actingAs($admin)->getJson($base.'/registry')->assertOk()->json('data.0');
        $this->assertEquals(800, $row['price_paid']);
        $this->postJson($base."/registry/{$row['id']}/certificate")->assertConflict();
        $this->postJson($base."/registry/{$row['id']}/payment", ['decision' => 'confirmed'])->assertOk();
        $this->actingAs($student)->getJson($url)->assertJsonPath('data.lessons.0.content', 'Example');
        $this->putJson($url."/lessons/$lesson")->assertOk()->assertJsonPath('data.completed', true);

        $this->actingAs($mentor)->getJson($base.'/authoring')->assertOk()
            ->assertJsonPath('data.royalties.0.accrued', fn ($value) => (float) $value === 320.0);
        $document = $this->actingAs($admin)->postJson($base."/registry/{$row['id']}/certificate")
            ->assertOk()->json('data.certificate_id');
        $this->postJson($base."/registry/{$row['id']}/certificate")->assertOk()->assertJsonPath('data.certificate_id', $document);
        Notification::assertSentToTimes($student, CourseCertificateIssued::class, 1);
        $this->actingAs($otherGuest)->get($base."/certificates/$document")->assertNotFound();
        $this->actingAs($student)->get($base."/certificates/$document")->assertOk()->assertSee('Course Completion Certificate');
    }

    public function test_admin_assigns_mentor_royalty_on_moodle_course_and_mentor_sees_earnings_summary_and_ledger(): void
    {
        Notification::fake();
        $admin = User::factory()->create(['role' => 'admin']);
        $mentor = User::factory()->create(['role' => 'mentor', 'name' => 'Wanjiru Mentor']);
        $otherMentor = User::factory()->create(['role' => 'mentor']);
        $student = User::factory()->create(['role' => 'guest', 'name' => 'Achieng Learner']);

        $courseId = DB::table('learning_courses')->insertGetId([
            'slug' => 'moodle-finance-101',
            'title' => 'Moodle Finance Basics',
            'description' => 'Unit economics and pricing',
            'level' => 'Moodle',
            'price' => 0,
            'discount' => 0,
            'royalty_rate' => 0,
            'status' => 'approved',
            'placement' => 'draft',
            'moodle_course_id' => 9,
            'author_id' => null,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // Assigning a non-mentor as royalty author is rejected.
        $this->actingAs($admin)
            ->postJson('/api/v1/learning/authoring/'.$courseId.'/publish', [
                'price' => 1500,
                'discount' => 300,
                'royalty_rate' => 25,
                'author_id' => $student->id,
                'placement' => 'public',
            ])
            ->assertUnprocessable();

        // Assigning active mentor stores author_id and royalty rate.
        $this->actingAs($admin)
            ->postJson('/api/v1/learning/authoring/'.$courseId.'/publish', [
                'price' => 1500,
                'discount' => 300,
                'royalty_rate' => 25,
                'author_id' => $mentor->id,
                'placement' => 'public',
            ])
            ->assertOk();

        // Student submits pending payment.
        Storage::fake('local');
        $this->actingAs($student)
            ->post('/api/v1/learning/courses/moodle-finance-101/enrolments', [
                'reference' => 'MPESA-PEND-99',
                'receipt' => UploadedFile::fake()->image('receipt.png'),
            ], ['Accept' => 'application/json'])
            ->assertOk();

        $pendingAuthoring = $this->actingAs($mentor)
            ->getJson('/api/v1/learning/authoring')
            ->assertOk()
            ->assertJsonPath('data.earnings_summary.pending_enrolments', 1)
            ->assertJsonPath('data.earnings_summary.confirmed_enrolments', 0)
            ->assertJsonPath('data.earnings_summary.accrued_royalties', fn ($v) => (float) $v === 0.0)
            ->assertJsonPath('data.earnings_summary.pending_royalties', fn ($v) => (float) $v === 300.0)
            ->json('data');

        $this->assertCount(1, $pendingAuthoring['ledger']);
        $this->assertSame('pending', $pendingAuthoring['ledger'][0]['payment_status']);
        $this->assertArrayNotHasKey('learner_email', $pendingAuthoring['ledger'][0]);
        $this->assertArrayNotHasKey('payment_reference', $pendingAuthoring['ledger'][0]);

        $enrolmentId = (int) $pendingAuthoring['ledger'][0]['id'];

        // Admin confirms payment -> mentor immediately sees accrued royalty and overview KPI metrics.
        $this->actingAs($admin)
            ->postJson('/api/v1/learning/registry/'.$enrolmentId.'/payment', ['decision' => 'confirmed'])
            ->assertOk();

        $this->actingAs($mentor)
            ->getJson('/api/v1/learning/authoring')
            ->assertOk()
            ->assertJsonPath('data.earnings_summary.confirmed_enrolments', 1)
            ->assertJsonPath('data.earnings_summary.pending_enrolments', 0)
            ->assertJsonPath('data.earnings_summary.gross_revenue', fn ($v) => (float) $v === 1200.0)
            ->assertJsonPath('data.earnings_summary.accrued_royalties', fn ($v) => (float) $v === 300.0)
            ->assertJsonPath('data.earnings_summary.pending_royalties', fn ($v) => (float) $v === 0.0)
            ->assertJsonPath('data.ledger.0.payment_status', 'confirmed')
            ->assertJsonPath('data.ledger.0.royalty_amount', fn ($v) => (float) $v === 300.0);

        $this->actingAs($mentor)
            ->getJson('/api/v1/workspace/summary')
            ->assertOk()
            ->assertJsonPath('data.metrics.authoredCourses', 1)
            ->assertJsonPath('data.metrics.courseEnrolments', 1)
            ->assertJsonPath('data.metrics.accruedRoyalties', fn ($v) => (float) $v === 300.0);

        // Unrelated mentor only sees their own courses and zero royalties.
        $this->actingAs($otherMentor)
            ->getJson('/api/v1/learning/authoring')
            ->assertOk()
            ->assertJsonCount(0, 'data.rows')
            ->assertJsonCount(0, 'data.ledger')
            ->assertJsonPath('data.earnings_summary.accrued_royalties', fn ($v) => (float) $v === 0.0);
    }
}
