<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('learning_courses', function (Blueprint $table) {
            $table->id();
            $table->string('slug', 160)->unique();
            $table->foreignId('author_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('title', 140);
            $table->text('description');
            $table->string('level', 80);
            $table->unsignedInteger('price')->default(0);
            $table->unsignedInteger('discount')->default(0);
            $table->unsignedTinyInteger('royalty_rate')->default(0);
            $table->string('status', 20);
            $table->string('proposal_file')->nullable();
            $table->text('review_notes')->nullable();
            $table->timestamps();
            $table->index(['status', 'author_id']);
        });
        Schema::create('learning_lessons', function (Blueprint $table) {
            $table->id();
            $table->foreignId('course_id')->constrained('learning_courses')->restrictOnDelete();
            $table->string('title', 160);
            $table->text('content')->nullable();
            $table->string('url', 500)->nullable();
            $table->unsignedSmallInteger('position');
            $table->unique(['course_id', 'position']);
        });
        Schema::create('learning_enrolments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('course_id')->constrained('learning_courses')->restrictOnDelete();
            $table->foreignId('learner_id')->constrained('users')->restrictOnDelete();
            $table->string('payment_reference', 120)->nullable()->unique();
            $table->unsignedInteger('price_paid');
            $table->unsignedTinyInteger('royalty_rate')->default(0);
            $table->string('payment_status', 16);
            $table->text('payment_note')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->uuid('certificate_id')->nullable()->unique();
            $table->timestamp('issued_at')->nullable();
            $table->timestamps();
            $table->unique(['course_id', 'learner_id']);
        });
        Schema::create('learning_completions', function (Blueprint $table) {
            $table->foreignId('enrolment_id')->constrained('learning_enrolments')->cascadeOnDelete();
            $table->foreignId('lesson_id')->constrained('learning_lessons')->restrictOnDelete();
            $table->timestamp('completed_at');
            $table->primary(['enrolment_id', 'lesson_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('learning_completions');
        Schema::dropIfExists('learning_enrolments');
        Schema::dropIfExists('learning_lessons');
        Schema::dropIfExists('learning_courses');
    }
};
