<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('engagement_events', function (Blueprint $table) {
            $table->foreignId('organizer_id')->nullable()->after('id')->constrained('users')->nullOnDelete();
            $table->text('review_notes')->nullable()->after('status');
        });

        Schema::create('community_forums', function (Blueprint $table) {
            $table->id();
            $table->string('slug', 140)->unique();
            $table->string('name', 120);
            $table->string('description', 500);
            $table->unsignedSmallInteger('position')->default(0);
            $table->boolean('is_active')->default(true);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('community_groups', function (Blueprint $table) {
            $table->id();
            $table->string('slug', 140)->unique();
            $table->string('name', 120);
            $table->string('category', 80);
            $table->string('description', 1000);
            $table->string('whatsapp_url', 500)->nullable();
            $table->boolean('is_active')->default(true);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('community_group_members', function (Blueprint $table) {
            $table->id();
            $table->foreignId('group_id')->constrained('community_groups')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->timestamp('joined_at');
            $table->unique(['group_id', 'user_id']);
        });

        Schema::create('community_threads', function (Blueprint $table) {
            $table->id();
            $table->foreignId('forum_id')->nullable()->constrained('community_forums')->cascadeOnDelete();
            $table->foreignId('group_id')->nullable()->constrained('community_groups')->cascadeOnDelete();
            $table->foreignId('author_id')->constrained('users')->cascadeOnDelete();
            $table->string('title', 160);
            $table->text('body');
            $table->unsignedBigInteger('accepted_reply_id')->nullable();
            $table->boolean('pinned')->default(false);
            $table->boolean('locked')->default(false);
            $table->boolean('hidden')->default(false);
            $table->timestamps();
            $table->index(['forum_id', 'hidden']);
            $table->index(['group_id', 'hidden']);
        });

        Schema::create('community_replies', function (Blueprint $table) {
            $table->id();
            $table->foreignId('thread_id')->constrained('community_threads')->cascadeOnDelete();
            $table->foreignId('author_id')->constrained('users')->cascadeOnDelete();
            $table->text('body');
            $table->boolean('hidden')->default(false);
            $table->timestamps();
        });

        Schema::create('community_reply_votes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('reply_id')->constrained('community_replies')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->timestamp('created_at');
            $table->unique(['reply_id', 'user_id']);
        });

        Schema::create('editorial_comments', function (Blueprint $table) {
            $table->id();
            $table->string('content_id', 200)->index();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->text('body');
            $table->boolean('hidden')->default(false);
            $table->timestamps();
        });

        Schema::create('editorial_likes', function (Blueprint $table) {
            $table->id();
            $table->string('content_id', 200)->index();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->timestamp('created_at');
            $table->unique(['content_id', 'user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('editorial_likes');
        Schema::dropIfExists('editorial_comments');
        Schema::dropIfExists('community_reply_votes');
        Schema::dropIfExists('community_replies');
        Schema::dropIfExists('community_threads');
        Schema::dropIfExists('community_group_members');
        Schema::dropIfExists('community_groups');
        Schema::dropIfExists('community_forums');

        Schema::table('engagement_events', function (Blueprint $table) {
            $table->dropConstrainedForeignId('organizer_id');
            $table->dropColumn('review_notes');
        });
    }
};
