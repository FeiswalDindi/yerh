<?php

namespace App\Notifications;

use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

final class WorkspaceAlert extends Notification
{
    public function __construct(
        private readonly string $message,
        private readonly string $url = '/dashboard',
        private readonly ?string $subject = null,
        private readonly ?string $actionLabel = null,
        private readonly bool $sendMail = true,
    ) {}

    public function via(object $notifiable): array
    {
        $canMail = $this->sendMail
            && (bool) config('yerh.mail_notifications', true)
            && ! empty($notifiable->email);

        return $canMail ? ['database', 'mail'] : ['database'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $name = isset($notifiable->name) && is_string($notifiable->name) && trim($notifiable->name) !== ''
            ? trim($notifiable->name)
            : 'there';
        $target = str_starts_with($this->url, 'http://') || str_starts_with($this->url, 'https://')
            ? $this->url
            : url($this->url);

        return (new MailMessage)
            ->subject($this->subject ?: 'YERH Platform Notification')
            ->greeting("Hello {$name},")
            ->line($this->message)
            ->action($this->actionLabel ?: 'Open YERH', $target)
            ->salutation("Regards,\nYouth Entrepreneurship Resource Hub");
    }

    public function toArray(object $notifiable): array
    {
        return [
            'message' => $this->message,
            'url' => $this->url,
            ...($this->subject ? ['subject' => $this->subject] : []),
        ];
    }

    public function databaseType(object $notifiable): string
    {
        return 'workspace-alert';
    }
}
