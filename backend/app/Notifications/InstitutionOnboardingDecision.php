<?php

namespace App\Notifications;

use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

final class InstitutionOnboardingDecision extends Notification
{
    public function __construct(
        private readonly string $institutionName,
        private readonly string $decision,
        private readonly ?string $note = null,
        private readonly ?string $institutionSlug = null,
    ) {}

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        if ($this->decision === 'approved') {
            $path = $this->institutionSlug
                ? '/account?institution='.rawurlencode($this->institutionSlug)
                : '/account';
            $mail = (new MailMessage)
                ->subject("Institution onboarding approved: {$this->institutionName}")
                ->greeting('Hello,')
                ->line("Your partner institution onboarding application for {$this->institutionName} has been approved.");

            if ($this->note) {
                $mail->line("Reviewer note: {$this->note}");
            }

            return $mail
                ->action('Open the Youth Entrepreneurship Resource Hub', url($path))
                ->line('Students and focal coordinators from your institution can now sign in and affiliate on the platform.');
        }

        $mail = (new MailMessage)
            ->subject("Update on your institution onboarding application: {$this->institutionName}")
            ->greeting('Hello,')
            ->line("Your partner institution onboarding application for {$this->institutionName} could not be approved at this time.");

        if ($this->note) {
            $mail->line("Reason: {$this->note}");
        }

        return $mail
            ->action('Contact the team', url('/contact?topic=Partnership'))
            ->line('You may reply via our contact page if you would like to update your details and reapply.');
    }
}
