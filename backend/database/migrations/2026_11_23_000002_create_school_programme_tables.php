<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('school_cohorts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('institution_id')->constrained()->cascadeOnDelete();
            $table->string('name', 120);
            $table->date('starts_on');
            $table->date('ends_on');
            $table->timestamps();
            $table->unique(['institution_id', 'name', 'starts_on']);
        });

        Schema::create('school_students', function (Blueprint $table) {
            $table->id();
            $table->foreignId('institution_id')->constrained()->cascadeOnDelete();
            $table->string('name', 120);
            $table->string('reference', 60);
            $table->unsignedTinyInteger('age')->nullable();
            $table->string('gender', 60)->nullable();
            $table->string('grade', 60);
            $table->timestamps();
            $table->unique(['institution_id', 'reference']);
        });

        Schema::create('school_ventures', function (Blueprint $table) {
            $table->id();
            $table->foreignId('cohort_id')->constrained('school_cohorts')->cascadeOnDelete();
            $table->string('name', 120);
            $table->string('sector', 120);
            $table->text('description');
            $table->timestamps();
        });

        Schema::create('school_venture_students', function (Blueprint $table) {
            $table->foreignId('cohort_id')->constrained('school_cohorts')->cascadeOnDelete();
            $table->foreignId('venture_id')->constrained('school_ventures')->cascadeOnDelete();
            $table->foreignId('student_id')->constrained('school_students')->cascadeOnDelete();
            $table->primary(['cohort_id', 'student_id']);
            $table->unique(['venture_id', 'student_id']);
        });

        Schema::create('school_classes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('cohort_id')->constrained('school_cohorts')->cascadeOnDelete();
            $table->string('title', 160);
            $table->date('class_date');
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        Schema::create('school_class_teams', function (Blueprint $table) {
            $table->foreignId('class_id')->constrained('school_classes')->cascadeOnDelete();
            $table->foreignId('venture_id')->constrained('school_ventures')->cascadeOnDelete();
            $table->primary(['class_id', 'venture_id']);
        });

        Schema::create('school_results', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('venture_id');
            $table->unsignedBigInteger('student_id');
            $table->string('stage', 32);
            $table->decimal('score', 5, 2);
            $table->text('notes')->nullable();
            $table->foreignId('recorded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->unique(['venture_id', 'student_id', 'stage']);
            $table->foreign(['venture_id', 'student_id'])->references(['venture_id', 'student_id'])->on('school_venture_students')->cascadeOnDelete();
        });

        Schema::create('school_credentials', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('venture_id');
            $table->unsignedBigInteger('student_id');
            $table->string('kind', 32);
            $table->string('status', 20);
            $table->decimal('score', 5, 2);
            $table->string('classification', 50);
            $table->text('review_notes')->nullable();
            $table->foreignId('requested_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->uuid('document_id')->nullable()->unique();
            $table->timestamp('issued_at')->nullable();
            $table->timestamps();
            $table->unique(['venture_id', 'student_id', 'kind']);
            $table->index('status');
            $table->foreign(['venture_id', 'student_id'])->references(['venture_id', 'student_id'])->on('school_venture_students')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('school_credentials');
        Schema::dropIfExists('school_results');
        Schema::dropIfExists('school_class_teams');
        Schema::dropIfExists('school_classes');
        Schema::dropIfExists('school_venture_students');
        Schema::dropIfExists('school_ventures');
        Schema::dropIfExists('school_students');
        Schema::dropIfExists('school_cohorts');
    }
};
