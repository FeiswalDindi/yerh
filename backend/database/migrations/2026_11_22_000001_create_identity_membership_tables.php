<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('role', 32)->default('guest');
            $table->timestamp('suspended_at')->nullable();
        });

        Schema::create('institutions', function (Blueprint $table) {
            $table->id();
            $table->string('slug', 120)->unique();
            $table->string('name', 160);
            $table->string('kind', 32);
            $table->string('status', 16)->default('pending');
            $table->timestamps();
        });

        Schema::create('institution_access', function (Blueprint $table) {
            $table->foreignId('institution_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('access', 12);
            $table->primary(['institution_id', 'user_id']);
        });

        Schema::create('institution_memberships', function (Blueprint $table) {
            $table->foreignId('user_id')->primary()->constrained()->cascadeOnDelete();
            $table->foreignId('institution_id')->constrained()->restrictOnDelete();
            $table->string('location', 120);
            $table->timestamp('consented_at');
            $table->timestamps();
        });

        Schema::create('institution_invitations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('institution_id')->constrained()->restrictOnDelete();
            $table->foreignId('invited_by')->constrained('users')->restrictOnDelete();
            $table->foreignId('accepted_by')->nullable()->constrained('users')->restrictOnDelete();
            $table->string('name', 80);
            $table->string('email', 254);
            $table->string('pending_email', 254)->nullable()->unique();
            $table->char('token_hash', 64)->unique();
            $table->timestamp('expires_at')->index();
            $table->timestamp('accepted_at')->nullable();
            $table->timestamp('revoked_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('institution_invitations');
        Schema::dropIfExists('institution_memberships');
        Schema::dropIfExists('institution_access');
        Schema::dropIfExists('institutions');
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['role', 'suspended_at']);
        });
    }
};
