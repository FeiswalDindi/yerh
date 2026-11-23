<?php

namespace App\Domain\Incubation;

use App\Models\User;
use Illuminate\Support\Facades\DB;

final class SchoolAccess
{
    public function scope(User $actor, string $slug, bool $write = false, bool $lock = false): array
    {
        $query = DB::table('institutions')->where('slug', $slug)
            ->where('kind', 'high-school')->where('status', 'active');
        $institution = ($lock ? $query->lockForUpdate() : $query)->first();
        abort_unless($institution, 404);
        $access = $actor->role === 'admin' ? 'manage' : DB::table('institution_access')
            ->where('institution_id', $institution->id)->where('user_id', $actor->id)->value('access');
        abort_unless($write ? $access === 'manage' : in_array($access, ['view', 'manage'], true), 403);

        return [$institution, $access];
    }

    public function cohort(int $institution, int $id): object
    {
        return DB::table('school_cohorts')->where('institution_id', $institution)
            ->find($id) ?? abort(404);
    }

    public function teams(int $cohort)
    {
        return DB::table('school_ventures')->where('cohort_id', $cohort);
    }

    public function studentScore($results, string $kind): ?float
    {
        if ($kind !== 'venture') {
            return isset($results[$kind]) ? (float) $results[$kind] : null;
        }

        if ($results->count() !== count(Curriculum::STAGES)) {
            return null;
        }

        return round($results->avg(), 2);
    }

    public function classification(float $score): string
    {
        return match (true) {
            $score >= 70 => 'First Class',
            $score >= 60 => 'Second Class Upper',
            $score >= Curriculum::PASS_MARK => 'Second Class Lower',
            default => 'Completion',
        };
    }
}
