<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Tests\TestCase;

final class CmsStudioTest extends TestCase
{
    use RefreshDatabase;

    public function test_content_manager_and_admin_can_draft_preview_publish_and_restore_cms_sections(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $editor = User::factory()->create(['role' => 'content_manager']);
        $entrepreneur = User::factory()->create(['role' => 'entrepreneur']);

        // Non-editors cannot access CMS studio endpoints.
        $this->actingAs($entrepreneur)->getJson('/api/v1/workspace/cms')->assertForbidden();
        $this->putJson('/api/v1/workspace/cms/site/draft', ['payload' => ['name' => 'Nope']])->assertForbidden();

        // Unsafe URL protocols are rejected.
        $this->actingAs($editor)->putJson('/api/v1/workspace/cms/homepage/draft', [
            'payload' => [
                'slides' => [['title' => 'Bad', 'href' => 'javascript:alert(1)']],
            ],
        ])->assertUnprocessable()->assertJsonValidationErrors('payload');

        $this->putJson('/api/v1/workspace/cms/site/draft', [
            'payload' => [
                'pages' => [
                    '/about' => ['heroImage' => 'javascript:alert(1)'],
                ],
            ],
        ])->assertUnprocessable()->assertJsonValidationErrors('payload');

        // Saving draft does not change the public CMS payload.
        $siteDraft = [
            'name' => 'YERH Studio Preview',
            'slogan' => 'Draft Slogan',
            'contact' => [
                'email' => 'hello@example.test',
                'phone' => '+254700000000',
                'whatsapp' => '+254700000000',
                'address' => 'Nairobi',
            ],
            'announcement' => [
                'enabled' => true,
                'text' => 'Cohort 2026 applications are now open!',
                'linkLabel' => 'Apply',
                'linkHref' => '/opportunities',
            ],
            'homeSections' => [
                'stories' => true,
                'businesses' => true,
                'events' => false,
                'blogs' => true,
                'updates' => true,
                'partners' => false,
            ],
            'pages' => [
                '/about' => [
                    'eyebrow' => 'About YERH',
                    'title' => 'Edited Hero Heading',
                    'description' => 'Updated subtitle.',
                    'heroImage' => '/media/be-part-of-the-team-3382b8d1.jpg',
                    'heroImageAlt' => 'Team collaboration',
                    'heroOverlay' => 'navy',
                    'sections' => [],
                ],
                '/institutions/apply' => [
                    'eyebrow' => 'Institution partnerships',
                    'title' => 'Partner institution portal',
                    'description' => 'Custom onboarding hero description.',
                    'sections' => [],
                ],
            ],
        ];

        $this->actingAs($editor)->putJson('/api/v1/workspace/cms/site/draft', ['payload' => $siteDraft])->assertOk();
        $this->getJson('/api/v1/cms/public')
            ->assertOk()
            ->assertJsonMissing(['slogan' => 'Draft Slogan']);
        $this->getJson('/api/v1/workspace/cms')
            ->assertOk()
            ->assertJsonPath('data.sections.site.has_draft', true)
            ->assertJsonPath('data.sections.site.published_version', 0);

        // Publishing makes v1 live and records a revision.
        $this->postJson('/api/v1/workspace/cms/site/publish', [
            'summary' => 'Updated contact & hero copy',
        ])->assertOk()->assertJsonPath('data.version', 1);

        $this->getJson('/api/v1/cms/public')
            ->assertOk()
            ->assertJsonPath('data.documents.site.contact.email', 'hello@example.test')
            ->assertJsonPath('data.documents.site.homeSections.events', false)
            ->assertJsonPath('data.documents.site.homeSections.partners', false)
            ->assertJsonPath('data.documents.site.pages./about.title', 'Edited Hero Heading')
            ->assertJsonPath('data.documents.site.pages./about.heroImage', '/media/be-part-of-the-team-3382b8d1.jpg')
            ->assertJsonPath('data.documents.site.pages./about.heroOverlay', 'navy')
            ->assertJsonPath('data.documents.site.pages./institutions/apply.title', 'Partner institution portal');

        // Admin publishes v2, then restores v1 and verifies public cache updates.
        $siteV2 = [...$siteDraft, 'contact' => [...$siteDraft['contact'], 'email' => 'v2@example.test']];
        $this->actingAs($admin)->postJson('/api/v1/workspace/cms/site/publish', [
            'payload' => $siteV2,
            'summary' => 'Changed contact email to v2',
        ])->assertOk()->assertJsonPath('data.version', 2);

        $this->getJson('/api/v1/cms/public')
            ->assertOk()
            ->assertJsonPath('data.documents.site.contact.email', 'v2@example.test');

        $v1RevisionId = collect($this->getJson('/api/v1/workspace/cms')->json('data.revisions'))
            ->firstWhere('version', 1)['id'];

        $this->postJson("/api/v1/workspace/cms/revisions/{$v1RevisionId}/restore")
            ->assertOk()
            ->assertJsonPath('data.version', 3);

        $this->getJson('/api/v1/cms/public')
            ->assertOk()
            ->assertJsonPath('data.documents.site.contact.email', 'hello@example.test');
    }

