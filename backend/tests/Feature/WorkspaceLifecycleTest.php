<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

final class WorkspaceLifecycleTest extends TestCase
{
    use RefreshDatabase;

    private const WORKSPACE = '/api/v1/workspace';

    public function test_affiliation_review_unlocks_ventures_and_enforces_institution_login(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $guest = User::factory()->create();
        $other = User::factory()->create();
        $school = $this->createInstitution($admin, 'Eastlands Hub', 'hub');
        $this->createInstitution($admin, 'Northern Hub', 'hub');
        $application = [
            'institution' => $school, 'location' => 'Nairobi',
            'details' => 'I need support validating an agriculture venture.', 'consent' => true,
        ];
        $venture = [
            'name' => 'Green Basket', 'sector' => 'Agribusiness', 'location' => 'Nairobi',
            'description' => 'Collect weekly orders for locally grown produce.',
        ];

        $this->actingAs($guest)->postJson(self::WORKSPACE.'/ventures', $venture)->assertForbidden();
        $first = $this->postJson(self::WORKSPACE.'/applications', $application)->assertCreated()->json('data.id');
        $this->postJson(self::WORKSPACE.'/applications', $application)->assertUnprocessable();
        $this->actingAs($other)->getJson(self::WORKSPACE.'/applications')->assertExactJson(['data' => []]);
        $this->postJson(self::WORKSPACE."/applications/$first/review", ['decision' => 'approved'])->assertForbidden();
        $this->actingAs($admin)->postJson(self::WORKSPACE."/applications/$first/review", ['decision' => 'rejected'])
            ->assertUnprocessable()->assertJsonValidationErrors('note');
        $this->postJson(self::WORKSPACE."/applications/$first/review", ['decision' => 'rejected', 'note' => 'Please clarify your location.'])
            ->assertOk();
        $second = $this->actingAs($guest)->postJson(self::WORKSPACE.'/applications', $application)->assertCreated()->json('data.id');
        $this->actingAs($admin)->postJson(self::WORKSPACE."/applications/$second/review", ['decision' => 'approved'])->assertOk();
        $this->postJson(self::WORKSPACE."/applications/$second/review", ['decision' => 'approved'])->assertConflict();
        $this->assertDatabaseCount('institution_memberships', 1);

        $this->actingAs($guest->fresh())->getJson('/api/v1/auth/me')
            ->assertJsonPath('data.role', 'entrepreneur')->assertJsonPath('data.affiliation.slug', $school);
        $this->postJson(self::WORKSPACE.'/ventures', [...$venture, 'sector' => 'Unlisted sector'])
            ->assertUnprocessable()->assertJsonValidationErrors('sector');
        $id = $this->postJson(self::WORKSPACE.'/ventures', $venture)->assertCreated()->json('data.id');
        $this->actingAs($admin)->postJson(self::WORKSPACE."/ventures/$id/review", ['decision' => 'rejected', 'note' => 'Explain your delivery plan.'])
            ->assertOk();
        $this->actingAs($guest->fresh())->patchJson(self::WORKSPACE."/ventures/$id", [
            ...$venture, 'description' => 'Collect orders on Friday and deliver on Saturdays.',
        ])->assertOk()->assertJsonPath('data.status', 'pending');
        $this->actingAs($admin)->postJson(self::WORKSPACE."/ventures/$id/review", ['decision' => 'approved'])->assertOk();
        $this->actingAs($guest->fresh())->getJson(self::WORKSPACE.'/ventures')
            ->assertOk()->assertJsonPath('data.0.status', 'approved');
        $this->requestLogout();
        $credentials = ['email' => $guest->email, 'password' => 'password'];
        $this->postJson('/api/v1/auth/login', [...$credentials, 'institution' => 'northern-hub'])
            ->assertUnprocessable()->assertJsonValidationErrors('institution');
        $this->getJson('/api/v1/auth/me')->assertUnauthorized();
        $this->postJson('/api/v1/auth/login', [...$credentials, 'institution' => $school])->assertOk();
    }

