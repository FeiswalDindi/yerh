<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

final class InstitutionDirectoryController extends Controller
{
    public function choices(): JsonResponse
    {
        $rows = DB::table('institutions')
            ->where('status', 'active')
            ->orderBy('name')
            ->get(['slug', 'name', 'kind', 'allowed_domains'])
            ->map(fn ($row) => [
                'slug' => $row->slug,
                'name' => $row->name,
                'kind' => $row->kind,
                'allowed_domains' => $this->decodeDomains($row->allowed_domains ?? null),
            ]);

        return response()->json(['data' => $rows]);
    }

    public function index(Request $request): JsonResponse
    {
        $this->requireAdmin($request);

        $rows = DB::table('institutions')->orderBy('name')
            ->select(['slug', 'name', 'kind', 'status', 'agreement_reference', 'allowed_domains', 'contact_email', 'contact_phone'])
            ->selectSub(DB::table('institution_access as access')
                ->join('users', 'users.id', '=', 'access.user_id')
                ->whereColumn('access.institution_id', 'institutions.id')->where('access.access', 'manage')
                ->whereNull('users.suspended_at')->orderBy('users.name')->orderBy('users.id')
                ->select('users.name')->limit(1), 'administrator')
            ->selectSub(DB::table('institution_agreement_documents as documents')
                ->whereColumn('documents.institution_id', 'institutions.id')->selectRaw('count(*)'), 'agreements')
            ->selectSub(DB::table('institution_access as staff')
                ->whereColumn('staff.institution_id', 'institutions.id')->selectRaw('count(*)'), 'staff_count')
            ->selectSub(DB::table('institution_memberships as member')
                ->whereColumn('member.institution_id', 'institutions.id')->selectRaw('count(*)'), 'members_count')
            ->selectSub(DB::table('school_students as student')
                ->whereColumn('student.institution_id', 'institutions.id')->selectRaw('count(*)'), 'school_students_count')
            ->selectSub(DB::table('ventures as venture')
                ->whereColumn('venture.institution_id', 'institutions.id')->selectRaw('count(*)'), 'ventures_count')
            ->selectSub(DB::table('school_ventures as team')
                ->join('school_cohorts as cohort', 'cohort.id', '=', 'team.cohort_id')
                ->whereColumn('cohort.institution_id', 'institutions.id')->selectRaw('count(*)'), 'school_ventures_count')
            ->selectSub(DB::table('venture_credentials as cred')
                ->join('incubation_paths as path', 'path.id', '=', 'cred.path_id')
                ->join('ventures as venture', 'venture.id', '=', 'path.venture_id')
                ->whereColumn('venture.institution_id', 'institutions.id')->selectRaw('count(*)'), 'credentials_count')
            ->selectSub(DB::table('school_cohorts as cohort')
                ->whereColumn('cohort.institution_id', 'institutions.id')->selectRaw('count(*)'), 'school_cohorts_count')
            ->get()
            ->map(function ($row) {
                $row->allowed_domains = $this->decodeDomains($row->allowed_domains ?? null);
                $row->staff_count = (int) $row->staff_count;
                $row->agreements = (int) $row->agreements;
                $row->students_count = $row->kind === 'high-school' ? (int) $row->school_students_count : (int) $row->members_count;
                $row->ventures_count = $row->kind === 'high-school' ? (int) $row->school_ventures_count : (int) $row->ventures_count;
                $row->results_count = $row->kind === 'high-school' ? (int) $row->school_cohorts_count : (int) $row->credentials_count;
                unset($row->members_count, $row->school_students_count, $row->school_ventures_count, $row->credentials_count, $row->school_cohorts_count);

                return $row;
            });

        return response()->json(['data' => $rows]);
    }

