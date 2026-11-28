<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;

final class SeedPlatformContent extends Command
{
    protected $signature = 'yerh:seed-content';

    protected $description = 'Seed baseline CMS sections, editorial items, forums, and community groups idempotently.';

    public function handle(): int
    {
        $summary = self::seed();
        $this->info(sprintf(
            'Seeded CMS sections (%d inserted, %d cleaned), editorial items (%d inserted), forums (%d), groups (%d).',
            $summary['cms_inserted'],
            $summary['cms_cleaned'],
            $summary['editorial_inserted'],
            $summary['forums_inserted'],
            $summary['groups_inserted'],
        ));

        return self::SUCCESS;
    }

    /**
     * @return array{cms_inserted:int, cms_cleaned:int, editorial_inserted:int, forums_inserted:int, groups_inserted:int}
     */
    public static function seed(): array
    {
        $dir = database_path('seeders/data');
        $now = now();
        $cmsInserted = 0;
        $cmsCleaned = 0;

        $cmsSections = [
            'site',
            'homepage',
            'faqs',
            'team',
            'partners',
            'terms',
            'entrepreneurship',
            'lessons',
            'sidebar',
        ];

        foreach ($cmsSections as $section) {
            $path = $dir.DIRECTORY_SEPARATOR.$section.'.json';
            if (! File::exists($path)) {
                continue;
            }
            $payload = json_decode(File::get($path), true, flags: JSON_THROW_ON_ERROR);
            $encoded = json_encode($payload, JSON_THROW_ON_ERROR);

            $existing = DB::table('cms_documents')->where('section', $section)->first();
            if (! $existing) {
                DB::table('cms_documents')->insert([
                    'section' => $section,
                    'draft_payload' => null,
                    'published_payload' => $encoded,
                    'published_version' => 1,
                    'published_at' => $now,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
                $cmsInserted++;
                continue;
            }

            if ($existing->published_payload === null) {
                DB::table('cms_documents')->where('section', $section)->update([
                    'published_payload' => $encoded,
                    'published_version' => max(1, (int) $existing->published_version),
                    'published_at' => $existing->published_at ?? $now,
                    'updated_at' => $now,
                ]);
                $cmsInserted++;
                continue;
            }

            if ($section === 'site') {
                $current = json_decode($existing->published_payload, true, flags: JSON_THROW_ON_ERROR);
                $cleanedNav = self::cleanNavigation($current['navigation'] ?? []);
                $updates = [];
                $navChanged = $cleanedNav !== ($current['navigation'] ?? []);
                if ($navChanged) {
                    $current['navigation'] = $cleanedNav;
                }
                $pagesChanged = false;
                if (isset($payload['pages']) && is_array($payload['pages'])) {
                    $currentPages = is_array($current['pages'] ?? null) ? $current['pages'] : [];
                    foreach ($payload['pages'] as $pageKey => $pageValue) {
                        if (str_starts_with((string) $pageKey, '/careers') && ! array_key_exists($pageKey, $currentPages)) {
                            $currentPages[$pageKey] = $pageValue;
                            $pagesChanged = true;
                        }
                    }
                    if ($pagesChanged) {
                        $current['pages'] = $currentPages;
                    }
                }
                if ($navChanged || $pagesChanged) {
                    $updates['published_payload'] = json_encode($current, JSON_THROW_ON_ERROR);
                }
                if ($existing->draft_payload !== null) {
                    $draft = json_decode($existing->draft_payload, true, flags: JSON_THROW_ON_ERROR);
                    if (is_array($draft) && isset($draft['navigation']) && is_array($draft['navigation'])) {
                        $cleanedDraftNav = self::cleanNavigation($draft['navigation']);
                        $draftChanged = $cleanedDraftNav !== $draft['navigation'];
                        if ($draftChanged) {
                            $draft['navigation'] = $cleanedDraftNav;
                        }
                        if (isset($payload['pages']) && is_array($payload['pages'])) {
                            $draftPages = is_array($draft['pages'] ?? null) ? $draft['pages'] : [];
                            foreach ($payload['pages'] as $pageKey => $pageValue) {
                                if (str_starts_with((string) $pageKey, '/careers') && ! array_key_exists($pageKey, $draftPages)) {
                                    $draftPages[$pageKey] = $pageValue;
                                    $draftChanged = true;
                                }
                            }
                            if ($draftChanged) {
                                $draft['pages'] = $draftPages;
                            }
                        }
                        if ($draftChanged) {
                            $updates['draft_payload'] = json_encode($draft, JSON_THROW_ON_ERROR);
                        }
                    }
                }
                if ($updates !== []) {
                    $updates['updated_at'] = $now;
                    DB::table('cms_documents')->where('section', 'site')->update($updates);
                    $cmsCleaned++;
                }
            }

            if ($section === 'homepage') {
                $current = json_decode($existing->published_payload, true, flags: JSON_THROW_ON_ERROR);
                $changed = false;
                if (isset($current['slides']) && is_array($current['slides'])) {
                    foreach ($current['slides'] as $idx => $slide) {
                        if (($slide['href'] ?? null) === '/network') {
                            $current['slides'][$idx]['href'] = '/forums';
                            $changed = true;
                        }
                    }
                }
                if ($changed) {
                    DB::table('cms_documents')->where('section', 'homepage')->update([
                        'published_payload' => json_encode($current, JSON_THROW_ON_ERROR),
                        'updated_at' => $now,
                    ]);
                    $cmsCleaned++;
                }
            }
        }

        $editorialInserted = 0;
        foreach (['blogs', 'stories', 'reports', 'businesses', 'events'] as $collection) {
            $path = $dir.DIRECTORY_SEPARATOR.$collection.'.json';
            if (! File::exists($path)) {
                continue;
            }
            $records = json_decode(File::get($path), true, flags: JSON_THROW_ON_ERROR);
            foreach ($records as $record) {
                $contentId = $record['id'] ?? null;
                $slug = $record['slug'] ?? null;
                $kind = $record['kind'] ?? null;
                if (! $contentId || ! $slug || ! $kind) {
                    continue;
                }
                if (str_starts_with((string) ($record['source']['path'] ?? ''), 'local-demo')) {
                    continue;
                }
                $exists = DB::table('editorial_content')->where('content_id', $contentId)->exists();
                if ($exists) {
                    continue;
                }
                DB::table('editorial_content')->insert([
                    'content_id' => $contentId,
                    'kind' => $kind,
                    'slug' => $slug,
                    'status' => ($record['status'] ?? 'published') === 'archived' ? 'archived' : 'published',
                    'featured' => false,
                    'payload' => json_encode($record, JSON_THROW_ON_ERROR),
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
                $editorialInserted++;
            }
        }

        $featuredStoriesSynced = false;
        if (DB::table('editorial_content')->where('kind', 'story')->where('featured', true)->count() === 0) {
            $homepageRaw = DB::table('cms_documents')->where('section', 'homepage')->value('published_payload');
            $homepageDecoded = is_string($homepageRaw) ? json_decode($homepageRaw, true) : null;
            $featuredStoryIds = is_array($homepageDecoded['featuredStories'] ?? null)
                ? array_values(array_filter(array_map('strval', $homepageDecoded['featuredStories'])))
                : [];
            if ($featuredStoryIds !== []) {
                DB::table('editorial_content')
                    ->where('kind', 'story')
                    ->whereIn('content_id', $featuredStoryIds)
                    ->update(['featured' => true]);
                $featuredStoriesSynced = true;
            }
        }

        $forumsInserted = 0;
        if (DB::table('community_forums')->count() === 0) {
            $starterForums = [
                [
                    'slug' => 'entrepreneurship',
                    'name' => 'Entrepreneurship & Strategy',
                    'description' => 'Ask questions about starting, pricing, operations, and growing a sustainable venture.',
                    'position' => 1,
                ],
                [
                    'slug' => 'startups',
                    'name' => 'Startups & Validation',
                    'description' => 'Test early ideas, gather customer feedback, and share practical validation lessons.',
                    'position' => 2,
                ],
                [
                    'slug' => 'funding',
                    'name' => 'Funding & Compliance',
                    'description' => 'Navigate business registration, licensing, grants, Youth Fund, and investor readiness.',
                    'position' => 3,
                ],
                [
                    'slug' => 'technology',
                    'name' => 'Technology & Digital Tools',
                    'description' => 'Discuss digital marketing, payments, bookkeeping software, and building online products.',
                    'position' => 4,
                ],
            ];
            foreach ($starterForums as $forum) {
                DB::table('community_forums')->insert($forum + [
                    'is_active' => true,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
                $forumsInserted++;
            }
        }

        $groupsInserted = 0;
        if (DB::table('community_groups')->count() === 0) {
            $starterGroups = [
                [
                    'slug' => 'agribusiness-sustainability',
                    'name' => 'Agribusiness & Sustainability Circle',
                    'category' => 'Sustainability',
                    'description' => 'Peer circle for founders building agriculture, food value-addition, and green enterprises.',
                ],
                [
                    'slug' => 'digital-builders',
                    'name' => 'Digital & Tech Founders',
                    'category' => 'Technology',
                    'description' => 'Connect with youth building software, e-commerce, and digital service businesses.',
                ],
                [
                    'slug' => 'first-venture',
                    'name' => 'First-Time Founders Circle',
                    'category' => 'Startups',
                    'description' => 'Accountability circle for entrepreneurs launching and registering their very first business.',
                ],
            ];
            foreach ($starterGroups as $group) {
                DB::table('community_groups')->insert($group + [
                    'whatsapp_url' => null,
                    'is_active' => true,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
                $groupsInserted++;
            }
        }

        Cache::forget('yerh.cms.public.v2');
        Cache::forget('yerh.editorial.public.v1');

        return [
            'cms_inserted' => $cmsInserted,
            'cms_cleaned' => $cmsCleaned,
            'editorial_inserted' => $editorialInserted,
            'forums_inserted' => $forumsInserted,
            'groups_inserted' => $groupsInserted,
        ];
    }

    /**
     * @param  array<int, array<string, mixed>>  $items
     * @return array<int, array<string, mixed>>
     */
    private static function cleanNavigation(array $items): array
    {
        $filtered = [];
        foreach ($items as $item) {
            if (! is_array($item)) {
                continue;
            }
            $id = (string) ($item['id'] ?? '');
            $href = (string) ($item['href'] ?? '');
            if (in_array($id, ['yem', 'network', 'mentor', 'mentee', 'workshops', 'webinars'], true)
                || str_starts_with($href, '/yem')
                || in_array($href, ['/network', '/workshops', '/webinars'], true)) {
                continue;
            }
            if ($id === 'marketplace' || $href === '/marketplace') {
                $item['label'] = 'Shop';
            }
            if (isset($item['children']) && is_array($item['children'])) {
                $children = self::cleanNavigation($item['children']);
                if ($id === 'resources') {
                    $hasGroups = false;
                    foreach ($children as $child) {
                        if (($child['id'] ?? '') === 'groups' || ($child['href'] ?? '') === '/groups') {
                            $hasGroups = true;
                            break;
                        }
                    }
                    if (! $hasGroups) {
                        $groupsEntry = [
                            'id' => 'groups',
                            'label' => 'Groups',
                            'href' => '/groups',
                        ];
                        $inserted = false;
                        $nextChildren = [];
                        foreach ($children as $child) {
                            $nextChildren[] = $child;
                            if (! $inserted && (($child['id'] ?? '') === 'forums' || ($child['href'] ?? '') === '/forums')) {
                                $nextChildren[] = $groupsEntry;
                                $inserted = true;
                            }
                        }
                        if (! $inserted) {
                            $nextChildren[] = $groupsEntry;
                        }
                        $children = $nextChildren;
                    }
                }
                $item['children'] = $children;
            }
            $filtered[] = $item;
        }

        $hasCareers = false;
        foreach ($filtered as $item) {
            if (($item['id'] ?? '') === 'careers' || ($item['href'] ?? '') === '/careers') {
                $hasCareers = true;
                break;
            }
        }
        if (! $hasCareers) {
            $careersEntry = [
                'id' => 'careers',
                'label' => 'Careers',
                'href' => '/careers',
                'children' => [
                    ['id' => 'careers-institutions', 'label' => 'Register Your Institution', 'href' => '/careers/institutions'],
                    ['id' => 'careers-partnerships', 'label' => 'Partnerships', 'href' => '/careers/partnerships'],
                    ['id' => 'careers-mentorship', 'label' => 'Mentorship', 'href' => '/careers/mentorship'],
                    ['id' => 'careers-invest', 'label' => 'Invest with Us', 'href' => '/careers/invest'],
                ],
            ];
            $withCareers = [];
            $insertedCareers = false;
            foreach ($filtered as $item) {
                if (! $insertedCareers && (($item['id'] ?? '') === 'contact' || ($item['href'] ?? '') === '/contact')) {
                    $withCareers[] = $careersEntry;
                    $insertedCareers = true;
                }
                $withCareers[] = $item;
            }
            if (! $insertedCareers) {
                $withCareers[] = $careersEntry;
            }
            $filtered = $withCareers;
        }

        return array_values($filtered);
    }
}
