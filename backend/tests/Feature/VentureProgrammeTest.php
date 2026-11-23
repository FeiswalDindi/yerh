<?php

namespace Tests\Feature;

use App\Domain\Incubation\Curriculum;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

final class VentureProgrammeTest extends TestCase
{
    use RefreshDatabase;

    private const API = '/api/v1/workspace';

    public function test_individual_path_certificates_and_publication_use_graded_stages_and_confirmed_fees(): void
    {
        [$admin, $mentor, $founder, $venture] = $this->programmeAccounts();
        $outsider = User::factory()->create(['role' => 'mentor']);
        $product = $this->createProduct($founder, $venture, 'Starter basket');
        $id = $this->postJson(self::API."/ventures/$venture/launch", ['product_ids' => [$product]])->assertCreated()->json('data.id');
        $this->postJson(self::API."/ventures/$venture/launch")->assertConflict();
        $this->postJson(self::API."/incubation/$id/stages/getting-started/evidence", [
            'step' => 'discovery', 'body' => 'Evidence before a mentor is assigned.',
        ])->assertConflict();
        $this->actingAs($outsider)->getJson(self::API."/incubation/$id")->assertNotFound();
        $this->actingAs($admin)->postJson(self::API."/incubation/$id/mentor", ['mentor_id' => $mentor->id])->assertOk();
        $this->postJson(self::API."/products/$product/review/listing", ['decision' => 'approved'])->assertOk();
        $this->actingAs($founder)->postJson(self::API."/products/$product/evidence", [
            'evidence' => 'The product was tested with five customers.',
        ])->assertOk();
        $this->actingAs($mentor)->postJson(self::API."/products/$product/review/evidence", ['decision' => 'approved'])->assertOk();
        $this->getJson('/api/v1/marketplace')->assertExactJson(['data' => []]);
        $this->actingAs($founder)->postJson(self::API."/incubation/$id/stages/advanced/evidence", [
            'step' => 'pilot', 'body' => 'Evidence before completing the first stage.',
        ])->assertConflict();

        foreach (app(Curriculum::class)->stages() as $stage) {
            $base = self::API."/incubation/$id/stages/".$stage['id'];
            $this->actingAs($founder)->postJson($base.'/request-review')->assertConflict();
            foreach ($stage['steps'] as $step) {
                $this->postJson($base.'/evidence', ['step' => $step['id'], 'body' => 'Evidence recorded for this milestone.'])->assertOk();
            }
            $this->postJson($base.'/request-review')->assertOk();
            $this->postJson($base.'/open-exam', ['note' => 'Founders cannot open exams.'])->assertForbidden();
            $this->actingAs($mentor)->postJson($base.'/meeting', [
                'meeting_at' => now()->addDay()->toIso8601String(), 'location' => 'Online',
            ])->assertOk();
            $this->postJson($base.'/open-exam', ['note' => 'Discussed evidence at review.'])->assertOk();
            $this->actingAs($founder)->postJson($base.'/submit', ['answer' => 'My answer uses the evidence I submitted.'])->assertOk();
            $this->actingAs($mentor)->postJson($base.'/grade', ['score' => 0, 'note' => 'An assessment can complete below the pass mark.'])->assertOk();
        }

        $this->getJson('/api/v1/marketplace')->assertJsonPath('data.0.name', 'Starter basket');
        $this->actingAs($admin)->postJson(self::API."/incubation/$id/certificates/getting-started")->assertConflict();
        $document = $this->postJson(self::API."/incubation/$id/certificates/venture")->assertCreated()->json('data.document_id');
        $this->actingAs($outsider)->get(self::API."/venture-certificates/$document/document")->assertNotFound();
        $this->actingAs($founder)->get(self::API."/venture-certificates/$document/document")->assertOk()->assertSee('Achievements');
        $payment = $this->postJson(self::API.'/programme-payments', [
            'purpose' => 'getting-started', 'target_id' => $id, 'reference' => 'Test-stage-reference',
        ])->assertCreated()->json('data.id');
        $this->actingAs($admin)->postJson(self::API."/programme-payments/$payment/review", ['decision' => 'confirmed'])->assertOk();
        $this->postJson(self::API."/incubation/$id/certificates/getting-started")->assertCreated();

        $newProduct = $this->createProduct($founder, $venture, 'Added after graduation');
        $this->actingAs($admin)->postJson(self::API."/products/$newProduct/review/listing", ['decision' => 'approved'])->assertOk();
        $this->getJson('/api/v1/marketplace')->assertJsonCount(1, 'data');
        $this->actingAs($founder)->postJson(self::API."/products/$newProduct/evidence", ['evidence' => 'Targeted evidence for a newly added product.'])->assertOk();
        $this->actingAs($mentor)->postJson(self::API."/products/$newProduct/review/evidence", ['decision' => 'approved'])->assertOk();
        $this->getJson('/api/v1/marketplace')->assertJsonCount(2, 'data');
    }

