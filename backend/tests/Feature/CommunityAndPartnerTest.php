<?php

namespace Tests\Feature;

use App\Console\Commands\SeedPlatformContent;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

final class CommunityAndPartnerTest extends TestCase
{
    use RefreshDatabase;

    public function test_seed_platform_content_populates_cms_editorial_forums_and_groups_idempotently(): void
    {
        $first = SeedPlatformContent::seed();
        $this->assertSame(9, $first['cms_inserted']);
        $this->assertGreaterThan(20, $first['editorial_inserted']);
        $this->assertSame(4, $first['forums_inserted']);
        $this->assertSame(3, $first['groups_inserted']);

        $cmsResponse = $this->getJson('/api/v1/cms/public')
            ->assertOk()
            ->assertJsonPath('data.documents.site.homeSections.partners', true)
            ->assertJsonStructure([
                'data' => [
                    'documents' => [
                        'site',
                        'homepage',
                        'faqs',
                        'team',
                        'partners',
                        'terms',
                        'entrepreneurship',
                        'lessons',
                        'sidebar',
                    ],
                ],
            ]);

        $cmsNav = $cmsResponse->json('data.documents.site.navigation');
        $cmsPages = $cmsResponse->json('data.documents.site.pages');

        $resourcesChildren = collect($cmsNav)->firstWhere('id', 'resources')['children'] ?? [];
        $this->assertSame('Shop', collect($resourcesChildren)->firstWhere('id', 'marketplace')['label'] ?? null);
        $this->assertSame('/groups', collect($resourcesChildren)->firstWhere('id', 'groups')['href'] ?? null);
        $this->assertNull(collect($resourcesChildren)->firstWhere('id', 'workshops'));
        $this->assertNull(collect($resourcesChildren)->firstWhere('id', 'webinars'));

        $navIds = array_column($cmsNav, 'id');
        $this->assertSame(['home', 'resources', 'benefits', 'publications', 'careers', 'contact'], $navIds);
        $careersChildren = collect($cmsNav)->firstWhere('id', 'careers')['children'] ?? [];
        $this->assertSame([
            '/careers/institutions',
            '/careers/partnerships',
            '/careers/mentorship',
            '/careers/invest',
        ], array_column($careersChildren, 'href'));
        $this->assertArrayHasKey('/careers/partnerships', $cmsPages);
        $this->assertArrayHasKey('/careers/institutions', $cmsPages);
        $this->assertArrayHasKey('/careers/mentorship', $cmsPages);
        $this->assertArrayHasKey('/careers/invest', $cmsPages);

        // Second run is strictly idempotent.
        $second = SeedPlatformContent::seed();
        $this->assertSame(0, $second['cms_inserted']);
        $this->assertSame(0, $second['editorial_inserted']);
        $this->assertSame(0, $second['forums_inserted']);
        $this->assertSame(0, $second['groups_inserted']);
    }

