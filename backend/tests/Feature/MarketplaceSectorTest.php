<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

final class MarketplaceSectorTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_add_a_category_and_replace_its_public_picture(): void
    {
        Storage::fake('local');
        $url = '/api/v1/workspace/marketplace-sectors';
        $this->getJson('/api/v1/marketplace-sectors')->assertOk()->assertJsonCount(5, 'data');
        $this->actingAs(User::factory()->create())->postJson($url, ['name' => 'Energy'])->assertForbidden();
        $this->actingAs(User::factory()->create(['role' => 'admin']));
        $id = $this->postJson($url, ['name' => 'Energy'])->assertCreated()->json('data.id');
        $this->postJson($url, ['name' => 'Energy'])->assertUnprocessable();
        $this->postJson("$url/$id/image", ['photo' => UploadedFile::fake()->create('notes.txt', 1, 'text/plain')])->assertUnprocessable();
        $png = file_get_contents(base_path('../frontend/public/media/health-c8d73354.png'));
        $replacement = fn () => UploadedFile::fake()->createWithContent('health.png', $png);
        $this->postJson("$url/$id/image", ['photo' => $replacement()])->assertOk();
        $this->postJson("$url/$id/image", ['photo' => $replacement()])->assertOk();
        $this->assertCount(1, Storage::disk('local')->files('marketplace-sectors'));
        $record = collect($this->getJson('/api/v1/marketplace-sectors')->json('data'))->firstWhere('id', $id);
        $this->assertSame(0, $record['count']);
        $this->get($record['image'])->assertOk()->assertHeader('content-type', 'image/png');

        $webp = $this->get($record['image'], ['Accept' => 'image/webp,image/*,*/*;q=0.8'])
            ->assertOk()
            ->assertHeader('content-type', 'image/webp')
            ->assertHeader('Vary', 'Accept');

        $etag = (string) $webp->headers->get('ETag');
        $this->assertNotSame('', $etag);

        $this->get($record['image'], ['Accept' => 'image/webp', 'If-None-Match' => $etag])
            ->assertStatus(304);
    }
}
