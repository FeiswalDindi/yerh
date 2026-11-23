<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('incubation_paths', function (Blueprint $table) {
            $table->id();
            $table->foreignId('venture_id')->unique()->constrained()->restrictOnDelete();
            $table->foreignId('mentor_id')->nullable()->constrained('users')->restrictOnDelete();
            $table->timestamp('graduated_at')->nullable();
            $table->timestamps();
        });

        Schema::create('incubation_stages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('path_id')->constrained('incubation_paths')->cascadeOnDelete();
            $table->string('stage', 32);
            $table->unique(['path_id', 'stage']);
            $table->timestamp('review_requested_at')->nullable();
            $table->timestamp('meeting_at')->nullable();
            $table->string('meeting_location', 240)->nullable();
            $table->text('meeting_note')->nullable();
            $table->timestamp('exam_opened_at')->nullable();
            $table->text('answer')->nullable();
            $table->timestamp('submitted_at')->nullable();
            $table->unsignedTinyInteger('score')->nullable();
            $table->text('grade_note')->nullable();
            $table->timestamp('graded_at')->nullable();
            $table->timestamps();
        });

        Schema::create('incubation_evidence', function (Blueprint $table) {
            $table->id();
            $table->foreignId('stage_id')->constrained('incubation_stages')->cascadeOnDelete();
            $table->string('step_key', 50);
            $table->unique(['stage_id', 'step_key']);
            $table->text('body');
            $table->boolean('feedback_requested')->default(false);
            $table->text('feedback')->nullable();
            $table->timestamps();
        });

        Schema::create('venture_products', function (Blueprint $table) {
            $table->id();
            $table->foreignId('venture_id')->constrained()->restrictOnDelete();
            $table->foreignId('included_path_id')->nullable()->constrained('incubation_paths')->restrictOnDelete();
            $table->string('slug', 180)->unique();
            $table->string('name', 120);
            $table->text('description');
            $table->decimal('price', 12, 2);
            $table->string('moderation', 16)->default('pending');
            $table->text('moderation_note')->nullable();
            $table->text('evidence')->nullable();
            $table->string('evidence_status', 16)->nullable();
            $table->text('evidence_note')->nullable();
            $table->timestamps();
        });

        Schema::create('programme_fee_settings', function (Blueprint $table) {
            $table->string('purpose', 32)->primary();
            $table->unsignedInteger('amount');
            $table->boolean('enabled')->default(true);
        });

        Schema::create('programme_payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('path_id')->nullable()->constrained('incubation_paths')->restrictOnDelete();
            $table->foreignId('product_id')->nullable()->constrained('venture_products')->restrictOnDelete();
            $table->foreignId('payer_id')->constrained('users')->restrictOnDelete();
            $table->string('purpose', 32);
            $table->unique(['path_id', 'purpose']);
            $table->unique(['product_id', 'purpose']);
            $table->unsignedInteger('amount');
            $table->string('reference', 120)->unique();
            $table->string('status', 16)->default('pending');
            $table->foreignId('reviewer_id')->nullable()->constrained('users')->nullOnDelete();
            $table->text('decision_note')->nullable();
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamps();
        });

        Schema::create('venture_credentials', function (Blueprint $table) {
            $table->id();
            $table->uuid('document_id')->unique();
            $table->foreignId('path_id')->constrained('incubation_paths')->restrictOnDelete();
            $table->foreignId('recipient_id')->constrained('users')->restrictOnDelete();
            $table->foreignId('issuer_id')->constrained('users')->restrictOnDelete();
            $table->string('kind', 32);
            $table->unique(['path_id', 'kind']);
            $table->timestamp('issued_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('venture_credentials');
        Schema::dropIfExists('programme_payments');
        Schema::dropIfExists('programme_fee_settings');
        Schema::dropIfExists('venture_products');
        Schema::dropIfExists('incubation_evidence');
        Schema::dropIfExists('incubation_stages');
        Schema::dropIfExists('incubation_paths');
    }
};