    public function test_cms_preserves_cleared_empty_strings_and_sanitizes_null_leaves(): void
    {
        $editor = User::factory()->create(['role' => 'content_manager']);

        $homepagePayload = [
            'slides' => [[
                'theme' => 'dark',
                'eyebrow' => '',
                'title' => 'Idea to',
                'secondLine' => '',
                'accent' => 'Business',
                'text' => 'Build your skills.',
                'image' => '/media/be-part-of-the-team-3382b8d1.webp',
                'alt' => '',
                'href' => '/join',
                'action' => 'Start your journey',
                'caption' => 'From idea to opportunity.',
            ]],
            'importantLinks' => [[
                'label' => 'GET STARTED',
                'href' => '/join',
                'openInNewTab' => false,
            ]],
        ];

        $this->actingAs($editor)->postJson('/api/v1/workspace/cms/homepage/publish', [
            'payload' => $homepagePayload,
            'summary' => 'Cleared slide eyebrow and secondLine',
        ])->assertOk();

        $publicRes = $this->getJson('/api/v1/cms/public')->assertOk();
        $this->assertSame('', $publicRes->json('data.documents.homepage.slides.0.eyebrow'));
        $this->assertSame('', $publicRes->json('data.documents.homepage.slides.0.secondLine'));

        $wsRes = $this->getJson('/api/v1/workspace/cms')->assertOk();
        $this->assertSame('', $wsRes->json('data.sections.homepage.published.slides.0.eyebrow'));
        $this->assertSame('', $wsRes->json('data.sections.homepage.published.slides.0.secondLine'));

        // Simulate legacy stored DB row with null strings & stale cache flush.
        \Illuminate\Support\Facades\DB::table('cms_documents')
            ->where('section', 'homepage')
            ->update([
                'published_payload' => json_encode([
                    'slides' => [[
                        'eyebrow' => null,
                        'title' => 'Idea to',
                        'secondLine' => null,
                        'accent' => 'Business',
                        'text' => 'Build your skills.',
                        'image' => '/media/be-part-of-the-team-3382b8d1.webp',
                        'alt' => null,
                        'href' => '/join',
                        'action' => 'Start',
                        'caption' => '',
                    ]],
                ], JSON_THROW_ON_ERROR),
            ]);
        \Illuminate\Support\Facades\Cache::flush();

        $healedRes = $this->getJson('/api/v1/cms/public')->assertOk();
        $this->assertSame('', $healedRes->json('data.documents.homepage.slides.0.eyebrow'));
        $this->assertSame('', $healedRes->json('data.documents.homepage.slides.0.secondLine'));
    }

