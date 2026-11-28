<?php

namespace App\Http\Controllers;

use App\Domain\Incubation\Curriculum;
use App\Domain\Incubation\PathAccess;
use App\Domain\Incubation\ProgrammeFees;
use App\Models\User;
use App\Notifications\WorkspaceAlert;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class VentureCertificateController extends Controller
{
    public function __construct(
        private readonly PathAccess $access,
        private readonly Curriculum $curriculum,
        private readonly ProgrammeFees $fees,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $actor = $request->user();
        abort_unless(in_array($actor->role, ['entrepreneur', 'admin'], true), 403);
        $paths = $this->access->visible($actor)->whereNotNull('path.mentor_id')->latest('path.id')->get();
        $stages = DB::table('incubation_stages')->whereIn('path_id', $paths->pluck('id'))
            ->whereNotNull('graded_at')
            ->where(function ($query): void {
                $query->where('passed', true)
                    ->orWhere(function ($fallback): void {
                        $fallback->whereNull('passed')->where('score', '>=', Curriculum::PASS_MARK);
                    });
            })
            ->get(['path_id', 'stage'])->groupBy('path_id');
        $issued = DB::table('venture_credentials')->whereIn('path_id', $paths->pluck('id'))->get()->groupBy('path_id');
        $payments = DB::table('programme_payments')->whereIn('path_id', $paths->pluck('id'))->get()->groupBy('path_id');
        $fees = collect($this->fees->settings())->keyBy('purpose');
        $records = [];
        foreach ($paths as $path) {
            $completed = collect($stages->get($path->id))->pluck('stage')->all();
            $moodleGraduated = ! empty($path->moodle_completed_at) && ! empty($path->graduated_at);
            foreach (Curriculum::CREDENTIALS as $kind) {
                $eligibleByMoodle = $kind === 'venture' && $moodleGraduated;
                if (! $eligibleByMoodle && array_diff($this->curriculum->credentialStages($kind), $completed)) {
                    continue;
                }
                $credential = collect($issued->get($path->id))->firstWhere('kind', $kind);
                $payment = collect($payments->get($path->id))->firstWhere('purpose', $kind);
                $amount = $fees->get($kind)['amount'] ?? 0;
                $records[] = [
                    'path_id' => $path->id, 'kind' => $kind, 'venture' => $path->venture,
                    'recipient' => $path->owner, 'title' => $this->title($kind),
                    'fee' => $amount, 'payment_status' => $payment?->status, 'payment_note' => $payment?->decision_note,
                    'document_id' => $credential?->document_id,
                    'eligible' => $amount === 0 || $payment?->status === 'confirmed',
                ];
            }
        }

        return response()->json(['data' => $records]);
    }

    public function issue(Request $request, int $id, string $kind): JsonResponse
    {
        abort_unless($request->user()->role === 'admin', 403);
        [$document, $recipientId, $issued] = DB::transaction(function () use ($request, $id, $kind) {
            $path = $this->access->find($request->user(), $id, lock: true);
            abort_unless($this->access->completed($id, $this->curriculum->credentialStages($kind)), 409, 'Earlier required assessments must be passed first.');
            $existing = DB::table('venture_credentials')->where('path_id', $id)->where('kind', $kind)->first();
            if ($existing) {
                return [$existing->document_id, (int) $path->owner_id, false];
            }
            $paid = $this->fees->for($kind)['amount'] === 0 || DB::table('programme_payments')
                ->where('path_id', $id)->where('purpose', $kind)->where('status', 'confirmed')->exists();
            abort_unless($paid, 409, 'Confirm the certificate payment first.');
            $document = (string) Str::uuid();
            DB::table('venture_credentials')->insert([
                'document_id' => $document, 'path_id' => $id, 'kind' => $kind,
                'recipient_id' => $path->owner_id, 'issuer_id' => $request->user()->id, 'issued_at' => now(),
            ]);

            return [$document, (int) $path->owner_id, true];
        }, 3);

        if ($issued) {
            User::query()->find($recipientId)?->notify(new WorkspaceAlert(
                'Your '.$this->title($kind).' is ready to view.',
                '/dashboard/certificates',
            ));
        }

        return response()->json(['data' => ['document_id' => $document]], 201);
    }

    public function document(Request $request, string $document): Response
    {
        $actor = $request->user();
        $query = DB::table('venture_credentials as credential')->where('credential.document_id', $document)
            ->join('users as recipient', 'recipient.id', '=', 'credential.recipient_id')
            ->join('incubation_paths as path', 'path.id', '=', 'credential.path_id')
            ->join('ventures as venture', 'venture.id', '=', 'path.venture_id');
        if ($actor->role !== 'admin') {
            $query->where('credential.recipient_id', $actor->id);
        }
        $record = $query->first(['credential.*', 'recipient.name as recipient', 'venture.name as venture']) ?? abort(404);
        $stages = $record->kind === 'venture' ? Curriculum::STAGES : [$record->kind];
        $achievements = collect($this->curriculum->stages())->whereIn('id', $stages)->pluck('steps')->flatten(1)->pluck('title');

        return response()->view('venture-certificate', [
            'record' => $record,
            'title' => $this->title($record->kind),
            'achievements' => $achievements,
        ])->header('Cache-Control', 'private, no-store');
    }

    private function title(string $kind): string
    {
        return $kind === 'venture' ? 'Venture Incubation Certificate' : $this->curriculum->stage($kind)['title'].' Certificate';
    }
}
