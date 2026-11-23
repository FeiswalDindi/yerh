<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

final class EngagementTest extends TestCase
{
    use RefreshDatabase;

    private const API = '/api/v1/engagement';

    public function test_event_drafts_booking_capacity_and_rescheduling(): void
    {
        $this->travelTo(now()->setDate(2026, 11, 23)->startOfDay());
        $admin = User::factory()->create(['role' => 'admin']);
        $guest = User::factory()->create(['role' => 'guest']);
        $other = User::factory()->create(['role' => 'guest']);
        $root = self::API;
        $category = $this->actingAs($admin)->postJson($root.'/manage/event-categories', ['name' => 'Workshop'])
            ->assertOk()->json('data.id');
        $record = [
            'title' => 'Local workshop', 'summary' => 'Workshop details', 'venue' => 'Nairobi',
            'category_id' => $category, 'starts_at' => '2026-11-22T10:00', 'ends_at' => '2026-11-22T11:00',
            'status' => 'draft', 'capacity' => 1,
            'presenters' => [['name' => 'Test Host', 'profession' => 'Founder', 'role' => 'host']],
        ];
        $id = $this->postJson($root.'/manage/events', $record)->assertOk()->json('data.id');
        $this->getJson($root.'/events')->assertJsonCount(0, 'data.events');
        $this->getJson($root.'/manage/events')->assertJsonPath('data.events.0.archived', true);
        $record['starts_at'] = '2026-11-26T10:00';
        $record['ends_at'] = '2026-11-26T11:00';
        $record['status'] = 'published';
        $this->patchJson($root.'/manage/events/'.$id, $record)->assertOk();
        $published = $this->getJson($root.'/events')->assertJsonPath('data.events.0.archived', false)->json('data.events.0');
        $uri = $root.'/events/'.$published['slug'];
        $this->actingAs($guest)->getJson($root.'/manage/events')->assertForbidden();
        $this->postJson($uri.'/booking')->assertOk();
        $this->postJson($uri.'/booking')->assertOk();
        $this->getJson($uri)->assertJsonPath('data.booked', true)->assertJsonPath('data.presenters.0.name', 'Test Host');
        $this->actingAs($other)->postJson($uri.'/booking')->assertConflict();
        $this->actingAs($guest)->deleteJson($uri.'/booking')->assertOk();
        $this->actingAs($other)->postJson($uri.'/booking')->assertOk();
    }

    public function test_opportunity_applications_only_show_for_eligible_founders_and_admin(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $founder = User::factory()->create(['role' => 'entrepreneur']);
        $other = User::factory()->create(['role' => 'entrepreneur']);
        $institution = DB::table('institutions')->insertGetId([
            'name' => 'Opportunity Hub', 'slug' => 'hub', 'kind' => 'hub', 'status' => 'active',
        ]);
        $venture = DB::table('ventures')->insertGetId([
            'owner_id' => $founder->id, 'institution_id' => $institution, 'name' => 'Test Venture',
            'sector' => 'Agriculture', 'location' => 'Nairobi', 'description' => 'Example', 'status' => 'approved',
        ]);
        $root = self::API;
        $this->actingAs($admin)->postJson($root.'/manage/opportunities', [
            'title' => 'Growth support', 'description' => 'A chance to grow', 'category' => 'Grant', 'organiser' => 'Test Hub',
            'status' => 'published',
        ])->assertOk();
        $item = $this->getJson($root.'/opportunities')->assertJsonPath('data.0.open', true)->json('data.0');
        $params = ['venture_id' => $venture, 'motivation' => 'We need training on customer discovery.'];
        $path = $root.'/opportunities/'.$item['slug'].'/applications';
        $this->postJson($path, $params)->assertForbidden();
        $this->actingAs($other)->postJson($path, $params)->assertNotFound();
        $application = $this->actingAs($founder)->postJson($path, $params)->assertCreated()->json('data.id');
        $this->postJson($path, $params)->assertConflict();
        $this->actingAs($other)->getJson($root.'/applications')->assertJsonCount(0, 'data');
        $this->actingAs($admin)->postJson($root.'/applications/'.$application.'/decision', ['decision' => 'rejected'])->assertUnprocessable();
        $this->postJson($root.'/applications/'.$application.'/decision', ['decision' => 'accepted'])->assertOk();
        $this->actingAs($founder)->getJson($root.'/applications')->assertJsonPath('data.0.status', 'accepted');
    }
}
