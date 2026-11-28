<?php

namespace App\Http\Controllers;

use App\Services\ImageOptimizer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response as SymfonyResponse;
use Throwable;

final class CmsMediaController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $this->requireEditor($request);

        $rows = DB::table('cms_media as media')
            ->leftJoin('users as uploader', 'uploader.id', '=', 'media.uploaded_by')
            ->latest('media.id')
            ->limit(200)
            ->get([
                'media.id',
                'media.uuid',
                'media.original_name',
                'media.mime_type',
                'media.size_bytes',
                'media.width',
                'media.height',
                'media.alt_text',
                'media.folder',
                'media.in_site_library',
                'media.created_at',
                'uploader.name as uploaded_by',
            ])
            ->map(fn ($row) => [
                'id' => $row->id,
                'uuid' => $row->uuid,
                'url' => '/api/v1/cms/media/'.$row->uuid,
                'original_name' => $row->original_name,
                'mime_type' => $row->mime_type,
                'size_bytes' => (int) $row->size_bytes,
                'width' => $row->width !== null ? (int) $row->width : null,
                'height' => $row->height !== null ? (int) $row->height : null,
                'alt_text' => $row->alt_text ?? '',
                'folder' => $row->folder,
                'in_site_library' => (bool) $row->in_site_library,
                'uploaded_by' => $row->uploaded_by,
                'created_at' => $row->created_at,
            ]);

        return response()->json(['data' => $rows])->header('Cache-Control', 'private, no-store');
    }

    public function store(Request $request, ImageOptimizer $optimizer): JsonResponse
    {
        $user = $request->user();
        $isPartner = $user->role === 'partner';
        abort_unless($isPartner || in_array($user->role, ['admin', 'content_manager'], true), 403);

        $data = $request->validate([
            'file' => $isPartner
                ? ['required', 'file', 'mimes:jpeg,jpg,png,webp,gif', 'max:5120']
                : ['required', 'file', 'mimes:jpeg,jpg,png,webp,gif,pdf', 'max:8192'],
            'alt_text' => ['nullable', 'string', 'max:240'],
            'folder' => ['nullable', 'string', 'max:60', 'regex:/^[a-z0-9_-]+$/i'],
            'in_site_library' => ['nullable', 'boolean'],
        ]);

        $file = $request->file('file');
        $disk = 'local';
        $path = $file->store('cms-media', $disk);
        abort_if($path === false, 500, 'Could not store the media file.');

        $uuid = (string) Str::uuid();
        $originalName = mb_substr($file->getClientOriginalName(), 0, 180);
        $mimeType = (string) ($file->getMimeType() ?: 'application/octet-stream');
        $sizeBytes = (int) $file->getSize();
        $dimensions = $optimizer->inspectDimensions(Storage::disk($disk)->path($path));
        $width = $dimensions['width'] ?? null;
        $height = $dimensions['height'] ?? null;
        $folder = $isPartner
            ? 'events'
            : (Str::lower(trim((string) ($data['folder'] ?? 'general'))) ?: 'general');
        $altText = isset($data['alt_text']) ? trim($data['alt_text']) : '';
        $inSiteLibrary = $isPartner ? false : $request->boolean('in_site_library', false);

        try {
            $id = DB::table('cms_media')->insertGetId([
                'uuid' => $uuid,
                'disk' => $disk,
                'path' => $path,
                'original_name' => $originalName,
                'mime_type' => $mimeType,
                'size_bytes' => $sizeBytes,
                'width' => $width,
                'height' => $height,
                'alt_text' => $altText !== '' ? $altText : null,
                'folder' => $folder,
                'in_site_library' => $inSiteLibrary,
                'uploaded_by' => $request->user()->id,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        } catch (Throwable $exception) {
            Storage::disk($disk)->delete($path);
            throw $exception;
        }

        try {
            $optimizer->prepareVariant($disk, $path, 'cms-'.$uuid, null, true);
        } catch (Throwable) {
            // Defer WebP conversion to request time if eager pre-warming fails.
        }

        return response()->json([
            'data' => [
                'id' => $id,
                'uuid' => $uuid,
                'url' => '/api/v1/cms/media/'.$uuid,
                'original_name' => $originalName,
                'mime_type' => $mimeType,
                'size_bytes' => $sizeBytes,
                'width' => $width,
                'height' => $height,
                'alt_text' => $altText,
                'folder' => $folder,
                'in_site_library' => $inSiteLibrary,
            ],
        ], 201)->header('Cache-Control', 'no-store');
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $this->requireEditor($request);
        $data = $request->validate([
            'alt_text' => ['nullable', 'string', 'max:240'],
            'folder' => ['sometimes', 'string', 'max:60', 'regex:/^[a-z0-9_-]+$/i'],
            'in_site_library' => ['sometimes', 'boolean'],
        ]);

        $record = DB::table('cms_media')->where('id', $id)->first() ?? abort(404);
        $updates = ['updated_at' => now()];
        if (array_key_exists('alt_text', $data)) {
            $updates['alt_text'] = $data['alt_text'] !== null && trim($data['alt_text']) !== ''
                ? trim($data['alt_text'])
                : null;
        }
        if (array_key_exists('folder', $data)) {
            $updates['folder'] = Str::lower(trim($data['folder'])) ?: 'general';
        }
        if (array_key_exists('in_site_library', $data)) {
            $updates['in_site_library'] = (bool) $data['in_site_library'];
        }
        DB::table('cms_media')->where('id', $record->id)->update($updates);

        return response()->json([
            'data' => [
                'id' => $record->id,
                'in_site_library' => array_key_exists('in_site_library', $updates)
                    ? (bool) $updates['in_site_library']
                    : (bool) $record->in_site_library,
            ],
        ]);
    }

    public function destroy(Request $request, int $id, ImageOptimizer $optimizer): Response
    {
        $this->requireEditor($request);
        $record = DB::table('cms_media')->where('id', $id)->first() ?? abort(404);
        DB::table('cms_media')->where('id', $record->id)->delete();
        Storage::disk($record->disk)->delete($record->path);
        $optimizer->purgeCache($record->disk, 'cms-'.$record->uuid);

        return response()->noContent();
    }

    public function show(Request $request, string $uuid, ImageOptimizer $optimizer): SymfonyResponse
    {
        $record = DB::table('cms_media')->where('uuid', $uuid)->first(['disk', 'path', 'original_name']) ?? abort(404);
        abort_unless(Storage::disk($record->disk)->exists($record->path), 404);

        if ($request->boolean('download')) {
            return Storage::disk($record->disk)->download($record->path, $record->original_name, [
                'X-Content-Type-Options' => 'nosniff',
                'Cache-Control' => 'public, max-age=31536000, immutable',
            ]);
        }

        $preferWebp = str_contains(strtolower((string) $request->header('Accept', '')), 'image/webp');
        $requestedWidth = $request->integer('w') ?: null;
        $variant = $optimizer->prepareVariant($record->disk, $record->path, 'cms-'.$uuid, $requestedWidth, $preferWebp);

        return $optimizer->serveFile(
            $request,
            Storage::disk($record->disk)->path($variant['path']),
            $variant['mime'],
            true,
        );
    }

    private function requireEditor(Request $request): void
    {
        abort_unless(in_array($request->user()->role, ['admin', 'content_manager'], true), 403);
    }
}
