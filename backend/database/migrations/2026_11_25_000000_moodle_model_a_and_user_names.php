<?php

use App\Models\User;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('first_name', 80)->nullable()->after('name');
            $table->string('last_name', 80)->nullable()->after('first_name');
            $table->string('moodle_username', 100)->nullable()->unique()->after('moodle_user_id');
        });

        DB::table('users')->select('id', 'name')->orderBy('id')->chunkById(200, function ($rows): void {
            foreach ($rows as $row) {
                [$first, $last] = User::splitFullName((string) ($row->name ?? ''));
                DB::table('users')->where('id', $row->id)->update([
                    'first_name' => $first,
                    'last_name' => $last,
                ]);
            }
        });

        Schema::table('learning_courses', function (Blueprint $table) {
            $table->string('moodle_shortname', 120)->nullable()->after('moodle_course_id');
            $table->unsignedBigInteger('moodle_category_id')->nullable()->after('moodle_shortname');
            $table->timestamp('moodle_synced_at')->nullable()->after('cover_image');
        });

        Schema::table('learning_enrolments', function (Blueprint $table) {
            $table->timestamp('moodle_enrolled_at')->nullable()->after('payment_note');
            $table->unsignedTinyInteger('moodle_progress')->nullable()->after('moodle_enrolled_at');
            $table->timestamp('moodle_synced_at')->nullable()->after('moodle_progress');
        });

        Schema::table('incubation_paths', function (Blueprint $table) {
            $table->unsignedBigInteger('moodle_course_id')->nullable()->after('mentor_id');
            $table->unsignedBigInteger('moodle_group_id')->nullable()->after('moodle_course_id');
            $table->unsignedTinyInteger('moodle_progress')->nullable()->after('moodle_group_id');
            $table->unsignedTinyInteger('moodle_score')->nullable()->after('moodle_progress');
            $table->timestamp('moodle_completed_at')->nullable()->after('moodle_score');
            $table->timestamp('moodle_synced_at')->nullable()->after('moodle_completed_at');
        });

        Schema::table('institutions', function (Blueprint $table) {
            $table->unsignedBigInteger('moodle_category_id')->nullable()->after('contact_phone');
        });
    }

    public function down(): void
    {
        Schema::table('institutions', function (Blueprint $table) {
            $table->dropColumn('moodle_category_id');
        });

        Schema::table('incubation_paths', function (Blueprint $table) {
            $table->dropColumn([
                'moodle_course_id',
                'moodle_group_id',
                'moodle_progress',
                'moodle_score',
                'moodle_completed_at',
                'moodle_synced_at',
            ]);
        });

        Schema::table('learning_enrolments', function (Blueprint $table) {
            $table->dropColumn(['moodle_enrolled_at', 'moodle_progress', 'moodle_synced_at']);
        });

        Schema::table('learning_courses', function (Blueprint $table) {
            $table->dropColumn(['moodle_shortname', 'moodle_category_id', 'moodle_synced_at']);
        });

        Schema::table('users', function (Blueprint $table) {
            $table->dropUnique(['moodle_username']);
            $table->dropColumn(['first_name', 'last_name', 'moodle_username']);
        });
    }
};
