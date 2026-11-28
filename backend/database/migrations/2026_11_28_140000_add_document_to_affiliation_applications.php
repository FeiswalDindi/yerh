<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('affiliation_applications', function (Blueprint $table): void {
            if (! Schema::hasColumn('affiliation_applications', 'document_path')) {
                $table->string('document_path', 255)->nullable()->after('details');
            }
            if (! Schema::hasColumn('affiliation_applications', 'document_name')) {
                $table->string('document_name', 180)->nullable()->after('document_path');
            }
        });
    }

    public function down(): void
    {
        Schema::table('affiliation_applications', function (Blueprint $table): void {
            if (Schema::hasColumn('affiliation_applications', 'document_name')) {
                $table->dropColumn('document_name');
            }
            if (Schema::hasColumn('affiliation_applications', 'document_path')) {
                $table->dropColumn('document_path');
            }
        });
    }
};
