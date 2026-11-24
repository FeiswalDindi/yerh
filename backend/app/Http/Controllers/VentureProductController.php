<?php

namespace App\Http\Controllers;

use App\Domain\Incubation\MarketplaceVisibility;
use App\Services\ImageOptimizer;
use App\Support\WorkspaceNotifier;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Throwable;

final class VentureProductController extends Controller
{
    public function __construct(
        private readonly MarketplaceVisibility $marketplace,
        private readonly ImageOptimizer $images,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $actor = $request->user();
        $query = $this->marketplace->products()->latest('product.id')
            ->join('users as founder', 'founder.id', '=', 'venture.owner_id')
            ->select('product.*', 'founder.name as owner', 'venture.name as venture', 'venture.sector', 'venture.status as venture_status',
                'path.id as path_id', 'path.graduated_at', 'payment.status as payment_status',
                'payment.amount as payment_amount', 'payment.decision_note as payment_note');
        match ($actor->role) {
            'entrepreneur' => $query->where('venture.owner_id', $actor->id),
            'mentor' => $query->where('path.mentor_id', $actor->id)->whereNotNull('product.evidence_status'),
            'admin' => $query,
            default => abort(403),
        };
        $products = $query->get();
        $published = $this->marketplace->publicProducts()->whereIn('product.id', $products->pluck('id'))->pluck('product.slug');
        foreach ($products as $product) {
            $product->published = $published->contains($product->slug);
            $product->has_image = ! empty($product->image_path);
            $product->image_url = $product->image_path
                ? '/api/v1/workspace/products/'.$product->id.'/image?v='.substr(sha1((string) $product->image_path), 0, 12)
                : null;
            unset($product->image_path);
        }

        return response()->json(['data' => $products]);
    }

