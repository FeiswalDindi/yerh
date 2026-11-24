<?php

namespace App\Http\Controllers;

use App\Domain\Incubation\MarketplaceVisibility;
use App\Services\ImageOptimizer;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\Response;

final class MarketplaceSectorController extends Controller
{
    public function index(MarketplaceVisibility $marketplace): JsonResponse
    {
        $counts = $marketplace->publicProducts()->select('venture.sector')
            ->selectRaw('count(*) as total')->groupBy('venture.sector');
        $sectors = DB::table('marketplace_sectors as sector')
            ->leftJoinSub($counts, 'published', 'published.sector', '=', 'sector.name')
            ->orderBy('sector.name')->get(['sector.*', 'published.total'])->map(fn ($row) => [
            'id' => $row->id,
            'count' => (int) $row->total,
            'name' => $row->name,
            'image' => $row->uploaded_image
                ? '/api/v1/marketplace-sectors/'.$row->id.'/image?v='.substr(sha1($row->uploaded_image), 0, 12)
                : $row->image,
        ]);

        return response()->json(['data' => $sectors]);
    }

    public function image(Request $request, int $id, ImageOptimizer $optimizer): Response
    {
        $path = DB::table('marketplace_sectors')->where('id', $id)->value('uploaded_image');
        abort_unless($path && Storage::disk('local')->exists($path), 404);

        $preferWebp = str_contains(strtolower((string) $request->header('Accept', '')), 'image/webp');
        $requestedWidth = $request->integer('w') ?: null;
        $variant = $optimizer->prepareVariant('local', $path, 'sector-'.sha1($path), $requestedWidth, $preferWebp);

        return $optimizer->serveFile(
            $request,
            Storage::disk('local')->path($variant['path']),
            $variant['mime'],
            true,
        );
    }

    public function save(Request $request, ImageOptimizer $optimizer, ?int $id = null): JsonResponse
    {
        abort_unless(in_array($request->user()->role, ['admin', 'content_manager'], true), 403);
        $rules = ['photo' => [$id === null ? 'nullable' : 'required', 'image', 'mimes:jpeg,png,webp', 'max:2048']];
        if ($id === null) {
            $rules['name'] = ['required', 'string', 'max:100', 'unique:marketplace_sectors,name'];
        }
        $data = $request->validate($rules);
        $disk = Storage::disk('local');
        $path = $request->file('photo')?->store('marketplace-sectors', 'local');
        abort_if($path === false, 500, 'Could not store the category picture.');
        $previous = null;
        try {
            $saved = DB::transaction(function () use ($id, $data, $path, &$previous) {
                if ($id === null) {
                    return DB::table('marketplace_sectors')->insertGetId(['name' => $data['name'], 'uploaded_image' => $path]);
                }
                $sector = DB::table('marketplace_sectors')->where('id', $id)->lockForUpdate()->first();
                abort_unless($sector, 404);
                $previous = $sector->uploaded_image;
                DB::table('marketplace_sectors')->where('id', $id)->update(['uploaded_image' => $path]);

                return $id;
            });
        } catch (\Throwable $error) {
            if ($path) {
                $disk->delete($path);
            }
            if ($error instanceof UniqueConstraintViolationException) {
                throw ValidationException::withMessages(['name' => 'This category already exists.']);
            }
            throw $error;
        }
        if ($previous) {
            $disk->delete($previous);
            $optimizer->purgeCache('local', 'sector-'.sha1($previous));
        }

        return response()->json(['data' => ['id' => $saved]], $id === null ? 201 : 200);
    }
}
