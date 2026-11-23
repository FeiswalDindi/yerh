<?php

namespace App\Http\Controllers;

use App\Domain\Engagement\Publishing;
use Illuminate\Database\Query\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

final class EngagementEventController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $admin = (bool) ($request->route()->defaults['admin'] ?? false);
        if ($admin) {
            abort_unless($request->user()->role === 'admin', 403);
        }
        $events = $this->events()->when(! $admin, fn (Builder $query) => $query->where('event.status', 'published'))
            ->orderBy('event.starts_at')->get()->map($this->serialize(...));
        $categories = DB::table('event_categories')->orderBy('name')->get();

        return response()->json(['data' => compact('events', 'categories')]);
    }

    public function show(Request $request, string $slug): JsonResponse
    {
        $record = $this->events()->where('event.slug', $slug)->where('event.status', 'published')->first() ?? abort(404);
        $booked = $request->user() && $this->bookings($record->id)->where('user_id', $request->user()->id)->exists();

        return response()->json(['data' => $this->serialize($record) + ['booked' => $booked]])->header('Cache-Control', 'no-store');
    }

    public function category(Request $request, ?int $id = null): JsonResponse
    {
        abort_unless($request->user()->role === 'admin', 403);
        $unique = Rule::unique('event_categories');
        if ($id !== null) {
            abort_unless(DB::table('event_categories')->where('id', $id)->exists(), 404);
            $unique->ignore($id);
        }
        $data = $request->validate(['name' => ['required', 'string', 'max:80', $unique]]);
        if ($id === null) {
            $id = DB::table('event_categories')->insertGetId($data);
        } else {
            DB::table('event_categories')->where('id', $id)->update($data);
        }

        return response()->json(['data' => ['id' => $id]]);
    }

    public function save(Request $request, ?int $id = null): JsonResponse
    {
        abort_unless($request->user()->role === 'admin', 403);
        $data = $request->validate([
            'title' => ['required', 'string', 'max:140'],
            'summary' => ['required', 'string', 'max:5000'],
            'venue' => ['required', 'string', 'max:160'],
            'category_id' => ['required', 'integer', 'exists:event_categories,id'],
            'starts_at' => ['required', 'date_format:Y-m-d\TH:i'],
            'ends_at' => ['required', 'date_format:Y-m-d\TH:i', 'after:starts_at'],
            'deadline' => ['nullable', 'date_format:Y-m-d\TH:i', 'before_or_equal:starts_at'],
            'capacity' => ['nullable', 'integer', 'between:1,200000'],
            'status' => ['required', 'in:draft,published'],
            'presenters' => ['nullable', 'array', 'max:20'],
            'presenters.*.name' => ['required', 'string', 'max:100'],
            'presenters.*.profession' => ['required', 'string', 'max:100'],
            'presenters.*.role' => ['required', 'in:host,facilitator'],
            'presenters.*.photo' => ['nullable', 'url:http,https', 'max:500'],
        ]);
        foreach (['starts_at', 'ends_at', 'deadline'] as $date) {
            $data[$date] = Publishing::time($data[$date] ?? null);
        }
        $data['capacity'] ??= null;
        $data['presenters'] = json_encode(array_values($data['presenters'] ?? []), JSON_THROW_ON_ERROR);
        $data['updated_at'] = now();
        $id = DB::transaction(function () use ($id, $data) {
            if ($id === null) {
                return DB::table('engagement_events')->insertGetId($data + [
                    'slug' => Publishing::slug($data['title'], 'event'), 'created_at' => now(),
                ]);
            }
            $query = DB::table('engagement_events')->where('id', $id);
            abort_unless((clone $query)->lockForUpdate()->first(), 404);
            if ($data['capacity'] !== null && $this->bookings($id)->count() > $data['capacity']) {
                throw ValidationException::withMessages(['capacity' => 'Capacity cannot be lower than the number of current bookings.']);
            }
            $query->update($data);

            return $id;
        });

        return response()->json(['data' => ['id' => $id]]);
    }

    public function reserve(Request $request, string $slug): JsonResponse
    {
        abort_unless(in_array($request->user()->role, ['guest', 'entrepreneur'], true), 403);
        DB::transaction(function () use ($request, $slug) {
            $event = DB::table('engagement_events')->where('slug', $slug)->lockForUpdate()->first() ?? abort(404);
            $query = $this->bookings($event->id)->where('user_id', $request->user()->id);
            if ($request->isMethod('delete')) {
                $query->delete();

                return;
            }
            abort_unless($event->status === 'published', 404);
            $now = now('UTC')->format('Y-m-d H:i:s');
            abort_if($event->starts_at <= $now || ($event->deadline && $event->deadline <= $now), 409, 'Registration is closed.');
            if ($query->exists()) {
                return;
            }
            abort_if($event->capacity !== null && $this->bookings($event->id)->count() >= $event->capacity, 409, 'The event is full.');
            DB::table('event_bookings')->insert([
                'event_id' => $event->id, 'user_id' => $request->user()->id, 'created_at' => now(),
            ]);
        });

        return response()->json(['data' => ['booked' => ! $request->isMethod('delete')]]);
    }

    private function serialize(object $record): array
    {
        return [
            ...((array) $record), 'presenters' => json_decode($record->presenters ?? '[]', true, flags: JSON_THROW_ON_ERROR),
            'starts_at' => Publishing::time($record->starts_at, true),
            'ends_at' => Publishing::time($record->ends_at, true),
            'deadline' => Publishing::time($record->deadline, true),
            'archived' => $record->ends_at <= now('UTC')->format('Y-m-d H:i:s'),
        ];
    }

    private function events(): Builder
    {
        return DB::table('engagement_events as event')->join('event_categories as category', 'category.id', '=', 'event.category_id')
            ->select('event.*', 'category.name as category')
            ->selectSub(DB::table('event_bookings')->whereColumn('event_id', 'event.id')->selectRaw('count(*)'), 'bookings');
    }

    private function bookings(int $event): Builder
    {
        return DB::table('event_bookings')->where('event_id', $event);
    }
}
