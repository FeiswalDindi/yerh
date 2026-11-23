<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('event_categories', function (Blueprint $table) {
            $table->id();
            $table->string('name', 80)->unique();
        });
        Schema::create('engagement_events', function (Blueprint $table) {
            $table->id();
            $table->string('slug', 160)->unique();
            $table->foreignId('category_id')->constrained('event_categories')->restrictOnDelete();
            $table->string('title', 140);
            $table->text('summary');
            $table->string('venue', 160);
            $table->dateTime('starts_at');
            $table->dateTime('ends_at');
            $table->dateTime('deadline')->nullable();
            $table->unsignedInteger('capacity')->nullable();
            $table->string('status', 20);
            $table->json('presenters')->nullable();
            $table->timestamps();
            $table->index(['status', 'ends_at']);
        });
        Schema::create('event_bookings', function (Blueprint $table) {
            $table->foreignId('event_id')->constrained('engagement_events')->restrictOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->timestamp('created_at');
            $table->primary(['event_id', 'user_id']);
        });
        Schema::create('engagement_opportunities', function (Blueprint $table) {
            $table->id();
            $table->string('slug', 160)->unique();
            $table->string('title', 140);
            $table->string('category', 80);
            $table->string('organiser', 140);
            $table->text('description');
            $table->dateTime('opens_at')->nullable();
            $table->dateTime('deadline')->nullable();
            $table->string('external_url', 500)->nullable();
            $table->string('status', 20);
            $table->timestamps();
            $table->index(['status', 'deadline']);
        });
        Schema::create('opportunity_submissions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('opportunity_id')->constrained('engagement_opportunities')->restrictOnDelete();
            $table->foreignId('venture_id')->constrained()->restrictOnDelete();
            $table->foreignId('applicant_id')->constrained('users')->restrictOnDelete();
            $table->text('motivation');
            $table->string('status', 20);
            $table->text('review_notes')->nullable();
            $table->timestamps();
            $table->unique(['opportunity_id', 'venture_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('opportunity_submissions');
        Schema::dropIfExists('engagement_opportunities');
        Schema::dropIfExists('event_bookings');
        Schema::dropIfExists('engagement_events');
        Schema::dropIfExists('event_categories');
    }
};
