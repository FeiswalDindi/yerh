<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldBeEncrypted;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

final class InstitutionInvitationIssued extends Notification implements ShouldBeEncrypted, ShouldQueue
{
    use Queueable;

    public function __construct(
        private readonly string $institution,
        private readonly string $token,
    ) {}

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject('YERH institution invitation')
            ->line('You were invited to join '.$this->institution.' on YERH.')
            ->line('Sign in with this email address and verify it before accepting. This single-use invitation expires in seven days.')
            ->line($this->token)
            ->action('Accept invitation', url('/account/invitations/'.$this->token));
    }
}
