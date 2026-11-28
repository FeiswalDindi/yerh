<?php

namespace App\Providers;

use App\Contracts\Learning\CourseCatalog;
use App\Integrations\Moodle\MoodleClient;
use App\Integrations\Moodle\MoodleCourseCatalog;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Mail\Events\MessageSent;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Str;
use Symfony\Component\Mime\Address;
use Throwable;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->bind(CourseCatalog::class, fn () => new MoodleCourseCatalog(
            siteUrl: (string) config('services.moodle.url'),
            token: (string) config('services.moodle.token'),
        ));

        $this->app->bind(MoodleClient::class, fn () => new MoodleClient(
            siteUrl: (string) config('services.moodle.url'),
            token: (string) config('services.moodle.token'),
            userAuth: (string) config('services.moodle.user_auth', 'manual'),
            studentRoleId: (int) config('services.moodle.student_role_id', 5),
            mentorRoleId: (int) config('services.moodle.mentor_role_id', 4),
            ssoSecret: (string) config('services.moodle.sso_secret', ''),
        ));
    }

    public function boot(): void
    {
        RateLimiter::for('auth-login', function (Request $request): Limit {
            $email = Str::lower(trim((string) $request->input('email', '')));

            return Limit::perMinute(8)->by($email.'|'.$request->ip());
        });

        RateLimiter::for('auth-register', fn (Request $request): Limit => Limit::perMinute(5)->by((string) $request->ip()));

        RateLimiter::for('auth-password-reset', function (Request $request): Limit {
            $email = Str::lower(trim((string) $request->input('email', '')));

            return Limit::perMinute(5)->by($email.'|'.$request->ip());
        });

        RateLimiter::for('auth-oauth', fn (Request $request): Limit => Limit::perMinute(15)->by((string) $request->ip()));

        Event::listen(MessageSent::class, function (MessageSent $event): void {
            try {
                if (! Schema::hasTable('sent_emails')) {
                    return;
                }

                $toAddresses = $event->message->getTo();
                $toEmails = [];
                $toNames = [];
                foreach ($toAddresses as $address) {
                    if ($address instanceof Address) {
                        $toEmails[] = $address->getAddress();
                        if ($address->getName() !== '') {
                            $toNames[] = $address->getName();
                        }
                    }
                }

                $fromAddresses = $event->message->getFrom();
                $fromEmail = null;
                if ($fromAddresses !== [] && $fromAddresses[0] instanceof Address) {
                    $fromEmail = Str::limit($fromAddresses[0]->getAddress(), 254, '');
                }

                $htmlBody = $event->message->getHtmlBody();
                $textBody = $event->message->getTextBody();

                DB::table('sent_emails')->insert([
                    'to_email' => Str::limit(implode(', ', $toEmails) ?: 'unknown@example.test', 254, ''),
                    'to_name' => $toNames !== [] ? Str::limit(implode(', ', $toNames), 120, '') : null,
                    'from_email' => $fromEmail ?: Str::limit((string) config('mail.from.address', 'notifications@example.test'), 254, ''),
                    'subject' => Str::limit((string) ($event->message->getSubject() ?? '(No subject)'), 255, ''),
                    'html_body' => is_string($htmlBody) ? $htmlBody : null,
                    'text_body' => is_string($textBody) ? $textBody : null,
                    'mailer' => Str::limit((string) ($event->data['mailer'] ?? config('mail.default', 'log')), 40, ''),
                    'created_at' => now(),
                ]);
            } catch (Throwable) {
                // Never disrupt mail dispatch or transactions if email capture table is unavailable.
            }
        });
    }
}
