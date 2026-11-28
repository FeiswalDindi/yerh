<?php

namespace App\Models;

use App\Notifications\ResetAccountPassword;
use App\Notifications\VerifyAccountEmail;
use Database\Factories\UserFactory;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

class User extends Authenticatable implements MustVerifyEmail
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'first_name',
        'last_name',
        'email',
        'password',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    public function sendEmailVerificationNotification(): void
    {
        $this->notify(new VerifyAccountEmail);
    }

    public function sendPasswordResetNotification($token): void
    {
        $this->notify(new ResetAccountPassword($token));
    }

    public function isActive(): bool
    {
        return $this->suspended_at === null;
    }

    public function hasPassword(): bool
    {
        return is_string($this->password) && $this->password !== '';
    }

    /**
     * Split a full name into guaranteed non-empty [first_name, last_name] parts.
     *
     * @return array{0: string, 1: string}
     */
    public static function splitFullName(string $fullName): array
    {
        $normalized = preg_replace('/\s+/', ' ', trim($fullName)) ?? '';
        if ($normalized === '') {
            return ['YERH', 'Member'];
        }

        $parts = explode(' ', $normalized, 2);
        $first = mb_substr($parts[0], 0, 80);
        $last = isset($parts[1]) && trim($parts[1]) !== ''
            ? mb_substr(trim($parts[1]), 0, 80)
            : 'Member';

        return [$first, $last];
    }

    /**
     * Return Moodle-safe non-empty firstname and lastname fields.
     *
     * @return array{firstname: string, lastname: string}
     */
    public function moodleNames(): array
    {
        $first = trim((string) ($this->first_name ?? ''));
        $last = trim((string) ($this->last_name ?? ''));
        if ($first !== '' && $last !== '') {
            return [
                'firstname' => mb_substr($first, 0, 80),
                'lastname' => mb_substr($last, 0, 80),
            ];
        }

        [$fallbackFirst, $fallbackLast] = self::splitFullName((string) ($this->name ?? ''));

        return [
            'firstname' => $first !== '' ? mb_substr($first, 0, 80) : $fallbackFirst,
            'lastname' => $last !== '' ? mb_substr($last, 0, 80) : $fallbackLast,
        ];
    }

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'terms_accepted_at' => 'datetime',
            'suspended_at' => 'datetime',
            'password' => 'hashed',
        ];
    }
}
