<?php

namespace App\Http\Controllers;

use App\Domain\Identity\AffiliationResolver;
use App\Models\User;
use App\Notifications\WorkspaceAlert;
use App\Support\WorkspaceNotifier;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Throwable;

final class AffiliationApplicationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $actor = $request->user();
        $institutionSlug = $request->validate([
            'institution' => ['nullable', 'string', 'max:120'],
        ])['institution'] ?? null;

        $query = DB::table('affiliation_applications as application')
            ->join('institutions as institution', 'application.institution_id', '=', 'institution.id')
            ->join('users as applicant', 'application.user_id', '=', 'applicant.id')
            ->select(
                'application.id',
                'application.status',
                'application.details',
                'application.document_path',
                'application.document_name',
                'application.location',
                'application.decision_note',
                'institution.name as institution',
                'institution.slug as institution_slug',
                'applicant.name as applicant',
                'applicant.email as applicant_email',
            )
            ->orderByDesc('application.id');

        if ($actor->role === 'admin') {
            if ($institutionSlug) {
                $query->where('institution.slug', $institutionSlug);
            }
        } else {
            $managedInstitutions = DB::table('institution_access as access')
                ->join('institutions as inst', 'inst.id', '=', 'access.institution_id')
                ->where('access.user_id', $actor->id)
                ->where('inst.status', 'active')
                ->whereIn('inst.kind', ['university', 'hub'])
                ->pluck('inst.id');

            if ($managedInstitutions->isNotEmpty()) {
                $query->whereIn('application.institution_id', $managedInstitutions);
                if ($institutionSlug) {
                    $query->where('institution.slug', $institutionSlug);
                }
            } else {
                $query->where('application.user_id', $actor->id);
            }
        }

        $rows = $query->get()->map(function ($row) {
            $row->has_document = ! empty($row->document_path);
            unset($row->document_path);

            return $row;
        });

        return response()->json(['data' => $rows])->header('Cache-Control', 'no-store');
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'institution' => ['required', 'string', 'max:120'],
            'location' => ['required', 'string', 'max:120'],
            'details' => ['nullable', 'string', 'max:2000'],
            'document' => ['nullable', 'file', 'mimes:pdf,jpeg,jpg,png,webp', 'max:5120'],
            'consent' => ['accepted'],
        ]);

        $documentFile = $request->file('document');
        $storedPath = $documentFile?->store('affiliation-documents', 'local');
        abort_if($storedPath === false, 500, 'Could not store your institutional verification document.');
        $documentName = $documentFile ? mb_substr($documentFile->getClientOriginalName(), 0, 180) : null;
        $detailsText = trim((string) ($data['details'] ?? ''));

        try {
            $outcome = DB::transaction(function () use ($request, $data, $storedPath, $documentName, $detailsText) {
                $actor = User::query()->lockForUpdate()->findOrFail($request->user()->id);
                abort_unless($actor->role === 'guest' && $actor->isActive() && $actor->hasVerifiedEmail(), 403);
                $institution = DB::table('institutions')->where('slug', $data['institution'])
                    ->where('status', 'active')->whereIn('kind', ['university', 'hub'])->first();
                if (! $institution) {
                    throw ValidationException::withMessages(['institution' => 'Choose an active university or hub.']);
                }
                if (DB::table('affiliation_applications')->where('pending_user_id', $actor->id)->exists()
                    || DB::table('institution_memberships')->where('user_id', $actor->id)->exists()
                    || DB::table('institution_access')->where('user_id', $actor->id)->exists()) {
                    throw ValidationException::withMessages(['institution' => 'You already have a pending application or institution affiliation.']);
                }

                $domains = AffiliationResolver::parseDomains($institution->allowed_domains ?? null);
                $emailDomain = Str::after(Str::lower($actor->email), '@');

                if ($domains !== [] && in_array($emailDomain, $domains, true)) {
                    DB::table('institution_memberships')->insert([
                        'user_id' => $actor->id,
                        'institution_id' => $institution->id,
                        'location' => $data['location'],
                        'consented_at' => now(),
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);
                    $actor->forceFill([
                        'role' => 'entrepreneur',
                        'requested_institution_id' => null,
                        'location' => $actor->location ?: $data['location'],
                    ])->save();

                    return ['auto_approved' => true, 'id' => null, 'actor' => $actor, 'institution' => $institution];
                }

                if ($storedPath === null && mb_strlen($detailsText) < 10) {
                    throw ValidationException::withMessages([
                        'document' => 'Upload an official document from the selected institution showing you are a student or member.',
                    ]);
                }

                $id = DB::table('affiliation_applications')->insertGetId([
                    'user_id' => $actor->id,
                    'pending_user_id' => $actor->id,
                    'institution_id' => $institution->id,
                    'location' => $data['location'],
                    'details' => $detailsText !== '' ? $detailsText : ('Institutional proof uploaded: '.$documentName),
                    'document_path' => $storedPath,
                    'document_name' => $documentName,
                    'consented_at' => now(),
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);

                return ['auto_approved' => false, 'id' => $id, 'actor' => $actor, 'institution' => $institution];
            }, 3);
        } catch (Throwable $exception) {
            if ($storedPath) {
                Storage::disk('local')->delete($storedPath);
            }
            throw $exception;
        }

        if ($outcome['auto_approved'] && $storedPath) {
            Storage::disk('local')->delete($storedPath);
        }

        /** @var User $actor */
        $actor = $outcome['actor'];
        $institution = $outcome['institution'];

        if ($outcome['auto_approved']) {
            $actor->notify(new WorkspaceAlert(
                "Your {$institution->name} email was verified automatically. Your Entrepreneur dashboard is now unlocked.",
                '/dashboard',
            ));

            return response()->json([
                'data' => [
                    'id' => null,
                    'auto_approved' => true,
                    'institution' => $institution->name,
                ],
            ], 201);
        }

        $coordinators = User::query()
            ->whereNull('suspended_at')
            ->whereNotNull('email_verified_at')
            ->whereIn('id', DB::table('institution_access')
                ->where('institution_id', $institution->id)
                ->where('access', 'manage')
                ->select('user_id'))
            ->get();
        if ($coordinators->isNotEmpty()) {
            Notification::send($coordinators, new WorkspaceAlert(
                "{$actor->name} applied to affiliate with {$institution->name}.",
                '/dashboard/workspace?tab=school&institution='.rawurlencode($institution->slug).'&view=requests',
            ));
        } else {
            WorkspaceNotifier::notifyAdmins(
                "{$actor->name} applied to affiliate with {$institution->name}.",
                '/dashboard/workspace?tab=approvals&view=roles',
            );
        }

        return response()->json([
            'data' => [
                'id' => $outcome['id'],
                'auto_approved' => false,
            ],
        ], 201);
    }

    public function review(Request $request, int $id): JsonResponse
    {
        $actor = $request->user();
        $data = $request->validate([
            'decision' => ['required', Rule::in(['approved', 'rejected'])],
            'note' => ['required_if:decision,rejected', 'nullable', 'string', 'max:1500'],
        ]);

        [$learner, $institutionName] = DB::transaction(function () use ($actor, $id, $data) {
            $application = DB::table('affiliation_applications')->where('id', $id)->first();
            abort_unless($application, 404);

            $canReview = $actor->role === 'admin' || DB::table('institution_access as access')
                ->join('institutions as inst', 'inst.id', '=', 'access.institution_id')
                ->where('access.institution_id', $application->institution_id)
                ->where('access.user_id', $actor->id)
                ->where('access.access', 'manage')
                ->where('inst.status', 'active')
                ->whereIn('inst.kind', ['university', 'hub'])
                ->exists();
            abort_unless($canReview, 403);

            $learner = User::query()->lockForUpdate()->findOrFail($application->user_id);
            $application = DB::table('affiliation_applications')->where('id', $id)->lockForUpdate()->first();
            abort_unless($application?->status === 'pending', 409, 'This application has already been decided.');

            $institution = DB::table('institutions')->where('id', $application->institution_id)->first();
            $institutionName = $institution?->name ?? 'your institution';

            if ($data['decision'] === 'approved') {
                $activeInstitution = DB::table('institutions')->where('id', $application->institution_id)
                    ->where('status', 'active')->whereIn('kind', ['university', 'hub'])->first();
                abort_unless($activeInstitution && $learner->role === 'guest' && $learner->isActive()
                    && $learner->hasVerifiedEmail()
                    && ! DB::table('institution_memberships')->where('user_id', $learner->id)->exists()
                    && ! DB::table('institution_access')->where('user_id', $learner->id)->exists(),
                    409, 'This account or institution is no longer eligible.');
                DB::table('institution_memberships')->insert([
                    'user_id' => $learner->id, 'institution_id' => $activeInstitution->id,
                    'location' => $application->location, 'consented_at' => $application->consented_at,
                    'created_at' => now(), 'updated_at' => now(),
                ]);
                $learner->forceFill(['role' => 'entrepreneur', 'requested_institution_id' => null])->save();
            }

            DB::table('affiliation_applications')->where('id', $id)->update([
                'status' => $data['decision'], 'pending_user_id' => null,
                'decision_note' => $data['note'] ?? null, 'reviewer_id' => $actor->id,
                'reviewed_at' => now(), 'updated_at' => now(),
            ]);

            return [$learner, $institutionName];
        }, 3);

        $learner->notify(new WorkspaceAlert(
            $data['decision'] === 'approved'
                ? "Your affiliation with {$institutionName} was approved. Your Entrepreneur dashboard is ready."
                : "Your affiliation request for {$institutionName} was declined.".(! empty($data['note']) ? ' Note: '.$data['note'] : ''),
            $data['decision'] === 'approved' ? '/dashboard' : '/account',
        ));

        return response()->json(['data' => ['status' => $data['decision']]]);
    }

    public function document(Request $request, int $id): StreamedResponse
    {
        $actor = $request->user();
        $row = DB::table('affiliation_applications')
            ->where('id', $id)
            ->first(['user_id', 'institution_id', 'document_path', 'document_name']) ?? abort(404);

        $canView = $actor->role === 'admin'
            || (int) $row->user_id === $actor->id
            || DB::table('institution_access')
                ->where('institution_id', $row->institution_id)
                ->where('user_id', $actor->id)
                ->whereIn('access', ['view', 'manage'])
                ->exists();
        abort_unless($canView, 403);
        abort_unless($row->document_path && Storage::disk('local')->exists($row->document_path), 404);

        return Storage::disk('local')->response($row->document_path, $row->document_name ?: 'affiliation-proof', [
            'X-Content-Type-Options' => 'nosniff',
            'Cache-Control' => 'private, no-store',
        ]);
    }
}
