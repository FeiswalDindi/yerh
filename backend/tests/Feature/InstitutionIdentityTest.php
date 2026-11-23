<?php

namespace Tests\Feature;

use App\Models\User;
use App\Notifications\InstitutionInvitationIssued;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Notifications\AnonymousNotifiable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

final class InstitutionIdentityTest extends TestCase
{
    use RefreshDatabase;

    private const API = '/api/v1/identity';

    public function test_verified_recipient_accepts_university_invite_once_and_becomes_entrepreneur(): void
    {
        Notification::fake();
        $staff = User::factory()->create();
        $learner = User::factory()->create(['email' => 'recipient@example.test']);
        $thirdParty = User::factory()->create();
        $id = $this->institution('university', 'university');
        $this->grant($staff, $id);
        $this->actingAs($staff)->postJson(self::API.'/institutions/university/invitations', [
            'name' => 'Youth Member', 'email' => 'RECIPIENT@example.test',
        ])->assertCreated();
        $this->actingAs($staff)->postJson(self::API.'/institutions/university/invitations', [
            'name' => 'Youth Member', 'email' => 'recipient@example.test',
        ])->assertUnprocessable();
        $testNotification = Notification::sent(new AnonymousNotifiable, InstitutionInvitationIssued::class)->sole();
        $token = collect($testNotification->toMail(new AnonymousNotifiable)->introLines)->last();
        $this->assertDatabaseHas('institution_invitations', ['token_hash' => hash('sha256', $token)]);
        $data = ['token' => $token, 'location' => 'Nairobi', 'consent' => true];

        $this->actingAs($thirdParty)->postJson(self::API.'/invitations/accept', $data)->assertUnprocessable();
        $this->actingAs($learner)->postJson(self::API.'/invitations/accept', [...$data, 'consent' => false])
            ->assertUnprocessable()->assertJsonValidationErrors('consent');
        $this->actingAs($learner)->postJson(self::API.'/invitations/accept', $data)
            ->assertOk()->assertJsonPath('data.role', 'entrepreneur');
        $this->postJson(self::API.'/invitations/accept', $data)->assertUnprocessable();
        $this->assertDatabaseHas('institution_memberships', ['user_id' => $learner->id, 'institution_id' => $id]);
        $this->assertSame('entrepreneur', $learner->fresh()->role);
    }

    public function test_school_access_is_scoped_and_school_admin_does_not_get_individual_invitations(): void
    {
        Notification::fake();
        $staff = User::factory()->create(['role' => 'school_admin']);
        $school = $this->institution('school', 'high_school');
        $this->institution('university', 'university');
        $this->grant($staff, $school);
        $this->actingAs($staff)->getJson(self::API.'/institutions/school/access')
            ->assertOk()->assertJsonPath('data.access', 'manage');
        $this->getJson(self::API.'/institutions/university/access')->assertForbidden();
        $this->postJson(self::API.'/institutions/school/invitations', [
            'name' => 'Student', 'email' => 'student@example.test',
        ])->assertForbidden();
        Notification::assertNothingSent();
    }

    public function test_invite_revocation_is_scoped_and_disables_redemption(): void
    {
        Notification::fake();
        $staff = User::factory()->create();
        $learner = User::factory()->create();
        $hub = $this->institution('hub', 'hub');
        $outside = $this->institution('other', 'university');
        $this->grant($staff, $hub);
        $this->grant($staff, $outside);
        $response = $this->actingAs($staff)->postJson(self::API.'/institutions/hub/invitations', [
            'name' => 'Youth Member', 'email' => $learner->email,
        ])->assertCreated();
        $id = $response->json('data.id');
        $testNotification = Notification::sent(new AnonymousNotifiable, InstitutionInvitationIssued::class)->sole();
        $token = collect($testNotification->toMail(new AnonymousNotifiable)->introLines)->last();
        $this->deleteJson(self::API.'/institutions/other/invitations/'.$id)->assertNotFound();
        $this->deleteJson(self::API.'/institutions/hub/invitations/'.$id)->assertNoContent();
        $this->actingAs($learner)->postJson(self::API.'/invitations/accept', [
            'token' => $token, 'location' => 'Nairobi', 'consent' => true,
        ])->assertUnprocessable();
        $this->assertDatabaseCount('institution_memberships', 0);
    }

    private function institution(string $slug, string $kind): int
    {
        return DB::table('institutions')->insertGetId([
            'slug' => $slug, 'name' => ucfirst($slug), 'kind' => $kind, 'status' => 'active',
        ]);
    }

    private function grant(User $user, int $institution): void
    {
        DB::table('institution_access')->insert([
            'user_id' => $user->id, 'institution_id' => $institution, 'access' => 'manage',
        ]);
    }
}
