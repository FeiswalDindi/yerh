<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('institutions', function (Blueprint $table) {
            $table->json('allowed_domains')->nullable()->after('agreement_reference');
            $table->string('contact_email', 254)->nullable()->after('allowed_domains');
            $table->string('contact_phone', 40)->nullable()->after('contact_email');
        });

        Schema::table('users', function (Blueprint $table) {
            $table->foreignId('requested_institution_id')
                ->nullable()
                ->after('role')
                ->constrained('institutions')
                ->nullOnDelete();
            $table->unsignedBigInteger('moodle_user_id')->nullable()->unique()->after('requested_institution_id');
        });

        Schema::table('incubation_stages', function (Blueprint $table) {
            $table->unsignedSmallInteger('attempt')->default(1)->after('stage');
            $table->boolean('passed')->nullable()->after('score');
        });

        Schema::table('programme_payments', function (Blueprint $table) {
            $table->string('receipt_path', 255)->nullable()->after('reference');
            $table->string('receipt_name', 180)->nullable()->after('receipt_path');
        });

        Schema::table('learning_enrolments', function (Blueprint $table) {
            $table->string('receipt_path', 255)->nullable()->after('payment_reference');
            $table->string('receipt_name', 180)->nullable()->after('receipt_path');
        });

        Schema::table('learning_courses', function (Blueprint $table) {
            $table->unsignedBigInteger('moodle_course_id')->nullable()->unique()->after('author_id');
            $table->string('placement', 24)->default('public')->after('status');
            $table->string('incubation_stage', 32)->nullable()->after('placement');
            $table->foreignId('institution_id')
                ->nullable()
                ->after('incubation_stage')
                ->constrained('institutions')
                ->nullOnDelete();
            $table->boolean('featured')->default(false)->after('institution_id');
            $table->string('cover_image', 500)->nullable()->after('featured');
            $table->index(['placement', 'status']);
        });

        Schema::create('platform_settings', function (Blueprint $table) {
            $table->string('key', 80)->primary();
            $table->json('value');
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('platform_settings');

        Schema::table('learning_courses', function (Blueprint $table) {
            $table->dropIndex(['placement', 'status']);
            $table->dropConstrainedForeignId('institution_id');
            $table->dropUnique(['moodle_course_id']);
            $table->dropColumn(['moodle_course_id', 'placement', 'incubation_stage', 'featured', 'cover_image']);
        });

        Schema::table('learning_enrolments', function (Blueprint $table) {
            $table->dropColumn(['receipt_path', 'receipt_name']);
        });

        Schema::table('programme_payments', function (Blueprint $table) {
            $table->dropColumn(['receipt_path', 'receipt_name']);
        });

        Schema::table('incubation_stages', function (Blueprint $table) {
            $table->dropColumn(['attempt', 'passed']);
        });

        Schema::table('users', function (Blueprint $table) {
            $table->dropUnique(['moodle_user_id']);
            $table->dropConstrainedForeignId('requested_institution_id');
            $table->dropColumn('moodle_user_id');
        });

        Schema::table('institutions', function (Blueprint $table) {
            $table->dropColumn(['allowed_domains', 'contact_email', 'contact_phone']);
        });
    }
};
