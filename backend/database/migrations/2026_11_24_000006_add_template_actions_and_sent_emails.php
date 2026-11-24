<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('email_templates', function (Blueprint $table) {
            $table->string('action_label', 80)->nullable()->after('body');
            $table->string('action_url', 300)->nullable()->after('action_label');
        });

        $mappings = [
            'onboarding' => ['Open Your Dashboard', '/dashboard'],
            'events' => ['View Upcoming Events', '/events'],
            'incubation' => ['Open Incubation Pathway', '/dashboard/workspace?tab=incubation'],
            'requests' => ['Update Your Profile', '/dashboard/profile'],
            'enquiries' => ['Contact Us', '/contact'],
            'announcements' => ['Explore Opportunities', '/opportunities'],
        ];

        foreach ($mappings as $category => [$label, $url]) {
            DB::table('email_templates')
                ->where('category', $category)
                ->whereNull('action_url')
                ->update([
                    'action_label' => $label,
                    'action_url' => $url,
                ]);
        }

        Schema::create('sent_emails', function (Blueprint $table) {
            $table->id();
            $table->string('to_email', 254)->index();
            $table->string('to_name', 120)->nullable();
            $table->string('from_email', 254)->nullable();
            $table->string('subject', 255);
            $table->longText('html_body')->nullable();
            $table->longText('text_body')->nullable();
            $table->string('mailer', 40)->default('log');
            $table->timestamp('created_at')->index();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sent_emails');

        Schema::table('email_templates', function (Blueprint $table) {
            $table->dropColumn(['action_label', 'action_url']);
        });
    }
};
