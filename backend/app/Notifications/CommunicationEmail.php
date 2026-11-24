<?php

namespace App\Notifications;

use Illuminate\Notifications\AnonymousNotifiable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Str;

final class CommunicationEmail extends Notification
{
    public function __construct(
        private readonly string $subject,
        private readonly string $body,
        private readonly string $channel = 'both',
        private readonly ?string $actionLabel = null,
        private readonly ?string $actionUrl = null,
        private readonly ?string $replyTo = null,
        private readonly ?string $recipientName = null,
    ) {}

    public function via(object $notifiable): array
    {
        if ($notifiable instanceof AnonymousNotifiable) {
            return ['mail'];
        }

        return match ($this->channel) {
            'email' => ['mail'],
            'notification' => ['database'],
            default => ['mail', 'database'],
        };
    }

    public function toMail(object $notifiable): MailMessage
    {
        $name = $this->recipientName
            ?: (isset($notifiable->name) && is_string($notifiable->name) ? trim($notifiable->name) : '')
            ?: 'there';

        $mail = (new MailMessage)
            ->subject($this->subject)
            ->greeting("Hello {$name},");

        if ($this->replyTo) {
            $mail->replyTo($this->replyTo);
        }

        $paragraphs = preg_split('/\r?\n\r?\n/', trim($this->body)) ?: [];
        foreach ($paragraphs as $paragraph) {
            $lines = array_values(array_filter(array_map('trim', preg_split('/\r?\n/', $paragraph) ?: []), static fn ($line) => $line !== ''));
            foreach ($lines as $line) {
                $mail->line($line);
            }
        }

        if ($this->actionLabel && $this->actionUrl) {
            $target = str_starts_with($this->actionUrl, 'http://') || str_starts_with($this->actionUrl, 'https://')
                ? $this->actionUrl
                : url($this->actionUrl);
            $mail->action($this->actionLabel, $target);
        }

        return $mail->salutation("Regards,\nYouth Entrepreneurship Resource Hub");
    }

    public function toArray(object $notifiable): array
    {
        $snippet = Str::limit((string) preg_replace('/\s+/', ' ', trim($this->body)), 180);

        return [
            'message' => "{$this->subject} — {$snippet}",
            'subject' => $this->subject,
            'url' => $this->actionUrl ?: '/account/notifications',
        ];
    }

    public function databaseType(object $notifiable): string
    {
        return 'communication-message';
    }
}
