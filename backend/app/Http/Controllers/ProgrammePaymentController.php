<?php

namespace App\Http\Controllers;

use App\Domain\Incubation\Curriculum;
use App\Domain\Incubation\PathAccess;
use App\Domain\Incubation\ProgrammeFees;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

final class ProgrammePaymentController extends Controller
{
    public function __construct(
        private readonly PathAccess $access,
        private readonly Curriculum $curriculum,
        private readonly ProgrammeFees $fees,
    ) {}

    public function settings(): JsonResponse
    {
        return response()->json(['data' => $this->fees->settings()]);
    }

    public function changeSetting(Request $request, string $purpose): JsonResponse
    {
        abort_unless($request->user()->role === 'admin', 403);
        abort_unless(in_array($purpose, Curriculum::FEE_PURPOSES, true), 404);
        $data = $request->validate([
            'amount' => ['required', 'integer', 'between:0,10000000'],
            'enabled' => ['sometimes', 'boolean'],
        ]);
        $enabled = $purpose !== 'marketplace' || ($data['enabled'] ?? true);
        abort_if($purpose === 'marketplace' && $enabled && $data['amount'] === 0, 422, 'An enabled paid listing needs a fee.');
        DB::table('programme_fee_settings')->upsert([
            ['purpose' => $purpose, 'amount' => $data['amount'], 'enabled' => $enabled],
        ], ['purpose'], ['amount', 'enabled']);

        return $this->settings();
    }

    public function index(Request $request): JsonResponse
    {
        abort_unless($request->user()->role === 'admin', 403);

        return response()->json(['data' => DB::table('programme_payments as payment')
            ->join('users as payer', 'payer.id', '=', 'payment.payer_id')
            ->leftJoin('incubation_paths as path', 'path.id', '=', 'payment.path_id')
            ->leftJoin('ventures as venture', 'venture.id', '=', 'path.venture_id')
            ->leftJoin('venture_products as product', 'product.id', '=', 'payment.product_id')
            ->latest('payment.id')->get(['payment.*', 'payer.name as payer', 'venture.name as venture', 'product.name as product'])]);
    }

    public function record(Request $request): JsonResponse
    {
        abort_unless($request->user()->role === 'entrepreneur', 403);
        $data = $request->validate([
            'purpose' => ['required', Rule::in(Curriculum::FEE_PURPOSES)],
            'target_id' => ['required', 'integer'],
            'reference' => ['required', 'string', 'min:3', 'max:120'],
        ]);
        $actor = $request->user();
        try {
            $id = DB::transaction(function () use ($actor, $data) {
                $purpose = $data['purpose'];
                $target = $data['target_id'];
                $fee = $this->fees->for($purpose);
                abort_unless($fee['enabled'] && $fee['amount'] > 0, 409, 'There is no active fee for this item.');

                if ($purpose === 'marketplace') {
                    $product = DB::table('venture_products as product')->join('ventures as venture', 'venture.id', '=', 'product.venture_id')
                        ->where('product.id', $target)->where('venture.owner_id', $actor->id)->lockForUpdate()
                        ->first(['product.id', 'product.moderation', 'product.evidence_status', 'venture.id as venture_id', 'venture.status']) ?? abort(404);
                    $graduated = DB::table('incubation_paths')->where('venture_id', $product->venture_id)->whereNotNull('graduated_at')->exists();
                    abort_unless($product->status === 'approved' && $product->moderation !== 'rejected', 409, 'This product cannot use paid listing yet.');
                    abort_if($graduated && $product->evidence_status === 'approved', 409, 'Incubation already covers this product.');
                } else {
                    $path = $this->access->find($actor, $target, lock: true);
                    abort_unless($this->access->completed($path->id, $this->curriculum->credentialStages($purpose)), 409, 'Complete the stage first.');
                    abort_if(DB::table('venture_credentials')->where('path_id', $target)->where('kind', $purpose)->exists(), 409, 'The certificate has already been issued.');
                }

                $scope = ['purpose' => $purpose, $purpose === 'marketplace' ? 'product_id' : 'path_id' => $target];
                $existing = DB::table('programme_payments')->where($scope)->first();
                abort_if($existing && $existing->status !== 'declined', 409, 'A payment is already recorded for this item.');
                $values = [
                    'payer_id' => $actor->id, 'amount' => $fee['amount'], 'reference' => $data['reference'],
                    'status' => 'pending', 'reviewer_id' => null, 'reviewed_at' => null, 'decision_note' => null,
                    'updated_at' => now(),
                ];
                if ($existing) {
                    DB::table('programme_payments')->where('id', $existing->id)->update($values);

                    return $existing->id;
                }

                return DB::table('programme_payments')->insertGetId([...$scope, ...$values, 'created_at' => now()]);
            }, 3);
        } catch (UniqueConstraintViolationException) {
            throw ValidationException::withMessages(['reference' => 'That payment reference is already recorded.']);
        }

        return response()->json(['data' => ['id' => $id]], 201);
    }

    public function review(Request $request, int $id): JsonResponse
    {
        abort_unless($request->user()->role === 'admin', 403);
        $data = $request->validate([
            'decision' => ['required', Rule::in(['confirmed', 'declined'])],
            'note' => ['required_if:decision,declined', 'nullable', 'string', 'max:1500'],
        ]);
        $recorded = DB::table('programme_payments')->where('id', $id)->where('status', 'pending')->update([
            'status' => $data['decision'], 'decision_note' => $data['note'] ?? null,
            'reviewer_id' => $request->user()->id, 'reviewed_at' => now(), 'updated_at' => now(),
        ]);
        abort_unless($recorded, 409, 'Choose a pending payment.');

        return response()->json(['data' => ['id' => $id]]);
    }
}
