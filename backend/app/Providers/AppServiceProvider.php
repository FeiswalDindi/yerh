<?php

namespace App\Providers;

use App\Contracts\Learning\CourseCatalog;
use App\Integrations\Moodle\MoodleCourseCatalog;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->bind(CourseCatalog::class, fn () => new MoodleCourseCatalog(
            siteUrl: (string) config('services.moodle.url'),
            token: (string) config('services.moodle.token'),
        ));
    }
}
