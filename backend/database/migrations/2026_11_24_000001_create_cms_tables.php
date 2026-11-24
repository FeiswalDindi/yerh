<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('cms_documents', function (Blueprint $table) {
            $table->string('section', 40)->primary();
            $table->json('draft_payload')->nullable();
            $table->json('published_payload')->nullable();
            $table->unsignedInteger('published_version')->default(0);
            $table->foreignId('draft_updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('draft_updated_at')->nullable();
            $table->foreignId('published_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('published_at')->nullable();
            $table->timestamps();
        });

        Schema::create('cms_revisions', function (Blueprint $table) {
            $table->id();
            $table->string('section', 40)->index();
            $table->unsignedInteger('version');
            $table->string('summary', 180)->nullable();
            $table->json('payload');
            $table->foreignId('author_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('created_at')->index();
        });

        Schema::create('cms_media', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->string('disk', 24)->default('local');
            $table->string('path', 255);
            $table->string('original_name', 180);
            $table->string('mime_type', 80);
            $table->unsignedInteger('size_bytes');
            $table->string('alt_text', 240)->nullable();
            $table->string('folder', 60)->default('general')->index();
            $table->foreignId('uploaded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cms_media');
        Schema::dropIfExists('cms_revisions');
        Schema::dropIfExists('cms_documents');
    }
};
