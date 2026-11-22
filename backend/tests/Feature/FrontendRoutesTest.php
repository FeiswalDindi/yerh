<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\File;
use Tests\TestCase;

class FrontendRoutesTest extends TestCase
{
    public function test_spa_routes_use_the_built_entry_and_api_routes_stay_separate(): void
    {
        $originalPublicPath = public_path();
        $fixture = storage_path('framework/testing/frontend-'.bin2hex(random_bytes(8)));
        File::ensureDirectoryExists($fixture.'/ui');
        File::put($fixture.'/ui/index.html', '<html><title>YERH test</title></html>');
        $this->app->usePublicPath($fixture);

        try {
            $this->get('/')->assertOk()->assertHeader('Content-Type', 'text/html; charset=UTF-8');
            $this->get('/dashboard/workspace?tab=approvals')->assertOk();
            $this->get('/media/09/yerh-logo.webp')->assertRedirect('/ui/media/09/yerh-logo.webp');
            $this->getJson('/api/v1/status')->assertOk()->assertExactJson(['status' => 'ok']);
            $this->getJson('/api/v1/unknown')->assertNotFound();
            $this->get('/ui/unknown.js')->assertNotFound();
        } finally {
            $this->app->usePublicPath($originalPublicPath);
            File::deleteDirectory($fixture);
        }
    }
}
