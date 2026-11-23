<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;

final class YerhEditorialCatalogueSeeder extends Seeder
{
    public function run(): void
    {
        $directory = base_path('../frontend/src/mocks/data/');
        foreach (['blogs', 'stories', 'reports'] as $collection) {
            $records = collect(File::json($directory.$collection.'.json'))
                ->reject(fn ($record) => str_starts_with($record['source']['path'], 'local-demo'))
                ->map(fn ($record) => [
                    'content_id' => $record['id'], 'kind' => $record['kind'], 'slug' => $record['slug'],
                    'status' => ($record['status'] ?? 'published') === 'archived' ? 'archived' : 'published',
                    'payload' => json_encode($record, JSON_THROW_ON_ERROR), 'created_at' => now(), 'updated_at' => now(),
                ]);
            DB::table('editorial_content')->upsert($records->values()->all(), ['content_id'], ['content_id']);
        }
    }
}
