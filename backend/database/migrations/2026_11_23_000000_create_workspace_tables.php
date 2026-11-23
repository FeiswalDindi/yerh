<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('institutions', function (Blueprint $table) {
            $table->string('agreement_reference', 180)->nullable();
        });

        Schema::create('affiliation_applications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('pending_user_id')->nullable()->unique()->constrained('users')->cascadeOnDelete();
            $table->foreignId('institution_id')->constrained()->restrictOnDelete();
            $table->string('location', 120);
            $table->text('details');
            $table->timestamp('consented_at');
            $table->string('status', 16)->default('pending')->index();
            $table->text('decision_note')->nullable();
            $table->foreignId('reviewer_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamps();
        });

        Schema::create('ventures', function (Blueprint $table) {
            $table->id();
            $table->foreignId('owner_id')->constrained('users')->restrictOnDelete();
            $table->foreignId('institution_id')->constrained()->restrictOnDelete();
            $table->string('name', 120);
            $table->string('sector', 100);
            $table->string('location', 120);
            $table->text('description');
            $table->string('status', 16)->default('pending')->index();
            $table->text('decision_note')->nullable();
            $table->foreignId('reviewer_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ventures');
        Schema::dropIfExists('affiliation_applications');
        Schema::table('institutions', function (Blueprint $table) {
            $table->dropColumn('agreement_reference');
        });
    }
};
