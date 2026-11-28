<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $ids = DB::table('learning_lessons')
            ->whereNotNull('url')
            ->where(function ($query) {
                $query->whereRaw('LOWER(url) LIKE ?', ['%youtube.com%'])
                    ->orWhereRaw('LOWER(url) LIKE ?', ['%youtu.be%'])
                    ->orWhereRaw('LOWER(url) LIKE ?', ['%youtube-nocookie.com%']);
            })
            ->pluck('id')
            ->all();

        if (! empty($ids)) {
            DB::table('learning_completions')->whereIn('lesson_id', $ids)->delete();
            DB::table('learning_lessons')->whereIn('id', $ids)->delete();
        }
    }

    public function down(): void
    {
        // One-way cleanup of seeded YouTube lesson rows.
    }
};
