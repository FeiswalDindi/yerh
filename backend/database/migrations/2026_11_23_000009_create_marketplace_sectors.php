<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $defaults = json_decode(file_get_contents(base_path('../frontend/src/mocks/data/marketplace-sectors.json')), true, flags: JSON_THROW_ON_ERROR);
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
