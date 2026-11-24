<?php

namespace App\Http\Controllers;

use App\Domain\Incubation\Curriculum;
use App\Domain\Incubation\PathAccess;
use App\Domain\Incubation\ProgrammeFees;
use App\Models\User;
use App\Notifications\WorkspaceAlert;
use App\Support\WorkspaceNotifier;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Throwable;

final class ProgrammePaymentController extends Controller
{
    private const INSTRUCTIONS_KEY = 'payment_instructions';

    public function __construct(
        private readonly PathAccess $access,
        private readonly Curriculum $curriculum,
        private readonly ProgrammeFees $fees,
    ) {}

    public function settings(): JsonResponse
    {
        return response()->json(['data' => $this->fees->settings()]);
    }

    public function instructions(): JsonResponse
    {
        $defaults = config('yerh.payment_instructions', [
            'provider' => 'M-Pesa Paybill',
            'paybill_number' => '522522',
            'account_number' => 'YERH',
            'recipient_name' => 'Youth Entrepreneurship Resource Hub',
            'instructions' => 'Send the exact fee via M-Pesa Paybill, then enter your confirmation code and upload a screenshot or PDF receipt.',
        ]);
        $stored = DB::table('platform_settings')->where('key', self::INSTRUCTIONS_KEY)->value('value');
        $parsed = is_string($stored) ? json_decode($stored, true) : null;

        return response()->json([
            'data' => is_array($parsed) ? array_merge($defaults, $parsed) : $defaults,
        ])->header('Cache-Control', 'private, no-store');
    }

    public function updateInstructions(Request $request): JsonResponse
    {
        abort_unless($request->user()->role === 'admin', 403);
        $data = $request->validate([
            'provider' => ['required', 'string', 'min:2', 'max:80'],
            'paybill_number' => ['required', 'string', 'min:2', 'max:60'],
            'account_number' => ['required', 'string', 'min:2', 'max:80'],
            'recipient_name' => ['required', 'string', 'min:2', 'max:140'],
            'instructions' => ['required', 'string', 'min:10', 'max:1500'],
        ]);

        DB::table('platform_settings')->upsert([[
            'key' => self::INSTRUCTIONS_KEY,
            'value' => json_encode($data, JSON_THROW_ON_ERROR),
            'updated_by' => $request->user()->id,
            'created_at' => now(),
            'updated_at' => now(),
        ]], ['key'], ['value', 'updated_by', 'updated_at']);

        return $this->instructions();
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

        $rows = DB::table('programme_payments as payment')
            ->join('users as payer', 'payer.id', '=', 'payment.payer_id')
            ->leftJoin('incubation_paths as path', 'path.id', '=', 'payment.path_id')
            ->leftJoin('ventures as venture', 'venture.id', '=', 'path.venture_id')
            ->leftJoin('venture_products as product', 'product.id', '=', 'payment.product_id')
            ->latest('payment.id')
            ->get(['payment.*', 'payer.name as payer', 'venture.name as venture', 'product.name as product'])
            ->map(function ($row) {
                $row->has_receipt = ! empty($row->receipt_path);
                unset($row->receipt_path);

                return $row;
            });

        return response()->json(['data' => $rows])->header('Cache-Control', 'private, no-store');
    }

