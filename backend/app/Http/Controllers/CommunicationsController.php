<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Notifications\CommunicationEmail;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Throwable;

final class CommunicationsController extends Controller
{
    private const TEMPLATE_CATEGORIES = [
        'onboarding',
        'events',
        'incubation',
        'enquiries',
        'announcements',
        'requests',
        'general',
    ];

    public function audience(Request $request): JsonResponse
    {
        $this->authorize($request);
        $this->ensureStarterTemplates();

        $allUsers = $this->loadEnrichedAudience();
        $filters = $request->only([
            'search',
            'role',
            'institution_id',
            'verified',
            'status',
            'venture',
            'incubation',
            'event_id',
            'location',
        ]);
        $filtered = $this->applyAudienceFilters($allUsers, $filters);

        $institutions = DB::table('institutions')
            ->orderBy('name')
            ->get(['id', 'name', 'kind', 'status']);
        $events = DB::table('engagement_events')
            ->orderByDesc('starts_at')
            ->get(['id', 'title', 'starts_at', 'venue_type', 'status']);
        $locations = $allUsers
            ->pluck('location')
            ->filter(static fn ($loc) => is_string($loc) && trim($loc) !== '')
            ->map(static fn ($loc) => trim((string) $loc))
            ->unique()
            ->sort()
            ->values();

        return response()->json([
            'data' => [
                'users' => $filtered->values()->all(),
                'total_users' => $allUsers->count(),
                'filters' => [
                    'institutions' => $institutions,
                    'events' => $events,
                    'locations' => $locations,
                ],
                'stats' => [
                    'new_enquiries' => DB::table('contact_messages')->where('status', 'new')->count(),
                    'total_enquiries' => DB::table('contact_messages')->count(),
                    'total_users' => $allUsers->count(),
                    'verified_users' => $allUsers->whereNotNull('email_verified_at')->count(),
                    'templates' => DB::table('email_templates')->count(),
                    'dispatches' => DB::table('communication_dispatches')->count(),
                    'outbox_count' => DB::table('sent_emails')->count(),
                ],
                'mail_status' => [
                    'mailer' => (string) config('mail.default'),
                    'from_address' => (string) config('mail.from.address'),
                    'from_name' => (string) config('mail.from.name'),
                    'mail_notifications' => (bool) config('yerh.mail_notifications', true),
                    'live_delivery' => ! in_array((string) config('mail.default'), ['log', 'array'], true),
                ],
            ],
        ])->header('Cache-Control', 'private, no-store');
    }

