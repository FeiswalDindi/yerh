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
        $this->postJson($url.'/enrolments', ['reference' => 'TEST LEARNING REFERENCE', 'price' => 0])->assertOk();
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
}
