<?php

namespace App\Integrations\Moodle;

use App\Models\User;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use LogicException;
use RuntimeException;
use Throwable;

final readonly class MoodleClient
{
    public function __construct(
        private string $siteUrl,
        private string $token,
        private string $userAuth = 'manual',
        private int $studentRoleId = 5,
        private int $mentorRoleId = 4,
        private string $ssoSecret = '',
    ) {}

    public function isConfigured(): bool
    {
        return trim($this->siteUrl) !== '' && trim($this->token) !== '';
    }

    public function hasSsoSecret(): bool
    {
        return trim($this->ssoSecret) !== '';
    }

    public function siteUrl(): string
    {
        return rtrim(trim($this->siteUrl), '/');
    }

    public function courseUrl(int $moodleCourseId): string
    {
        return $this->siteUrl().'/course/view.php?id='.$moodleCourseId;
    }

    public function signedLaunchUrl(
        int $moodleUserId,
        ?int $moodleCourseId = null,
        string $destination = 'courses',
        bool $allowAdmin = false,
    ): string {
        if (! $this->hasSsoSecret()) {
            return $moodleCourseId && $moodleCourseId > 0
                ? $this->courseUrl($moodleCourseId)
                : $this->siteUrl().'/my/courses.php';
        }

        $json = json_encode([
            'uid' => $moodleUserId,
            'course' => $moodleCourseId ?? 0,
            'dest' => $destination,
            'allow_admin' => $allowAdmin,
            'exp' => time() + 120,
            'nonce' => bin2hex(random_bytes(16)),
        ], JSON_THROW_ON_ERROR);

        $payload = rtrim(strtr(base64_encode($json), '+/', '-_'), '=');
        $sig = hash_hmac('sha256', $payload, trim($this->ssoSecret));

        return $this->siteUrl().'/local/yerhsso/login.php?payload='.rawurlencode($payload).'&sig='.rawurlencode($sig);
    }

    public function call(string $function, array $params = []): mixed
    {
        if (! $this->isConfigured()) {
            throw new LogicException('Configure the Moodle site URL and integration token.');
        }

        $response = Http::asForm()
            ->acceptJson()
            ->connectTimeout(3)
            ->timeout(15)
            ->withoutRedirecting()
            ->post($this->siteUrl().'/webservice/rest/server.php', [
                ...$params,
                'wstoken' => $this->token,
                'wsfunction' => $function,
                'moodlewsrestformat' => 'json',
            ]);

        $payload = $response->json();

        if (! $response->successful()) {
            throw new RuntimeException('Moodle REST service request failed.');
        }

        if (is_array($payload) && (isset($payload['exception']) || isset($payload['errorcode']))) {
            Log::warning('Moodle web service returned an error.', [
                'wsfunction' => $function,
                'errorcode' => $payload['errorcode'] ?? null,
                'message' => $payload['message'] ?? null,
            ]);
            throw new RuntimeException('Moodle rejected the web service request.');
        }

        return $payload;
    }

    /**
     * @return list<array{
     *     id: int,
     *     shortname: string,
     *     fullname: string,
     *     summary: string,
     *     categoryid: int|null,
     *     categoryname: string|null,
     *     visible: bool,
     *     cover_image: string|null
     * }>
     */
    public function listCourses(): array
    {
        $payload = $this->call('core_course_get_courses_by_field');

        if (! is_array($payload) || ! isset($payload['courses']) || ! is_array($payload['courses'])) {
            throw new RuntimeException('Moodle did not return a course list.');
        }

        $courses = [];
        foreach ($payload['courses'] as $course) {
            if (! is_array($course)
                || ! is_int($course['id'] ?? null)
                || ! is_string($course['fullname'] ?? null)
                || ! is_string($course['shortname'] ?? null)) {
                throw new RuntimeException('Moodle returned an invalid course record.');
            }

            if (($course['format'] ?? null) === 'site') {
                continue;
            }

            $summary = trim(html_entity_decode(strip_tags((string) ($course['summary'] ?? '')), ENT_QUOTES | ENT_HTML5, 'UTF-8'));
            $coverImage = null;
            if (! empty($course['overviewfiles']) && is_array($course['overviewfiles'])) {
                $firstFile = $course['overviewfiles'][0] ?? null;
                if (is_array($firstFile) && is_string($firstFile['fileurl'] ?? null) && $firstFile['fileurl'] !== '') {
                    $coverImage = $firstFile['fileurl'];
                }
            }

            $courses[] = [
                'id' => $course['id'],
                'shortname' => $course['shortname'],
                'fullname' => $course['fullname'],
                'summary' => $summary !== '' ? $summary : $course['fullname'],
                'categoryid' => isset($course['categoryid']) && is_int($course['categoryid']) ? $course['categoryid'] : null,
                'categoryname' => isset($course['categoryname']) && is_string($course['categoryname']) ? $course['categoryname'] : null,
                'visible' => (bool) ($course['visible'] ?? true),
                'cover_image' => $coverImage,
            ];
        }

        return $courses;
    }

    public function ensureUser(User $user, ?string $plainPassword = null): int
    {
        if ($user->moodle_user_id) {
            return (int) $user->moodle_user_id;
        }

        $existing = $this->call('core_user_get_users_by_field', [
            'field' => 'email',
            'values' => [$user->email],
        ]);

        if (is_array($existing) && isset($existing[0]['id']) && is_int($existing[0]['id'])) {
            $moodleId = (int) $existing[0]['id'];
            $username = is_string($existing[0]['username'] ?? null) ? $existing[0]['username'] : 'yerh_'.$user->id;
            $user->forceFill([
                'moodle_user_id' => $moodleId,
                'moodle_username' => $username,
            ])->save();

            if ($plainPassword !== null && $plainPassword !== '') {
                $this->syncUserPassword($user, $plainPassword);
            }

            return $moodleId;
        }

        $username = 'yerh_'.$user->id;
        $byUsername = $this->call('core_user_get_users_by_field', [
            'field' => 'username',
            'values' => [$username],
        ]);
        if (is_array($byUsername) && isset($byUsername[0]['id']) && is_int($byUsername[0]['id'])) {
            $existingIdNumber = trim((string) ($byUsername[0]['idnumber'] ?? ''));
            if ($existingIdNumber === '' || $existingIdNumber === (string) $user->id) {
                $moodleId = (int) $byUsername[0]['id'];
                $user->forceFill([
                    'moodle_user_id' => $moodleId,
                    'moodle_username' => $username,
                ])->save();

                if ($plainPassword !== null && $plainPassword !== '') {
                    $this->syncUserPassword($user, $plainPassword);
                }

                return $moodleId;
            }

            // Preserve any existing Moodle user tied to a different idnumber.
            $username = 'yerh_'.$user->id.'_'.substr(sha1(strtolower($user->email)), 0, 6);
        }

        $names = $user->moodleNames();

        $userPayload = [
            'username' => $username,
            'auth' => $this->userAuth,
            'firstname' => $names['firstname'],
            'lastname' => $names['lastname'],
            'email' => $user->email,
            'idnumber' => (string) $user->id,
        ];
        if ($this->userAuth === 'manual') {
            $userPayload['password'] = ($plainPassword !== null && $plainPassword !== '')
                ? $plainPassword
                : 'Yerh#'.bin2hex(random_bytes(8)).'9aA!';
        }

        $created = $this->call('core_user_create_users', [
            'users' => [$userPayload],
        ]);

        if (! is_array($created) || ! isset($created[0]['id']) || ! is_int($created[0]['id'])) {
            throw new RuntimeException('Moodle did not return a created user identifier.');
        }

        $moodleId = (int) $created[0]['id'];
        $user->forceFill([
            'moodle_user_id' => $moodleId,
            'moodle_username' => $username,
        ])->save();

        return $moodleId;
    }

    public function syncUserAccount(User $user, ?string $plainPassword = null): ?int
    {
        if (! $this->isConfigured()) {
            return null;
        }

        try {
            $hadId = (bool) $user->moodle_user_id;
            $moodleId = $this->ensureUser($user, $plainPassword);

            $names = $user->moodleNames();
            $update = [
                'id' => $moodleId,
                'firstname' => $names['firstname'],
                'lastname' => $names['lastname'],
                'email' => $user->email,
                'suspended' => $user->isActive() ? 0 : 1,
            ];

            if ($hadId && $this->userAuth === 'manual' && $plainPassword !== null && $plainPassword !== '') {
                $update['auth'] = 'manual';
                $update['password'] = $plainPassword;
            }

            $result = $this->call('core_user_update_users', [
                'users' => [$update],
            ]);
            if (is_array($result) && ! empty($result['warnings'])) {
                Log::warning('Moodle reported warnings while syncing user account.', [
                    'user_id' => $user->id,
                    'moodle_user_id' => $moodleId,
                    'warnings' => $result['warnings'],
                ]);
            }

            return $moodleId;
        } catch (Throwable $exception) {
            Log::warning('Could not synchronize YERH user account with Moodle.', [
                'user_id' => $user->id,
                'moodle_user_id' => $user->moodle_user_id,
                'error' => $exception->getMessage(),
            ]);

            return null;
        }
    }

    public function syncUserProfile(User $user): void
    {
        if (! $this->isConfigured() || ! $user->moodle_user_id) {
            return;
        }

        try {
            $names = $user->moodleNames();
            $this->call('core_user_update_users', [
                'users' => [[
                    'id' => (int) $user->moodle_user_id,
                    'firstname' => $names['firstname'],
                    'lastname' => $names['lastname'],
                    'email' => $user->email,
                    'suspended' => $user->isActive() ? 0 : 1,
                ]],
            ]);
        } catch (Throwable $exception) {
            Log::warning('Could not synchronize Moodle user profile.', [
                'user_id' => $user->id,
                'moodle_user_id' => $user->moodle_user_id,
                'error' => $exception->getMessage(),
            ]);
        }
    }

    public function syncUserPassword(User $user, string $plainPassword): void
    {
        if (! $this->isConfigured() || $this->userAuth !== 'manual' || ! $user->moodle_user_id || $plainPassword === '') {
            return;
        }

        try {
            $result = $this->call('core_user_update_users', [
                'users' => [[
                    'id' => (int) $user->moodle_user_id,
                    'auth' => 'manual',
                    'password' => $plainPassword,
                ]],
            ]);
            if (is_array($result) && ! empty($result['warnings'])) {
                Log::warning('Moodle reported warnings while syncing user password.', [
                    'user_id' => $user->id,
                    'moodle_user_id' => $user->moodle_user_id,
                    'warnings' => $result['warnings'],
                ]);
            }
        } catch (Throwable $exception) {
            Log::warning('Could not sync Moodle user password.', [
                'user_id' => $user->id,
                'moodle_user_id' => $user->moodle_user_id,
                'error' => $exception->getMessage(),
            ]);
        }
    }

    public function enrolUser(int $moodleUserId, int $moodleCourseId, ?int $roleId = null): void
    {
        $this->call('enrol_manual_enrol_users', [
            'enrolments' => [[
                'roleid' => $roleId ?? $this->studentRoleId,
                'userid' => $moodleUserId,
                'courseid' => $moodleCourseId,
            ]],
        ]);
    }

    public function enrolMentor(int $moodleUserId, int $moodleCourseId): void
    {
        $this->enrolUser($moodleUserId, $moodleCourseId, $this->mentorRoleId);
    }

    public function ensureCourseGroup(int $moodleCourseId, string $name, string $idnumber): int
    {
        $groups = $this->call('core_group_get_course_groups', [
            'courseid' => $moodleCourseId,
        ]);

        if (is_array($groups)) {
            foreach ($groups as $group) {
                if (! is_array($group) || ! is_int($group['id'] ?? null)) {
                    continue;
                }
                if (($group['idnumber'] ?? null) === $idnumber || ($group['name'] ?? null) === $name) {
                    return (int) $group['id'];
                }
            }
        }

        $created = $this->call('core_group_create_groups', [
            'groups' => [[
                'courseid' => $moodleCourseId,
                'name' => $name,
                'description' => 'YERH Venture Incubation Group',
                'idnumber' => $idnumber,
            ]],
        ]);

        if (! is_array($created) || ! isset($created[0]['id']) || ! is_int($created[0]['id'])) {
            throw new RuntimeException('Moodle did not create the venture group.');
        }

        return (int) $created[0]['id'];
    }

    /**
     * @param  list<int>  $moodleUserIds
     */
    public function addGroupMembers(int $groupId, array $moodleUserIds): void
    {
        $members = [];
        foreach (array_values(array_unique(array_map('intval', $moodleUserIds))) as $userId) {
            if ($userId > 0) {
                $members[] = [
                    'groupid' => $groupId,
                    'userid' => $userId,
                ];
            }
        }

        if ($members === []) {
            return;
        }

        $this->call('core_group_add_group_members', [
            'members' => $members,
        ]);
    }

    /**
     * @param  list<int>  $moodleUserIds
     */
    public function removeGroupMembers(int $groupId, array $moodleUserIds): void
    {
        $members = [];
        foreach (array_values(array_unique(array_map('intval', $moodleUserIds))) as $userId) {
            if ($userId > 0) {
                $members[] = [
                    'groupid' => $groupId,
                    'userid' => $userId,
                ];
            }
        }

        if ($members === []) {
            return;
        }

        $this->call('core_group_delete_group_members', [
            'members' => $members,
        ]);
    }

    /**
     * @return array{completed: bool, progress: int, score: int|null}
     */
    public function courseProgress(int $moodleUserId, int $moodleCourseId): array
    {
        $completed = false;
        try {
            $status = $this->call('core_completion_get_course_completion_status', [
                'courseid' => $moodleCourseId,
                'userid' => $moodleUserId,
            ]);
            if (is_array($status) && isset($status['completionstatus']['completed'])) {
                $completed = (bool) $status['completionstatus']['completed'];
            }
        } catch (RuntimeException) {
            $completed = false;
        }

        $progress = $completed ? 100 : 0;
        try {
            $activities = $this->call('core_completion_get_activities_completion_status', [
                'courseid' => $moodleCourseId,
                'userid' => $moodleUserId,
            ]);
            $statuses = is_array($activities) && isset($activities['statuses']) && is_array($activities['statuses'])
                ? $activities['statuses']
                : [];
            $tracked = 0;
            $done = 0;
            foreach ($statuses as $item) {
                if (! is_array($item)) {
                    continue;
                }
                if (($item['tracking'] ?? 1) === 0) {
                    continue;
                }
                $tracked++;
                if ((int) ($item['state'] ?? 0) > 0) {
                    $done++;
                }
            }
            if ($tracked > 0) {
                $progress = $completed ? 100 : (int) round(($done / $tracked) * 100);
            }
        } catch (RuntimeException) {
            // Keep progress fallback when activity completion tracking is disabled.
        }

        $score = null;
        try {
            $grades = $this->call('gradereport_user_get_grade_items', [
                'courseid' => $moodleCourseId,
                'userid' => $moodleUserId,
            ]);
            $items = is_array($grades) && isset($grades['usergrades'][0]['gradeitems'])
                && is_array($grades['usergrades'][0]['gradeitems'])
                ? $grades['usergrades'][0]['gradeitems']
                : [];
            foreach ($items as $item) {
                if (! is_array($item) || ($item['itemtype'] ?? null) !== 'course') {
                    continue;
                }
                $raw = $item['graderaw'] ?? null;
                $max = $item['grademax'] ?? null;
                if (is_numeric($raw) && is_numeric($max) && (float) $max > 0) {
                    $score = max(0, min(100, (int) round(((float) $raw / (float) $max) * 100)));
                }
                break;
            }
        } catch (RuntimeException) {
            // Grades remain null if gradebook is unavailable.
        }

        return [
            'completed' => $completed,
            'progress' => max(0, min(100, $progress)),
            'score' => $score,
        ];
    }

    /**
     * @return list<array{
     *     title: string,
     *     summary: string,
     *     activities: list<array{name: string, type: string}>
     * }>
     */
    public function courseContents(int $moodleCourseId): array
    {
        if (! $this->isConfigured() || $moodleCourseId < 1) {
            return [];
        }

        $load = function () use ($moodleCourseId): array {
            try {
                $raw = $this->call('core_course_get_contents', [
                    'courseid' => $moodleCourseId,
                ]);
            } catch (Throwable) {
                return [];
            }

            if (! is_array($raw)) {
                return [];
            }

            $sections = [];
            foreach ($raw as $section) {
                if (! is_array($section)) {
                    continue;
                }
                if (isset($section['visible']) && (int) $section['visible'] === 0) {
                    continue;
                }
                $modules = is_array($section['modules'] ?? null) ? $section['modules'] : [];
                $activities = [];
                foreach ($modules as $module) {
                    if (! is_array($module) || (isset($module['visible']) && (int) $module['visible'] === 0)) {
                        continue;
                    }
                    $modName = (string) ($module['modname'] ?? 'resource');
                    $type = match ($modName) {
                        'page' => 'Lesson & Notes',
                        'quiz' => 'Quiz',
                        'assign' => 'Assignment',
                        'resource' => 'Resource',
                        'url' => 'External Link',
                        'forum' => 'Discussion',
                        default => ucfirst($modName),
                    };
                    $title = trim(html_entity_decode(strip_tags((string) ($module['name'] ?? '')), ENT_QUOTES | ENT_HTML5, 'UTF-8'));
                    if ($title !== '') {
                        $activities[] = ['name' => $title, 'type' => $type];
                    }
                }

                $sectionNumber = (int) ($section['section'] ?? 0);
                if ($sectionNumber === 0 && $activities === []) {
                    continue;
                }

                $title = trim(html_entity_decode(strip_tags((string) ($section['name'] ?? '')), ENT_QUOTES | ENT_HTML5, 'UTF-8'));
                $summary = trim(html_entity_decode(strip_tags((string) ($section['summary'] ?? '')), ENT_QUOTES | ENT_HTML5, 'UTF-8'));
                if ($title === '' && $activities === [] && $summary === '') {
                    continue;
                }

                $sections[] = [
                    'title' => $title !== '' ? $title : 'Module '.count($sections) + 1,
                    'summary' => $summary,
                    'activities' => $activities,
                ];
            }

            return $sections;
        };

        if (app()->runningUnitTests()) {
            return $load();
        }

        return Cache::remember("moodle.course_contents.{$moodleCourseId}", 300, $load);
    }
}