    public function test_cms_media_library_uploads_streams_updates_and_deletes(): void
    {
        Storage::fake('local');
        $editor = User::factory()->create(['role' => 'content_manager']);
        $png = file_get_contents(base_path('../frontend/public/media/health-c8d73354.png'));
        $file = UploadedFile::fake()->createWithContent('hero-banner.png', $png);

        $uploaded = $this->actingAs($editor)->post('/api/v1/workspace/cms/media', [
            'file' => $file,
            'alt_text' => 'Youth team working together',
            'folder' => 'hero',
        ], ['Accept' => 'application/json'])->assertCreated()->json('data');

        $this->assertTrue(is_int($uploaded['width']) && $uploaded['width'] > 0);
        $this->assertTrue(is_int($uploaded['height']) && $uploaded['height'] > 0);
        $this->assertFalse($uploaded['in_site_library']);

        $this->getJson('/api/v1/workspace/cms/media')
            ->assertOk()
            ->assertJsonPath('data.0.id', $uploaded['id'])
            ->assertJsonPath('data.0.width', $uploaded['width'])
            ->assertJsonPath('data.0.height', $uploaded['height'])
            ->assertJsonPath('data.0.folder', 'hero')
            ->assertJsonPath('data.0.in_site_library', false);

        $this->get($uploaded['url'])
            ->assertOk()
            ->assertHeader('X-Content-Type-Options', 'nosniff');

        $webp = $this->get($uploaded['url'], ['Accept' => 'image/webp,image/*,*/*;q=0.8'])
            ->assertOk()
            ->assertHeader('Content-Type', 'image/webp')
            ->assertHeader('Vary', 'Accept');

        $cacheControl = (string) $webp->headers->get('Cache-Control');
        $this->assertStringContainsString('public', $cacheControl);
        $this->assertStringContainsString('max-age=31536000', $cacheControl);
        $this->assertStringContainsString('immutable', $cacheControl);

        $etag = (string) $webp->headers->get('ETag');
        $this->assertNotSame('', $etag);

        $this->get($uploaded['url'], ['Accept' => 'image/webp', 'If-None-Match' => $etag])
            ->assertStatus(304);

        $noUpscale = $this->get($uploaded['url'].'?w=99999', ['Accept' => 'image/webp'])
            ->assertOk()
            ->assertHeader('Content-Type', 'image/webp');
        $this->assertInstanceOf(BinaryFileResponse::class, $noUpscale->baseResponse);
        $noUpscaleSize = getimagesize($noUpscale->baseResponse->getFile()->getPathname());
        $this->assertSame($uploaded['width'], $noUpscaleSize[0]);

        $wideJpg = file_get_contents(base_path('../frontend/public/media/mowrah-designs-900x599-cb3e579d.jpg'));
        $wideUploaded = $this->actingAs($editor)->post('/api/v1/workspace/cms/media', [
            'file' => UploadedFile::fake()->createWithContent('wide-hero.jpg', $wideJpg),
            'folder' => 'hero',
            'in_site_library' => '1',
        ], ['Accept' => 'application/json'])->assertCreated()->json('data');

        $this->assertTrue($wideUploaded['in_site_library']);

        $resized = $this->get($wideUploaded['url'].'?w=320', ['Accept' => 'image/webp'])
            ->assertOk()
            ->assertHeader('Content-Type', 'image/webp');
        $this->assertInstanceOf(BinaryFileResponse::class, $resized->baseResponse);
        $resizedSize = getimagesize($resized->baseResponse->getFile()->getPathname());
        $this->assertLessThanOrEqual(320, $resizedSize[0]);

        $download = $this->get($uploaded['url'].'?download=1')->assertOk();
        $disposition = (string) $download->headers->get('Content-Disposition');
        $this->assertStringContainsString('attachment', $disposition);
        $this->assertStringContainsString('hero-banner.png', $disposition);

        $this->patchJson('/api/v1/workspace/cms/media/'.$uploaded['id'], [
            'alt_text' => 'Updated alt text',
            'in_site_library' => true,
        ])->assertOk()->assertJsonPath('data.in_site_library', true);

        $this->assertDatabaseHas('cms_media', [
            'id' => $uploaded['id'],
            'alt_text' => 'Updated alt text',
            'in_site_library' => 1,
        ]);

        $this->patchJson('/api/v1/workspace/cms/media/'.$uploaded['id'], [
            'in_site_library' => false,
        ])->assertOk()->assertJsonPath('data.in_site_library', false);

        $this->assertDatabaseHas('cms_media', [
            'id' => $uploaded['id'],
            'in_site_library' => 0,
        ]);

        $this->deleteJson('/api/v1/workspace/cms/media/'.$uploaded['id'])->assertNoContent();
        $this->get($uploaded['url'])->assertNotFound();
        $this->assertFalse(Storage::disk('local')->exists('image-cache/cms-'.$uploaded['uuid']));

        $this->deleteJson('/api/v1/workspace/cms/media/'.$wideUploaded['id'])->assertNoContent();
        $this->assertFalse(Storage::disk('local')->exists('image-cache/cms-'.$wideUploaded['uuid']));
    }

    public function test_content_manager_has_full_editorial_events_opportunities_and_sector_access_without_admin_privileges(): void
    {
        $editor = User::factory()->create(['role' => 'content_manager']);

        // Editorial with cover image and deletion.
        $postId = $this->actingAs($editor)->postJson('/api/v1/workspace/editorial', [
            'kind' => 'story',
            'title' => 'Visual Story',
            'category' => 'Agribusiness',
            'excerpt' => 'Youth-led food enterprise.',
            'image' => '/media/comfort-worms-e046b580.jpg',
            'imageAlt' => 'Farm enterprise',
            'status' => 'published',
            'featured' => true,
            'blocks' => [['type' => 'paragraph', 'text' => 'How the venture grew from campus.']],
        ])->assertOk()->json('data.id');

        $this->getJson('/api/v1/editorial')
            ->assertOk()
            ->assertJsonPath('data.items.0.image', '/media/comfort-worms-e046b580.jpg');

        $this->deleteJson("/api/v1/workspace/editorial/{$postId}")->assertNoContent();

        // Events, opportunities & marketplace categories.
        $catId = $this->postJson('/api/v1/engagement/manage/event-categories', ['name' => 'Bootcamp'])
            ->assertOk()->json('data.id');
        $this->postJson('/api/v1/engagement/manage/events', [
            'title' => 'Pitch Bootcamp',
            'summary' => 'Hands-on pitch prep.',
            'venue' => 'KCA Innovation Hub',
            'category_id' => $catId,
            'starts_at' => '2026-12-01T10:00',
            'ends_at' => '2026-12-01T13:00',
            'status' => 'published',
        ])->assertOk();
        $this->postJson('/api/v1/engagement/manage/opportunities', [
            'title' => 'Seed Fund 2026',
            'category' => 'Grant',
            'organiser' => 'YERH',
            'description' => 'Seed capital for verified student ventures.',
            'status' => 'published',
        ])->assertOk();
        $this->postJson('/api/v1/workspace/marketplace-sectors', ['name' => 'Green Tech'])->assertCreated();

        // Summary metrics returned for content_manager, while admin-only routes remain forbidden.
        $this->getJson('/api/v1/workspace/summary')
            ->assertOk()
            ->assertJsonPath('data.metrics.events', 1)
            ->assertJsonPath('data.metrics.opportunities', 1);
        $this->getJson('/api/v1/workspace/users')->assertForbidden();
        $this->getJson('/api/v1/workspace/institutions')->assertForbidden();
    }
}
