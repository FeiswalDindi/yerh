<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

final class CourseCertificateIssued extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        private readonly string $courseName,
        private readonly string $certificateUrl,
    ) {
        $this->afterCommit();
    }

    public function via(object $notifiable): array
    {
        return ['mail', 'database'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject('Your YERH course certificate is ready')
            ->line('Your certificate for '.$this->courseName.' is ready.')
            ->action('View certificate', $this->certificateUrl);
    }

    public function toArray(object $notifiable): array
    {
        return [
            'courseName' => $this->courseName,
            'url' => $this->certificateUrl,
        ];
    }

    public function databaseType(object $notifiable): string
    {
        return 'course-certificate-issued';
    }
}
