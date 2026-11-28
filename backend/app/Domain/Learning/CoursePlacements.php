<?php

namespace App\Domain\Learning;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

final class CoursePlacements
{
    public const SETTINGS_KEY = 'course_placements';

    /**
     * @return list<array{
     *     key: string,
     *     label: string,
     *     description: string,
     *     visible_on_public_learn: bool,
     *     auto_attach_incubation: bool,
     *     institution_scoped: bool,
     *     is_draft: bool,
     *     system: bool
     * }>
     */
    public static function defaults(): array
    {
        return [
            [
                'key' => 'public',
                'label' => 'Public catalogue (/learn)',
                'description' => 'Shown on the public YERH course storefront and open for learner enrolment.',
                'visible_on_public_learn' => true,
                'auto_attach_incubation' => false,
                'institution_scoped' => false,
                'is_draft' => false,
                'system' => true,
            ],
            [
                'key' => 'incubation',
                'label' => 'Incubation pathway (Model A)',
                'description' => 'Hidden from public /learn; automatically assigned to ventures when a mentor is linked.',
                'visible_on_public_learn' => false,
                'auto_attach_incubation' => true,
                'institution_scoped' => false,
                'is_draft' => false,
                'system' => true,
            ],
            [
                'key' => 'institution',
                'label' => 'Institution exclusive',
                'description' => 'Reserved for partner universities and innovation hubs.',
                'visible_on_public_learn' => false,
                'auto_attach_incubation' => false,
                'institution_scoped' => true,
                'is_draft' => false,
                'system' => true,
            ],
            [
                'key' => 'draft',
                'label' => 'Hidden draft',
                'description' => 'Kept unpublished while preparing content in Moodle or YERH.',
                'visible_on_public_learn' => false,
                'auto_attach_incubation' => false,
                'institution_scoped' => false,
                'is_draft' => true,
                'system' => true,
            ],
        ];
    }

    /**
     * @return list<array{
     *     key: string,
     *     label: string,
     *     description: string,
     *     visible_on_public_learn: bool,
     *     auto_attach_incubation: bool,
     *     institution_scoped: bool,
     *     is_draft: bool,
     *     system: bool
     * }>
     */
    public function all(): array
    {
        $raw = DB::table('platform_settings')->where('key', self::SETTINGS_KEY)->value('value');
        $decoded = is_string($raw) ? json_decode($raw, true) : null;
        if (! is_array($decoded) || $decoded === []) {
            return self::defaults();
        }

        $items = [];
        $seen = [];
        foreach ($decoded as $entry) {
            if (! is_array($entry)) {
                continue;
            }
            $key = $this->normalizeKey((string) ($entry['key'] ?? ''));
            if ($key === '' || isset($seen[$key])) {
                continue;
            }
            $seen[$key] = true;
            $isDraft = $key === 'draft' ? true : (bool) ($entry['is_draft'] ?? false);
            $items[] = [
                'key' => $key,
                'label' => Str::limit(trim((string) ($entry['label'] ?? $key)) ?: $key, 80, ''),
                'description' => Str::limit(trim((string) ($entry['description'] ?? '')), 300, ''),
                'visible_on_public_learn' => $isDraft ? false : (bool) ($entry['visible_on_public_learn'] ?? false),
                'auto_attach_incubation' => $isDraft ? false : (bool) ($entry['auto_attach_incubation'] ?? false),
                'institution_scoped' => $isDraft ? false : (bool) ($entry['institution_scoped'] ?? false),
                'is_draft' => $isDraft,
                'system' => (bool) ($entry['system'] ?? in_array($key, ['public', 'incubation', 'institution', 'draft'], true)),
            ];
        }

        if (! isset($seen['draft'])) {
            $items[] = self::defaults()[3];
        }

        return $items;
    }

    /**
     * @return list<string>
     */
    public function keys(): array
    {
        return array_column($this->all(), 'key');
    }

    /**
     * @return list<string>
     */
    public function publicKeys(): array
    {
        return array_values(array_column(
            array_filter($this->all(), static fn (array $item): bool => $item['visible_on_public_learn'] && ! $item['is_draft']),
            'key'
        ));
    }

    /**
     * @return list<string>
     */
    public function incubationKeys(): array
    {
        return array_values(array_column(
            array_filter($this->all(), static fn (array $item): bool => $item['auto_attach_incubation'] && ! $item['is_draft']),
            'key'
        ));
    }

    public function isDraft(string $key): bool
    {
        foreach ($this->all() as $item) {
            if ($item['key'] === $key) {
                return $item['is_draft'];
            }
        }

        return $key === 'draft';
    }

    /**
     * @param  list<array<string, mixed>>  $items
     * @return list<array<string, mixed>>
     */
    public function save(array $items, int $updatedBy): array
    {
        $normalized = [];
        $seen = [];

        foreach ($items as $index => $entry) {
            $rawKey = trim((string) ($entry['key'] ?? ''));
            $label = trim((string) ($entry['label'] ?? ''));
            $key = $this->normalizeKey($rawKey !== '' ? $rawKey : $label);
            if ($key === '' || ! preg_match('/^[a-z0-9][a-z0-9_-]{1,23}$/', $key)) {
                throw ValidationException::withMessages([
                    "placements.{$index}.key" => 'Each placement key must be 2–24 lowercase letters, numbers, hyphens, or underscores.',
                ]);
            }
            if (isset($seen[$key])) {
                throw ValidationException::withMessages([
                    "placements.{$index}.key" => "Duplicate placement key '{$key}'.",
                ]);
            }
            if ($label === '') {
                throw ValidationException::withMessages([
                    "placements.{$index}.label" => 'Each placement needs a display label.',
                ]);
            }
            $seen[$key] = true;
            $isDraft = $key === 'draft' ? true : (bool) ($entry['is_draft'] ?? false);
            $normalized[] = [
                'key' => $key,
                'label' => Str::limit($label, 80, ''),
                'description' => Str::limit(trim((string) ($entry['description'] ?? '')), 300, ''),
                'visible_on_public_learn' => $isDraft ? false : (bool) ($entry['visible_on_public_learn'] ?? false),
                'auto_attach_incubation' => $isDraft ? false : (bool) ($entry['auto_attach_incubation'] ?? false),
                'institution_scoped' => $isDraft ? false : (bool) ($entry['institution_scoped'] ?? false),
                'is_draft' => $isDraft,
                'system' => in_array($key, ['public', 'incubation', 'institution', 'draft'], true),
            ];
        }

        if (! isset($seen['draft'])) {
            throw ValidationException::withMessages([
                'placements' => 'The Hidden draft placement cannot be removed.',
            ]);
        }

        $nextKeys = array_keys($seen);
        $inUse = DB::table('learning_courses')
            ->whereNotIn('placement', $nextKeys)
            ->distinct()
            ->pluck('placement')
            ->all();

        if ($inUse !== []) {
            throw ValidationException::withMessages([
                'placements' => 'Cannot remove placement(s) still assigned to courses: '.implode(', ', $inUse).'.',
            ]);
        }

        DB::table('platform_settings')->upsert([[
            'key' => self::SETTINGS_KEY,
            'value' => json_encode($normalized, JSON_THROW_ON_ERROR),
            'updated_by' => $updatedBy,
            'created_at' => now(),
            'updated_at' => now(),
        ]], ['key'], ['value', 'updated_by', 'updated_at']);

        return $normalized;
    }

    private function normalizeKey(string $raw): string
    {
        return Str::limit(Str::slug($raw, '-'), 24, '');
    }
}
