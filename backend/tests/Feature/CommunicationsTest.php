<?php

namespace Tests\Feature;

use App\Models\User;
use App\Notifications\CommunicationEmail;
use App\Notifications\WorkspaceAlert;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Notifications\AnonymousNotifiable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

final class CommunicationsTest extends TestCase
{
    use RefreshDatabase;

    public function test_communications_rbac_template_crud_audience_filters_and_broadcast(): void
    {
        Notification::fake();

        $admin = User::factory()->create(['role' => 'admin', 'name' => 'Admin Chief']);
        $cm = User::factory()->create(['role' => 'content_manager', 'name' => 'Content Lead']);
        $founder = User::factory()->create(['role' => 'entrepreneur', 'name' => 'Amina Ochieng', 'location' => 'Nairobi']);
        $mentor = User::factory()->create(['role' => 'mentor', 'name' => 'David Mentor', 'location' => 'Kisumu']);
        $unverified = User::factory()->unverified()->create(['role' => 'guest', 'name' => 'Pending User']);
        $suspended = User::factory()->create(['role' => 'guest', 'name' => 'Suspended User', 'suspended_at' => now()]);

        $instId = DB::table('institutions')->insertGetId([
            'slug' => 'kca-hub',
            'name' => 'KCA Hub',
            'kind' => 'university',
            'status' => 'active',
        ]);
        DB::table('institution_memberships')->insert([
            'institution_id' => $instId,
            'user_id' => $founder->id,
            'location' => 'Nairobi',
            'consented_at' => now(),
        ]);
        $ventureId = DB::table('ventures')->insertGetId([
            'owner_id' => $founder->id,
            'institution_id' => $instId,
            'name' => 'Solar Kiln',
            'sector' => 'Agribusiness',
            'location' => 'Nairobi',
            'description' => 'Clean energy dryers.',
            'status' => 'approved',
        ]);
        DB::table('incubation_paths')->insert([
            'venture_id' => $ventureId,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // Non-staff are blocked.
        $this->actingAs($founder)->getJson('/api/v1/workspace/communications/audience')->assertForbidden();
        $this->actingAs($mentor)->getJson('/api/v1/workspace/communications/templates')->assertForbidden();

        // Starter templates auto-seed cleanly with mapped CTA buttons, and CRUD works.
        $templates = $this->actingAs($cm)
            ->getJson('/api/v1/workspace/communications/templates')
            ->assertOk()
            ->json('data');
        $this->assertGreaterThanOrEqual(5, count($templates));

        $byCategory = collect($templates)->keyBy('category');
        $this->assertSame('/events', $byCategory['events']['action_url'] ?? null);
        $this->assertSame('/dashboard', $byCategory['onboarding']['action_url'] ?? null);
        $this->assertSame('/opportunities', $byCategory['announcements']['action_url'] ?? null);

        $tplId = $this->postJson('/api/v1/workspace/communications/templates', [
            'name' => 'Pitch Readiness Call',
            'category' => 'incubation',
            'subject' => 'Hi {{first_name}} at {{institution}}',
            'body' => 'Hello {{name}}, prepare your deck for Friday.',
            'action_label' => 'Open Incubation',
            'action_url' => '/dashboard/workspace?tab=incubation',
        ])->assertCreated()
            ->assertJsonPath('data.action_label', 'Open Incubation')
            ->assertJsonPath('data.action_url', '/dashboard/workspace?tab=incubation')
            ->json('data.id');

        $this->patchJson("/api/v1/workspace/communications/templates/{$tplId}", [
            'name' => 'Pitch Readiness Updated',
            'category' => 'incubation',
            'subject' => 'Hi {{first_name}} at {{institution}}',
            'body' => 'Updated instructions for {{name}} ({{role}}).',
            'action_label' => 'View Events',
            'action_url' => '/events',
        ])->assertOk()
            ->assertJsonPath('data.name', 'Pitch Readiness Updated')
            ->assertJsonPath('data.action_url', '/events');

        // Multi-facet audience filtering.
        $this->actingAs($admin)
            ->getJson("/api/v1/workspace/communications/audience?role=entrepreneur&institution_id={$instId}&venture=approved&incubation=active")
            ->assertOk()
            ->assertJsonCount(1, 'data.users')
            ->assertJsonPath('data.users.0.id', $founder->id);

        $this->getJson('/api/v1/workspace/communications/audience?verified=unverified')
            ->assertOk()
            ->assertJsonCount(1, 'data.users')
            ->assertJsonPath('data.users.0.id', $unverified->id);

        $this->getJson('/api/v1/workspace/communications/audience?status=suspended')
            ->assertOk()
            ->assertJsonCount(1, 'data.users')
            ->assertJsonPath('data.users.0.id', $suspended->id);

        // Broadcast to filtered audience with template interpolation.
        $dispatchId = $this->postJson('/api/v1/workspace/communications/broadcast', [
            'subject' => 'Hello {{first_name}} from {{institution}}',
            'body' => 'Hi {{name}}, your {{role}} update is ready.',
            'channel' => 'both',
            'selection_mode' => 'filtered',
            'filters' => [
                'role' => 'entrepreneur',
                'institution_id' => (string) $instId,
                'status' => 'active',
            ],
            'template_id' => $tplId,
            'action_label' => 'Open Dashboard',
            'action_url' => '/dashboard',
        ])->assertCreated()
            ->assertJsonPath('data.recipient_count', 1)
            ->assertJsonPath('data.sent_count', 1)
            ->json('data.dispatch_id');

        Notification::assertSentTo($founder, CommunicationEmail::class);
        Notification::assertNotSentTo($mentor, CommunicationEmail::class);

        $this->getJson('/api/v1/workspace/communications/history')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.template_name', 'Pitch Readiness Updated');

        $this->getJson("/api/v1/workspace/communications/history/{$dispatchId}")
            ->assertOk()
            ->assertJsonPath('data.recipients.0.email', $founder->email)
            ->assertJsonPath('data.recipients.0.status', 'sent');

        $this->deleteJson("/api/v1/workspace/communications/templates/{$tplId}")->assertOk();
    }

    public function test_enquiry_auto_acknowledgement_and_direct_email_reply(): void
    {
        Notification::fake();

        $cm = User::factory()->create(['role' => 'content_manager']);
        $admin = User::factory()->create(['role' => 'admin']);

        $enquiryId = $this->postJson('/api/v1/contact', [
            'name' => 'Grace Enquirer',
            'email' => 'grace@enquirer.example',
            'topic' => 'Partnership',
            'message' => 'We would like to partner on regional youth workshops.',
        ])->assertCreated()->json('data.id');

        Notification::assertSentTo($cm, WorkspaceAlert::class);
        Notification::assertSentTo($admin, WorkspaceAlert::class);
        Notification::assertSentOnDemand(
            CommunicationEmail::class,
            fn ($notification, $channels, $notifiable) => $notifiable instanceof AnonymousNotifiable
                && $notifiable->routeNotificationFor('mail') === 'grace@enquirer.example',
        );

        $this->actingAs($cm)
            ->postJson("/api/v1/workspace/communications/enquiries/{$enquiryId}/reply", [
                'subject' => 'Re: {{topic}} with YERH',
                'body' => 'Hello {{first_name}}, thank you for partnering with us.',
                'mark_status' => 'resolved',
            ])
            ->assertCreated()
            ->assertJsonPath('data.sent', true)
            ->assertJsonPath('data.status', 'resolved');

        $this->getJson('/api/v1/workspace/contact-messages')
            ->assertOk()
            ->assertJsonPath('data.0.status', 'resolved')
            ->assertJsonPath('data.0.reply_count', 1);
    }

    public function test_virtual_events_presenter_photo_and_reservation_notifications(): void
    {
        Notification::fake();
        $this->travelTo(now()->setDate(2026, 11, 23)->startOfDay());

        $cm = User::factory()->create(['role' => 'content_manager']);
        $mentor = User::factory()->create(['role' => 'mentor']);
        $admin = User::factory()->create(['role' => 'admin']);

        $catId = $this->actingAs($cm)
            ->postJson('/api/v1/engagement/manage/event-categories', ['name' => 'Mentorship Clinic'])
            ->assertOk()
            ->json('data.id');

        // Virtual event requires meeting_link.
        $this->postJson('/api/v1/engagement/manage/events', [
            'title' => 'Online Pitch Clinic',
            'summary' => 'Get live feedback on your startup pitch.',
            'venue_type' => 'virtual',
            'venue' => 'Google Meet',
            'category_id' => $catId,
            'starts_at' => '2026-11-28T14:00',
            'ends_at' => '2026-11-28T15:30',
            'status' => 'published',
        ])->assertUnprocessable()->assertJsonValidationErrors('meeting_link');

        // Accepts uploaded CMS media URL for presenter photo.
        $eventId = $this->postJson('/api/v1/engagement/manage/events', [
            'title' => 'Online Pitch Clinic',
            'summary' => 'Get live feedback on your startup pitch.',
            'venue_type' => 'virtual',
            'venue' => 'Google Meet',
            'meeting_link' => 'https://meet.google.com/yerh-pitch-live',
            'category_id' => $catId,
            'starts_at' => '2026-11-28T14:00',
            'ends_at' => '2026-11-28T15:30',
            'capacity' => 50,
            'status' => 'published',
            'presenters' => [
                [
                    'name' => 'Dr. Wanjiku Host',
                    'profession' => 'Lead Venture Advisor',
                    'role' => 'host',
                    'photo' => '/api/v1/cms/media/550e8400-e29b-41d4-a716-446655440000',
                ],
            ],
        ])->assertOk()->json('data.id');

        $slug = DB::table('engagement_events')->where('id', $eventId)->value('slug');

        // Unbooked user sees virtual status without private meeting_link.
        $this->actingAs($mentor)
            ->getJson("/api/v1/engagement/events/{$slug}")
            ->assertOk()
            ->assertJsonPath('data.venue_type', 'virtual')
            ->assertJsonPath('data.has_meeting_link', true)
            ->assertJsonPath('data.meeting_link', null);

        // Mentor (and any verified user) can reserve a spot and immediately receives confirmation + meeting link.
        $this->postJson("/api/v1/engagement/events/{$slug}/booking")
            ->assertOk()
            ->assertJsonPath('data.booked', true);

        Notification::assertSentTo($mentor, WorkspaceAlert::class);

        $this->getJson("/api/v1/engagement/events/{$slug}")
            ->assertOk()
            ->assertJsonPath('data.booked', true)
            ->assertJsonPath('data.meeting_link', 'https://meet.google.com/yerh-pitch-live')
            ->assertJsonPath('data.presenters.0.photo', '/api/v1/cms/media/550e8400-e29b-41d4-a716-446655440000');

        // Role change & suspension trigger automatic alerts.
        $guest = User::factory()->create(['role' => 'guest']);
        $this->actingAs($admin)->patchJson("/api/v1/workspace/users/{$guest->id}", [
            'role' => 'content_manager',
            'suspended' => false,
        ])->assertOk();
        Notification::assertSentTo($guest, WorkspaceAlert::class);

        $this->actingAs($admin)->patchJson("/api/v1/workspace/users/{$guest->id}", [
            'role' => 'content_manager',
            'suspended' => true,
        ])->assertOk();
        Notification::assertSentOnDemand(
            CommunicationEmail::class,
            fn ($notification, $channels, $notifiable) => $notifiable instanceof AnonymousNotifiable
                && $notifiable->routeNotificationFor('mail') === $guest->email,
        );
    }

    public function test_built_in_mailer_captures_emails_with_template_button_into_outbox(): void
    {
        $cm = User::factory()->create(['role' => 'content_manager', 'name' => 'Content Editor']);
        $founder = User::factory()->create(['role' => 'entrepreneur', 'name' => 'Faith Founder']);

        $this->actingAs($founder)->getJson('/api/v1/workspace/communications/outbox')->assertForbidden();

        $tplId = $this->actingAs($cm)
            ->postJson('/api/v1/workspace/communications/templates', [
                'name' => 'Event Invite CTA',
                'category' => 'events',
                'subject' => 'Join us, {{first_name}}',
                'body' => 'Reserve your seat before capacity fills.',
                'action_label' => 'View Upcoming Events',
                'action_url' => '/events',
            ])
            ->assertCreated()
            ->json('data.id');

        // Send a real broadcast (no Notification::fake) omitting manual button fields so the template's CTA is used.
        $this->postJson('/api/v1/workspace/communications/broadcast', [
            'subject' => 'Join us, {{first_name}}',
            'body' => 'Reserve your seat before capacity fills.',
            'channel' => 'email',
            'selection_mode' => 'selected',
            'user_ids' => [$founder->id],
            'template_id' => $tplId,
        ])->assertCreated()
            ->assertJsonPath('data.sent_count', 1);

        $outbox = $this->getJson('/api/v1/workspace/communications/outbox')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->json('data');

        $emailId = $outbox[0]['id'];
        $this->assertSame($founder->email, $outbox[0]['to_email']);
        $this->assertSame('Join us, Faith', $outbox[0]['subject']);

        $detail = $this->getJson("/api/v1/workspace/communications/outbox/{$emailId}")
            ->assertOk()
            ->json('data');

        $this->assertStringContainsString('View Upcoming Events', (string) ($detail['html_body'] ?? $detail['text_body']));
        $this->assertStringContainsString('/events', (string) ($detail['html_body'] ?? $detail['text_body']));
    }
}
