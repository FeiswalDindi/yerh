<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

final class CmsController extends Controller
{
    public const SECTIONS = ['site', 'homepage', 'faqs', 'team', 'partners', 'terms', 'entrepreneurship', 'lessons', 'sidebar'];

    private const CACHE_KEY = 'yerh.cms.public.v2';

    public function publicPayload(): JsonResponse
    {
        $payload = Cache::remember(self::CACHE_KEY, now()->addMinutes(10), function () {
            $docs = DB::table('cms_documents')
                ->whereNotNull('published_payload')
                ->get(['section', 'published_payload', 'published_version', 'published_at']);

            $documents = [];
            foreach ($docs as $doc) {
                $decoded = json_decode($doc->published_payload, true, flags: JSON_THROW_ON_ERROR);
                $documents[$doc->section] = $this->coerceNullLeaves($decoded);
            }

            return [
                'documents' => (object) $documents,
                'liveStats' => $this->liveStats(),
            ];
        });

        return response()->json(['data' => $payload])->header('Cache-Control', 'public, max-age=60');
    }

    public function index(Request $request): JsonResponse
    {
        $this->requireEditor($request);

        $docs = DB::table('cms_documents as doc')
            ->leftJoin('users as drafter', 'drafter.id', '=', 'doc.draft_updated_by')
            ->leftJoin('users as publisher', 'publisher.id', '=', 'doc.published_by')
            ->get([
                'doc.*',
                'drafter.name as draft_author',
                'publisher.name as published_author',
            ])
            ->keyBy('section');

        $sections = [];
        foreach (self::SECTIONS as $key) {
            $row = $docs->get($key);
            $draft = $row?->draft_payload
                ? $this->coerceNullLeaves(json_decode($row->draft_payload, true, flags: JSON_THROW_ON_ERROR))
                : null;
            $published = $row?->published_payload
                ? $this->coerceNullLeaves(json_decode($row->published_payload, true, flags: JSON_THROW_ON_ERROR))
                : null;

            $sections[$key] = [
                'section' => $key,
                'draft' => $draft,
                'published' => $published,
                'published_version' => (int) ($row->published_version ?? 0),
                'has_draft' => $draft !== null,
                'draft_author' => $row->draft_author ?? null,
                'draft_updated_at' => $row->draft_updated_at ?? null,
                'published_author' => $row->published_author ?? null,
                'published_at' => $row->published_at ?? null,
            ];
        }

        $revisions = DB::table('cms_revisions as rev')
            ->leftJoin('users as author', 'author.id', '=', 'rev.author_id')
            ->latest('rev.id')
            ->limit(40)
            ->get([
                'rev.id',
                'rev.section',
                'rev.version',
                'rev.summary',
                'rev.created_at',
                'author.name as author',
            ]);

        return response()->json([
            'data' => [
                'sections' => $sections,
                'revisions' => $revisions,
                'liveStats' => $this->liveStats(),
            ],
        ])->header('Cache-Control', 'private, no-store');
    }

    public function saveDraft(Request $request, string $section): JsonResponse
    {
        $this->requireEditor($request);
        $this->assertValidSection($section);

        $data = $request->validate([
            'payload' => ['required', 'array'],
        ]);
        $sanitized = $this->coerceNullLeaves($data['payload']);
        $this->validateSafePayload($sanitized);

        $encoded = json_encode($sanitized, JSON_THROW_ON_ERROR);
        abort_if(strlen($encoded) > 512_000, 422, 'Section content exceeds the maximum size limit.');

        DB::table('cms_documents')->upsert([[
            'section' => $section,
            'draft_payload' => $encoded,
            'draft_updated_by' => $request->user()->id,
            'draft_updated_at' => now(),
            'created_at' => now(),
            'updated_at' => now(),
        ]], ['section'], ['draft_payload', 'draft_updated_by', 'draft_updated_at', 'updated_at']);

        return response()->json([
            'data' => [
                'section' => $section,
                'saved' => true,
            ],
        ])->header('Cache-Control', 'no-store');
    }

