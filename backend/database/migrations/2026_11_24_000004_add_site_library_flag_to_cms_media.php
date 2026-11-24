<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('cms_media', function (Blueprint $table) {
            $table->boolean('in_site_library')->default(false)->after('folder')->index();
        });
    }

    public function down(): void
    {
        Schema::table('cms_media', function (Blueprint $table) {
            $table->dropIndex(['in_site_library']);
            $table->dropColumn('in_site_library');
        });
    }
};
