<?php

namespace App\Http\Controllers;

use App\Domain\Engagement\Publishing;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

final class EditorialContentController extends Controller
{
    private const CACHE_KEY = 'yerh.editorial.public.v1';

    public function publicIndex(): JsonResponse
    {
        $data = Cache::remember(self::CACHE_KEY, now()->addMinutes(10), function () {
            $published = DB::table('editorial_content')->where('status', 'published')->latest('updated_at')->get();
            $items = $published->map(fn ($record) => json_decode($record->payload, true, flags: JSON_THROW_ON_ERROR))->values()->all();
            $featured = $published->where('kind', 'story')->where('featured', true)->pluck('content_id')->values()->all();
            $hidden = DB::table('editorial_content')->whereIn('status', ['draft', 'archived'])
                ->where('payload->source->path', '!=', 'laravel-editorial')->pluck('content_id')->values()->all();

            return compact('items', 'featured', 'hidden');
        });

        $commentCounts = DB::table('editorial_comments')
            ->where('hidden', false)
            ->groupBy('content_id')
            ->selectRaw('content_id, count(*) as total')
            ->pluck('total', 'content_id');

        $likeCounts = DB::table('editorial_likes')
            ->groupBy('content_id')
            ->selectRaw('content_id, count(*) as total')
            ->pluck('total', 'content_id');

        $data['items'] = array_map(static function (array $item) use ($commentCounts, $likeCounts): array {
            $id = (string) ($item['id'] ?? '');
            $item['commentCount'] = (int) ($commentCounts[$id] ?? 0);
            $item['likeCount'] = (int) ($likeCounts[$id] ?? 0);

            return $item;
        }, $data['items']);

        return response()->json(['data' => $data])->header('Cache-Control', 'public, max-age=60');
    }

    public function index(Request $request): JsonResponse
    {
        abort_unless(in_array($request->user()->role, ['admin', 'content_manager'], true), 403);
        $items = DB::table('editorial_content')->latest('updated_at')->get()
            ->map(fn ($record) => [
                'id' => $record->id, 'status' => $record->status, 'featured' => (bool) $record->featured,
                'updated_at' => $record->updated_at,
                'content' => json_decode($record->payload, true, flags: JSON_THROW_ON_ERROR),
            ]);

        return response()->json(['data' => $items])->header('Cache-Control', 'no-store');
    }