    public function test_partner_events_review_attendees_and_course_proposals_only(): void
    {
        Storage::fake('local');

        $admin = User::factory()->create(['role' => 'admin']);
        $cm = User::factory()->create(['role' => 'content_manager']);
        $guest = User::factory()->create(['role' => 'guest']);
        $entrepreneur = User::factory()->create(['role' => 'entrepreneur']);

        // Admin promotes verified guest to partner.
        $this->actingAs($admin)
            ->patchJson("/api/v1/workspace/users/{$guest->id}", [
                'role' => 'partner',
                'suspended' => false,
            ])
            ->assertOk();

        $partner = $guest->fresh();
        $this->assertSame('partner', $partner->role);

        $catId = DB::table('event_categories')->insertGetId(['name' => 'Workshop']);

        // Partner can upload a presenter photo to CMS media under events folder.
        $png = file_get_contents(base_path('../frontend/public/media/health-c8d73354.png'));
        $photoUpload = $this->actingAs($partner)->post('/api/v1/workspace/cms/media', [
            'file' => UploadedFile::fake()->createWithContent('host.png', $png),
        ], ['Accept' => 'application/json'])->assertCreated()->json('data');
        $this->assertSame('events', $photoUpload['folder']);
        $this->assertFalse($photoUpload['in_site_library']);

        // Partner cannot publish directly without Admin/CM approval.
        $this->actingAs($partner)->postJson('/api/v1/engagement/manage/events', [
            'title' => 'Partner Direct Publish Attempt',
            'summary' => 'Should be rejected.',
            'venue_type' => 'physical',
            'venue' => 'Nairobi Hall',
            'category_id' => $catId,
            'starts_at' => '2027-02-10T10:00',
            'ends_at' => '2027-02-10T12:00',
            'status' => 'published',
        ])->assertUnprocessable();

        // Partner submits an event for review.
        $eventId = $this->actingAs($partner)->postJson('/api/v1/engagement/manage/events', [
            'title' => 'Export Readiness Clinic',
            'summary' => 'Practical export training for Kenyan MSMEs.',
            'venue_type' => 'virtual',
            'venue' => 'Virtual (Google Meet)',
            'meeting_link' => 'https://meet.google.com/yerh-partner-clinic',
            'category_id' => $catId,
            'starts_at' => '2027-02-10T10:00',
            'ends_at' => '2027-02-10T12:00',
            'status' => 'pending_review',
            'presenters' => [
                [
                    'name' => 'Wanjiku Host',
                    'profession' => 'Export Advisor',
                    'role' => 'host',
                    'photo' => $photoUpload['url'],
                ],
            ],
        ])->assertOk()->json('data.id');

        // Content Manager approves & publishes the partner event.
        $this->actingAs($cm)
            ->postJson("/api/v1/engagement/manage/events/{$eventId}/review", [
                'decision' => 'published',
            ])
            ->assertOk();

        $eventRow = DB::table('engagement_events')->where('id', $eventId)->first();
        $this->assertSame('published', $eventRow->status);

        // Entrepreneur books a spot and Partner sees the attendee list.
        $this->actingAs($entrepreneur)
            ->postJson("/api/v1/engagement/events/{$eventRow->slug}/booking")
            ->assertOk()
            ->assertJsonPath('data.booked', true);

        $this->actingAs($partner)
            ->getJson("/api/v1/engagement/manage/events/{$eventId}/attendees")
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.email', $entrepreneur->email);

        // Partner proposes a course, Admin approves it, and Partner CANNOT add lessons directly.
        $courseId = $this->actingAs($partner)->post('/api/v1/learning/authoring', [
            'title' => 'Supply Chain Basics',
            'description' => 'Introduction to supplier sourcing and inventory management.',
            'level' => 'Getting started',
            'proposal' => UploadedFile::fake()->create('syllabus.pdf', 120, 'application/pdf'),
        ], ['Accept' => 'application/json'])->assertCreated()->json('data.id');

        $this->actingAs($admin)
            ->postJson("/api/v1/learning/authoring/{$courseId}/review", ['decision' => 'approved'])
            ->assertOk();

        $this->actingAs($partner)
            ->postJson("/api/v1/learning/authoring/{$courseId}/lessons", [
                'title' => 'Lesson 1',
                'content' => 'Should be forbidden for partners.',
            ])
            ->assertForbidden();

        // Partner dashboard summary metrics populate cleanly.
        $this->actingAs($partner)
            ->getJson('/api/v1/workspace/summary')
            ->assertOk()
            ->assertJsonPath('data.metrics.myEvents', 1)
            ->assertJsonPath('data.metrics.publishedEvents', 1)
            ->assertJsonPath('data.metrics.eventBookings', 1)
            ->assertJsonPath('data.metrics.courseProposals', 1);
    }