    public function create(Request $request): JsonResponse
    {
        $this->requireAdmin($request);
        $data = $request->validate([
            'name' => ['required', 'string', 'min:2', 'max:120'],
            'kind' => ['required', Rule::in(['high-school', 'university', 'hub'])],
            'agreement_reference' => ['nullable', 'string', 'max:180'],
            'contact_email' => ['nullable', 'email', 'max:254'],
            'contact_phone' => ['nullable', 'string', 'max:40'],
            'allowed_domains' => ['nullable', 'array', 'max:20'],
            'allowed_domains.*' => ['required', 'string', 'max:120', 'regex:/^@?[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/'],
        ]);
        $slug = Str::slug($data['name']);
        if ($slug === '' || $slug === 'yerh') {
            throw ValidationException::withMessages(['name' => 'Enter a different institution name.']);
        }

        $domains = $this->normalizeDomains($data['allowed_domains'] ?? []);
        $payload = [
            'name' => trim($data['name']),
            'kind' => $data['kind'],
            'slug' => $slug,
            'agreement_reference' => isset($data['agreement_reference']) && trim($data['agreement_reference']) !== '' ? trim($data['agreement_reference']) : null,
            'contact_email' => isset($data['contact_email']) && trim($data['contact_email']) !== '' ? Str::lower(trim($data['contact_email'])) : null,
            'contact_phone' => isset($data['contact_phone']) && trim($data['contact_phone']) !== '' ? trim($data['contact_phone']) : null,
            'allowed_domains' => $domains !== [] ? json_encode($domains, JSON_THROW_ON_ERROR) : null,
            'created_at' => now(),
            'updated_at' => now(),
        ];

        try {
            DB::table('institutions')->insert($payload);
        } catch (UniqueConstraintViolationException) {
            throw ValidationException::withMessages(['name' => 'An institution with this name already exists.']);
        }

        return response()->json(['data' => ['slug' => $slug]], 201);
    }

    public function activate(Request $request, string $slug): JsonResponse
    {
        $this->requireAdmin($request);
        DB::transaction(function () use ($slug) {
            $school = DB::table('institutions')->where('slug', $slug)->lockForUpdate()->first();
            abort_unless($school, 404);
            DB::table('institutions')->where('id', $school->id)->update([
                'status' => 'active', 'updated_at' => now(),
            ]);
        });

        return response()->json(['data' => ['status' => 'active']]);
    }

    public function deactivate(Request $request, string $slug): JsonResponse
    {
        $this->requireAdmin($request);
        DB::transaction(function () use ($slug) {
            $school = DB::table('institutions')->where('slug', $slug)->lockForUpdate()->first();
            abort_unless($school, 404);
            DB::table('institutions')->where('id', $school->id)->update([
                'status' => 'suspended', 'updated_at' => now(),
            ]);
        });

        return response()->json(['data' => ['status' => 'suspended']]);
    }