    public function publish(Request $request, string $section): JsonResponse
    {
        $this->requireEditor($request);
        $this->assertValidSection($section);

        $data = $request->validate([
            'payload' => ['nullable', 'array'],
            'summary' => ['nullable', 'string', 'max:180'],
        ]);

        $sanitizedPayload = isset($data['payload'])
            ? $this->coerceNullLeaves($data['payload'])
            : null;

        if ($sanitizedPayload !== null) {
            $this->validateSafePayload($sanitizedPayload);
        }

        $version = DB::transaction(function () use ($request, $section, $data, $sanitizedPayload) {
            $row = DB::table('cms_documents')->where('section', $section)->lockForUpdate()->first();
            $encoded = $sanitizedPayload !== null
                ? json_encode($sanitizedPayload, JSON_THROW_ON_ERROR)
                : ($row?->draft_payload ?? $row?->published_payload);

            if (! $encoded) {
                throw ValidationException::withMessages(['payload' => 'Save changes before publishing.']);
            }
            if ($sanitizedPayload === null) {
                $decoded = $this->coerceNullLeaves(json_decode($encoded, true, flags: JSON_THROW_ON_ERROR));
                $encoded = json_encode($decoded, JSON_THROW_ON_ERROR);
            }
            abort_if(strlen($encoded) > 512_000, 422, 'Section content exceeds the maximum size limit.');

            $nextVersion = ((int) ($row->published_version ?? 0)) + 1;
            $now = now();

            DB::table('cms_documents')->upsert([[
                'section' => $section,
                'draft_payload' => null,
                'published_payload' => $encoded,
                'published_version' => $nextVersion,
                'draft_updated_by' => null,
                'draft_updated_at' => null,
                'published_by' => $request->user()->id,
                'published_at' => $now,
                'created_at' => $now,
                'updated_at' => $now,
            ]], ['section'], [
                'draft_payload',
                'published_payload',
                'published_version',
                'draft_updated_by',
                'draft_updated_at',
                'published_by',
                'published_at',
                'updated_at',
            ]);

            DB::table('cms_revisions')->insert([
                'section' => $section,
                'version' => $nextVersion,
                'summary' => isset($data['summary']) && trim($data['summary']) !== ''
                    ? trim($data['summary'])
                    : 'Published '.ucfirst($section).' (v'.$nextVersion.')',
                'payload' => $encoded,
                'author_id' => $request->user()->id,
                'created_at' => $now,
            ]);

            if ($section === 'homepage') {
                $publishedHomepage = json_decode($encoded, true, flags: JSON_THROW_ON_ERROR);
                if (is_array($publishedHomepage) && array_key_exists('featuredStories', $publishedHomepage) && is_array($publishedHomepage['featuredStories'])) {
                    $featuredIds = array_values(array_filter(array_map('strval', $publishedHomepage['featuredStories'])));
                    DB::table('editorial_content')->where('kind', 'story')->update(['featured' => false]);
                    if ($featuredIds !== []) {
                        DB::table('editorial_content')
                            ->where('kind', 'story')
                            ->whereIn('content_id', $featuredIds)
                            ->update(['featured' => true]);
                    }
                }
            }

            return $nextVersion;
        }, 3);

        Cache::forget(self::CACHE_KEY);
        if ($section === 'homepage') {
            Cache::forget('yerh.editorial.public.v1');
        }

        return response()->json([
            'data' => [
                'section' => $section,
                'version' => $version,
            ],
        ])->header('Cache-Control', 'no-store');
    }

    public function discardDraft(Request $request, string $section): JsonResponse
    {
        $this->requireEditor($request);
        $this->assertValidSection($section);

        DB::table('cms_documents')->where('section', $section)->update([
            'draft_payload' => null,
            'draft_updated_by' => null,
            'draft_updated_at' => null,
            'updated_at' => now(),
        ]);

        return response()->json(['data' => ['discarded' => true]]);
    }