    public function test_verified_guests_forums_articles_whatsapp_groups_and_leaderboard(): void
    {
        SeedPlatformContent::seed();

        $admin = User::factory()->create(['role' => 'admin']);
        $cm = User::factory()->create(['role' => 'content_manager']);
        $mentor = User::factory()->create(['role' => 'mentor']);
        $entrepreneur = User::factory()->create(['role' => 'entrepreneur']);
        $verifiedGuest = User::factory()->create(['role' => 'guest']);
        $unverifiedGuest = User::factory()->unverified()->create(['role' => 'guest']);

        // Unverified guest cannot post in forums or comment/like articles.
        $forumId = DB::table('community_forums')->value('id');
        $this->actingAs($unverifiedGuest)->postJson('/api/v1/community/threads', [
            'forum_id' => $forumId,
            'title' => 'Unverified question',
            'body' => 'Should be blocked until email is verified.',
        ])->assertForbidden();

        $this->actingAs($unverifiedGuest)
            ->postJson('/api/v1/community/articles/test-story/like')
            ->assertForbidden();

        // Verified guest CAN post on public forums, comment, and like articles.
        $threadId = $this->actingAs($verifiedGuest)->postJson('/api/v1/community/threads', [
            'forum_id' => $forumId,
            'title' => 'How to price handmade soap?',
            'body' => 'Looking for tips on retail and wholesale pricing margins.',
        ])->assertCreated()->json('data.id');

        $replyId = $this->actingAs($mentor)->postJson("/api/v1/community/threads/{$threadId}/replies", [
            'body' => 'Calculate direct materials, packaging, labour, and add a 40% margin.',
        ])->assertCreated()->json('data.id');

        $this->actingAs($verifiedGuest)
            ->postJson("/api/v1/community/replies/{$replyId}/vote")
            ->assertOk()
            ->assertJsonPath('data.voted', true)
            ->assertJsonPath('data.votes_count', 1);

        $this->actingAs($verifiedGuest)
            ->postJson("/api/v1/community/threads/{$threadId}/solution", ['reply_id' => $replyId])
            ->assertOk()
            ->assertJsonPath('data.accepted_reply_id', $replyId);

        $realArticleId = DB::table('editorial_content')->where('status', 'published')->value('content_id');
        $this->assertNotEmpty($realArticleId);

        $this->actingAs($verifiedGuest)
            ->postJson("/api/v1/community/articles/{$realArticleId}/like")
            ->assertOk()
            ->assertJsonPath('data.liked', true);

        $this->actingAs($verifiedGuest)
            ->postJson("/api/v1/community/articles/{$realArticleId}/comments", [
                'body' => 'Very helpful story for first-time founders!',
            ])
            ->assertCreated();

        $this->getJson("/api/v1/community/articles/{$realArticleId}/engagement")
            ->assertOk()
            ->assertJsonPath('data.likes_count', 1)
            ->assertJsonCount(1, 'data.comments');

        // Verified guest is still blocked from dashboard-only leaderboard and group creation.
        $this->actingAs($verifiedGuest)->getJson('/api/v1/community/leaderboard')->assertForbidden();
        $this->actingAs($verifiedGuest)->postJson('/api/v1/community/manage/groups', [
            'name' => 'Guest Group Attempt',
            'category' => 'General',
            'description' => 'Should not be permitted.',
        ])->assertForbidden();

        // Non-admin/non-CM cannot create groups.
        $this->actingAs($entrepreneur)->postJson('/api/v1/community/manage/groups', [
            'name' => 'Rogue Group',
            'category' => 'Tech',
            'description' => 'Should not be permitted.',
        ])->assertForbidden();

        // Content Manager creates a group with an official WhatsApp link.
        $groupId = $this->actingAs($cm)->postJson('/api/v1/community/manage/groups', [
            'name' => 'Kenya Retail Circle',
            'category' => 'Retail',
            'description' => 'Peer group for retail founders.',
            'whatsapp_url' => 'https://chat.whatsapp.com/TestGroupInvite123',
            'is_active' => true,
        ])->assertOk()->json('data.id');

        // Public visitors can browse groups, but WhatsApp links remain hidden until joined.
        auth()->logout();
        $publicGroups = $this->getJson('/api/v1/community/groups')
            ->assertOk()
            ->json('data');
        $publicRetail = collect($publicGroups)->firstWhere('id', $groupId);
        $this->assertNotNull($publicRetail);
        $this->assertTrue($publicRetail['has_whatsapp']);
        $this->assertNull($publicRetail['whatsapp_url']);

        // Unverified guest cannot join groups.
        $this->actingAs($unverifiedGuest)
            ->postJson("/api/v1/community/groups/{$publicRetail['slug']}/membership")
            ->assertForbidden();

        // Verified guest CAN join a group, receive the official WhatsApp link, and post in group discussions.
        $this->actingAs($verifiedGuest)
            ->postJson("/api/v1/community/groups/{$publicRetail['slug']}/membership")
            ->assertOk()
            ->assertJsonPath('data.joined', true)
            ->assertJsonPath('data.whatsapp_url', 'https://chat.whatsapp.com/TestGroupInvite123');

        $this->actingAs($verifiedGuest)
            ->getJson("/api/v1/community/groups/{$publicRetail['slug']}")
            ->assertOk()
            ->assertJsonPath('data.group.joined', true)
            ->assertJsonPath('data.group.whatsapp_url', 'https://chat.whatsapp.com/TestGroupInvite123');

        $this->actingAs($verifiedGuest)->postJson('/api/v1/community/threads', [
            'group_id' => $groupId,
            'title' => 'Guest founder introducing their retail craft',
            'body' => 'Excited to connect with fellow retail founders in this circle!',
        ])->assertCreated();

        // Before joining, Entrepreneur sees has_whatsapp=true but whatsapp_url=null.
        $beforeGroups = $this->actingAs($entrepreneur)
            ->getJson('/api/v1/community/groups')
            ->assertOk()
            ->json('data');
        $retailGroup = collect($beforeGroups)->firstWhere('id', $groupId);
        $this->assertNotNull($retailGroup);
        $this->assertTrue($retailGroup['has_whatsapp']);
        $this->assertNull($retailGroup['whatsapp_url']);

        // Entrepreneur cannot post inside group before joining.
        $this->actingAs($entrepreneur)->postJson('/api/v1/community/threads', [
            'group_id' => $groupId,
            'title' => 'Before joining',
            'body' => 'Should require membership first.',
        ])->assertForbidden();

        // After joining, WhatsApp invite URL is revealed and group threads unlock.
        $this->actingAs($entrepreneur)
            ->postJson("/api/v1/community/groups/{$retailGroup['slug']}/membership")
            ->assertOk()
            ->assertJsonPath('data.joined', true)
            ->assertJsonPath('data.whatsapp_url', 'https://chat.whatsapp.com/TestGroupInvite123');

        $this->actingAs($entrepreneur)->postJson('/api/v1/community/threads', [
            'group_id' => $groupId,
            'title' => 'Wholesale suppliers in Nairobi',
            'body' => 'Sharing vetted packaging suppliers for small retail stores.',
        ])->assertCreated();

        // Leaderboard counts mentor's accepted solution (15) + reply (2) + vote received (3) = 20 pts
        // and entrepreneur's group topic (5 pts).
        $board = $this->actingAs($entrepreneur)
            ->getJson('/api/v1/community/leaderboard?period=month')
            ->assertOk()
            ->json('data');

        $mentorRow = collect($board['top'])->firstWhere('user_id', $mentor->id);
        $this->assertNotNull($mentorRow);
        $this->assertSame(20, $mentorRow['points']);
        $this->assertSame(5, $board['me']['points']);

        // Sidebar includes author_id for clickable community profile links.
        $sidebar = $this->getJson('/api/v1/community/sidebar')
            ->assertOk()
            ->json('data');
        $this->assertNotEmpty($sidebar['comments']);
        $this->assertContains($verifiedGuest->id, array_column($sidebar['comments'], 'author_id'));

        // Synced live community profile aggregates groups, public forums, comments & leaderboard.
        $mentorProfile = $this->getJson('/api/v1/community/members/'.$mentor->id)
            ->assertOk()
            ->json('data');
        $this->assertSame($mentor->name, $mentorProfile['member']['name']);
        $this->assertArrayNotHasKey('email', $mentorProfile['member']);
        $this->assertSame(20, $mentorProfile['leaderboard']['all']['points']);
        $this->assertSame(1, $mentorProfile['stats']['replies_count']);
        $this->assertSame(1, $mentorProfile['stats']['solutions_count']);

        $guestProfile = $this->getJson('/api/v1/community/members/'.$verifiedGuest->id)
            ->assertOk()
            ->json('data');
        $this->assertSame(1, $guestProfile['stats']['groups_count']);
        $this->assertSame(1, $guestProfile['stats']['comments_count']);
        $this->assertNull($guestProfile['leaderboard']['all']);

        $this->getJson('/api/v1/community/members/'.$unverifiedGuest->id)->assertNotFound();

        // Moderation: Admin hides the forum thread; regular members get 404.
        $this->actingAs($admin)
            ->patchJson("/api/v1/community/manage/threads/{$threadId}", ['hidden' => true])
            ->assertOk();

        $this->actingAs($entrepreneur)
            ->getJson('/api/v1/community/threads/'.$threadId)
            ->assertNotFound();
    }