    public function record(Request $request): JsonResponse
    {
        abort_unless($request->user()->role === 'entrepreneur', 403);
        $data = $request->validate([
            'purpose' => ['required', Rule::in(Curriculum::FEE_PURPOSES)],
            'target_id' => ['required', 'integer'],
            'reference' => ['required', 'string', 'min:3', 'max:120'],
            'receipt' => ['nullable', 'file', 'mimes:jpeg,jpg,png,webp,pdf', 'max:5120'],
        ]);
        $actor = $request->user();
        $receiptFile = $request->file('receipt');
        $storedPath = $receiptFile?->store('payment-receipts', 'local');
        abort_if($storedPath === false, 500, 'Could not store the payment receipt.');
        $receiptName = $receiptFile ? mb_substr($receiptFile->getClientOriginalName(), 0, 180) : null;
        $replacedPath = null;

        try {
            $id = DB::transaction(function () use ($actor, $data, $storedPath, $receiptName, &$replacedPath) {
                $purpose = $data['purpose'];
                $target = (int) $data['target_id'];
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
                    abort_unless($this->access->completed($path->id, $this->curriculum->credentialStages($purpose)), 409, 'Pass the stage assessment first.');
                    abort_if(DB::table('venture_credentials')->where('path_id', $target)->where('kind', $purpose)->exists(), 409, 'The certificate has already been issued.');
                }

                $scope = ['purpose' => $purpose, $purpose === 'marketplace' ? 'product_id' : 'path_id' => $target];
                $existing = DB::table('programme_payments')->where($scope)->first();
                abort_if($existing && $existing->status !== 'declined', 409, 'A payment is already recorded for this item.');
                $values = [
                    'payer_id' => $actor->id, 'amount' => $fee['amount'], 'reference' => trim($data['reference']),
                    'status' => 'pending', 'reviewer_id' => null, 'reviewed_at' => null, 'decision_note' => null,
                    'updated_at' => now(),
                ];
                if ($storedPath !== null) {
                    $values['receipt_path'] = $storedPath;
                    $values['receipt_name'] = $receiptName;
                } elseif (! $existing) {
                    $values['receipt_path'] = null;
                    $values['receipt_name'] = null;
                }
                if ($existing) {
                    if ($storedPath !== null && $existing->receipt_path) {
                        $replacedPath = $existing->receipt_path;
                    }
                    DB::table('programme_payments')->where('id', $existing->id)->update($values);

                    return $existing->id;
                }

                return DB::table('programme_payments')->insertGetId([...$scope, ...$values, 'created_at' => now()]);
            }, 3);
        } catch (Throwable $exception) {
            if ($storedPath) {
                Storage::disk('local')->delete($storedPath);
            }
            if ($exception instanceof UniqueConstraintViolationException) {
                throw ValidationException::withMessages(['reference' => 'That payment reference is already recorded.']);
            }
            throw $exception;
        }

        if ($replacedPath) {
            Storage::disk('local')->delete($replacedPath);
        }

        WorkspaceNotifier::notifyAdmins(
            "{$actor->name} submitted a {$data['purpose']} payment reference for review.",
            '/dashboard/workspace?tab=payments',
        );

        return response()->json(['data' => ['id' => $id]], 201);
    }

    public function receipt(Request $request, int $id): StreamedResponse
    {
        $actor = $request->user();
        $payment = DB::table('programme_payments')->where('id', $id)->first(['payer_id', 'receipt_path', 'receipt_name']) ?? abort(404);
        abort_unless($actor->role === 'admin' || (int) $payment->payer_id === $actor->id, 403);
        abort_unless($payment->receipt_path && Storage::disk('local')->exists($payment->receipt_path), 404);

        return Storage::disk('local')->response($payment->receipt_path, $payment->receipt_name ?: 'payment-receipt', [
            'X-Content-Type-Options' => 'nosniff',
            'Cache-Control' => 'private, no-store',
        ]);
    }

    public function review(Request $request, int $id): JsonResponse
    {
        abort_unless($request->user()->role === 'admin', 403);
        $data = $request->validate([
            'decision' => ['required', Rule::in(['confirmed', 'declined'])],
            'note' => ['required_if:decision,declined', 'nullable', 'string', 'max:1500'],
        ]);
        $payment = DB::table('programme_payments')->where('id', $id)->where('status', 'pending')->first(['id', 'payer_id', 'purpose']);
        abort_unless($payment, 409, 'Choose a pending payment.');

        $recorded = DB::table('programme_payments')->where('id', $id)->where('status', 'pending')->update([
            'status' => $data['decision'], 'decision_note' => $data['note'] ?? null,
            'reviewer_id' => $request->user()->id, 'reviewed_at' => now(), 'updated_at' => now(),
        ]);
        abort_unless($recorded, 409, 'Choose a pending payment.');

        User::query()->find($payment->payer_id)?->notify(new WorkspaceAlert(
            $data['decision'] === 'confirmed'
                ? 'Your payment has been confirmed.'
                : 'Your payment could not be confirmed.'.(! empty($data['note']) ? ' Note: '.$data['note'] : ''),
            $payment->purpose === 'marketplace' ? '/dashboard/workspace?tab=products' : '/dashboard/certificates',
        ));

        return response()->json(['data' => ['id' => $id]]);
    }
}
