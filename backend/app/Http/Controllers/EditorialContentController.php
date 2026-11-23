<?php

namespace App\Http\Controllers;

use App\Domain\Engagement\Publishing;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

final class EditorialContentController extends Controller
{
    public function publicIndex(): JsonResponse
    {
        $published = DB::table('editorial_content')->where('status', 'published')->latest('updated_at')->get();
        $items = $published->map(fn ($record) => json_decode($record->payload, true, flags: JSON_THROW_ON_ERROR));
        $featured = $published->where('kind', 'story')->where('featured', true)->pluck('content_id')->values();
        $hidden = DB::table('editorial_content')->whereIn('status', ['draft', 'archived'])
            ->where('payload->source->path', '!=', 'laravel-editorial')->pluck('content_id');

        return response()->json(['data' => compact('items', 'featured', 'hidden')]);
    }

    public function index(Request $request): JsonResponse
    {
        abort_unless(in_array($request->user()->role, ['admin', 'content_manager'], true), 403);
        $items = DB::table('editorial_content')->latest('updated_at')->get()
            ->map(fn ($record) => [
                'id' => $record->id, 'status' => $record->status, 'featured' => (bool) $record->featured,
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
            'status' => ['required', 'in:draft,published,archived'],
            'featured' => ['required', 'boolean'],
            'blocks' => ['required', 'array', 'min:1', 'max:100'],
            'blocks.*.type' => ['required', 'in:heading,paragraph,list-item'],
            'blocks.*.text' => ['required', 'string', 'max:12000'],
        ]);
        $id = DB::transaction(function () use ($request, $data, $id) {
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
            $payload = array_replace($payload, [
                'title' => $data['title'], 'category' => $data['category'], 'excerpt' => $data['excerpt'],
                'publishedAt' => $payload['publishedAt'] ?? ($data['status'] === 'published' ? now()->toIso8601String() : null),
                'blocks' => array_values($data['blocks']),
            ]);
            unset($payload['status']);
            $values = [
                'payload' => json_encode($payload, JSON_THROW_ON_ERROR),
                'status' => $data['status'], 'featured' => $data['featured'] && $kind === 'story',
                'updated_at' => now(), 'editor_id' => $request->user()->id,
            ];
            if ($previous) {
                $query->update($values);

                return $id;
            }

            return DB::table('editorial_content')->insertGetId($values + [
                'kind' => $kind, 'slug' => $slug, 'content_id' => $contentId, 'created_at' => now(),
            ]);
        });

        return response()->json(['data' => ['id' => $id]]);
    }
}