    public function test_paid_listing_is_charged_at_configured_price_and_stays_private_until_confirmed_and_approved(): void
    {
        [$admin, , $founder, $venture] = $this->programmeAccounts();
        $product = $this->createProduct($founder, $venture, 'Independent listing');
        $this->actingAs($admin)->putJson(self::API.'/programme-fees/marketplace', [
            'amount' => 1200, 'enabled' => false,
        ])->assertOk();
        $proof = ['target_id' => $product, 'purpose' => 'marketplace', 'reference' => 'LISTING-TEST', 'amount' => 0];
        $this->actingAs($founder)->postJson(self::API.'/programme-payments', $proof)->assertConflict();
        $this->actingAs($admin)->putJson(self::API.'/programme-fees/marketplace', [
            'amount' => 1200, 'enabled' => true,
        ])->assertOk();
        $payment = $this->actingAs($founder)->postJson(self::API.'/programme-payments', $proof)->assertCreated()->json('data.id');
        $this->assertDatabaseHas('programme_payments', ['id' => $payment, 'amount' => 1200, 'status' => 'pending']);
        $this->actingAs($admin)->postJson(self::API."/programme-payments/$payment/review", ['decision' => 'confirmed'])->assertOk();
        $this->getJson('/api/v1/marketplace')->assertJsonCount(0, 'data');
        $this->postJson(self::API."/products/$product/review/listing", ['decision' => 'approved'])->assertOk();
        $this->getJson('/api/v1/marketplace?category=Agribusiness')->assertJsonPath('data.0.name', 'Independent listing');
        $this->getJson('/api/v1/marketplace?category=Healthcare')->assertJsonCount(0, 'data');
        $this->getJson('/api/v1/marketplace-sectors')->assertJsonPath('data.0.name', 'Agribusiness')->assertJsonPath('data.0.count', 1);
    }

    private function programmeAccounts(): array
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $mentor = User::factory()->create(['role' => 'mentor']);
        $founder = User::factory()->create(['role' => 'entrepreneur']);
        $institution = DB::table('institutions')->insertGetId([
            'name' => 'Test University', 'slug' => 'test-university', 'kind' => 'university', 'status' => 'active',
        ]);
        DB::table('institution_memberships')->insert([
            'institution_id' => $institution, 'user_id' => $founder->id, 'location' => 'Nairobi', 'consented_at' => now(),
        ]);
        $venture = DB::table('ventures')->insertGetId([
            'name' => 'Starter venture', 'sector' => 'Agribusiness', 'location' => 'Nairobi',
            'description' => 'Collect weekly orders for locally grown produce.', 'status' => 'approved',
            'owner_id' => $founder->id, 'institution_id' => $institution,
        ]);

        return [$admin, $mentor, $founder, $venture];
    }

    private function createProduct(User $founder, int $venture, string $name): int
    {
        return $this->actingAs($founder)->postJson(self::API.'/products', [
            'venture_id' => $venture, 'name' => $name, 'description' => 'Prepared and tested through the venture.', 'price' => '250.50',
        ])->assertCreated()->json('data.id');
    }
}
