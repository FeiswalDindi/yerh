<?php

namespace App\Domain\Incubation;

use Illuminate\Support\Facades\DB;

final class ProgrammeFees
{
    public function __construct(private readonly Curriculum $curriculum) {}

    public function settings(): array
    {
        $settings = DB::table('programme_fee_settings')->get()->keyBy('purpose');

        return array_map(static fn ($purpose, $amount) => [
            'purpose' => $purpose,
            'amount' => (int) ($settings->get($purpose)->amount ?? $amount),
            'enabled' => (bool) ($settings->get($purpose)->enabled ?? true),
        ], array_keys($this->curriculum->defaultFees()), array_values($this->curriculum->defaultFees()));
    }

    public function for(string $purpose): array
    {
        return collect($this->settings())->firstWhere('purpose', $purpose)
            ?? ['purpose' => $purpose, 'amount' => 0, 'enabled' => true];
    }
}