    public function save(Request $request, ?int $id = null): JsonResponse
    {
        abort_unless(in_array($request->user()->role, ['admin', 'content_manager'], true), 403);
        $data = $request->validate([
            'kind' => ['required', 'in:article,story,publication'],
            'title' => ['required', 'string', 'max:160'],
            'category' => ['required', 'string', 'max:80'],
            'excerpt' => ['required', 'string', 'max:500'],
            'image' => ['nullable', 'string', 'max:500', 'regex:/^(\/|https?:\/\/)/i'],
            'imageAlt' => ['nullable', 'string', 'max:240'],
            'status' => ['required', 'in:draft,published,archived'],
            'featured' => ['required', 'boolean'],
            'blocks' => ['required', 'array', 'min:1', 'max:100'],
            'blocks.*.type' => ['required', 'in:heading,paragraph,list-item'],
            'blocks.*.text' => ['required', 'string', 'max:12000'],
            'downloads' => ['sometimes', 'array', 'max:20'],
            'downloads.*.label' => ['required', 'string', 'max:140'],
            'downloads.*.href' => ['required', 'string', 'max:500', 'regex:/^(\/|https?:\/\/)/i'],
            'downloads.*.availableLocally' => ['sometimes', 'boolean'],
            'videos' => ['sometimes', 'array', 'max:10'],
            'videos.*' => ['required', 'url:http,https', 'max:500'],
            'linkedinUrl' => ['nullable', 'url:http,https', 'max:500'],
            'storyGroups' => ['sometimes', 'array', 'max:2'],
            'storyGroups.*' => ['required', 'in:Entrepreneur,Startups'],
            'displayLines' => ['nullable', 'array'],
            'displayLines.line1' => ['nullable', 'string', 'max:120'],
            'displayLines.line2' => ['nullable', 'string', 'max:160'],
        ]);
        [$id, $homepageSynced] = DB::transaction(function () use ($request, $data, $id) {
            $query = DB::table('editorial_content')->where('id', $id);
            $previous = $id === null ? null : ($query->lockForUpdate()->first() ?? abort(404));
            $slug = $previous?->slug ?? Publishing::slug($data['title'], 'publication');
            $contentId = $previous?->content_id ?? 'editorial-'.$slug;
            $kind = $previous?->kind ?? $data['kind'];
            $payload = $previous ? json_decode($previous->payload, true, flags: JSON_THROW_ON_ERROR) : [
                'id' => $contentId, 'slug' => $slug, 'kind' => $kind,
                'image' => null, 'imageAlt' => '', 'downloads' => [], 'videos' => [],
                'source' => ['path' => 'laravel-editorial', 'url' => '', 'sha256' => ''],
            ];
            $updates = [
                'title' => $data['title'],
                'category' => $data['category'],
                'excerpt' => $data['excerpt'],
                'publishedAt' => $payload['publishedAt'] ?? ($data['status'] === 'published' ? now()->toIso8601String() : null),
                'blocks' => array_values($data['blocks']),
            ];
            if (array_key_exists('image', $data)) {
                $image = $data['image'] !== null ? trim($data['image']) : '';
                $updates['image'] = $image !== '' ? $image : null;
            }
            if (array_key_exists('imageAlt', $data)) {
                $updates['imageAlt'] = trim((string) ($data['imageAlt'] ?? ''));
            }
            if (array_key_exists('downloads', $data)) {
                $updates['downloads'] = array_values(array_map(fn ($dl) => [
                    'label' => $dl['label'],
                    'href' => $dl['href'],
                    'availableLocally' => (bool) ($dl['availableLocally'] ?? str_starts_with($dl['href'], '/')),
                ], $data['downloads']));
            }
            if (array_key_exists('videos', $data)) {
                $updates['videos'] = array_values($data['videos']);
            }
            if (array_key_exists('linkedinUrl', $data)) {
                $linkedin = $data['linkedinUrl'] !== null ? trim((string) $data['linkedinUrl']) : '';
                if ($linkedin !== '') {
                    $updates['linkedinUrl'] = $linkedin;
                } else {
                    unset($payload['linkedinUrl']);
                }
            }
            if ($kind === 'story' && array_key_exists('storyGroups', $data)) {
                $updates['storyGroups'] = array_values(array_unique($data['storyGroups']));
            }
            if ($kind === 'story' && array_key_exists('displayLines', $data)) {
                $line1 = trim((string) ($data['displayLines']['line1'] ?? ''));
                $line2 = trim((string) ($data['displayLines']['line2'] ?? ''));
                if ($line1 !== '' || $line2 !== '') {
                    $updates['displayLines'] = [
                        'line1' => $line1 !== '' ? $line1 : $data['title'],
                        'line2' => $line2 !== '' ? $line2 : $data['excerpt'],
                    ];
                } else {
                    unset($payload['displayLines']);
                }
            }
            $payload = array_replace($payload, $updates);
            unset($payload['status']);
            $isFeaturedStory = $kind === 'story' && (bool) $data['featured'];
            $values = [
                'payload' => json_encode($payload, JSON_THROW_ON_ERROR),
                'status' => $data['status'], 'featured' => $isFeaturedStory,
                'updated_at' => now(), 'editor_id' => $request->user()->id,
            ];
            if ($previous) {
                $query->update($values);
            } else {
                $id = DB::table('editorial_content')->insertGetId($values + [
                    'kind' => $kind, 'slug' => $slug, 'content_id' => $contentId, 'created_at' => now(),
                ]);
            }

            $synced = false;
            if ($kind === 'story') {
                $shouldFeature = $isFeaturedStory && $data['status'] === 'published';
                $synced = $this->syncHomepageFeaturedStory($contentId, $shouldFeature);
            }

            return [$id, $synced];
        });

        Cache::forget(self::CACHE_KEY);
        if ($homepageSynced) {
            Cache::forget('yerh.cms.public.v2');
        }

        return response()->json(['data' => ['id' => $id]]);
    }

    private function syncHomepageFeaturedStory(string $contentId, bool $featured): bool
    {
        $homepage = DB::table('cms_documents')->where('section', 'homepage')->lockForUpdate()->first();
        if (! $homepage) {
            return false;
        }

        $syncPayload = static function (?string $raw) use ($contentId, $featured): ?string {
            if (! $raw) {
                return null;
            }
            $decoded = json_decode($raw, true);
            if (! is_array($decoded)) {
                return null;
            }
            $list = array_values(array_filter(
                array_map('strval', is_array($decoded['featuredStories'] ?? null) ? $decoded['featuredStories'] : []),
                fn (string $id) => $id !== '' && $id !== $contentId,
            ));
            if ($featured) {
                array_unshift($list, $contentId);
            }
            if ($list === ($decoded['featuredStories'] ?? [])) {
                return null;
            }
            $decoded['featuredStories'] = $list;

            return json_encode($decoded, JSON_THROW_ON_ERROR);
        };

        $updates = [];
        $pub = $syncPayload($homepage->published_payload);
        if ($pub !== null) {
            $updates['published_payload'] = $pub;
        }
        $draft = $syncPayload($homepage->draft_payload);
        if ($draft !== null) {
            $updates['draft_payload'] = $draft;
        }

        if ($updates === []) {
            return false;
        }

        $updates['updated_at'] = now();
        DB::table('cms_documents')->where('section', 'homepage')->update($updates);

        return true;
    }

    public function destroy(Request $request, int $id): Response
    {
        abort_unless(in_array($request->user()->role, ['admin', 'content_manager'], true), 403);
        $deleted = DB::table('editorial_content')->where('id', $id)->delete();
        abort_unless($deleted === 1, 404);
        Cache::forget(self::CACHE_KEY);

        return response()->noContent();
    }
}
