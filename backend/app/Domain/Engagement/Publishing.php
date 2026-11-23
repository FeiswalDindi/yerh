<?php

namespace App\Domain\Engagement;

use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

final class Publishing
{
    public static function slug(string $title, string $fallback): string
    {
        return (Str::slug(Str::limit($title, 100, '')) ?: $fallback).'-'.Str::lower(Str::random(10));
    }

    public static function time(?string $value, bool $forEditing = false): ?string
    {
        if (! $value) {
            return null;
        }

        return $forEditing
            ? Carbon::parse($value, 'UTC')->setTimezone('Africa/Nairobi')->format('Y-m-d\TH:i')
            : Carbon::parse($value, 'Africa/Nairobi')->utc()->format('Y-m-d H:i:s');
    }
}
