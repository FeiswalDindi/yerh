<?php

namespace App\Domain\Incubation;

use Illuminate\Support\Facades\File;

final class Curriculum
{
    public const STAGES = ['getting-started', 'advanced', 'funding'];

    public const CREDENTIALS = [...self::STAGES, 'venture'];

    public const FEE_PURPOSES = ['getting-started', 'advanced', 'marketplace'];

    public const PASS_MARK = 50;

    private ?array $source = null;

    public function stages(): array
    {
        return $this->training()['curriculum'];
    }

    public function stage(string $key): array
    {
        return collect($this->stages())->firstWhere('id', $key) ?? abort(404);
    }

    public function prerequisites(string $stage): array
    {
        $index = array_search($stage, self::STAGES, true);
        abort_if($index === false, 404);

        return array_slice(self::STAGES, 0, $index);
    }

    public function credentialStages(string $kind): array
    {
        abort_unless(in_array($kind, self::CREDENTIALS, true), 404);

        return $kind === 'venture' ? self::STAGES : [...$this->prerequisites($kind), $kind];
    }

    public function defaultFees(): array
    {
        return $this->training()['fees'];
    }

    private function training(): array
    {
        return $this->source ??= File::json(base_path('../frontend/src/mocks/data/platform.json'))['training'];
    }
}
