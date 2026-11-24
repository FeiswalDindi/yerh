<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('institution_onboarding_applications', function (Blueprint $table) {
            $table->id();
            $table->string('institution_name', 160);
            $table->string('kind', 32);
            $table->string('contact_name', 120);
            $table->string('contact_email', 254);
            $table->string('contact_phone', 40);
            $table->string('website', 300)->nullable();
            $table->json('allowed_domains')->nullable();
            $table->string('agreement_reference', 180)->nullable();
            $table->string('agreement_path', 255)->nullable();
            $table->string('agreement_name', 180)->nullable();
            $table->text('notes')->nullable();
            $table->string('status', 16)->default('pending');
            $table->text('decision_note')->nullable();
            $table->foreignId('institution_id')->nullable()->constrained('institutions')->nullOnDelete();
            $table->foreignId('reviewer_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamps();
            $table->index(['status', 'created_at']);
        });

        Schema::create('contact_messages', function (Blueprint $table) {
            $table->id();
            $table->string('name', 120);
            $table->string('email', 254);
            $table->string('topic', 100);
            $table->text('message');
            $table->string('status', 16)->default('new');
            $table->text('admin_notes')->nullable();
            $table->foreignId('handled_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('handled_at')->nullable();
            $table->timestamps();
            $table->index(['status', 'created_at']);
        });

        Schema::table('incubation_evidence', function (Blueprint $table) {
            $table->string('attachment_path', 255)->nullable()->after('feedback');
            $table->string('attachment_name', 180)->nullable()->after('attachment_path');
        });

        Schema::table('incubation_stages', function (Blueprint $table) {
            $table->string('answer_attachment_path', 255)->nullable()->after('answer');
            $table->string('answer_attachment_name', 180)->nullable()->after('answer_attachment_path');
        });

        Schema::table('opportunity_submissions', function (Blueprint $table) {
            $table->string('attachment_path', 255)->nullable()->after('motivation');
            $table->string('attachment_name', 180)->nullable()->after('attachment_path');
        });

        Schema::table('venture_products', function (Blueprint $table) {
            $table->string('image_path', 255)->nullable()->after('price');
            $table->string('contact_email', 254)->nullable()->after('image_path');
            $table->string('contact_phone', 40)->nullable()->after('contact_email');
            $table->string('whatsapp', 40)->nullable()->after('contact_phone');
        });
    }

    public function down(): void
    {
        Schema::table('venture_products', function (Blueprint $table) {
            $table->dropColumn(['image_path', 'contact_email', 'contact_phone', 'whatsapp']);
        });

        Schema::table('opportunity_submissions', function (Blueprint $table) {
            $table->dropColumn(['attachment_path', 'attachment_name']);
        });

        Schema::table('incubation_stages', function (Blueprint $table) {
            $table->dropColumn(['answer_attachment_path', 'answer_attachment_name']);
        });

        Schema::table('incubation_evidence', function (Blueprint $table) {
            $table->dropColumn(['attachment_path', 'attachment_name']);
        });

        Schema::dropIfExists('contact_messages');
        Schema::dropIfExists('institution_onboarding_applications');
    }
};
