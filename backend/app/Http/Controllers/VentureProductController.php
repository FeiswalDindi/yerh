<?php

namespace App\Http\Controllers;

use App\Domain\Incubation\MarketplaceVisibility;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

final class VentureProductController extends Controller
{
    public function __construct(private readonly MarketplaceVisibility $marketplace) {}

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
        $id = DB::table('venture_products')->insertGetId([
            ...$data, 'venture_id' => $venture->id,
            'slug' => Str::slug($data['name']).'-'.Str::lower((string) Str::ulid()),
            'created_at' => now(), 'updated_at' => now(),
        ]);

        return response()->json(['data' => ['id' => $id]], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        abort_unless($request->user()->role === 'entrepreneur', 403);
        $data = $this->validateProduct($request);
        DB::transaction(function () use ($request, $id, $data) {
            $product = $this->lockProduct($id);
            abort_unless((int) $product->owner_id === $request->user()->id, 404);
            DB::table('venture_products')->where('id', $id)->update([
                ...$data, 'moderation' => 'pending', 'moderation_note' => null,
                'evidence' => null, 'evidence_status' => null, 'evidence_note' => null, 'updated_at' => now(),
            ]);
        }, 3);

        return response()->json(['data' => ['id' => $id]]);
    }

    public function submitEvidence(Request $request, int $id): JsonResponse
    {
        abort_unless($request->user()->role === 'entrepreneur', 403);
        $data = $request->validate(['evidence' => ['required', 'string', 'min:10', 'max:5000']]);
        DB::transaction(function () use ($request, $id, $data) {
            $product = $this->lockProduct($id);
            abort_unless((int) $product->owner_id === $request->user()->id, 404);
            $path = DB::table('incubation_paths')->where('venture_id', $product->venture_id)->first();
            abort_unless($path && ($path->graduated_at || ($path->mentor_id && $product->included_path_id === $path->id)),
                409, 'Include this product at launch or request a review after graduation.');
            abort_if(in_array($product->evidence_status, ['pending', 'approved'], true), 409, 'This evidence already has an active review.');
            DB::table('venture_products')->where('id', $id)->update([
                'evidence' => $data['evidence'], 'evidence_status' => 'pending', 'evidence_note' => null, 'updated_at' => now(),
            ]);
        }, 3);

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
        DB::transaction(function () use ($actor, $id, $review, $data) {
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
        }, 3);

        return response()->json(['data' => ['id' => $id]]);
    }

    public function publicIndex(Request $request): JsonResponse
    {
        $data = $request->validate(['category' => ['nullable', 'string', 'max:120']]);
        $products = $this->marketplace->publicProducts();
        if (isset($data['category'])) {
            $products->where('venture.sector', $data['category']);
        }

        return response()->json(['data' => $products->latest('product.id')->get()]);
    }

    public function publicShow(string $slug): JsonResponse
    {
        return response()->json(['data' => $this->marketplace->publicProducts()->where('product.slug', $slug)->first() ?? abort(404)]);
    }

    private function validateProduct(Request $request): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'min:2', 'max:120'],
            'description' => ['required', 'string', 'min:10', 'max:5000'],
            'price' => ['required', 'numeric', 'decimal:0,2', 'between:0,9999999999.99'],
        ]);
    }

    private function lockProduct(int $id): object
    {
        return DB::table('venture_products as product')->join('ventures as venture', 'venture.id', '=', 'product.venture_id')
            ->where('product.id', $id)->lockForUpdate()->first(['product.*', 'venture.owner_id']) ?? abort(404);
    }
}
