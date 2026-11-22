<?php

namespace Tests\Feature;

use App\Contracts\Learning\CourseCatalog;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use LogicException;
use RuntimeException;
use Tests\TestCase;

class MoodleCourseCatalogTest extends TestCase
{
    public function test_catalogue_uses_moodles_rest_service_and_maps_courses(): void
    {
        config(['services.moodle.url' => 'https://moodle.example.test/', 'services.moodle.token' => 'test-token']);
        Http::preventStrayRequests();
        Http::fake([
            'https://moodle.example.test/webservice/rest/server.php' => Http::response([
                ['id' => 1, 'shortname' => 'Site', 'fullname' => 'Site', 'format' => 'site'],
                ['id' => 2, 'shortname' => 'FOUND', 'fullname' => 'Business foundations'],
            ]),
        ]);

        $this->assertSame([
            ['id' => 2, 'name' => 'Business foundations', 'shortName' => 'FOUND'],
        ], $this->app->make(CourseCatalog::class)->courses());

        Http::assertSent(fn (Request $request) => $request->method() === 'POST'
            && $request['wsfunction'] === 'core_course_get_courses'
            && $request['wstoken'] === 'test-token');
    }

    public function test_moodle_errors_do_not_expose_service_details(): void
    {
        config(['services.moodle.url' => 'https://moodle.example.test', 'services.moodle.token' => 'test-token']);
        Http::preventStrayRequests();
        Http::fake(['https://moodle.example.test/*' => Http::response([
            'exception' => 'webservice_access_exception',
            'message' => 'Internal service detail',
        ])]);

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('Moodle did not return a course catalogue.');

        $this->app->make(CourseCatalog::class)->courses();
    }

    public function test_unconfigured_moodle_makes_no_request(): void
    {
        config(['services.moodle.url' => null, 'services.moodle.token' => null]);
        Http::preventStrayRequests();

        $this->expectException(LogicException::class);

        $this->app->make(CourseCatalog::class)->courses();
    }
}