    public function test_portal_and_management_are_scoped_to_authorized_staff(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $staff = User::factory()->create();
        $other = User::factory()->create();
        $this->createInstitution($admin, 'Central University', 'university');
        $this->createInstitution($admin, 'Lakeview School', 'high-school');

        $unverified = User::factory()->unverified()->create(['name' => 'Eligible namesake']);
        $suspended = User::factory()->create(['name' => 'Eligible suspended', 'suspended_at' => now()]);
        $staff->update(['name' => 'Eligible candidate']);
        $candidatePath = self::WORKSPACE.'/institutions/central-university/staff-candidates?q=Eligible';
        $this->actingAs($other)->getJson($candidatePath)->assertForbidden();
        $this->actingAs($admin)->getJson($candidatePath)
            ->assertExactJson(['data' => [['id' => $staff->id, 'name' => 'Eligible candidate']]]);
        $this->postJson(self::WORKSPACE.'/institutions/central-university/staff', [
            'email' => $staff->email, 'access' => 'manage',
        ])->assertUnprocessable()->assertJsonValidationErrors('user_id');
        foreach ([$admin, $unverified, $suspended] as $ineligible) {
            $this->postJson(self::WORKSPACE.'/institutions/central-university/staff', [
                'user_id' => $ineligible->id, 'access' => 'manage',
            ])->assertUnprocessable()->assertJsonValidationErrors('user_id');
        }
        $this->patchJson(self::WORKSPACE.'/institutions/central-university', ['name' => 'Central Campus'])
            ->assertOk()->assertJsonPath('data.slug', 'central-university');
        $this->getJson(self::WORKSPACE.'/institutions')->assertJsonPath('data.0.name', 'Central Campus');
        $this->actingAs($other)->postJson(self::WORKSPACE.'/institutions/central-university/staff', [
            'user_id' => $staff->id, 'access' => 'view',
        ])->assertForbidden();
        $this->actingAs($admin)->postJson(self::WORKSPACE.'/institutions/central-university/staff', [
            'user_id' => $staff->id, 'access' => 'view',
        ])->assertOk();
        $this->postJson(self::WORKSPACE.'/institutions/lakeview-school/staff', [
            'user_id' => $staff->id, 'access' => 'manage',
        ])->assertUnprocessable();
        $this->actingAs($staff->fresh())->getJson('/api/v1/auth/me')
            ->assertJsonPath('data.staff.0.slug', 'central-university')->assertJsonPath('data.staff.0.access', 'view');
        $this->getJson(self::WORKSPACE.'/institutions/central-university/members')
            ->assertOk()->assertJsonPath('data.invitations', []);
        $this->getJson(self::WORKSPACE.'/institutions/lakeview-school/members')->assertForbidden();
        $this->postJson('/api/v1/identity/institutions/central-university/invitations', [
            'email' => 'invite@example.test', 'name' => 'New member',
        ])->assertForbidden();
        $this->assertSame(1, DB::table('institution_access')->count());
    }

    public function test_only_admin_can_promote_an_eligible_mentor_by_id(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $guest = User::factory()->create(['name' => 'Candidate mentor', 'email' => 'mentor.candidate@example.test']);
        $otherGuest = User::factory()->create(['name' => 'Another verified guest', 'email' => 'another.guest@example.test']);
        $unverified = User::factory()->unverified()->create(['name' => 'Candidate unverified']);
        $path = '/api/v1/workspace/mentors';

        $this->actingAs($guest)->getJson($path.'/candidates')->assertForbidden();
        $this->postJson($path, ['user_id' => $guest->id])->assertForbidden();
        $this->actingAs($admin)->getJson($path.'/candidates?q=Candidate')
            ->assertExactJson(['data' => [['id' => $guest->id, 'name' => 'Candidate mentor']]]);
        $this->getJson($path.'/candidates?q=mentor.candidate')
            ->assertExactJson(['data' => [['id' => $guest->id, 'name' => 'Candidate mentor']]]);
        $this->getJson($path.'/candidates?q=NoSuchAccount999')
            ->assertExactJson(['data' => []]);
        $this->getJson($path.'/candidates?q=Another')
            ->assertExactJson(['data' => [['id' => $otherGuest->id, 'name' => 'Another verified guest']]]);
        $this->postJson($path, ['email' => $guest->email])->assertUnprocessable()->assertJsonValidationErrors('user_id');
        $this->postJson($path, ['user_id' => $unverified->id])->assertUnprocessable()->assertJsonValidationErrors('user_id');
        $this->postJson($path, ['user_id' => $guest->id])->assertCreated()->assertJsonPath('data.role', 'mentor');
        $this->getJson($path.'/candidates?q=Candidate')->assertExactJson(['data' => []]);
        $this->assertSame('mentor', $guest->fresh()->role);
    }

