<?php

namespace Database\Seeders;

use App\Console\Commands\SeedPlatformContent;
use Illuminate\Database\Seeder;

final class PlatformContentSeeder extends Seeder
{
    public function run(): void
    {
        SeedPlatformContent::seed();
    }
}
