<?php

namespace App\Http\Controllers;

use App\Domain\Engagement\Publishing;
use App\Support\WorkspaceNotifier;
use Closure;
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
        $user = $request->user();
        $isStaff = $user && in_array($user->role, ['admin', 'content_manager'], true);
        if ($admin) {
            abort_unless($isStaff, 403);
        }

        $bookedMap = $user
            ? array_flip(
                DB::table('event_bookings')
                    ->where('user_id', $user->id)
                    ->pluck('event_id')
                    ->all()
            )
            : [];

        $events = $this->events()
            ->when(! $admin, fn (Builder $query) => $query->where('event.status', 'published'))
            ->orderBy('event.starts_at')
            ->get()
            ->map(function (object $record) use ($admin, $isStaff, $bookedMap) {
                $booked = isset($bookedMap[$record->id]);

                return $this->serialize($record, $admin || $isStaff || $booked, $booked);
            });
        $categories = DB::table('event_categories')->orderBy('name')->get();

        return response()->json(['data' => compact('events', 'categories')]);
    }

    public function show(Request $request, string $slug): JsonResponse
    {
        $record = $this->events()->where('event.slug', $slug)->where('event.status', 'published')->first() ?? abort(404);
        $user = $request->user();
        $isStaff = $user && in_array($user->role, ['admin', 'content_manager'], true);
        $booked = $user && $this->bookings($record->id)->where('user_id', $user->id)->exists();

        return response()
            ->json(['data' => $this->serialize($record, $isStaff || $booked, $booked)])
            ->header('Cache-Control', 'no-store');
    }

    public function category(Request $request, ?int $id = null): JsonResponse
    {
        abort_unless(in_array($request->user()->role, ['admin', 'content_manager'], true), 403);
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
        abort_unless(in_array($request->user()->role, ['admin', 'content_manager'], true), 403);
        $data = $request->validate([
            'title' => ['required', 'string', 'max:140'],
            'summary' => ['required', 'string', 'max:5000'],
            'venue_type' => ['nullable', Rule::in(['physical', 'virtual'])],
            'venue' => ['nullable', 'string', 'max:160'],
            'meeting_link' => ['nullable', 'url:http,https', 'max:500'],
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
            'presenters.*.photo' => [
                'nullable',
                'string',
                'max:500',
                function (string $attribute, mixed $value, Closure $fail): void {
                    if ($value === null || trim((string) $value) === '') {
                        return;
                    }
                    $trimmed = trim((string) $value);
                    if (str_contains($trimmed, '..')) {
                        $fail('Presenter photo URL contains an invalid path.');

                        return;
                    }
                    if (preg_match('#^/(api/v1/cms/media/[A-Za-z0-9._-]+|media/[A-Za-z0-9._/-]+)$#', $trimmed) === 1) {
                        return;
                    }
                    $scheme = strtolower((string) parse_url($trimmed, PHP_URL_SCHEME));
                    if (! filter_var($trimmed, FILTER_VALIDATE_URL) || ! in_array($scheme, ['http', 'https'], true)) {
                        $fail('Enter a valid http(s) URL or upload a presenter photo.');
                    }
                },
            ],
        ]);

        $venueType = $data['venue_type'] ?? 'physical';
        $venue = trim((string) ($data['venue'] ?? ''));
        $meetingLink = isset($data['meeting_link']) && trim((string) $data['meeting_link']) !== ''
            ? trim((string) $data['meeting_link'])
            : null;

        if ($venueType === 'virtual') {
            if ($meetingLink === null) {
                throw ValidationException::withMessages([
                    'meeting_link' => 'Please enter a valid meeting link for virtual events.',
                ]);
            }
            if ($venue === '') {
                $venue = 'Virtual (Online)';
            }
        } else {
            if ($venue === '') {
                throw ValidationException::withMessages([
                    'venue' => 'Please enter a physical venue or location.',
                ]);
            }
            $meetingLink = null;
        }

        $data['venue_type'] = $venueType;
        $data['venue'] = $venue;
        $data['meeting_link'] = $meetingLink;

        foreach (['starts_at', 'ends_at', 'deadline'] as $date) {
            $data[$date] = Publishing::time($data[$date] ?? null);
        }
        $data['capacity'] ??= null;
        $presenters = array_map(static function (array $presenter): array {
            $photo = isset($presenter['photo']) ? trim((string) $presenter['photo']) : '';

            return [
                'name' => trim((string) $presenter['name']),
                'profession' => trim((string) $presenter['profession']),
                'role' => $presenter['role'],
                ...($photo !== '' ? ['photo' => $photo] : []),
            ];
        }, $data['presenters'] ?? []);
        $data['presenters'] = json_encode(array_values($presenters), JSON_THROW_ON_ERROR);
        $data['updated_at'] = now();

        $id = DB::transaction(function () use ($id, $data) {
            if ($id === null) {
                return DB::table('engagement_events')->insertGetId($data + [
                    'slug' => Publishing::slug($data['title'], 'event'),
                    'created_at' => now(),
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
        $user = $request->user();
        $cancel = $request->isMethod('delete');

        $result = DB::transaction(function () use ($user, $slug, $cancel) {
            $event = DB::table('engagement_events')->where('slug', $slug)->lockForUpdate()->first() ?? abort(404);
            $query = $this->bookings($event->id)->where('user_id', $user->id);

            if ($cancel) {
                $deleted = $query->delete() > 0;

                return ['changed' => $deleted, 'booked' => false, 'event' => $event];
            }

            abort_unless($event->status === 'published', 404);
            $now = now('UTC')->format('Y-m-d H:i:s');
            abort_if($event->starts_at <= $now || ($event->deadline && $event->deadline <= $now), 409, 'Registration is closed.');
            if ($query->exists()) {
                return ['changed' => false, 'booked' => true, 'event' => $event];
            }
            abort_if($event->capacity !== null && $this->bookings($event->id)->count() >= $event->capacity, 409, 'The event is full.');
            DB::table('event_bookings')->insert([
                'event_id' => $event->id,
                'user_id' => $user->id,
                'created_at' => now(),
            ]);

            return ['changed' => true, 'booked' => true, 'event' => $event];
        });

        if ($result['changed']) {
            $event = $result['event'];
            $startsEat = str_replace('T', ' ', (string) Publishing::time($event->starts_at, true)).' EAT';
            if ($result['booked']) {
                $locationNote = ($event->venue_type ?? 'physical') === 'virtual' && ! empty($event->meeting_link)
                    ? "Virtual meeting link: {$event->meeting_link}"
                    : "Venue: {$event->venue}";
                WorkspaceNotifier::notifyUser(
                    $user->id,
                    "Your spot is reserved for \"{$event->title}\" on {$startsEat}. {$locationNote}",
                    '/sessions/'.$event->slug,
                    "Spot confirmed: {$event->title}",
                    'View Event Details',
                );
            } else {
                WorkspaceNotifier::notifyUser(
                    $user->id,
                    "Your reservation for \"{$event->title}\" ({$startsEat}) has been cancelled.",
                    '/events',
                    "Event reservation cancelled: {$event->title}",
                    'Browse Events',
                );
            }
        }

        return response()->json(['data' => ['booked' => $result['booked']]]);
    }

    private function serialize(object $record, bool $exposeMeetingLink = false, bool $booked = false): array
    {
        $raw = (array) $record;
        $venueType = $record->venue_type ?? 'physical';
        $hasMeetingLink = ! empty($record->meeting_link);
        $raw['meeting_link'] = $exposeMeetingLink ? ($record->meeting_link ?? null) : null;

        return [
            ...$raw,
            'venue_type' => $venueType,
            'has_meeting_link' => $hasMeetingLink,
            'booked' => $booked,
            'presenters' => json_decode($record->presenters ?? '[]', true, flags: JSON_THROW_ON_ERROR),
            'starts_at' => Publishing::time($record->starts_at, true),
            'ends_at' => Publishing::time($record->ends_at, true),
            'deadline' => Publishing::time($record->deadline, true),
            'archived' => $record->ends_at <= now('UTC')->format('Y-m-d H:i:s'),
        ];
    }

    private function events(): Builder
    {
        return DB::table('engagement_events as event')
            ->join('event_categories as category', 'category.id', '=', 'event.category_id')
            ->select('event.*', 'category.name as category')
            ->selectSub(DB::table('event_bookings')->whereColumn('event_id', 'event.id')->selectRaw('count(*)'), 'bookings');
    }

    private function bookings(int $event): Builder
    {
        return DB::table('event_bookings')->where('event_id', $event);
    }
}
