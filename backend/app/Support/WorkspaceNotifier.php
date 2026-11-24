<?php

namespace App\Support;

use App\Models\User;
use App\Notifications\CommunicationEmail;
use App\Notifications\WorkspaceAlert;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Notification;
use Throwable;

final class WorkspaceNotifier
{
    public static function notifyUser(
        ?int $userId,
        string $message,
        string $url = '/dashboard',
        ?string $subject = null,
        ?string $actionLabel = null,
    ): void {
        if (! $userId) {
            return;
        }

        $user = User::query()
            ->whereKey($userId)
            ->whereNull('suspended_at')
            ->whereNotNull('email_verified_at')
            ->first();

        if ($user) {
            self::deliver($user, $message, $url, $subject, $actionLabel);
        }
    }

    /**
     * @param  list<string>  $roles
     */
    public static function notifyRoles(
        array $roles,
        string $message,
        string $url = '/dashboard',
        ?string $subject = null,
        ?string $actionLabel = null,
    ): void {
        if ($roles === []) {
            return;
        }

        $recipients = User::query()
            ->whereIn('role', $roles)
            ->whereNull('suspended_at')
            ->whereNotNull('email_verified_at')
            ->get();

        foreach ($recipients as $recipient) {
            self::deliver($recipient, $message, $url, $subject, $actionLabel);
        }
    }

    public static function notifyAdmins(
        string $message,
        string $url = '/dashboard',
        ?string $subject = null,
        ?string $actionLabel = null,
    ): void {
        self::notifyRoles(['admin'], $message, $url, $subject, $actionLabel);
    }

    public static function notifyContentTeam(
        string $message,
        string $url = '/dashboard',
        ?string $subject = null,
        ?string $actionLabel = null,
    ): void {
        self::notifyRoles(['admin', 'content_manager'], $message, $url, $subject, $actionLabel);
    }

    public static function notifyExternalEmail(
        string $email,
        string $name,
        string $subject,
        string $body,
        ?string $actionLabel = null,
        ?string $actionUrl = null,
        ?string $replyTo = null,
    ): bool {
        try {
            Notification::route('mail', $email)->notify(
                new CommunicationEmail(
                    subject: $subject,
                    body: $body,
                    channel: 'email',
                    actionLabel: $actionLabel,
                    actionUrl: $actionUrl,
                    replyTo: $replyTo,
                    recipientName: $name,
                ),
            );

            return true;
        } catch (Throwable $exception) {
            Log::warning('External email delivery failed', [
                'email' => $email,
                'subject' => $subject,
                'error' => $exception->getMessage(),
            ]);

            return false;
        }
    }

    private static function deliver(
        User $user,
        string $message,
        string $url,
        ?string $subject,
        ?string $actionLabel,
    ): void {
        try {
            $user->notify(new WorkspaceAlert($message, $url, $subject, $actionLabel, sendMail: true));
        } catch (Throwable $exception) {
            Log::warning('Workspace email delivery failed; falling back to in-app alert.', [
                'user_id' => $user->id,
                'error' => $exception->getMessage(),
            ]);

            try {
                $user->notify(new WorkspaceAlert($message, $url, $subject, $actionLabel, sendMail: false));
            } catch (Throwable $fallbackException) {
                Log::warning('Workspace alert delivery failed.', [
                    'user_id' => $user->id,
                    'error' => $fallbackException->getMessage(),
                ]);
            }
        }
    }
}
