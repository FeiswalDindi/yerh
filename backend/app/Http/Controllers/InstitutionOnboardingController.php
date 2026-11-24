<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Notifications\InstitutionOnboardingDecision;
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

final class InstitutionOnboardingController extends Controller
{
    public function apply(Request $request): JsonResponse
    {
        $data = $request->validate([
            'institution_name' => ['required', 'string', 'min:2', 'max:160'],
            'kind' => ['required', Rule::in(['high-school', 'university', 'hub'])],
            'contact_name' => ['required', 'string', 'min:2', 'max:120'],
            'contact_email' => ['required', 'email', 'max:254'],
            'contact_phone' => ['required', 'string', 'min:6', 'max:40'],
            'website' => ['nullable', 'url:http,https', 'max:300'],
            'allowed_domains' => ['nullable'],
            'agreement_reference' => ['nullable', 'string', 'max:180'],
            'agreement' => ['nullable', 'file', 'mimes:pdf', 'max:5120'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);

        $domains = $this->parseAndValidateDomains($data['allowed_domains'] ?? null);
        $name = trim($data['institution_name']);
        $slug = Str::slug($name);
        if ($slug === '' || $slug === 'yerh') {
            throw ValidationException::withMessages(['institution_name' => 'Enter a valid institution name.']);
        }

        $agreementFile = $request->file('agreement');
        $storedPath = $agreementFile?->storeAs('onboarding-agreements', Str::uuid()->toString().'.pdf', 'local');
        abort_if($storedPath === false, 500, 'Could not store the agreement document.');
        $agreementName = $agreementFile ? mb_substr($agreementFile->getClientOriginalName(), 0, 180) : null;

        try {
            $id = DB::transaction(function () use ($data, $name, $slug, $domains, $storedPath, $agreementName) {
                if (DB::table('institutions')->where('slug', $slug)->exists()) {
                    throw ValidationException::withMessages(['institution_name' => 'An institution with this name is already registered.']);
                }

                $pendingConflict = DB::table('institution_onboarding_applications')
                    ->where('status', 'pending')
                    ->lockForUpdate()
                    ->get(['institution_name'])
                    ->contains(fn ($row) => Str::slug($row->institution_name) === $slug);

                if ($pendingConflict) {
                    throw ValidationException::withMessages(['institution_name' => 'A pending onboarding application already exists for this institution.']);
                }

                return DB::table('institution_onboarding_applications')->insertGetId([
                    'institution_name' => $name,
                    'kind' => $data['kind'],
                    'contact_name' => trim($data['contact_name']),
                    'contact_email' => Str::lower(trim($data['contact_email'])),
                    'contact_phone' => trim($data['contact_phone']),
                    'website' => isset($data['website']) && trim($data['website']) !== '' ? trim($data['website']) : null,
                    'allowed_domains' => $domains !== [] ? json_encode($domains, JSON_THROW_ON_ERROR) : null,
                    'agreement_reference' => isset($data['agreement_reference']) && trim($data['agreement_reference']) !== ''
                        ? trim($data['agreement_reference'])
                        : null,
                    'agreement_path' => $storedPath,
                    'agreement_name' => $agreementName,
                    'notes' => isset($data['notes']) && trim($data['notes']) !== '' ? trim($data['notes']) : null,
                    'status' => 'pending',
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }, 3);
        } catch (Throwable $exception) {
            if ($storedPath) {
                Storage::disk('local')->delete($storedPath);
            }
            throw $exception;
        }

        $contactName = trim($data['contact_name']);
        $contactEmail = Str::lower(trim($data['contact_email']));

        WorkspaceNotifier::notifyAdmins(
            "New institution onboarding request from {$name} ({$data['kind']}).",
            '/dashboard/workspace?tab=approvals&view=institutions',
            "New institution onboarding request: {$name}",
            'Review application',
        );

        WorkspaceNotifier::notifyExternalEmail(
            $contactEmail,
            $contactName,
            "Institution onboarding application received: {$name}",
            "Thank you for submitting the partner institution onboarding application for {$name}.\n\nOur administration team will review your institution details and agreement documentation and notify you at {$contactEmail} once a decision is made.",
            'Check YERH Hub',
            '/',
        );

        return response()->json(['data' => ['id' => $id, 'status' => 'pending']], 201);
    }

    public function index(Request $request): JsonResponse
    {
        abort_unless($request->user()->role === 'admin', 403);

        $rows = DB::table('institution_onboarding_applications as app')
            ->leftJoin('institutions as inst', 'inst.id', '=', 'app.institution_id')
            ->select(
                'app.*',
                'inst.slug as institution_slug',
            )
            ->orderByRaw("CASE WHEN app.status = 'pending' THEN 0 ELSE 1 END")
            ->orderByDesc('app.id')
            ->get()
            ->map(function ($row) {
                $row->allowed_domains = $this->decodeDomains($row->allowed_domains ?? null);
                $row->has_document = ! empty($row->agreement_path);
                unset($row->agreement_path);

                return $row;
            });

        return response()->json(['data' => $rows])->header('Cache-Control', 'private, no-store');
    }

    public function document(Request $request, int $id): StreamedResponse
    {
        abort_unless($request->user()->role === 'admin', 403);

        $app = DB::table('institution_onboarding_applications')
            ->where('id', $id)
            ->first(['agreement_path', 'agreement_name']) ?? abort(404);

        abort_unless($app->agreement_path && Storage::disk('local')->exists($app->agreement_path), 404);

        return Storage::disk('local')->response($app->agreement_path, $app->agreement_name ?: 'onboarding-agreement.pdf', [
            'X-Content-Type-Options' => 'nosniff',
            'Cache-Control' => 'private, no-store',
        ]);
    }

    public function review(Request $request, int $id): JsonResponse
    {
        abort_unless($request->user()->role === 'admin', 403);
        $data = $request->validate([
            'decision' => ['required', Rule::in(['approved', 'rejected'])],
            'note' => ['required_if:decision,rejected', 'nullable', 'string', 'max:1500'],
            'activate' => ['sometimes', 'boolean'],
        ]);

        $actor = $request->user();
        $copiedAgreementPath = null;

        try {
            $outcome = DB::transaction(function () use ($actor, $id, $data, &$copiedAgreementPath) {
                $app = DB::table('institution_onboarding_applications')
                    ->where('id', $id)
                    ->lockForUpdate()
                    ->first() ?? abort(404);

                abort_unless($app->status === 'pending', 409, 'This onboarding application has already been decided.');

                $slug = null;
                $assignedUserId = null;

                if ($data['decision'] === 'approved') {
                    $slug = Str::slug($app->institution_name);
                    if ($slug === '' || $slug === 'yerh') {
                        throw ValidationException::withMessages(['decision' => 'The requested institution name cannot be provisioned.']);
                    }
                    if (DB::table('institutions')->where('slug', $slug)->exists()) {
                        throw ValidationException::withMessages(['decision' => 'An institution with this slug already exists.']);
                    }

                    $active = (bool) ($data['activate'] ?? true);
                    $institutionId = DB::table('institutions')->insertGetId([
                        'slug' => $slug,
                        'name' => $app->institution_name,
                        'kind' => $app->kind,
                        'status' => $active ? 'active' : 'pending',
                        'agreement_reference' => $app->agreement_reference,
                        'allowed_domains' => $app->allowed_domains,
                        'contact_email' => $app->contact_email,
                        'contact_phone' => $app->contact_phone,
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);

                    if ($app->agreement_path && Storage::disk('local')->exists($app->agreement_path)) {
                        $copiedAgreementPath = 'institution-agreements/'.Str::uuid()->toString().'.pdf';
                        $copied = Storage::disk('local')->copy($app->agreement_path, $copiedAgreementPath);
                        abort_unless($copied, 500, 'Could not provision the uploaded agreement document.');
                        DB::table('institution_agreement_documents')->insert([
                            'institution_id' => $institutionId,
                            'uploaded_by' => $actor->id,
                            'reference' => $app->agreement_reference ?: 'Onboarding MOU',
                            'path' => $copiedAgreementPath,
                            'created_at' => now(),
                        ]);
                    }

                    $coordinator = User::query()
                        ->whereRaw('LOWER(email) = ?', [Str::lower($app->contact_email)])
                        ->lockForUpdate()
                        ->first();

                    if ($coordinator
                        && $coordinator->role === 'guest'
                        && $coordinator->isActive()
                        && $coordinator->hasVerifiedEmail()
                        && ! DB::table('institution_memberships')->where('user_id', $coordinator->id)->exists()
                        && ! DB::table('institution_access')->where('user_id', $coordinator->id)->exists()
                        && ! DB::table('affiliation_applications')->where('pending_user_id', $coordinator->id)->exists()) {
                        DB::table('institution_access')->insert([
                            'institution_id' => $institutionId,
                            'user_id' => $coordinator->id,
                            'access' => 'manage',
                        ]);
                        $coordinator->forceFill(['role' => 'school_admin', 'requested_institution_id' => null])->save();
                        $assignedUserId = $coordinator->id;
                    }

                    DB::table('institution_onboarding_applications')->where('id', $id)->update([
                        'status' => 'approved',
                        'institution_id' => $institutionId,
                        'decision_note' => $data['note'] ?? null,
                        'reviewer_id' => $actor->id,
                        'reviewed_at' => now(),
                        'updated_at' => now(),
                    ]);
                } else {
                    DB::table('institution_onboarding_applications')->where('id', $id)->update([
                        'status' => 'rejected',
                        'decision_note' => $data['note'] ?? null,
                        'reviewer_id' => $actor->id,
                        'reviewed_at' => now(),
                        'updated_at' => now(),
                    ]);
                }

                return [
                    'institution_name' => $app->institution_name,
                    'contact_email' => $app->contact_email,
                    'slug' => $slug,
                    'assigned_user_id' => $assignedUserId,
                ];
            }, 3);
        } catch (Throwable $exception) {
            if ($copiedAgreementPath) {
                Storage::disk('local')->delete($copiedAgreementPath);
            }
            throw $exception;
        }

        if ($outcome['assigned_user_id']) {
            WorkspaceNotifier::notifyUser(
                $outcome['assigned_user_id'],
                "Your institution {$outcome['institution_name']} was approved and your coordinator portal is ready.",
                '/dashboard/workspace?tab=school&institution='.rawurlencode((string) $outcome['slug']),
            );
        }

        Notification::route('mail', $outcome['contact_email'])->notify(
            new InstitutionOnboardingDecision(
                $outcome['institution_name'],
                $data['decision'],
                $data['note'] ?? null,
                $outcome['slug'],
            ),
        );

        return response()->json([
            'data' => [
                'status' => $data['decision'],
                'institution_slug' => $outcome['slug'],
            ],
        ]);
    }

    /**
     * @return list<string>
     */
    private function parseAndValidateDomains(mixed $raw): array
    {
        if ($raw === null || $raw === '' || $raw === []) {
            return [];
        }

        $items = is_array($raw)
            ? $raw
            : preg_split('/[\s,;]+/', (string) $raw, -1, PREG_SPLIT_NO_EMPTY);

        if (! is_array($items)) {
            return [];
        }

        $normalized = [];
        foreach ($items as $item) {
            $clean = Str::lower(ltrim(trim((string) $item), '@'));
            if ($clean === '') {
                continue;
            }
            if (strlen($clean) > 120 || ! preg_match('/^[a-z0-9.-]+\.[a-z]{2,}$/', $clean)) {
                throw ValidationException::withMessages([
                    'allowed_domains' => "Enter valid domain names (for example, students.example.edu), got '{$clean}'.",
                ]);
            }
            $normalized[] = $clean;
        }

        $unique = array_values(array_unique($normalized));
        if (count($unique) > 20) {
            throw ValidationException::withMessages(['allowed_domains' => 'You can list up to 20 domains.']);
        }

        return $unique;
    }

    /**
     * @return list<string>
     */
    private function decodeDomains(mixed $raw): array
    {
        if (is_string($raw)) {
            $decoded = json_decode($raw, true);
            $raw = is_array($decoded) ? $decoded : [];
        }

        return is_array($raw) ? array_values($raw) : [];
    }
}
