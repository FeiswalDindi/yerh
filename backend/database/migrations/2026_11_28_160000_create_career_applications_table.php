<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('career_applications', function (Blueprint $table): void {
            $table->id();
            $table->string('track', 40);
            $table->string('applicant_name', 120);
            $table->string('applicant_email', 254);
            $table->string('applicant_phone', 40);
            $table->string('organization', 160)->nullable();
            $table->string('website', 300)->nullable();
            $table->string('linkedin_url', 300)->nullable();
            $table->string('focus_area', 140)->nullable();
            $table->text('message');
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('status', 24)->default('pending');
            $table->text('decision_note')->nullable();
            $table->foreignId('reviewer_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamps();

            $table->index(['track', 'status']);
            $table->index('applicant_email');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('career_applications');
    }
};
