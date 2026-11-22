<?php

namespace App\Integrations\Moodle;

use App\Contracts\Learning\CourseCatalog;
use Illuminate\Support\Facades\Http;
use LogicException;
use RuntimeException;

final readonly class MoodleCourseCatalog implements CourseCatalog
{
    public function __construct(private string $siteUrl, private string $token) {}

    public function courses(): array
    {
        if ($this->siteUrl === '' || $this->token === '') {
            throw new LogicException('Configure the Moodle site URL and integration token.');
        }

        $response = Http::asForm()
            ->acceptJson()
            ->connectTimeout(3)
            ->timeout(10)
            ->withoutRedirecting()
            ->post(rtrim($this->siteUrl, '/').'/webservice/rest/server.php', [
                'wstoken' => $this->token,
                'wsfunction' => 'core_course_get_courses',
                'moodlewsrestformat' => 'json',
            ]);

        $payload = $response->json();

        if (! $response->successful() || ! is_array($payload) || ! array_is_list($payload)) {
            throw new RuntimeException('Moodle did not return a course catalogue.');
        }

        $courses = [];

        foreach ($payload as $course) {
            if (! is_array($course)
                || ! is_int($course['id'] ?? null)
                || ! is_string($course['fullname'] ?? null)
                || ! is_string($course['shortname'] ?? null)) {
                throw new RuntimeException('Moodle returned an invalid course record.');
            }

            // Moodle represents the site homepage as a course with the site format.
            if (($course['format'] ?? null) !== 'site') {
                $courses[] = [
                    'id' => $course['id'],
                    'name' => $course['fullname'],
                    'shortName' => $course['shortname'],
                ];
            }
        }

        return $courses;
    }
}
