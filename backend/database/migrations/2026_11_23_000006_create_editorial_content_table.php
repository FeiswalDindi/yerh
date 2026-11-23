<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('editorial_content', function (Blueprint $table) {
            $table->id();
            $table->foreignId('editor_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('content_id', 200)->unique();
            $table->string('kind', 24);
            $table->string('slug', 200);
            $table->string('status', 20);
            $table->boolean('featured')->default(false);
            $table->json('payload');
            $table->timestamps();
            $table->unique(['kind', 'slug']);
            $table->index(['status', 'kind']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('editorial_content');
    }
};
