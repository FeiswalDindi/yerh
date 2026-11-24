<?php

namespace App\Http\Controllers;

use App\Domain\Engagement\Publishing;
use App\Support\WorkspaceNotifier;
use Illuminate\Database\Query\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Throwable;

final class OpportunityController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $admin = (bool) ($request->route()->defaults['admin'] ?? false);
        if ($admin) {
            abort_unless(in_array($request->user()->role, ['admin', 'content_manager'], true), 403);
        }
        $items = DB::table('engagement_opportunities')->when(! $admin, fn (Builder $query) => $query->where('status', 'published'))
            ->latest('updated_at')->get()->map($this->serialize(...));

        return response()->json(['data' => $items]);
    }

    public function show(string $slug): JsonResponse
    {
        $record = DB::table('engagement_opportunities')->where('slug', $slug)->where('status', 'published')->first() ?? abort(404);

        return response()->json(['data' => $this->serialize($record)]);
    }

    public function save(Request $request, ?int $id = null): JsonResponse
    {
        abort_unless(in_array($request->user()->role, ['admin', 'content_manager'], true), 403);
        $data = $request->validate([
            'title' => ['required', 'string', 'max:140'],
            'category' => ['required', 'string', 'max:80'],
            'organiser' => ['required', 'string', 'max:140'],
            'description' => ['required', 'string', 'max:5000'],
            'opens_at' => ['nullable', 'date_format:Y-m-d\TH:i'],
            'deadline' => ['nullable', 'date_format:Y-m-d\TH:i', 'after:opens_at'],
            'external_url' => ['nullable', 'url:http,https', 'max:500'],
            'status' => ['required', 'in:draft,published,closed'],
        ]);
        foreach (['opens_at', 'deadline'] as $date) {
            $data[$date] = Publishing::time($data[$date] ?? null);
        }
        $data['external_url'] ??= null;
        $data['updated_at'] = now();
        if ($id === null) {
            $id = DB::table('engagement_opportunities')->insertGetId($data + [
                'slug' => Publishing::slug($data['title'], 'opportunity'), 'created_at' => now(),
            ]);
        } else {
            DB::transaction(function () use ($id, $data) {
                $query = DB::table('engagement_opportunities')->where('id', $id);
                $existing = (clone $query)->lockForUpdate()->first() ?? abort(404);
                if (! $existing->external_url && ($data['external_url'] ?? null) && DB::table('opportunity_submissions')->where('opportunity_id', $id)->exists()) {
                    throw ValidationException::withMessages(['external_url' => 'An opportunity with applications cannot switch to external applications.']);
                }
                $query->update($data);
            });
        }

        return response()->json(['data' => ['id' => $id]]);
    }

    public function submissions(Request $request): JsonResponse
    {
        $user = $request->user();
        abort_unless(in_array($user->role, ['admin', 'entrepreneur'], true), 403);
        $applications = DB::table('opportunity_submissions as submission')
            ->join('engagement_opportunities as opportunity', 'opportunity.id', '=', 'submission.opportunity_id')
            ->join('ventures as venture', 'venture.id', '=', 'submission.venture_id')
            ->join('users as applicant', 'applicant.id', '=', 'submission.applicant_id')
            ->when($user->role !== 'admin', fn (Builder $query) => $query->where('applicant.id', $user->id))
            ->latest('submission.created_at')->get([
                'submission.*', 'opportunity.title as opportunity', 'opportunity.slug', 'venture.name as venture', 'applicant.name as applicant',
            ])->map(function ($row) {
                $row->has_attachment = ! empty($row->attachment_path);
                unset($row->attachment_path);

                return $row;
            });

        return response()->json(['data' => $applications])->header('Cache-Control', 'no-store');
    }

    public function apply(Request $request, string $slug): JsonResponse
    {
        abort_unless($request->user()->role === 'entrepreneur', 403);
        $data = $request->validate([
            'venture_id' => ['required', 'integer'],
            'motivation' => ['required', 'string', 'min:10', 'max:5000'],
            'attachment' => ['nullable', 'file', 'mimes:pdf,ppt,pptx,doc,docx,xls,xlsx,jpg,jpeg,png,webp', 'max:8192'],
        ]);

        $attachmentFile = $request->file('attachment');
        $storedPath = $attachmentFile?->store('opportunity-attachments', 'local');
        abort_if($storedPath === false, 500, 'Could not store the supporting attachment.');
        $storedName = $attachmentFile ? mb_substr($attachmentFile->getClientOriginalName(), 0, 180) : null;
        $replacedPath = null;

        try {
            [$id, $opportunityTitle, $ventureName] = DB::transaction(function () use ($request, $slug, $data, $storedPath, $storedName, &$replacedPath) {
                $opportunity = DB::table('engagement_opportunities')->where('slug', $slug)->where('status', 'published')->lockForUpdate()->first() ?? abort(404);
                abort_if(! $this->open($opportunity) || $opportunity->external_url, 409, 'Applications are closed for this opportunity.');
                $venture = DB::table('ventures')->where('owner_id', $request->user()->id)->where('status', 'approved')
                    ->find($data['venture_id']) ?? abort(404);
                $existing = DB::table('opportunity_submissions')->where('venture_id', $venture->id)
                    ->where('opportunity_id', $opportunity->id);
                $row = (clone $existing)->lockForUpdate()->first();
                abort_if($row && $row->status !== 'withdrawn', 409, 'This venture already has an application.');
                $fields = ['motivation' => $data['motivation'], 'status' => 'submitted', 'review_notes' => null, 'updated_at' => now()];
                if ($storedPath !== null) {
                    $fields['attachment_path'] = $storedPath;
                    $fields['attachment_name'] = $storedName;
                }
                if ($row) {
                    if ($storedPath !== null && $row->attachment_path) {
                        $replacedPath = $row->attachment_path;
                    }
                    $existing->update($fields);

                    return [$row->id, $opportunity->title, $venture->name];
                }

                $id = DB::table('opportunity_submissions')->insertGetId($fields + [
                    'applicant_id' => $request->user()->id, 'venture_id' => $venture->id, 'opportunity_id' => $opportunity->id, 'created_at' => now(),
                ]);

                return [$id, $opportunity->title, $venture->name];
            });
        } catch (Throwable $exception) {
            if ($storedPath) {
                Storage::disk('local')->delete($storedPath);
            }
            throw $exception;
        }

        if ($replacedPath) {
            Storage::disk('local')->delete($replacedPath);
        }

        WorkspaceNotifier::notifyAdmins(
            "{$ventureName} applied for opportunity: {$opportunityTitle}.",
            '/dashboard/opportunities?view=applications',
        );

        return response()->json(['data' => ['id' => $id]], 201);
    }

    public function attachment(Request $request, int $id): StreamedResponse
    {
        $user = $request->user();
        abort_unless(in_array($user->role, ['admin', 'entrepreneur'], true), 403);
        $submission = DB::table('opportunity_submissions')->where('id', $id)
            ->first(['applicant_id', 'attachment_path', 'attachment_name']) ?? abort(404);
        abort_unless($user->role === 'admin' || (int) $submission->applicant_id === $user->id, 403);
        abort_unless($submission->attachment_path && Storage::disk('local')->exists($submission->attachment_path), 404);

        return Storage::disk('local')->response($submission->attachment_path, $submission->attachment_name ?: 'opportunity-attachment', [
            'X-Content-Type-Options' => 'nosniff',
            'Cache-Control' => 'private, no-store',
        ]);
    }

    public function decide(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        abort_unless(in_array($user->role, ['admin', 'entrepreneur'], true), 403);
        $query = DB::table('opportunity_submissions')->where('id', $id)->whereIn('status', ['submitted', 'shortlisted']);
        if ($user->role === 'admin') {
            $data = $request->validate([
                'decision' => ['required', 'in:shortlisted,accepted,rejected'],
                'note' => ['required_if:decision,rejected', 'nullable', 'string', 'max:1500'],
            ]);
        } else {
            $query->where('applicant_id', $user->id);
            $data = $request->validate(['decision' => ['required', 'in:withdrawn']]);
        }
        $row = (clone $query)->first(['id', 'applicant_id', 'opportunity_id']);
        $changed = $query->update(['status' => $data['decision'], 'review_notes' => $data['note'] ?? null, 'updated_at' => now()]);
        abort_unless($changed && $row, 409, 'This application can no longer be updated.');

        if ($user->role === 'admin') {
            $title = DB::table('engagement_opportunities')->where('id', $row->opportunity_id)->value('title') ?? 'opportunity';
            $noteSuffix = ! empty($data['note']) ? ' Note: '.$data['note'] : '';
            WorkspaceNotifier::notifyUser(
                (int) $row->applicant_id,
                "Your application for {$title} is now {$data['decision']}.{$noteSuffix}",
                '/dashboard/opportunities?view=applications',
            );
        }

        return response()->json(['data' => ['saved' => true]]);
    }

    private function open(object $record): bool
    {
        $now = now('UTC')->format('Y-m-d H:i:s');

        return $record->status === 'published'
            && (! $record->opens_at || $record->opens_at <= $now) && (! $record->deadline || $record->deadline > $now);
    }

    private function serialize(object $record): array
    {
        return [
            ...((array) $record), 'open' => $this->open($record),
            'opens_at' => Publishing::time($record->opens_at, true), 'deadline' => Publishing::time($record->deadline, true),
        ];
    }
}
