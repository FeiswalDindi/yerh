<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $defaults = config('yerh.default_sectors', [
            ['name' => 'Agribusiness', 'image' => '/media/comfort-worms-e046b580.jpg'],
            ['name' => 'Creative enterprise', 'image' => '/media/mowrah-designs-900x599-cb3e579d.jpg'],
            ['name' => 'creatives', 'image' => null],
            ['name' => 'Fashion & design', 'image' => '/media/sued-d02d98cf.webp'],
            ['name' => 'Healthcare', 'image' => '/media/health-c8d73354.png'],
        ]);
        Schema::create('marketplace_sectors', function (Blueprint $table) {
            $table->id();
            $table->string('name', 120)->unique();
            $table->string('image')->nullable();
            $table->string('uploaded_image')->nullable();
        });

        DB::table('marketplace_sectors')->insert($defaults);
        foreach (['ventures', 'school_ventures'] as $source) {
            foreach (DB::table($source)->distinct()->pluck('sector') as $name) {
                if (trim($name) !== '') {
                    DB::table('marketplace_sectors')->insertOrIgnore(['name' => $name]);
                }
            }
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('marketplace_sectors');
    }
};
