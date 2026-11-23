<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;

final class YerhCourseCatalogueSeeder extends Seeder
{
    public function run(): void
    {
        $source = base_path('../frontend/src/mocks/data/');
        $lessons = collect(File::json($source.'lessons.json'))->keyBy('id');
        $prices = File::json($source.'platform.json')['courseCommerce']['prices'];

        DB::transaction(function () use ($source, $lessons, $prices) {
            foreach (File::json($source.'learning.json') as $course) {
                if (DB::table('learning_courses')->where('slug', $course['id'])->exists()) {
                    continue;
                }
                $offer = $prices[$course['id']] ?? ['price' => 0, 'discount' => 0];
                $id = DB::table('learning_courses')->insertGetId([
                    'slug' => $course['id'], 'title' => $course['title'], 'level' => $course['level'],
                    'description' => str_replace(' in the local demo', '', $course['description']),
                    'price' => $offer['price'], 'discount' => $offer['discount'], 'status' => 'published',
                    'created_at' => now(), 'updated_at' => now(),
                ]);
                foreach ($course['lessonIds'] as $index => $lessonId) {
                    $lesson = $lessons->get($lessonId);
                    DB::table('learning_lessons')->insert([
                        'course_id' => $id, 'title' => $lesson['title'], 'url' => $lesson['href'], 'position' => $index + 1,
                    ]);
                }
            }
        });
    }
}