    public function test_careers_applications_reach_admin_queue_and_support_account_promotion(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $guest = User::factory()->create(['role' => 'guest']);

        // Unauthenticated visitor submits an investor inquiry -> reaches Admin approval queue.
        auth()->logout();
        $investId = $this->postJson('/api/v1/careers/apply', [
            'track' => 'investor',
            'applicant_name' => 'Kiprop Capital',
            'applicant_email' => 'deals@kiprop.example.test',
            'applicant_phone' => '+254711000222',
            'organization' => 'Kiprop Venture Fund',
            'focus_area' => 'Seed Agribusiness',
            'message' => 'We would like to back five incubation-graduated agribusiness ventures this year.',
        ])->assertCreated()->json('data.id');

        // Verified guest applies for mentorship -> Admin sees promotable account and approves.
        $mentorReqId = $this->actingAs($guest)->postJson('/api/v1/careers/apply', [
            'track' => 'mentorship',
            'applicant_name' => $guest->name,
            'applicant_email' => $guest->email,
            'applicant_phone' => '+254722111333',
            'organization' => 'Nairobi Builders Ltd',
            'focus_area' => 'Go-to-Market',
            'message' => 'Ten years scaling retail distribution and mentoring university founders.',
        ])->assertCreated()->json('data.id');

        // Non-admin cannot view career requests queue.
        $this->actingAs($guest)->getJson('/api/v1/workspace/career-applications')->assertForbidden();

        // Admin queue lists both requests and flags guest account as promotable.
        $queue = $this->actingAs($admin)
            ->getJson('/api/v1/workspace/career-applications')
            ->assertOk()
            ->json('data');

        $mentorRow = collect($queue)->firstWhere('id', $mentorReqId);
        $this->assertNotNull($mentorRow);
        $this->assertTrue($mentorRow['can_promote']);

        $summary = $this->actingAs($admin)->getJson('/api/v1/workspace/summary')->assertOk()->json('data');
        $this->assertSame(2, $summary['metrics']['careerRequests']);

        // Admin approves mentorship request with promote_account=true -> guest becomes mentor.
        $this->actingAs($admin)
            ->postJson("/api/v1/workspace/career-applications/{$mentorReqId}/review", [
                'decision' => 'approved',
                'note' => 'Welcome to the YERH mentor pool.',
                'promote_account' => true,
            ])
            ->assertOk()
            ->assertJsonPath('data.status', 'approved')
            ->assertJsonPath('data.promoted_role', 'mentor');

        $this->assertSame('mentor', $guest->fresh()->role);

        // Admin declines the investor inquiry -> requires or stores note.
        $this->actingAs($admin)
            ->postJson("/api/v1/workspace/career-applications/{$investId}/review", [
                'decision' => 'rejected',
                'note' => 'Please share fund mandate documentation first.',
            ])
            ->assertOk()
            ->assertJsonPath('data.status', 'rejected');
    }

