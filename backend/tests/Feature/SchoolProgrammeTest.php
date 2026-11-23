<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

final class SchoolProgrammeTest extends TestCase
{
    use RefreshDatabase;

    public function test_school_staff_manage_offline_students_and_receive_individually_reviewed_certificates(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $staff = User::factory()->create(['role' => 'institution-admin']);
        $guest = User::factory()->create();
        $school = DB::table('institutions')->insertGetId([
            'name' => 'Test High School', 'slug' => 'test-high-school', 'kind' => 'high-school', 'status' => 'active',
        ]);
        DB::table('institutions')->insert([
            'name' => 'Other High School', 'slug' => 'other-high-school', 'kind' => 'high-school', 'status' => 'active',
        ]);
        DB::table('institution_access')->insert(['institution_id' => $school, 'user_id' => $staff->id, 'access' => 'manage']);
        $base = '/api/v1/workspace/schools/test-high-school';
        $queue = '/api/v1/workspace/school-certificates';
        $this->actingAs($guest)->getJson($base)->assertForbidden();
        $this->actingAs($staff)->getJson('/api/v1/workspace/schools/other-high-school')->assertForbidden();
        $student = $this->postJson($base.'/students', [
            'name' => 'Test Student', 'reference' => 'S123', 'grade' => 'Form 2', 'age' => 15,
        ])->assertOk()->json('data.id');
        $topStudent = $this->postJson($base.'/students', [
            'name' => 'Student Two', 'reference' => 'S124', 'grade' => 'Form 2', 'age' => 16,
        ])->assertOk()->json('data.id');
        $this->assertDatabaseCount('users', 3);
        $cohort = $this->postJson($base.'/cohorts', [
            'name' => 'Term 1', 'starts_on' => '2027-01-15', 'ends_on' => '2027-04-10',
        ])->assertCreated()->json('data.id');
        $base .= '/cohorts/'.$cohort;
        $venture = $this->postJson($base.'/teams', [
            'name' => 'Garden Group', 'sector' => 'Agribusiness', 'description' => 'School growing project',
            'students' => [$student, $topStudent],
        ])->assertCreated()->json('data.id');
        $this->postJson($base.'/classes', [
            'title' => 'Customer discovery', 'class_date' => '2027-01-16', 'teams' => [$venture],
        ])->assertCreated();
        $this->postJson($base.'/certificates/venture')->assertUnprocessable();
        $this->putJson($base."/results/$student/advanced", ['score' => 20])->assertUnprocessable();
        $this->putJson($base."/results/$student/getting-started", ['score' => 0])->assertOk();
        $this->putJson($base."/results/$student/advanced", ['score' => '49.50'])->assertOk();
        $this->putJson($base."/results/$topStudent/getting-started", ['score' => 80])->assertOk();
        $this->postJson($base.'/certificates/getting-started')->assertCreated()->assertJsonPath('data.requested', 2);
        $this->putJson($base."/results/$topStudent/getting-started", ['score' => 45])->assertUnprocessable();

        $items = $this->actingAs($admin)->getJson($queue)->assertOk()->json('data');
        $byStudent = collect($items)->keyBy('student_id');
        $this->assertSame('Completion', $byStudent[$student]['classification']);
        $this->assertSame('First Class', $byStudent[$topStudent]['classification']);
        $first = $byStudent[$student]['id'];
        $second = $byStudent[$topStudent]['id'];
        $this->postJson($queue."/$first/review", ['decision' => 'rejected'])->assertUnprocessable();
        $this->postJson($queue."/$first/review", ['decision' => 'rejected', 'note' => 'Attach a scoring note.'])->assertOk();
        $this->postJson($queue."/$second/review", ['decision' => 'approved'])->assertOk();

        $this->actingAs($staff)->getJson($base)->assertJsonFragment(['review_notes' => 'Attach a scoring note.']);
        $this->putJson($base."/results/$student/getting-started", ['score' => 45, 'notes' => 'Interview notes reviewed.'])->assertOk();
        $this->postJson($base.'/certificates/getting-started', ['student_id' => $student])->assertCreated();
        $this->putJson($base."/results/$student/funding", ['score' => 51])->assertOk();
        $this->postJson($base.'/certificates/venture')->assertCreated()->assertJsonPath('data.requested', 1);

        $document = DB::table('school_credentials')->where('id', $second)->value('document_id');
        $this->get($queue."/$document/document")->assertOk()->assertSee('First Class');
        $this->actingAs($guest)->get($queue."/$document/document")->assertForbidden();
        $this->getJson('/api/v1/marketplace')->assertExactJson(['data' => []]);
    }
}
