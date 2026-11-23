<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\TestCase;

final class WorkspaceContentTest extends TestCase
{
    use RefreshDatabase;

    public function test_content_publication_and_archiving(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $guest = User::factory()->create(['role' => 'guest']);
        $url = '/api/v1/workspace/editorial';
        $public = '/api/v1/editorial';
        $data = [
            'title' => 'New project', 'kind' => 'story', 'category' => 'Teams', 'excerpt' => 'A story about a team.',
            'blocks' => [['type' => 'paragraph', 'text' => 'The team put its idea into practice.']],
            'status' => 'draft', 'featured' => true,
        ];
        $this->actingAs($guest)->postJson($url, $data)->assertForbidden();
        $record = $this->actingAs($admin)->postJson($url, $data)->assertOk()->json('data.id');
        $this->getJson($public)->assertJsonCount(0, 'data.items')->assertJsonCount(0, 'data.hidden');
        $data['status'] = 'published';
        $this->patchJson($url.'/'.$record, $data)->assertOk();
        $this->actingAs($guest)->getJson($public)->assertJsonPath('data.items.0.title', 'New project')->assertJsonCount(1, 'data.featured');
        $data['status'] = 'archived';
        $this->actingAs($admin)->patchJson($url.'/'.$record, $data)->assertOk();
        $this->getJson($public)->assertJsonCount(0, 'data.items');
    }

    public function test_agreement_documents_and_notifications_are_account_scoped(): void
    {
        Storage::fake('local');
        $admin = User::factory()->create(['role' => 'admin']);
        $manager = User::factory()->create(['role' => 'institution-admin']);
        $unrelated = User::factory()->create();
        $institution = DB::table('institutions')->insertGetId([
            'name' => 'Agreement Hub', 'slug' => 'agreement-hub', 'kind' => 'hub', 'status' => 'active',
        ]);
        DB::table('institution_access')->insert([
            'institution_id' => $institution, 'user_id' => $manager->id, 'access' => 'view',
        ]);
        $path = '/api/v1/workspace/institutions/agreement-hub/agreements';
        $agreement = $this->actingAs($admin)->post($path, [
            'reference' => 'AGREEMENT-TEST', 'document' => UploadedFile::fake()->create('agreement.pdf', 10, 'application/pdf'),
        ], ['Accept' => 'application/json'])->assertCreated()->json('data.id');
        $this->actingAs($manager)->getJson($path)->assertJsonPath('data.0.reference', 'AGREEMENT-TEST');
        $this->get($path.'/'.$agreement)->assertOk();
        $this->postJson($path)->assertForbidden();
        $this->actingAs($unrelated)->get($path.'/'.$agreement)->assertForbidden();

        $notification = Str::uuid()->toString();
        $manager->notifications()->create([
            'id' => $notification, 'type' => 'course-certificate-issued',
            'data' => ['courseName' => 'Foundations', 'url' => 'http://127.0.0.1/api/v1/learning/certificates/example'],
        ]);
        $inbox = '/api/v1/notifications';
        $this->getJson($inbox)->assertJsonPath('data.unread', 0);
        $this->postJson($inbox.'/'.$notification.'/read')->assertNotFound();
        $this->actingAs($manager)->getJson($inbox)->assertJsonPath('data.unread', 1);
        $this->postJson($inbox.'/'.$notification.'/read')->assertNoContent();
        $this->getJson($inbox)->assertJsonPath('data.unread', 0);
    }
}