    public function test_my_story_cms_youtube_linkedin_and_homepage_sync(): void
    {
        SeedPlatformContent::seed();

        $cm = User::factory()->create(['role' => 'content_manager']);

        // Creating a published featured story with YouTube & LinkedIn links updates both feeds.
        $storyId = $this->actingAs($cm)
            ->postJson('/api/v1/workspace/editorial', [
                'kind' => 'story',
                'title' => 'Wanjiku Eco-Packaging',
                'category' => 'Sustainability',
                'excerpt' => 'Building biodegradable cassava packaging across Kiambu.',
                'status' => 'published',
                'featured' => true,
                'videos' => ['https://www.youtube.com/watch?v=dQw4w9WgXcQ'],
                'linkedinUrl' => 'https://www.linkedin.com/in/wanjiku-eco',
                'storyGroups' => ['Entrepreneur', 'Startups'],
                'displayLines' => [
                    'line1' => 'Wanjiku - Eco Founder',
                    'line2' => 'Kiambu BioPack',
                ],
                'blocks' => [
                    ['type' => 'paragraph', 'text' => 'Wanjiku started with three farmers in Kiambu.'],
                ],
            ])
            ->assertOk()
            ->json('data.id');

        $contentId = (string) DB::table('editorial_content')->where('id', $storyId)->value('content_id');
        $this->assertNotEmpty($contentId);

        $editorial = $this->getJson('/api/v1/editorial')->assertOk()->json('data');
        $created = collect($editorial['items'])->firstWhere('id', $contentId);
        $this->assertNotNull($created);
        $this->assertSame(['https://www.youtube.com/watch?v=dQw4w9WgXcQ'], $created['videos']);
        $this->assertSame('https://www.linkedin.com/in/wanjiku-eco', $created['linkedinUrl']);
        $this->assertContains($contentId, $editorial['featured']);

        $homepageDoc = $this->getJson('/api/v1/cms/public')
            ->assertOk()
            ->json('data.documents.homepage');
        $this->assertContains($contentId, $homepageDoc['featuredStories']);

        // Unchecking homepage "My Story" removes it from both editorial featured and CMS homepage.
        $this->actingAs($cm)
            ->patchJson("/api/v1/workspace/editorial/{$storyId}", [
                'kind' => 'story',
                'title' => 'Wanjiku Eco-Packaging',
                'category' => 'Sustainability',
                'excerpt' => 'Building biodegradable cassava packaging across Kiambu.',
                'status' => 'published',
                'featured' => false,
                'videos' => ['https://www.youtube.com/watch?v=dQw4w9WgXcQ'],
                'linkedinUrl' => 'https://www.linkedin.com/in/wanjiku-eco',
                'blocks' => [
                    ['type' => 'paragraph', 'text' => 'Wanjiku started with three farmers in Kiambu.'],
                ],
            ])
            ->assertOk();

        $homepageDocAfter = $this->getJson('/api/v1/cms/public')
            ->assertOk()
            ->json('data.documents.homepage');
        $this->assertNotContains($contentId, $homepageDocAfter['featuredStories']);

        // Publishing homepage CMS with featuredStories syncs editorial_content.featured back to true.
        $homepageDocAfter['myStoryTitle'] = 'Founder Spotlights';
        $homepageDocAfter['featuredStories'][] = $contentId;
        $this->actingAs($cm)
            ->postJson('/api/v1/workspace/cms/homepage/publish', [
                'payload' => $homepageDocAfter,
                'summary' => 'Feature Wanjiku on My Story',
            ])
            ->assertOk();

        $this->assertSame(1, (int) DB::table('editorial_content')->where('id', $storyId)->value('featured'));
        $this->getJson('/api/v1/cms/public')
            ->assertOk()
            ->assertJsonPath('data.documents.homepage.myStoryTitle', 'Founder Spotlights');
    }
}
