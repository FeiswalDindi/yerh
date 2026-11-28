<?php

namespace App\Domain\Incubation;

use App\Models\User;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\DB;

final class PathAccess
{
    public function visible(User $actor): Builder
    {
        $query = DB::table('incubation_paths as path')
            ->join('ventures as venture', 'venture.id', '=', 'path.venture_id')
            ->join('institutions as institution', 'institution.id', '=', 'venture.institution_id')
            ->leftJoin('users as mentor', 'mentor.id', '=', 'path.mentor_id')
            ->join('users as owner', 'owner.id', '=', 'venture.owner_id')
            ->select(
                'path.*',
                'venture.owner_id',
                'venture.institution_id',
                'venture.status as venture_status',
                'institution.status as institution_status',
                'venture.name as venture',
                'mentor.name as mentor',
                'owner.name as owner',
            );

        return match ($actor->role) {
            'admin' => $query,
            'entrepreneur' => $query->where('venture.owner_id', $actor->id),
            'mentor' => $query->where('path.mentor_id', $actor->id),
            default => abort(403),
        };
    }

    public function find(User $actor, int $id, bool $lock = false): object
    {
        $scope = $this->visible($actor)->where('path.id', $id);

        return ($lock ? $scope->lockForUpdate() : $scope)->first() ?? abort(404);
    }

    public function completed(int $pathId, array $stages): bool
    {
        if ($stages === Curriculum::STAGES && DB::table('incubation_paths')
            ->where('id', $pathId)
            ->whereNotNull('moodle_completed_at')
            ->whereNotNull('graduated_at')
            ->exists()) {
            return true;
        }

        return $stages === [] || DB::table('incubation_stages')
            ->where('path_id', $pathId)
            ->whereIn('stage', $stages)
            ->whereNotNull('graded_at')
            ->where(function (Builder $query): void {
                $query->where('passed', true)
                    ->orWhere(function (Builder $fallback): void {
                        $fallback->whereNull('passed')->where('score', '>=', Curriculum::PASS_MARK);
                    });
            })
            ->count() === count($stages);
    }
}
