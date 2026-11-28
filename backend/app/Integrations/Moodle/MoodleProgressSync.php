<?php

namespace App\Integrations\Moodle;

use App\Domain\Incubation\Curriculum;
use App\Models\User;
use App\Support\WorkspaceNotifier;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Throwable;

final class MoodleProgressSync
{
    public function __construct(private readonly MoodleClient $moodle) {}

    /**
     * @return array{progress: int, completed: bool, score: int|null}|null
     */
    public function syncEnrolment(int $enrolmentId, bool $force = false): ?array
    {
        if (! $this->moodle->isConfigured()) {
            return null;
        }

        $row = DB::table('learning_enrolments as e')
            ->join('learning_courses as c', 'c.id', '=', 'e.course_id')
            ->where('e.id', $enrolmentId)
            ->first([
                'e.id',
                'e.learner_id',
                'e.payment_status',
                'e.completed_at',
                'e.moodle_progress',
                'e.moodle_synced_at',
                'c.moodle_course_id',
            ]);

        if (! $row || $row->payment_status !== 'confirmed' || empty($row->moodle_course_id)) {
            return null;
        }

        if (! $force) {
            if ($row->completed_at !== null) {
                return [
                    'progress' => (int) ($row->moodle_progress ?? 100),
                    'completed' => true,
                    'score' => null,
                ];
            }

            if ($row->moodle_synced_at && Carbon::parse($row->moodle_synced_at)->gt(now()->subSeconds(30))) {
                return [
                    'progress' => (int) ($row->moodle_progress ?? 0),
                    'completed' => false,
                    'score' => null,
                ];
            }
        }

        $learner = User::query()->find($row->learner_id);
        if (! $learner) {
            return null;
        }

        try {
            $moodleUserId = $this->moodle->ensureUser($learner);
            $progress = $this->moodle->courseProgress($moodleUserId, (int) $row->moodle_course_id);
            $now = now();
            $update = [
                'moodle_progress' => $progress['progress'],
                'moodle_synced_at' => $now,
                'updated_at' => $now,
            ];
            if ($progress['completed'] && $row->completed_at === null) {
                $update['completed_at'] = $now;
            }
            DB::table('learning_enrolments')->where('id', $row->id)->update($update);

            return [
                'progress' => $progress['progress'],
                'completed' => (bool) ($progress['completed'] || $row->completed_at !== null),
                'score' => $progress['score'],
            ];
        } catch (Throwable $exception) {
            Log::warning('Background Moodle enrolment progress sync failed.', [
                'enrolment_id' => $enrolmentId,
                'error' => $exception->getMessage(),
            ]);

            return null;
        }
    }

    /**
     * @return array{progress: int, score: int|null, completed: bool, graduated: bool}|null
     */
    public function syncPathway(int $pathId, bool $force = false): ?array
    {
        if (! $this->moodle->isConfigured()) {
            return null;
        }

        $path = DB::table('incubation_paths as p')
            ->join('ventures as v', 'v.id', '=', 'p.venture_id')
            ->where('p.id', $pathId)
            ->first([
                'p.id',
                'p.mentor_id',
                'p.moodle_course_id',
                'p.moodle_progress',
                'p.moodle_score',
                'p.moodle_completed_at',
                'p.moodle_synced_at',
                'p.graduated_at',
                'v.owner_id',
                'v.name as venture',
            ]);

        if (! $path || empty($path->moodle_course_id)) {
            return null;
        }

        if (! $force) {
            if ($path->graduated_at !== null) {
                return [
                    'progress' => (int) ($path->moodle_progress ?? 100),
                    'score' => $path->moodle_score !== null ? (int) $path->moodle_score : null,
                    'completed' => true,
                    'graduated' => true,
                ];
            }

            if ($path->moodle_synced_at && Carbon::parse($path->moodle_synced_at)->gt(now()->subSeconds(30))) {
                return [
                    'progress' => (int) ($path->moodle_progress ?? 0),
                    'score' => $path->moodle_score !== null ? (int) $path->moodle_score : null,
                    'completed' => false,
                    'graduated' => false,
                ];
            }
        }

        $owner = User::query()->find($path->owner_id);
        if (! $owner) {
            return null;
        }

        try {
            $ownerMoodleId = $this->moodle->ensureUser($owner);
            $progress = $this->moodle->courseProgress($ownerMoodleId, (int) $path->moodle_course_id);
            $passed = $progress['completed'] && ($progress['score'] === null || $progress['score'] >= Curriculum::PASS_MARK);

            $newlyGraduated = DB::transaction(function () use ($pathId, $progress, $passed): bool {
                $row = DB::table('incubation_paths')->where('id', $pathId)->lockForUpdate()->first();
                if (! $row) {
                    return false;
                }
                $now = now();
                $update = [
                    'moodle_progress' => $progress['progress'],
                    'moodle_score' => $progress['score'],
                    'moodle_synced_at' => $now,
                    'updated_at' => $now,
                ];
                $graduatedNow = false;
                if ($passed) {
                    $update['moodle_completed_at'] = $row->moodle_completed_at ?? $now;
                    if (! $row->graduated_at) {
                        $update['graduated_at'] = $now;
                        $graduatedNow = true;
                    }
                }
                DB::table('incubation_paths')->where('id', $pathId)->update($update);

                return $graduatedNow;
            }, 3);

            if ($newlyGraduated) {
                WorkspaceNotifier::notifyUser(
                    (int) $path->owner_id,
                    "{$path->venture} completed Moodle incubation and graduated! Your Venture Certificate is ready.",
                    '/dashboard/certificates',
                );
                if ($path->mentor_id) {
                    WorkspaceNotifier::notifyUser(
                        (int) $path->mentor_id,
                        "{$path->venture} completed Moodle incubation and graduated.",
                        '/dashboard/workspace?tab=incubation&path='.$pathId,
                    );
                }
            }

            return [
                'progress' => $progress['progress'],
                'score' => $progress['score'],
                'completed' => $passed,
                'graduated' => (bool) ($passed || $path->graduated_at !== null),
            ];
        } catch (Throwable $exception) {
            Log::warning('Background Moodle pathway progress sync failed.', [
                'path_id' => $pathId,
                'error' => $exception->getMessage(),
            ]);

            return null;
        }
    }

    /**
     * @return array{enrolments: int, pathways: int}
     */
    public function syncAllActive(): array
    {
        if (! $this->moodle->isConfigured()) {
            return ['enrolments' => 0, 'pathways' => 0];
        }

        $enrolmentIds = DB::table('learning_enrolments as e')
            ->join('learning_courses as c', 'c.id', '=', 'e.course_id')
            ->where('e.payment_status', 'confirmed')
            ->whereNull('e.completed_at')
            ->whereNotNull('c.moodle_course_id')
            ->pluck('e.id');

        $syncedEnrolments = 0;
        foreach ($enrolmentIds as $id) {
            if ($this->syncEnrolment((int) $id, force: true) !== null) {
                $syncedEnrolments++;
            }
        }

        $pathIds = DB::table('incubation_paths')
            ->whereNull('graduated_at')
            ->whereNotNull('moodle_course_id')
            ->pluck('id');

        $syncedPathways = 0;
        foreach ($pathIds as $id) {
            if ($this->syncPathway((int) $id, force: true) !== null) {
                $syncedPathways++;
            }
        }

        return ['enrolments' => $syncedEnrolments, 'pathways' => $syncedPathways];
    }
}