    public function test_guest_applying_from_profile_with_matching_institution_domain_auto_approves(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $slug = $this->actingAs($admin)->postJson(self::WORKSPACE.'/institutions', [
            'name' => 'KCA University',
            'kind' => 'university',
            'allowed_domains' => ['students.kcau.ac.ke'],
        ])->assertCreated()->json('data.slug');
        $this->postJson(self::WORKSPACE."/institutions/$slug/activate", [])->assertOk();

        $guest = User::factory()->create([
            'role' => 'guest',
            'email' => 'founder@students.kcau.ac.ke',
        ]);

        $this->actingAs($guest)
            ->postJson(self::WORKSPACE.'/applications', [
                'institution' => $slug,
                'location' => 'Nairobi',
                'details' => 'Instant institutional domain affiliation from profile hub.',
                'consent' => true,
            ])
            ->assertCreated()
            ->assertJsonPath('data.auto_approved', true);

        $this->assertSame('entrepreneur', $guest->fresh()->role);
        $this->assertDatabaseHas('institution_memberships', ['user_id' => $guest->id]);
        $this->assertDatabaseCount('affiliation_applications', 0);
    }

    public function test_guest_can_upload_institutional_proof_document_and_authorized_reviewers_can_view_it(): void
    {
        Storage::fake('local');
        $admin = User::factory()->create(['role' => 'admin']);
        $coordinator = User::factory()->create(['role' => 'guest']);
        $applicant = User::factory()->create(['role' => 'guest', 'email' => 'student@example.test']);
        $stranger = User::factory()->create(['role' => 'guest']);
        $slug = $this->createInstitution($admin, 'Coast Innovation Hub', 'hub');
        $this->actingAs($admin)
            ->postJson(self::WORKSPACE."/institutions/$slug/staff", [
                'user_id' => $coordinator->id,
                'access' => 'manage',
            ])
            ->assertOk();

        // Missing proof document & details is rejected.
        $this->actingAs($applicant)
            ->postJson(self::WORKSPACE.'/applications', [
                'institution' => $slug,
                'location' => 'Mombasa',
                'consent' => true,
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('document');

        $applicationId = $this->actingAs($applicant)
            ->post(self::WORKSPACE.'/applications', [
                'institution' => $slug,
                'location' => 'Mombasa',
                'consent' => '1',
                'document' => UploadedFile::fake()->create('student-id.pdf', 32, 'application/pdf'),
            ], ['Accept' => 'application/json'])
            ->assertCreated()
            ->json('data.id');

        $this->actingAs($applicant)
            ->getJson(self::WORKSPACE.'/applications')
            ->assertOk()
            ->assertJsonPath('data.0.has_document', true)
            ->assertJsonPath('data.0.document_name', 'student-id.pdf');

        $documentUrl = self::WORKSPACE."/applications/$applicationId/document";
        $this->actingAs($applicant)->get($documentUrl)->assertOk();
        $this->actingAs($coordinator)->get($documentUrl)->assertOk();
        $this->actingAs($admin)->get($documentUrl)->assertOk();
        $this->actingAs($stranger)->get($documentUrl)->assertForbidden();
    }

    private function requestLogout(): void
    {
        $this->postJson('/api/v1/auth/logout')->assertNoContent();
    }

    private function createInstitution(User $admin, string $name, string $kind): string
    {
        $slug = $this->actingAs($admin)->postJson(self::WORKSPACE.'/institutions', [
            'name' => $name, 'kind' => $kind,
        ])->assertCreated()->json('data.slug');
        $this->getJson('/api/v1/institutions')->assertJsonMissing(['slug' => $slug]);
        $this->postJson(self::WORKSPACE."/institutions/$slug/activate", [])->assertOk();

        return $slug;
    }
}
