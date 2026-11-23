<?php

namespace App\Http\Controllers;

use App\Domain\Engagement\Publishing;
use Illuminate\Database\Query\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

final class OpportunityController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $admin = (bool) ($request->route()->defaults['admin'] ?? false);
        if ($admin) {
            abort_unless($request->user()->role === 'admin', 403);
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
        abort_unless($request->user()->role === 'admin', 403);
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
            ]);

        return response()->json(['data' => $applications])->header('Cache-Control', 'no-store');
    }

    public function apply(Request $request, string $slug): JsonResponse
    {
        abort_unless($request->user()->role === 'entrepreneur', 403);
        $data = $request->validate(['venture_id' => ['required', 'integer'], 'motivation' => ['required', 'string', 'min:10', 'max:5000']]);
        $id = DB::transaction(function () use ($request, $slug, $data) {
            $opportunity = DB::table('engagement_opportunities')->where('slug', $slug)->where('status', 'published')->lockForUpdate()->first() ?? abort(404);
            abort_if(! $this->open($opportunity) || $opportunity->external_url, 409, 'Applications are closed for this opportunity.');
            $venture = DB::table('ventures')->where('owner_id', $request->user()->id)->where('status', 'approved')
                ->find($data['venture_id']) ?? abort(404);
            $existing = DB::table('opportunity_submissions')->where('venture_id', $venture->id)
                ->where('opportunity_id', $opportunity->id);
            $row = (clone $existing)->lockForUpdate()->first();
            abort_if($row && $row->status !== 'withdrawn', 409, 'This venture already has an application.');
            $fields = ['motivation' => $data['motivation'], 'status' => 'submitted', 'review_notes' => null, 'updated_at' => now()];
            if ($row) {
                $existing->update($fields);

                return $row->id;
            }

            return DB::table('opportunity_submissions')->insertGetId($fields + [
                'applicant_id' => $request->user()->id, 'venture_id' => $venture->id, 'opportunity_id' => $opportunity->id, 'created_at' => now(),
            ]);
        });

        return response()->json(['data' => ['id' => $id]], 201);
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
        $changed = $query->update(['status' => $data['decision'], 'review_notes' => $data['note'] ?? null, 'updated_at' => now()]);
        abort_unless($changed, 409, 'This application can no longer be updated.');

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
