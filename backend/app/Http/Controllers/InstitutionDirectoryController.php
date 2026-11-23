<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

final class InstitutionDirectoryController extends Controller
{
    public function choices(): JsonResponse
    {
        return response()->json(['data' => DB::table('institutions')
            ->where('status', 'active')->orderBy('name')->get(['slug', 'name', 'kind'])]);
    }

    public function index(Request $request): JsonResponse
    {
        $this->requireAdmin($request);

        return response()->json(['data' => DB::table('institutions')->orderBy('name')
            ->select(['slug', 'name', 'kind', 'status', 'agreement_reference'])
            ->selectSub(DB::table('institution_access as access')
                ->join('users', 'users.id', '=', 'access.user_id')
                ->whereColumn('access.institution_id', 'institutions.id')->where('access.access', 'manage')
                ->whereNull('users.suspended_at')->orderBy('users.name')->orderBy('users.id')
                ->select('users.name')->limit(1), 'administrator')
            ->selectSub(DB::table('institution_agreement_documents as documents')
                ->whereColumn('documents.institution_id', 'institutions.id')->selectRaw('count(*)'), 'agreements')
            ->get()]);
    }

    public function create(Request $request): JsonResponse
    {
        $this->requireAdmin($request);
        $data = $request->validate([
            'name' => ['required', 'string', 'min:2', 'max:120'],
            'kind' => ['required', Rule::in(['high-school', 'university', 'hub'])],
        ]);
        $slug = Str::slug($data['name']);
        if ($slug === '' || $slug === 'yerh') {
            throw ValidationException::withMessages(['name' => 'Enter a different institution name.']);
        }

        try {
            DB::table('institutions')->insert([...$data, 'slug' => $slug, 'created_at' => now(), 'updated_at' => now()]);
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

    public function update(Request $request, string $slug): JsonResponse
    {
        $this->requireAdmin($request);
        $data = $request->validate(['name' => ['required', 'string', 'min:2', 'max:120']]);
        $school = DB::table('institutions')->where('slug', $slug)->first(['id']);
        abort_unless($school, 404);
        DB::table('institutions')->where('id', $school->id)->update([...$data, 'updated_at' => now()]);

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

        return response()->json(['data' => $this->eligibleStaff((int) $school->id)
            ->when($query !== '', fn ($builder) => $builder->whereLike('name', '%'.$query.'%'))
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

    private function requireAdmin(Request $request): void
    {
        abort_unless($request->user()->role === 'admin', 403);
    }
}