    public function broadcast(Request $request): JsonResponse
    {
        $actor = $this->authorize($request);

        $data = $request->validate([
            'subject' => ['required', 'string', 'min:2', 'max:180'],
            'body' => ['required', 'string', 'min:2', 'max:8000'],
            'channel' => ['required', Rule::in(['both', 'email', 'notification'])],
            'selection_mode' => ['required', Rule::in(['selected', 'filtered', 'all'])],
            'user_ids' => ['nullable', 'array', 'max:5000'],
            'user_ids.*' => ['integer'],
            'filters' => ['nullable', 'array'],
            'template_id' => ['nullable', 'integer', 'exists:email_templates,id'],
            'action_label' => ['nullable', 'string', 'max:80'],
            'action_url' => ['nullable', 'string', 'max:300', $this->actionUrlRule()],
        ]);

        $allUsers = $this->loadEnrichedAudience();
        $mode = $data['selection_mode'];
        $filters = is_array($data['filters'] ?? null) ? $data['filters'] : [];

        if ($mode === 'selected') {
            $wantedIds = array_map('intval', $data['user_ids'] ?? []);
            if ($wantedIds === []) {
                throw ValidationException::withMessages([
                    'user_ids' => 'Select at least one recipient before sending.',
                ]);
            }
            $lookup = array_flip($wantedIds);
            $recipients = $allUsers->filter(static fn (array $row) => isset($lookup[$row['id']]))->values();
        } elseif ($mode === 'filtered') {
            $recipients = $this->applyAudienceFilters($allUsers, $filters);
            if (! isset($filters['status']) || $filters['status'] === 'all' || $filters['status'] === '') {
                $recipients = $recipients->filter(static fn (array $row) => ! $row['suspended_at'])->values();
            }
        } else {
            $recipients = $allUsers->filter(static fn (array $row) => ! $row['suspended_at'])->values();
        }

        if ($recipients->isEmpty()) {
            throw ValidationException::withMessages([
                'user_ids' => 'No matching active recipients found for this broadcast.',
            ]);
        }

        $channel = $data['channel'];
        $templateRow = ! empty($data['template_id'])
            ? DB::table('email_templates')->where('id', $data['template_id'])->first(['action_label', 'action_url'])
            : null;
        $rawActionUrl = trim((string) ($data['action_url'] ?? '')) !== ''
            ? trim((string) $data['action_url'])
            : trim((string) ($templateRow->action_url ?? ''));
        $actionUrl = $rawActionUrl !== '' ? $rawActionUrl : null;
        $rawActionLabel = trim((string) ($data['action_label'] ?? '')) !== ''
            ? trim((string) $data['action_label'])
            : trim((string) ($templateRow->action_label ?? ''));
        $actionLabel = $actionUrl ? ($rawActionLabel !== '' ? $rawActionLabel : 'Open YERH') : null;

        $dispatchId = DB::table('communication_dispatches')->insertGetId([
            'kind' => 'broadcast',
            'subject' => trim($data['subject']),
            'body' => trim($data['body']),
            'channel' => $channel,
            'template_id' => $data['template_id'] ?? null,
            'recipient_count' => $recipients->count(),
            'sent_count' => 0,
            'failed_count' => 0,
            'filter_summary' => json_encode([
                'mode' => $mode,
                'filters' => $filters,
            ], JSON_THROW_ON_ERROR),
            'sent_by' => $actor->id,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $userModels = User::query()
            ->whereIn('id', $recipients->pluck('id')->all())
            ->get()
            ->keyBy('id');

        $sentCount = 0;
        $failedCount = 0;
        $replyTo = (string) config('mail.from.address');

        foreach ($recipients as $recipient) {
            /** @var User|null $model */
            $model = $userModels->get($recipient['id']);
            if (! $model) {
                $failedCount++;
                DB::table('communication_recipients')->insert([
                    'dispatch_id' => $dispatchId,
                    'user_id' => null,
                    'email' => $recipient['email'],
                    'name' => $recipient['name'],
                    'status' => 'failed',
                    'error_message' => 'User account not found.',
                    'created_at' => now(),
                ]);
                continue;
            }

            $vars = [
                'name' => $recipient['name'],
                'first_name' => Str::before($recipient['name'], ' ') ?: $recipient['name'],
                'email' => $recipient['email'],
                'role' => $this->roleLabel($recipient['role']),
                'institution' => $recipient['institution_name'] ?: 'Independent',
                'platform_name' => 'Youth Entrepreneurship Resource Hub',
            ];

            $subject = $this->interpolate($data['subject'], $vars);
            $body = $this->interpolate($data['body'], $vars);

            try {
                $model->notify(new CommunicationEmail(
                    subject: $subject,
                    body: $body,
                    channel: $channel,
                    actionLabel: $actionLabel,
                    actionUrl: $actionUrl,
                    replyTo: $replyTo ?: null,
                    recipientName: $recipient['name'],
                ));

                $sentCount++;
                DB::table('communication_recipients')->insert([
                    'dispatch_id' => $dispatchId,
                    'user_id' => $model->id,
                    'email' => $model->email,
                    'name' => $model->name,
                    'status' => $channel === 'notification' ? 'notified' : 'sent',
                    'error_message' => null,
                    'created_at' => now(),
                ]);
            } catch (Throwable $exception) {
                Log::warning('Broadcast recipient delivery failed', [
                    'dispatch_id' => $dispatchId,
                    'user_id' => $model->id,
                    'error' => $exception->getMessage(),
                ]);

                // If both channels were requested and SMTP failed, try database notification alone so user still gets an alert.
                if ($channel === 'both') {
                    try {
                        $model->notify(new CommunicationEmail(
                            subject: $subject,
                            body: $body,
                            channel: 'notification',
                            actionLabel: $actionLabel,
                            actionUrl: $actionUrl,
                            recipientName: $recipient['name'],
                        ));
                    } catch (Throwable) {
                        // Ignore secondary alert failure
                    }
                }

                $failedCount++;
                DB::table('communication_recipients')->insert([
                    'dispatch_id' => $dispatchId,
                    'user_id' => $model->id,
                    'email' => $model->email,
                    'name' => $model->name,
                    'status' => 'failed',
                    'error_message' => Str::limit($exception->getMessage(), 280),
                    'created_at' => now(),
                ]);
            }
        }

        DB::table('communication_dispatches')->where('id', $dispatchId)->update([
            'sent_count' => $sentCount,
            'failed_count' => $failedCount,
            'updated_at' => now(),
        ]);

        return response()->json([
            'data' => [
                'dispatch_id' => $dispatchId,
                'recipient_count' => $recipients->count(),
                'sent_count' => $sentCount,
                'failed_count' => $failedCount,
                'channel' => $channel,
            ],
        ], 201);
    }

    public function replyToEnquiry(Request $request, int $id): JsonResponse
    {
        $actor = $this->authorize($request);
        $enquiry = DB::table('contact_messages')->where('id', $id)->first() ?? abort(404);

        $data = $request->validate([
            'subject' => ['required', 'string', 'min:2', 'max:180'],
            'body' => ['required', 'string', 'min:2', 'max:8000'],
            'template_id' => ['nullable', 'integer', 'exists:email_templates,id'],
            'mark_status' => ['nullable', Rule::in(['read', 'resolved'])],
            'admin_notes' => ['nullable', 'string', 'max:2000'],
        ]);

        $vars = [
            'name' => $enquiry->name,
            'first_name' => Str::before($enquiry->name, ' ') ?: $enquiry->name,
            'email' => $enquiry->email,
            'topic' => $enquiry->topic,
            'role' => 'Member',
            'institution' => 'YERH Community',
            'platform_name' => 'Youth Entrepreneurship Resource Hub',
        ];

        $subject = $this->interpolate($data['subject'], $vars);
        $body = $this->interpolate($data['body'], $vars);

        $dispatchId = DB::table('communication_dispatches')->insertGetId([
            'kind' => 'enquiry_reply',
            'subject' => $subject,
            'body' => $body,
            'channel' => 'email',
            'template_id' => $data['template_id'] ?? null,
            'contact_message_id' => $enquiry->id,
            'recipient_count' => 1,
            'sent_count' => 0,
            'failed_count' => 0,
            'filter_summary' => json_encode(['enquiry_id' => $enquiry->id, 'topic' => $enquiry->topic], JSON_THROW_ON_ERROR),
            'sent_by' => $actor->id,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $delivered = false;
        $errorMessage = null;
        $replyTemplate = ! empty($data['template_id'])
            ? DB::table('email_templates')->where('id', $data['template_id'])->first(['action_label', 'action_url'])
            : null;
        $replyActionUrl = trim((string) ($replyTemplate->action_url ?? '')) ?: '/';
        $replyActionLabel = trim((string) ($replyTemplate->action_label ?? '')) ?: 'Visit YERH';

        try {
            Notification::route('mail', $enquiry->email)->notify(new CommunicationEmail(
                subject: $subject,
                body: $body,
                channel: 'email',
                actionLabel: $replyActionLabel,
                actionUrl: $replyActionUrl,
                replyTo: (string) config('mail.from.address'),
                recipientName: $enquiry->name,
            ));

            $matchingUser = User::query()
                ->whereRaw('LOWER(email) = ?', [Str::lower($enquiry->email)])
                ->whereNull('suspended_at')
                ->whereNotNull('email_verified_at')
                ->first();
            if ($matchingUser) {
                $matchingUser->notify(new CommunicationEmail(
                    subject: $subject,
                    body: $body,
                    channel: 'notification',
                    actionLabel: 'Open YERH',
                    actionUrl: '/account/notifications',
                    recipientName: $matchingUser->name,
                ));
            }

            $delivered = true;
        } catch (Throwable $exception) {
            $errorMessage = Str::limit($exception->getMessage(), 280);
            Log::warning('Enquiry reply email delivery failed', [
                'enquiry_id' => $enquiry->id,
                'email' => $enquiry->email,
                'error' => $exception->getMessage(),
            ]);
        }

        DB::table('communication_recipients')->insert([
            'dispatch_id' => $dispatchId,
            'user_id' => null,
            'email' => $enquiry->email,
            'name' => $enquiry->name,
            'status' => $delivered ? 'sent' : 'failed',
            'error_message' => $errorMessage,
            'created_at' => now(),
        ]);

        DB::table('communication_dispatches')->where('id', $dispatchId)->update([
            'sent_count' => $delivered ? 1 : 0,
            'failed_count' => $delivered ? 0 : 1,
            'updated_at' => now(),
        ]);

        if (! $delivered) {
            return response()->json([
                'message' => 'Could not send email reply: '.($errorMessage ?: 'Mail transport failed.'),
                'data' => ['dispatch_id' => $dispatchId, 'sent' => false],
            ], 502);
        }

        $nextStatus = $data['mark_status'] ?? 'resolved';
        $notes = $request->exists('admin_notes')
            ? (isset($data['admin_notes']) && trim((string) $data['admin_notes']) !== '' ? trim((string) $data['admin_notes']) : null)
            : $enquiry->admin_notes;

        DB::table('contact_messages')->where('id', $enquiry->id)->update([
            'status' => $nextStatus,
            'admin_notes' => $notes,
            'handled_by' => $actor->id,
            'handled_at' => now(),
            'replied_at' => now(),
            'reply_count' => ((int) ($enquiry->reply_count ?? 0)) + 1,
            'updated_at' => now(),
        ]);

        return response()->json([
            'data' => [
                'dispatch_id' => $dispatchId,
                'sent' => true,
                'status' => $nextStatus,
            ],
        ], 201);
    }

    public function templates(Request $request): JsonResponse
    {
        $this->authorize($request);
        $this->ensureStarterTemplates();

        $rows = DB::table('email_templates as tpl')
            ->leftJoin('users as author', 'author.id', '=', 'tpl.updated_by')
            ->select(
                'tpl.id',
                'tpl.name',
                'tpl.category',
                'tpl.subject',
                'tpl.body',
                'tpl.action_label',
                'tpl.action_url',
                'tpl.is_system',
                'author.name as updated_by_name',
                'tpl.updated_at',
                'tpl.created_at',
            )
            ->orderBy('tpl.category')
            ->orderBy('tpl.name')
            ->get();

        return response()->json(['data' => $rows])->header('Cache-Control', 'private, no-store');
    }

    public function saveTemplate(Request $request, ?int $id = null): JsonResponse
    {
        $actor = $this->authorize($request);

        $data = $request->validate([
            'name' => ['required', 'string', 'min:2', 'max:120'],
            'category' => ['required', Rule::in(self::TEMPLATE_CATEGORIES)],
            'subject' => ['required', 'string', 'min:2', 'max:180'],
            'body' => ['required', 'string', 'min:2', 'max:8000'],
            'action_label' => ['nullable', 'string', 'max:80'],
            'action_url' => ['nullable', 'string', 'max:300', $this->actionUrlRule()],
        ]);

        $actionUrl = isset($data['action_url']) && trim((string) $data['action_url']) !== ''
            ? trim((string) $data['action_url'])
            : null;
        $actionLabel = $actionUrl
            ? (isset($data['action_label']) && trim((string) $data['action_label']) !== ''
                ? trim((string) $data['action_label'])
                : 'Open YERH')
            : null;

        $payload = [
            'name' => trim($data['name']),
            'category' => $data['category'],
            'subject' => trim($data['subject']),
            'body' => trim($data['body']),
            'action_label' => $actionLabel,
            'action_url' => $actionUrl,
            'updated_by' => $actor->id,
            'updated_at' => now(),
        ];

        if ($id === null) {
            $id = DB::table('email_templates')->insertGetId($payload + [
                'is_system' => false,
                'created_by' => $actor->id,
                'created_at' => now(),
            ]);
            $status = 201;
        } else {
            abort_unless(DB::table('email_templates')->where('id', $id)->exists(), 404);
            DB::table('email_templates')->where('id', $id)->update($payload);
            $status = 200;
        }

        $template = DB::table('email_templates')->where('id', $id)->first();

        return response()->json(['data' => $template], $status);
    }

    public function deleteTemplate(Request $request, int $id): JsonResponse
    {
        $this->authorize($request);
        $deleted = DB::table('email_templates')->where('id', $id)->delete();
        abort_unless($deleted > 0, 404);

        return response()->json(['data' => ['id' => $id, 'deleted' => true]]);
    }

    public function history(Request $request): JsonResponse
    {
        $this->authorize($request);

        $rows = DB::table('communication_dispatches as dispatch')
            ->leftJoin('users as sender', 'sender.id', '=', 'dispatch.sent_by')
            ->leftJoin('email_templates as tpl', 'tpl.id', '=', 'dispatch.template_id')
            ->leftJoin('contact_messages as msg', 'msg.id', '=', 'dispatch.contact_message_id')
            ->select(
                'dispatch.id',
                'dispatch.kind',
                'dispatch.subject',
                'dispatch.body',
                'dispatch.channel',
                'dispatch.recipient_count',
                'dispatch.sent_count',
                'dispatch.failed_count',
                'dispatch.filter_summary',
                'dispatch.created_at',
                'sender.name as sender_name',
                'tpl.name as template_name',
                'msg.name as enquiry_name',
                'msg.email as enquiry_email',
                'msg.topic as enquiry_topic',
            )
            ->orderByDesc('dispatch.id')
            ->limit(100)
            ->get()
            ->map(static function (object $row): array {
                $item = (array) $row;
                $item['filter_summary'] = $row->filter_summary
                    ? json_decode($row->filter_summary, true, flags: JSON_THROW_ON_ERROR)
                    : null;

                return $item;
            });

        return response()->json(['data' => $rows])->header('Cache-Control', 'private, no-store');
    }

    public function dispatchDetail(Request $request, int $id): JsonResponse
    {
        $this->authorize($request);
        $dispatch = DB::table('communication_dispatches as dispatch')
            ->leftJoin('users as sender', 'sender.id', '=', 'dispatch.sent_by')
            ->select('dispatch.*', 'sender.name as sender_name')
            ->where('dispatch.id', $id)
            ->first() ?? abort(404);

        $recipients = DB::table('communication_recipients')
            ->where('dispatch_id', $id)
            ->orderBy('name')
            ->get(['id', 'user_id', 'name', 'email', 'status', 'error_message', 'created_at']);

        return response()->json([
            'data' => [
                'dispatch' => $dispatch,
                'recipients' => $recipients,
            ],
        ])->header('Cache-Control', 'private, no-store');
    }

    public function outbox(Request $request): JsonResponse
    {
        $this->authorize($request);

        $rows = DB::table('sent_emails')
            ->orderByDesc('id')
            ->limit(200)
            ->get(['id', 'to_email', 'to_name', 'from_email', 'subject', 'html_body', 'text_body', 'mailer', 'created_at'])
            ->map(static function (object $row): array {
                $plain = trim((string) ($row->text_body ?: strip_tags((string) ($row->html_body ?? ''))));

                return [
                    'id' => (int) $row->id,
                    'to_email' => $row->to_email,
                    'to_name' => $row->to_name,
                    'from_email' => $row->from_email,
                    'subject' => $row->subject,
                    'text_preview' => Str::limit((string) preg_replace('/\s+/', ' ', $plain), 140),
                    'has_html' => ! empty($row->html_body),
                    'mailer' => $row->mailer,
                    'created_at' => $row->created_at,
                ];
            });

        return response()->json(['data' => $rows])->header('Cache-Control', 'private, no-store');
    }

    public function outboxDetail(Request $request, int $id): JsonResponse
    {
        $this->authorize($request);
        $email = DB::table('sent_emails')->where('id', $id)->first() ?? abort(404);

        return response()->json(['data' => $email])->header('Cache-Control', 'private, no-store');
    }

    private function actionUrlRule(): \Closure
    {
        return static function (string $attribute, mixed $value, \Closure $fail): void {
            if ($value === null || trim((string) $value) === '') {
                return;
            }
            $url = trim((string) $value);
            if (str_starts_with($url, '/') && ! str_starts_with($url, '//')) {
                return;
            }
            $scheme = strtolower((string) parse_url($url, PHP_URL_SCHEME));
            if (! filter_var($url, FILTER_VALIDATE_URL) || ! in_array($scheme, ['http', 'https'], true)) {
                $fail('Button link must be a site path (like /events) or an http(s) URL.');
            }
        };
    }

    private function authorize(Request $request): User
    {
        $user = $request->user();
        abort_unless($user && in_array($user->role, ['admin', 'content_manager'], true), 403);

        return $user;
    }

    /**
     * @return Collection<int, array<string, mixed>>
     */
    private function loadEnrichedAudience(): Collection
    {
        $users = DB::table('users')
            ->orderBy('name')
            ->get([
                'id',
                'name',
                'email',
                'role',
                'location',
                'headline',
                'email_verified_at',
                'suspended_at',
                'created_at',
            ]);

        $memberships = DB::table('institution_memberships as m')
            ->join('institutions as i', 'i.id', '=', 'm.institution_id')
            ->get(['m.user_id', 'i.id as institution_id', 'i.name as institution_name'])
            ->keyBy('user_id');

        $staffAccess = DB::table('institution_access as a')
            ->join('institutions as i', 'i.id', '=', 'a.institution_id')
            ->get(['a.user_id', 'i.id as institution_id', 'i.name as institution_name'])
            ->keyBy('user_id');

        $venturesByOwner = DB::table('ventures')
            ->get(['id', 'owner_id', 'name', 'status'])
            ->groupBy('owner_id');

        $incubationByVenture = DB::table('incubation_paths')
            ->get(['venture_id', 'graduated_at'])
            ->groupBy('venture_id');

        $bookingsByUser = DB::table('event_bookings')
            ->get(['user_id', 'event_id'])
            ->groupBy('user_id');

        $enrolmentsByUser = DB::table('learning_enrolments')
            ->select('learner_id', DB::raw('count(*) as total'))
            ->groupBy('learner_id')
            ->pluck('total', 'learner_id');

        return $users->map(function (object $user) use (
            $memberships,
            $staffAccess,
            $venturesByOwner,
            $incubationByVenture,
            $bookingsByUser,
            $enrolmentsByUser,
        ): array {
            $affiliation = $memberships->get($user->id) ?? $staffAccess->get($user->id);
            $userVentures = $venturesByOwner->get($user->id) ?? collect();

            $ventureStatus = 'none';
            if ($userVentures->contains(static fn ($v) => $v->status === 'approved')) {
                $ventureStatus = 'approved';
            } elseif ($userVentures->contains(static fn ($v) => $v->status === 'pending')) {
                $ventureStatus = 'pending';
            } elseif ($userVentures->contains(static fn ($v) => $v->status === 'rejected')) {
                $ventureStatus = 'rejected';
            }

            $incubationStatus = 'none';
            foreach ($userVentures as $v) {
                $paths = $incubationByVenture->get($v->id) ?? collect();
                if ($paths->contains(static fn ($p) => $p->graduated_at !== null)) {
                    $incubationStatus = 'graduated';
                    break;
                }
                if ($paths->isNotEmpty()) {
                    $incubationStatus = 'active';
                }
            }

            $eventIds = ($bookingsByUser->get($user->id) ?? collect())
                ->pluck('event_id')
                ->map(static fn ($id) => (int) $id)
                ->values()
                ->all();

            return [
                'id' => (int) $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'role' => $user->role,
                'location' => $user->location,
                'headline' => $user->headline,
                'email_verified_at' => $user->email_verified_at,
                'suspended_at' => $user->suspended_at,
                'created_at' => $user->created_at,
                'institution_id' => $affiliation ? (int) $affiliation->institution_id : null,
                'institution_name' => $affiliation?->institution_name,
                'venture_count' => $userVentures->count(),
                'venture_status' => $ventureStatus,
                'venture_names' => $userVentures->pluck('name')->values()->all(),
                'incubation_status' => $incubationStatus,
                'event_ids' => $eventIds,
                'course_count' => (int) ($enrolmentsByUser[$user->id] ?? 0),
            ];
        });
    }

    /**
     * @param  Collection<int, array<string, mixed>>  $users
     * @param  array<string, mixed>  $filters
     * @return Collection<int, array<string, mixed>>
     */
    private function applyAudienceFilters(Collection $users, array $filters): Collection
    {
        $search = Str::lower(trim((string) ($filters['search'] ?? '')));
        $role = trim((string) ($filters['role'] ?? ''));
        $institutionId = trim((string) ($filters['institution_id'] ?? ''));
        $verified = trim((string) ($filters['verified'] ?? ''));
        $status = trim((string) ($filters['status'] ?? ''));
        $venture = trim((string) ($filters['venture'] ?? ''));
        $incubation = trim((string) ($filters['incubation'] ?? ''));
        $eventId = trim((string) ($filters['event_id'] ?? ''));
        $location = Str::lower(trim((string) ($filters['location'] ?? '')));

        return $users->filter(function (array $row) use (
            $search,
            $role,
            $institutionId,
            $verified,
            $status,
            $venture,
            $incubation,
            $eventId,
            $location,
        ): bool {
            if ($search !== '') {
                $haystack = Str::lower(implode(' ', array_filter([
                    $row['name'],
                    $row['email'],
                    $row['headline'],
                    $row['location'],
                    $row['institution_name'],
                    ...($row['venture_names'] ?? []),
                ])));
                if (! str_contains($haystack, $search)) {
                    return false;
                }
            }

            if ($role !== '' && $role !== 'all' && $row['role'] !== $role) {
                return false;
            }

            if ($institutionId !== '' && $institutionId !== 'all') {
                if ($institutionId === 'none') {
                    if ($row['institution_id'] !== null) {
                        return false;
                    }
                } elseif ((string) $row['institution_id'] !== $institutionId) {
                    return false;
                }
            }

            if ($verified === 'verified' && ! $row['email_verified_at']) {
                return false;
            }
            if ($verified === 'unverified' && $row['email_verified_at']) {
                return false;
            }

            if ($status === 'active' && $row['suspended_at']) {
                return false;
            }
            if ($status === 'suspended' && ! $row['suspended_at']) {
                return false;
            }

            if ($venture !== '' && $venture !== 'all') {
                if ($venture === 'any' && $row['venture_count'] === 0) {
                    return false;
                }
                if ($venture !== 'any' && $row['venture_status'] !== $venture) {
                    return false;
                }
            }

            if ($incubation !== '' && $incubation !== 'all') {
                if ($incubation === 'any' && $row['incubation_status'] === 'none') {
                    return false;
                }
                if ($incubation !== 'any' && $row['incubation_status'] !== $incubation) {
                    return false;
                }
            }

            if ($eventId !== '' && $eventId !== 'all') {
                if (! in_array((int) $eventId, $row['event_ids'], true)) {
                    return false;
                }
            }

            if ($location !== '' && $location !== 'all') {
                if (Str::lower(trim((string) ($row['location'] ?? ''))) !== $location) {
                    return false;
                }
            }

            return true;
        })->values();
    }

    /**
     * @param  array<string, string>  $vars
     */
    private function interpolate(string $template, array $vars): string
    {
        return (string) preg_replace_callback('/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/', static function (array $matches) use ($vars): string {
            $key = Str::lower($matches[1]);

            return $vars[$key] ?? $matches[0];
        }, $template);
    }

    private function roleLabel(string $role): string
    {
        return match ($role) {
            'admin' => 'Platform Administrator',
            'content_manager' => 'Content Manager',
            'school_admin' => 'Institutional Administrator',
            'entrepreneur' => 'Youth Entrepreneur',
            'mentor' => 'Mentor',
            default => ucwords(str_replace('_', ' ', $role)),
        };
    }

    private function ensureStarterTemplates(): void
    {
        if (DB::table('email_templates')->count() > 0) {
            return;
        }

        $now = now();
        DB::table('email_templates')->insert([
            [
                'name' => 'Welcome & Platform Orientation',
                'category' => 'onboarding',
                'subject' => 'Welcome to {{platform_name}}, {{first_name}}!',
                'body' => "Hello {{first_name}},\n\nWelcome to {{platform_name}}! Your {{role}} profile under {{institution}} is active.\n\nLog in to explore entrepreneurship courses, mentor support, upcoming events, and verified venture opportunities.",
                'action_label' => 'Open Your Dashboard',
                'action_url' => '/dashboard',
                'is_system' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'name' => 'Upcoming Event Invitation',
                'category' => 'events',
                'subject' => 'You are invited: upcoming live YERH entrepreneurship session',
                'body' => "Hi {{first_name}},\n\nWe have an upcoming entrepreneurship session open for registration.\n\nSpots are limited. Visit Events to view full details, meet the hosts, and reserve your spot today.",
                'action_label' => 'View Upcoming Events',
                'action_url' => '/events',
                'is_system' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'name' => 'Incubation Stage Check-In',
                'category' => 'incubation',
                'subject' => 'Action requested: continue your YERH incubation milestone',
                'body' => "Hi {{first_name}},\n\nWe noticed your venture journey is underway at {{institution}}. Please upload your next stage evidence and request a mentor review so we can unlock your upcoming assessment.",
                'action_label' => 'Open Incubation Pathway',
                'action_url' => '/dashboard/workspace?tab=incubation',
                'is_system' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'name' => 'Document or Profile Request',
                'category' => 'requests',
                'subject' => 'Information requested for your YERH account ({{name}})',
                'body' => "Hello {{first_name}},\n\nOur team is reviewing your recent request on {{platform_name}} and needs an update from you.\n\nPlease sign in to your account profile or reply directly to this email with any supporting details.",
                'action_label' => 'Update Your Profile',
                'action_url' => '/dashboard/profile',
                'is_system' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'name' => 'Enquiry Follow-Up Reply',
                'category' => 'enquiries',
                'subject' => 'Re: Your {{platform_name}} enquiry',
                'body' => "Hello {{first_name}},\n\nThank you for reaching out to us regarding \"{{topic}}\".\n\n[Write your tailored response here before sending.]\n\nPlease reply to this email or contact us if you need any further assistance.",
                'action_label' => 'Contact Us',
                'action_url' => '/contact',
                'is_system' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'name' => 'New Funding & Growth Opportunity Alert',
                'category' => 'announcements',
                'subject' => 'New grant & support opportunity now open on YERH',
                'body' => "Hi {{first_name}},\n\nA new venture funding and support opportunity has just been published on {{platform_name}}.\n\nCheck eligibility guidelines and submit your venture application before the closing deadline.",
                'action_label' => 'Explore Opportunities',
                'action_url' => '/opportunities',
                'is_system' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ],
        ]);
    }
}