    public function update(Request $request, string $slug): JsonResponse
    {
        $this->requireAdmin($request);
        $data = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'min:2', 'max:120'],
            'agreement_reference' => ['sometimes', 'nullable', 'string', 'max:180'],
            'contact_email' => ['sometimes', 'nullable', 'email', 'max:254'],
            'contact_phone' => ['sometimes', 'nullable', 'string', 'max:40'],
            'status' => ['sometimes', Rule::in(['pending', 'active', 'suspended'])],
            'allowed_domains' => ['sometimes', 'nullable', 'array', 'max:20'],
            'allowed_domains.*' => ['required', 'string', 'max:120', 'regex:/^@?[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/'],
        ]);
        $school = DB::table('institutions')->where('slug', $slug)->first(['id']);
        abort_unless($school, 404);

        $updates = ['updated_at' => now()];
        if (array_key_exists('name', $data)) {
            $updates['name'] = trim($data['name']);
        }
        if (array_key_exists('agreement_reference', $data)) {
            $updates['agreement_reference'] = $data['agreement_reference'] !== null && trim($data['agreement_reference']) !== ''
                ? trim($data['agreement_reference'])
                : null;
        }
        if (array_key_exists('contact_email', $data)) {
            $updates['contact_email'] = $data['contact_email'] !== null && trim($data['contact_email']) !== ''
                ? Str::lower(trim($data['contact_email']))
                : null;
        }
        if (array_key_exists('contact_phone', $data)) {
            $updates['contact_phone'] = $data['contact_phone'] !== null && trim($data['contact_phone']) !== ''
                ? trim($data['contact_phone'])
                : null;
        }
        if (array_key_exists('status', $data)) {
            $updates['status'] = $data['status'];
        }
        if (array_key_exists('allowed_domains', $data)) {
            $domains = $this->normalizeDomains($data['allowed_domains'] ?? []);
            $updates['allowed_domains'] = $domains !== [] ? json_encode($domains, JSON_THROW_ON_ERROR) : null;
        }

        DB::table('institutions')->where('id', $school->id)->update($updates);

        return response()->json(['data' => ['slug' => $slug]]);
    }

    public function staff(Request $request, string $slug): JsonResponse
    {
        $this->requireAdmin($request);
        $school = DB::table('institutions')->where('slug', $slug)->first(['id']);
        abort_unless($school, 404);

        return response()->json(['data' => DB::table('institution_access as access')
            ->join('users', 'users.id', '=', 'access.user_id')
            ->where('access.institution_id', $school->id)->orderBy('users.name')->orderBy('users.id')
            ->get(['users.id', 'users.name', 'access.access', 'users.suspended_at'])]);
    }

    public function staffCandidates(Request $request, string $slug): JsonResponse
    {
        $this->requireAdmin($request);
        $data = $request->validate(['q' => ['nullable', 'string', 'max:120']]);
        $school = DB::table('institutions')->where('slug', $slug)->first(['id']);
        abort_unless($school, 404);
        $query = trim($data['q'] ?? '');
        $like = '%'.addcslashes($query, '\\%_').'%';

        return response()->json(['data' => $this->eligibleStaff((int) $school->id)
            ->when($query !== '', fn ($builder) => $builder->where(
                fn ($nested) => $nested->whereLike('name', $like)->orWhereLike('email', $like)
            ))
            ->orderBy('name')->orderBy('id')->limit(24)->get(['id', 'name'])]);
    }

    private function eligibleStaff(int $institutionId): \Illuminate\Database\Eloquent\Builder
    {
        return User::query()->whereNull('suspended_at')->whereNotNull('email_verified_at')
            ->whereIn('role', ['guest', 'school_admin'])
            ->whereNotExists(fn ($query) => $query->from('institution_memberships')
                ->whereColumn('institution_memberships.user_id', 'users.id'))
            ->whereNotExists(fn ($query) => $query->from('institution_access')
                ->whereColumn('institution_access.user_id', 'users.id')
                ->where('institution_id', '<>', $institutionId));
    }

    public function assignStaff(Request $request, string $slug): JsonResponse
    {
        $this->requireAdmin($request);
        $data = $request->validate([
            'user_id' => ['required', 'integer', 'min:1'],
            'access' => ['required', Rule::in(['view', 'manage'])],
        ]);
        DB::transaction(function () use ($slug, $data) {
            $school = DB::table('institutions')->where('slug', $slug)->first();
            abort_unless($school, 404);
            $staff = User::query()->whereKey($data['user_id'])->lockForUpdate()->first();
            if (! $staff || ! $this->eligibleStaff((int) $school->id)->whereKey($staff->id)->exists()) {
                throw ValidationException::withMessages(['user_id' => 'Choose an eligible, verified account for this institution.']);
            }
            DB::table('institution_access')->updateOrInsert([
                'institution_id' => $school->id, 'user_id' => $staff->id,
            ], ['access' => $data['access']]);
            $staff->forceFill(['role' => 'school_admin'])->save();
        }, 3);

        return response()->json(['data' => ['access' => $data['access']]]);
    }

    public function removeStaff(Request $request, string $slug, int $userId): Response
    {
        $this->requireAdmin($request);
        DB::transaction(function () use ($slug, $userId) {
            $school = DB::table('institutions')->where('slug', $slug)->first(['id']);
            abort_unless($school, 404);
            $deleted = DB::table('institution_access')
                ->where('institution_id', $school->id)
                ->where('user_id', $userId)
                ->delete();
            abort_unless($deleted === 1, 404);

            $user = User::query()->lockForUpdate()->find($userId);
            if ($user && $user->role === 'school_admin'
                && ! DB::table('institution_access')->where('user_id', $userId)->exists()) {
                $user->forceFill(['role' => 'guest'])->save();
            }
        }, 3);

        return response()->noContent();
    }

    /**
     * @return list<string>
     */
    private function normalizeDomains(array $domains): array
    {
        $normalized = [];
        foreach ($domains as $domain) {
            $clean = Str::lower(ltrim(trim((string) $domain), '@'));
            if ($clean !== '') {
                $normalized[] = $clean;
            }
        }

        return array_values(array_unique($normalized));
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

    private function requireAdmin(Request $request): void
    {
        abort_unless($request->user()->role === 'admin', 403);
    }
}