    public function restore(Request $request, int $id): JsonResponse
    {
        $this->requireEditor($request);

        [$section, $version] = DB::transaction(function () use ($request, $id) {
            $revision = DB::table('cms_revisions')->where('id', $id)->first() ?? abort(404);
            $this->assertValidSection($revision->section);
            $doc = DB::table('cms_documents')->where('section', $revision->section)->lockForUpdate()->first();
            $nextVersion = ((int) ($doc->published_version ?? 0)) + 1;
            $now = now();
            $decoded = $this->coerceNullLeaves(json_decode($revision->payload, true, flags: JSON_THROW_ON_ERROR));
            $encoded = json_encode($decoded, JSON_THROW_ON_ERROR);

            DB::table('cms_documents')->upsert([[
                'section' => $revision->section,
                'draft_payload' => null,
                'published_payload' => $encoded,
                'published_version' => $nextVersion,
                'draft_updated_by' => null,
                'draft_updated_at' => null,
                'published_by' => $request->user()->id,
                'published_at' => $now,
                'created_at' => $now,
                'updated_at' => $now,
            ]], ['section'], [
                'draft_payload',
                'published_payload',
                'published_version',
                'draft_updated_by',
                'draft_updated_at',
                'published_by',
                'published_at',
                'updated_at',
            ]);

            DB::table('cms_revisions')->insert([
                'section' => $revision->section,
                'version' => $nextVersion,
                'summary' => 'Restored revision v'.$revision->version,
                'payload' => $encoded,
                'author_id' => $request->user()->id,
                'created_at' => $now,
            ]);

            return [$revision->section, $nextVersion];
        }, 3);

        Cache::forget(self::CACHE_KEY);

        return response()->json([
            'data' => [
                'section' => $section,
                'version' => $version,
            ],
        ])->header('Cache-Control', 'no-store');
    }

    private function coerceNullLeaves(mixed $node): mixed
    {
        if ($node === null) {
            return '';
        }
        if (is_array($node)) {
            $out = [];
            foreach ($node as $key => $value) {
                $out[$key] = $this->coerceNullLeaves($value);
            }

            return $out;
        }

        return $node;
    }

    private function liveStats(): array
    {
        return [
            'mentors' => DB::table('users')->where('role', 'mentor')->whereNull('suspended_at')->count(),
            'users' => DB::table('users')->whereNull('suspended_at')->count(),
            'institutions' => DB::table('institutions')->where('status', 'active')->count(),
            'ventures' => DB::table('ventures')->where('status', 'approved')->count(),
        ];
    }

    private function requireEditor(Request $request): void
    {
        abort_unless(in_array($request->user()->role, ['admin', 'content_manager'], true), 403);
    }

    private function assertValidSection(string $section): void
    {
        abort_unless(in_array($section, self::SECTIONS, true), 404);
    }

    private function validateSafePayload(mixed $node, string $key = ''): void
    {
        if (is_array($node)) {
            foreach ($node as $k => $v) {
                $this->validateSafePayload($v, is_string($k) ? $k : $key);
            }

            return;
        }

        if (! is_string($node)) {
            return;
        }

        $trimmed = trim($node);
        if ($trimmed === '') {
            return;
        }

        if (preg_match('/^(href|url|image|heroImage|src|sourceUrl|linkedinUrl|buttonHref|linkHref)$/i', $key)) {
            $lower = strtolower($trimmed);
            if (preg_match('/^(javascript|vbscript|data):/i', $lower)) {
                throw ValidationException::withMessages([
                    'payload' => "Unsafe URL protocol rejected in field '{$key}'.",
                ]);
            }
            $isRelative = str_starts_with($trimmed, '/') || str_starts_with($trimmed, '#');
            $isAllowedExternal = str_starts_with($lower, 'https://')
                || str_starts_with($lower, 'http://')
                || str_starts_with($lower, 'mailto:')
                || str_starts_with($lower, 'tel:');
            if (! $isRelative && ! $isAllowedExternal) {
                throw ValidationException::withMessages([
                    'payload' => "Use a site path (starting with /) or a valid https:// link in '{$key}'.",
                ]);
            }
        }
    }
}
