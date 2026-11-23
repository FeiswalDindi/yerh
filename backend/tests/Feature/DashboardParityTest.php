<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

final class DashboardParityTest extends TestCase
{
    use RefreshDatabase;

    public function test_registries_and_summary_distinguish_institution_ownership_from_affiliation(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $founder = User::factory()->create(['role' => 'entrepreneur']);
        $school = DB::table('institutions')->insertGetId(['slug' => 'academy', 'name' => 'Academy', 'kind' => 'high-school', 'status' => 'active']);
        $hub = DB::table('institutions')->insertGetId(['slug' => 'hub', 'name' => 'Local Hub', 'kind' => 'hub', 'status' => 'active']);
        $cohort = DB::table('school_cohorts')->insertGetId(['institution_id' => $school, 'name' => 'First term', 'starts_on' => '2026-01-01', 'ends_on' => '2026-04-01']);
        DB::table('school_ventures')->insert(['cohort_id' => $cohort, 'name' => 'School team', 'sector' => 'Food', 'description' => 'Team venture']);
        $id = DB::table('ventures')->insertGetId(['institution_id' => $hub, 'owner_id' => $founder->id, 'name' => 'Independent founder', 'sector' => 'Food', 'description' => 'Independent venture', 'location' => 'Nairobi']);
        $this->actingAs($admin)->getJson('/api/v1/workspace/summary')->assertJsonPath('data.metrics.approvals', 1);
        $this->getJson('/api/v1/workspace/institution-ventures')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.institution', 'Academy');
        $this->getJson('/api/v1/workspace/ventures')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.owner', $founder->name);
        $review = '/api/v1/workspace/ventures/'.$id.'/review';
        $this->postJson($review, ['decision' => 'approved'])->assertOk();
        $this->getJson('/api/v1/workspace/summary')->assertJsonPath('data.metrics.approvals', 0);
        $this->postJson($review, ['expected_status' => 'pending', 'decision' => 'approved'])->assertConflict();
        $this->postJson($review, ['expected_status' => 'approved', 'decision' => 'rejected'])->assertUnprocessable();
        $this->postJson($review, ['expected_status' => 'approved', 'decision' => 'rejected', 'note' => 'Correct the plan'])->assertOk();
        $this->getJson('/api/v1/workspace/activity')->assertJsonCount(2, 'data');
        $this->actingAs($founder)->getJson('/api/v1/workspace/summary')->assertJsonPath('data.metrics.ventures', 1)->assertJsonMissingPath('data.metrics.accounts');
        foreach (['institution-ventures', 'users', 'activity'] as $route) {
            $this->getJson('/api/v1/workspace/'.$route)->assertForbidden();
        }
    }

    public function test_staff_bulk_invites_are_atomic_and_eligibility_is_rechecked(): void
    {
        Notification::fake();
        $staff = User::factory()->create(['role' => 'school_admin']);
        $hub = DB::table('institutions')->insertGetId(['slug' => 'hub', 'name' => 'Local Hub', 'kind' => 'hub', 'status' => 'active']);
        DB::table('institution_access')->insert(['institution_id' => $hub, 'user_id' => $staff->id, 'access' => 'manage']);
        $one = User::factory()->create();
        $two = User::factory()->create();
        $url = '/api/v1/identity/institutions/hub';
        $this->actingAs($one)->getJson($url.'/invitees')->assertForbidden();
        $this->actingAs($staff)->getJson($url.'/invitees')->assertOk()->assertJsonCount(2, 'data');
        $this->postJson($url.'/invitations', ['user_ids' => [$one->id, $staff->id]])->assertUnprocessable();
        $this->assertDatabaseCount('institution_invitations', 0);
        $this->postJson($url.'/invitations', ['user_ids' => [$one->id, $two->id]])->assertCreated()->assertJsonCount(2, 'data.ids');
        $this->getJson($url.'/invitees')->assertJsonCount(0, 'data');
        $this->postJson($url.'/invitations', ['user_ids' => [$one->id]])->assertUnprocessable();
        $this->assertDatabaseCount('institution_invitations', 2);
        $admin = User::factory()->create(['role' => 'admin']);
        $this->actingAs($admin)->getJson('/api/v1/workspace/activity?institution=hub')->assertOk()->assertJsonCount(1, 'data');
        $this->getJson('/api/v1/workspace/activity?institution=other')->assertOk()->assertJsonCount(0, 'data');
    }

    public function test_profile_and_administrator_access_management(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $member = User::factory()->create();
        $profile = ['name' => 'Updated name', 'location' => 'Nairobi', 'headline' => 'Building a venture', 'bio' => 'My first venture profile.'];
        $this->actingAs($member)->patchJson('/api/v1/auth/me', $profile + ['role' => 'admin'])->assertOk()->assertJsonPath('data.role', 'guest');
        $this->getJson('/api/v1/auth/me')->assertJsonPath('data.bio', $profile['bio']);
        $url = '/api/v1/workspace/users/';
        $this->patchJson($url.$admin->id, ['role' => 'guest', 'suspended' => true])->assertForbidden();
        $this->actingAs($admin)->patchJson($url.$admin->id, ['role' => 'guest', 'suspended' => true])->assertForbidden();
        $this->patchJson($url.$member->id, ['role' => 'entrepreneur', 'suspended' => false])->assertUnprocessable();
        $this->patchJson($url.$member->id, ['role' => 'content_manager', 'suspended' => false])->assertOk();
        $this->actingAs($member->fresh())->getJson('/api/v1/workspace/editorial')->assertOk();
        $this->actingAs($admin)->patchJson($url.$member->id, ['role' => 'content_manager', 'suspended' => true])->assertOk();
        $this->actingAs($member->fresh())->getJson('/api/v1/workspace/editorial')->assertForbidden();
    }
}
