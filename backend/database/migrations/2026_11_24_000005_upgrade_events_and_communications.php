<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('engagement_events', function (Blueprint $table) {
            $table->string('venue_type', 20)->default('physical')->after('venue');
            $table->string('meeting_link', 500)->nullable()->after('venue_type');
        });

        Schema::table('contact_messages', function (Blueprint $table) {
            $table->unsignedInteger('reply_count')->default(0)->after('handled_at');
            $table->timestamp('replied_at')->nullable()->after('reply_count');
        });

        Schema::create('email_templates', function (Blueprint $table) {
            $table->id();
            $table->string('name', 120);
            $table->string('category', 40)->default('general');
            $table->string('subject', 180);
            $table->text('body');
            $table->boolean('is_system')->default(false);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->index('category');
        });

        Schema::create('communication_dispatches', function (Blueprint $table) {
            $table->id();
            $table->string('kind', 24);
            $table->string('subject', 180);
            $table->text('body');
            $table->string('channel', 20)->default('both');
            $table->foreignId('template_id')->nullable()->constrained('email_templates')->nullOnDelete();
            $table->foreignId('contact_message_id')->nullable()->constrained('contact_messages')->nullOnDelete();
            $table->unsignedInteger('recipient_count')->default(0);
            $table->unsignedInteger('sent_count')->default(0);
            $table->unsignedInteger('failed_count')->default(0);
            $table->json('filter_summary')->nullable();
            $table->foreignId('sent_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->index(['kind', 'created_at']);
        });

        Schema::create('communication_recipients', function (Blueprint $table) {
            $table->id();
            $table->foreignId('dispatch_id')->constrained('communication_dispatches')->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('email', 254);
            $table->string('name', 120);
            $table->string('status', 20);
            $table->string('error_message', 300)->nullable();
            $table->timestamp('created_at');
            $table->index(['dispatch_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('communication_recipients');
        Schema::dropIfExists('communication_dispatches');
        Schema::dropIfExists('email_templates');

        Schema::table('contact_messages', function (Blueprint $table) {
            $table->dropColumn(['reply_count', 'replied_at']);
        });

        Schema::table('engagement_events', function (Blueprint $table) {
            $table->dropColumn(['venue_type', 'meeting_link']);
        });
    }
};