    public function store(Request $request): JsonResponse
    {
        abort_unless($request->user()->role === 'entrepreneur', 403);
        $data = $this->validateProduct($request);
        $request->validate(['venture_id' => ['required', 'integer']]);
        $venture = DB::table('ventures')->where('id', $request->integer('venture_id'))
            ->where('owner_id', $request->user()->id)->first() ?? abort(404);
        abort_if($venture->status === 'rejected', 409, 'Resubmit and get this venture approved before adding products.');

        $photoFile = $request->file('photo');
        $storedPath = $photoFile?->store('product-images', 'local');
        abort_if($storedPath === false, 500, 'Could not store the product image.');

        try {
            $id = DB::table('venture_products')->insertGetId([
                'name' => $data['name'],
                'description' => $data['description'],
                'price' => $data['price'],
                'contact_email' => $data['contact_email'],
                'contact_phone' => $data['contact_phone'],
                'whatsapp' => $data['whatsapp'],
                'image_path' => $storedPath,
                'venture_id' => $venture->id,
                'slug' => Str::slug($data['name']).'-'.Str::lower((string) Str::ulid()),
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        } catch (Throwable $exception) {
            if ($storedPath) {
                Storage::disk('local')->delete($storedPath);
            }
            throw $exception;
        }

        WorkspaceNotifier::notifyAdmins(
            "{$request->user()->name} submitted a product listing for review: {$data['name']}.",
            '/dashboard/workspace?tab=approvals&view=products',
        );

        return response()->json(['data' => ['id' => $id]], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        abort_unless($request->user()->role === 'entrepreneur', 403);
        $data = $this->validateProduct($request);
        $photoFile = $request->file('photo');
        $storedPath = $photoFile?->store('product-images', 'local');
        abort_if($storedPath === false, 500, 'Could not store the product image.');
        $removePhoto = (bool) ($data['remove_photo'] ?? false);
        $obsoletePath = null;

        try {
            DB::transaction(function () use ($request, $id, $data, $storedPath, $removePhoto, &$obsoletePath) {
                $product = $this->lockProduct($id);
                abort_unless((int) $product->owner_id === $request->user()->id, 404);

                $nextImagePath = $product->image_path;
                if ($storedPath !== null) {
                    $obsoletePath = $product->image_path;
                    $nextImagePath = $storedPath;
                } elseif ($removePhoto) {
                    $obsoletePath = $product->image_path;
                    $nextImagePath = null;
                }

                DB::table('venture_products')->where('id', $id)->update([
                    'name' => $data['name'],
                    'description' => $data['description'],
                    'price' => $data['price'],
                    'contact_email' => $data['contact_email'],
                    'contact_phone' => $data['contact_phone'],
                    'whatsapp' => $data['whatsapp'],
                    'image_path' => $nextImagePath,
                    'moderation' => 'pending',
                    'moderation_note' => null,
                    'updated_at' => now(),
                ]);
            }, 3);
        } catch (Throwable $exception) {
            if ($storedPath) {
                Storage::disk('local')->delete($storedPath);
            }
            throw $exception;
        }

        if ($obsoletePath) {
            Storage::disk('local')->delete($obsoletePath);
            $this->images->purgeCache('local', 'product-'.$id);
        }

        WorkspaceNotifier::notifyAdmins(
            "{$request->user()->name} updated product listing {$data['name']} for moderation.",
            '/dashboard/workspace?tab=approvals&view=products',
        );

        return response()->json(['data' => ['id' => $id]]);
    }

    public function submitEvidence(Request $request, int $id): JsonResponse
    {
        abort_unless($request->user()->role === 'entrepreneur', 403);
        $data = $request->validate(['evidence' => ['required', 'string', 'min:10', 'max:5000']]);
        [$productName, $mentorId] = DB::transaction(function () use ($request, $id, $data) {
            $product = $this->lockProduct($id);
            abort_unless((int) $product->owner_id === $request->user()->id, 404);
            $path = DB::table('incubation_paths')->where('venture_id', $product->venture_id)->first();
            abort_unless($path && ($path->graduated_at || ($path->mentor_id && $product->included_path_id === $path->id)),
                409, 'Include this product at launch or request a review after graduation.');
            abort_if(in_array($product->evidence_status, ['pending', 'approved'], true), 409, 'This evidence already has an active review.');
            DB::table('venture_products')->where('id', $id)->update([
                'evidence' => $data['evidence'], 'evidence_status' => 'pending', 'evidence_note' => null, 'updated_at' => now(),
            ]);

            return [$product->name, $path->mentor_id ? (int) $path->mentor_id : null];
        }, 3);

        if ($mentorId) {
            WorkspaceNotifier::notifyUser(
                $mentorId,
                "{$request->user()->name} submitted product evidence for {$productName}.",
                '/dashboard/workspace?tab=products',
            );
        } else {
            WorkspaceNotifier::notifyAdmins(
                "{$request->user()->name} submitted product evidence for {$productName}.",
                '/dashboard/workspace?tab=approvals&view=evidence',
            );
        }

        return response()->json(['data' => ['id' => $id]]);
    }

    public function review(Request $request, int $id, string $review): JsonResponse
    {
        abort_unless(in_array($review, ['listing', 'evidence'], true), 404);
        $actor = $request->user();
        abort_unless($actor->role === 'admin' || ($review === 'evidence' && $actor->role === 'mentor'), 403);
        $data = $request->validate([
            'expected_status' => ['sometimes', Rule::prohibitedIf($actor->role !== 'admin' || $review !== 'listing'), Rule::in(['approved', 'pending', 'rejected'])],
            'decision' => ['required', Rule::in($request->has('expected_status') ? ['approved', 'rejected', 'pending'] : ['approved', 'rejected'])],
            'note' => ['required_if:decision,rejected', 'nullable', 'string', 'max:2000'],
        ]);
        [$ownerId, $productName] = DB::transaction(function () use ($actor, $id, $review, $data) {
            $product = $this->lockProduct($id);
            if ($actor->role === 'mentor') {
                $assigned = DB::table('incubation_paths')->where('venture_id', $product->venture_id)
                    ->where('mentor_id', $actor->id)->exists();
                abort_unless($assigned, 404);
            }
            [$status, $note] = $review === 'listing' ? ['moderation', 'moderation_note'] : ['evidence_status', 'evidence_note'];
            abort_unless($product->$status === ($data['expected_status'] ?? 'pending'), 409, 'This review is no longer pending.');
            DB::table('venture_products')->where('id', $id)->update([
                $status => $data['decision'], $note => $data['note'] ?? null, 'updated_at' => now(),
            ]);

            return [(int) $product->owner_id, $product->name];
        }, 3);

        $kindLabel = $review === 'listing' ? 'product listing' : 'product evidence';
        $noteSuffix = ! empty($data['note']) ? ' Note: '.$data['note'] : '';
        WorkspaceNotifier::notifyUser(
            $ownerId,
            "Your {$kindLabel} for {$productName} was {$data['decision']}.{$noteSuffix}",
            '/dashboard/workspace?tab=products',
        );

        return response()->json(['data' => ['id' => $id]]);
    }

    public function publicIndex(Request $request): JsonResponse
    {
        $data = $request->validate(['category' => ['nullable', 'string', 'max:120']]);
        $products = $this->marketplace->publicProducts();
        if (isset($data['category'])) {
            $products->where('venture.sector', $data['category']);
        }

        $items = $products->latest('product.id')->get()->map($this->serializePublicProduct(...));

        return response()->json(['data' => $items]);
    }

    public function publicShow(string $slug): JsonResponse
    {
        $row = $this->marketplace->publicProducts()->where('product.slug', $slug)->first() ?? abort(404);

        return response()->json(['data' => $this->serializePublicProduct($row)]);
    }

    public function publicImage(Request $request, string $slug): BinaryFileResponse
    {
        $row = $this->marketplace->publicProducts()
            ->where('product.slug', $slug)
            ->first(['product.id', 'product.image_path']) ?? abort(404);

        abort_unless($row->image_path && Storage::disk('local')->exists($row->image_path), 404);

        return $this->serveOptimizedProductImage($request, (int) $row->id, $row->image_path, true);
    }

    public function workspaceImage(Request $request, int $id): BinaryFileResponse
    {
        $actor = $request->user();
        $row = $this->marketplace->products()
            ->where('product.id', $id)
            ->first(['product.id', 'product.image_path', 'venture.owner_id', 'path.mentor_id']) ?? abort(404);

        abort_unless(
            $actor->role === 'admin'
            || (int) $row->owner_id === $actor->id
            || ($actor->role === 'mentor' && (int) $row->mentor_id === $actor->id),
            403,
        );
        abort_unless($row->image_path && Storage::disk('local')->exists($row->image_path), 404);

        return $this->serveOptimizedProductImage($request, (int) $row->id, $row->image_path, false);
    }

    private function serveOptimizedProductImage(
        Request $request,
        int $productId,
        string $sourcePath,
        bool $publicCache,
    ): BinaryFileResponse {
        $requestedWidth = $request->query('w');
        $width = is_numeric($requestedWidth) ? (int) $requestedWidth : null;
        $preferWebp = $this->acceptsWebp($request);

        $variant = $this->images->prepareVariant(
            'local',
            $sourcePath,
            'product-'.$productId,
            $width,
            $preferWebp,
        );

        $response = $this->images->serveFile(
            $request,
            Storage::disk('local')->path($variant['path']),
            $variant['mime'],
            true,
        );

        if (! $publicCache) {
            $response->headers->set('Cache-Control', 'private, max-age=3600');
        }

        return $response;
    }

    private function acceptsWebp(Request $request): bool
    {
        $accept = strtolower((string) $request->header('Accept', ''));

        return str_contains($accept, 'image/webp');
    }

    private function serializePublicProduct(object $row): array
    {
        $imageUrl = $row->image_path
            ? '/api/v1/marketplace/'.rawurlencode($row->slug).'/image?v='.substr(sha1((string) $row->image_path), 0, 12)
            : null;
        $sellerEmail = $row->contact_email ?: ($row->founder_email ?: null);
        $sellerPhone = $row->contact_phone ?: null;
        $whatsapp = $row->whatsapp ?: $sellerPhone;

        return [
            'slug' => $row->slug,
            'name' => $row->name,
            'description' => $row->description,
            'price' => $row->price,
            'venture' => $row->venture,
            'sector' => $row->sector,
            'location' => $row->location,
            'institution' => $row->institution,
            'seller_name' => $row->seller_name,
            'seller_email' => $sellerEmail,
            'seller_phone' => $sellerPhone,
            'whatsapp' => $whatsapp,
            'image_url' => $imageUrl,
        ];
    }

    private function validateProduct(Request $request): array
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'min:2', 'max:120'],
            'description' => ['required', 'string', 'min:10', 'max:5000'],
            'price' => ['required', 'numeric', 'decimal:0,2', 'between:0,9999999999.99'],
            'photo' => ['nullable', 'image', 'mimes:jpeg,jpg,png,webp', 'max:4096'],
            'remove_photo' => ['sometimes', 'boolean'],
            'contact_email' => ['nullable', 'email', 'max:254'],
            'contact_phone' => ['nullable', 'string', 'max:40'],
            'whatsapp' => ['nullable', 'string', 'max:40'],
        ]);

        return [
            'name' => trim($validated['name']),
            'description' => trim($validated['description']),
            'price' => $validated['price'],
            'remove_photo' => (bool) ($validated['remove_photo'] ?? false),
            'contact_email' => isset($validated['contact_email']) && trim($validated['contact_email']) !== ''
                ? Str::lower(trim($validated['contact_email']))
                : null,
            'contact_phone' => isset($validated['contact_phone']) && trim($validated['contact_phone']) !== ''
                ? trim($validated['contact_phone'])
                : null,
            'whatsapp' => isset($validated['whatsapp']) && trim($validated['whatsapp']) !== ''
                ? trim($validated['whatsapp'])
                : null,
        ];
    }

    private function lockProduct(int $id): object
    {
        return DB::table('venture_products as product')->join('ventures as venture', 'venture.id', '=', 'product.venture_id')
            ->where('product.id', $id)->lockForUpdate()->first(['product.*', 'venture.owner_id']) ?? abort(404);
    }
}
