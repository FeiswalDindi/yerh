<?php

namespace Tests\Feature;

use App\Models\User;
use App\Notifications\CourseCertificateIssued;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Notifications\SendQueuedNotifications;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

class CourseCertificateNotificationTest extends TestCase
{
    use RefreshDatabase;

    public function test_certificate_notification_is_queued_for_both_channels(): void
    {
        Queue::fake();
        $user = User::factory()->create();

        $user->notify(new CourseCertificateIssued('Business foundations', '/certificates/demo'));

        Queue::assertPushed(SendQueuedNotifications::class, fn ($job) => $job->channels === ['mail'] && $job->afterCommit);
        Queue::assertPushed(SendQueuedNotifications::class, fn ($job) => $job->channels === ['database'] && $job->afterCommit);
    }

    public function test_delivery_persists_an_unread_notification_and_sends_mail(): void
    {
        $user = User::factory()->create();

        $user->notifyNow(new CourseCertificateIssued(
            'Business foundations',
            'https://yerh.example.test/certificates/demo',
        ));

        $record = $user->unreadNotifications()->sole();
        $this->assertSame('course-certificate-issued', $record->type);
        $this->assertSame('Business foundations', $record->data['courseName']);
        $this->assertCount(1, Mail::mailer()->getSymfonyTransport()->messages());
    }
}
