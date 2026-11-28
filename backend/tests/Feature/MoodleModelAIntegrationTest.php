<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

final class MoodleModelAIntegrationTest extends TestCase
{
    use RefreshDatabase;

    public function test_register_supports_first_and_last_name_and_legacy_full_name(): void
    {
        Notification::fake();

        $this->postJson('/api/v1/auth/register', [
            'first_name' => 'Amina',
            'last_name' => 'Wanjiku',
            'email' => 'amina@example.test',
            'password' => 'Secret123!',
            'password_confirmation' => 'Secret123!',
        ])->assertCreated()
            ->assertJsonPath('data.first_name', 'Amina')
            ->assertJsonPath('data.last_name', 'Wanjiku')
            ->assertJsonPath('data.name', 'Amina Wanjiku');

        $this->postJson('/api/v1/auth/logout')->assertNoContent();

        $this->postJson('/api/v1/auth/register', [
            'name' => 'SingleWord',
            'email' => 'single@example.test',
            'password' => 'Secret123!',
            'password_confirmation' => 'Secret123!',
        ])->assertCreated()
            ->assertJsonPath('data.first_name', 'SingleWord')
            ->assertJsonPath('data.last_name', 'Member');
    }

    public function test_moodle_course_sync_publish_enrolment_and_completion(): void
    {
        config([
            'services.moodle.url' => 'https://lms.example.test',
            'services.moodle.token' => 'secret-token',
            'services.moodle.user_auth' => 'oauth2',
        ]);
        Http::preventStrayRequests();
        Http::fake(function (Request $request) {
            return match ($request['wsfunction']) {
                'core_course_get_courses_by_field' => Http::response([
                    'courses' => [
                        ['id' => 1, 'shortname' => 'SITE', 'fullname' => 'Site', 'format' => 'site'],
                        [
                            'id' => 3,
                            'shortname' => 'YERH-BIZ-101',
                            'fullname' => 'Business Foundations',
                            'summary' => '<p>Core venture fundamentals.</p>',
                            'categoryid' => 1,
                            'visible' => 1,
                        ],
                    ],
                ]),
                'core_user_get_users_by_field' => Http::response([]),
                'core_user_create_users' => Http::response([['id' => 42, 'username' => 'yerh_2']]),
                'enrol_manual_enrol_users' => Http::response(null),
                'core_completion_get_course_completion_status' => Http::response([
                    'completionstatus' => ['completed' => true],
                ]),
                'core_completion_get_activities_completion_status' => Http::response([
                    'statuses' => [['state' => 1, 'tracking' => 1]],
                ]),
                'gradereport_user_get_grade_items' => Http::response([
                    'usergrades' => [['gradeitems' => [['itemtype' => 'course', 'graderaw' => 88, 'grademax' => 100]]]],
                ]),
                default => Http::response(['exception' => 'unexpected', 'message' => $request['wsfunction']]),
            };
        });

        $admin = User::factory()->create(['role' => 'admin']);
        $student = User::factory()->create([
            'role' => 'guest',
            'name' => 'Kiprop Tanui',
            'first_name' => 'Kiprop',
            'last_name' => 'Tanui',
        ]);

        // Sync imports Moodle courses as hidden drafts (not on public /learn yet).
        $this->actingAs($admin)
            ->postJson('/api/v1/learning/moodle/sync')
            ->assertOk()
            ->assertJsonPath('data.synced', 1)
            ->assertJsonPath('data.created', 1);

        $this->getJson('/api/v1/learning')->assertOk()->assertJsonCount(0, 'data');

        $course = DB::table('learning_courses')->where('moodle_course_id', 3)->first();
        $this->assertNotNull($course);
        $this->assertSame('draft', $course->placement);

        // Admin can publish Moodle-backed course with zero local lessons.
        $this->actingAs($admin)->postJson('/api/v1/learning/authoring/'.$course->id.'/publish', [
            'price' => 0,
            'discount' => 0,
            'royalty_rate' => 0,
            'placement' => 'public',
            'featured' => true,
        ])->assertOk();

        $this->getJson('/api/v1/learning')->assertOk()->assertJsonCount(1, 'data');

        // Student enrols for free -> auto-creates Moodle user & enrols in course 3.
        $this->actingAs($student)->postJson('/api/v1/learning/courses/'.$course->slug.'/enrolments')
            ->assertOk();

        $this->assertSame(42, (int) $student->fresh()->moodle_user_id);

        // Student sees signed Moodle launch URL and auto-synced completion -> unlocks certificate.
        $this->actingAs($student)
            ->getJson('/api/v1/learning/courses/'.$course->slug)
            ->assertOk()
            ->assertJsonPath('data.enrolment.moodle_launch_url', '/api/v1/learning/moodle/launch?slug='.$course->slug)
            ->assertJsonPath('data.enrolment.moodle_progress', 100);

        $this->actingAs($student)
            ->postJson('/api/v1/learning/courses/'.$course->slug.'/sync-progress')
            ->assertOk()
            ->assertJsonPath('data.completed', true)
            ->assertJsonPath('data.progress', 100);

        $this->actingAs($student)
            ->getJson('/api/v1/learning')
            ->assertOk()
            ->assertJsonPath('data.0.enrolment_status', 'confirmed')
            ->assertJsonPath('data.0.enrolment_progress', 100)
            ->assertJsonPath('data.0.enrolment_completed', true);

        $enrolment = DB::table('learning_enrolments')->where('learner_id', $student->id)->first();
        $this->assertNotNull($enrolment->completed_at);

        $this->actingAs($admin)
            ->postJson('/api/v1/learning/registry/'.$enrolment->id.'/certificate')
            ->assertOk()
            ->assertJsonStructure(['data' => ['certificate_id']]);
    }

    public function test_model_a_incubation_enrols_group_and_graduates_from_moodle(): void
    {
        config([
            'services.moodle.url' => 'https://lms.example.test',
            'services.moodle.token' => 'secret-token',
            'services.moodle.user_auth' => 'oauth2',
        ]);
        Http::preventStrayRequests();
        $nextUserId = 100;
        Http::fake(function (Request $request) use (&$nextUserId) {
            return match ($request['wsfunction']) {
                'core_user_get_users_by_field' => Http::response([]),
                'core_user_create_users' => Http::response([['id' => ++$nextUserId]]),
                'enrol_manual_enrol_users' => Http::response(null),
                'core_group_get_course_groups' => Http::response([]),
                'core_group_create_groups' => Http::response([['id' => 77]]),
                'core_group_add_group_members' => Http::response(null),
                'core_completion_get_course_completion_status' => Http::response([
                    'completionstatus' => ['completed' => true],
                ]),
                'core_completion_get_activities_completion_status' => Http::response([
                    'statuses' => [['state' => 1, 'tracking' => 1]],
                ]),
                'gradereport_user_get_grade_items' => Http::response([
                    'usergrades' => [['gradeitems' => [['itemtype' => 'course', 'graderaw' => 82, 'grademax' => 100]]]],
                ]),
                default => Http::response(['exception' => 'unexpected', 'message' => $request['wsfunction']]),
            };
        });

        $admin = User::factory()->create(['role' => 'admin']);
        $founder = User::factory()->create(['role' => 'entrepreneur', 'first_name' => 'Grace', 'last_name' => 'Njeri']);
        $mentor = User::factory()->create(['role' => 'mentor', 'first_name' => 'David', 'last_name' => 'Otieno']);

        $institutionId = DB::table('institutions')->insertGetId([
            'slug' => 'kca',
            'name' => 'KCA Hub',
            'kind' => 'university',
            'status' => 'active',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('learning_courses')->insert([
            'slug' => 'yerh-incubation',
            'title' => 'YERH Venture Incubation Programme',
            'description' => 'Model A Incubation',
            'level' => 'Moodle',
            'price' => 0,
            'discount' => 0,
            'royalty_rate' => 0,
            'status' => 'published',
            'placement' => 'incubation',
            'moodle_course_id' => 2,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $ventureId = DB::table('ventures')->insertGetId([
            'owner_id' => $founder->id,
            'institution_id' => $institutionId,
            'sector' => 'Agribusiness',
            'name' => 'GreenPulse Farms',
            'location' => 'Nairobi',
            'description' => 'Solar irrigation kits',
            'status' => 'approved',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $pathId = $this->actingAs($founder)
            ->postJson('/api/v1/workspace/ventures/'.$ventureId.'/launch', [])
            ->assertCreated()
            ->json('data.id');

        $this->actingAs($admin)
            ->postJson('/api/v1/workspace/incubation/'.$pathId.'/mentor', ['mentor_id' => $mentor->id])
            ->assertOk();

        $path = DB::table('incubation_paths')->where('id', $pathId)->first();
        $this->assertSame(2, (int) $path->moodle_course_id);
        $this->assertSame(77, (int) $path->moodle_group_id);

        // Sync Moodle completion -> graduates venture and unlocks Venture Certificate.
        $this->actingAs($founder)
            ->postJson('/api/v1/workspace/incubation/'.$pathId.'/sync-moodle')
            ->assertOk()
            ->assertJsonPath('data.graduated', true)
            ->assertJsonPath('data.score', 82);

        $certs = $this->actingAs($founder)
            ->getJson('/api/v1/workspace/venture-certificates')
            ->assertOk()
            ->json('data');
        $this->assertNotEmpty(array_filter($certs, fn ($c) => $c['kind'] === 'venture'));
    }

    public function test_signed_moodle_sso_launch_redirects_with_hmac_signature_and_blocks_unauthorized_users(): void
    {
        config([
            'services.moodle.url' => 'https://lms.example.test',
            'services.moodle.token' => 'secret-token',
            'services.moodle.user_auth' => 'manual',
            'services.moodle.sso_secret' => 'test-sso-secret-1234',
        ]);
        Http::preventStrayRequests();
        Http::fake([
            '*' => Http::response(null),
        ]);

        $student = User::factory()->create(['role' => 'guest', 'moodle_user_id' => 42]);
        $stranger = User::factory()->create(['role' => 'guest', 'moodle_user_id' => 99]);

        $courseId = DB::table('learning_courses')->insertGetId([
            'slug' => 'business-foundations',
            'title' => 'Business foundations',
            'description' => 'Startup modules',
            'level' => 'Beginner',
            'price' => 0,
            'discount' => 0,
            'royalty_rate' => 0,
            'status' => 'published',
            'placement' => 'public',
            'moodle_course_id' => 3,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('learning_enrolments')->insert([
            'course_id' => $courseId,
            'learner_id' => $student->id,
            'payment_status' => 'confirmed',
            'payment_reference' => 'FREE-1',
            'price_paid' => 0,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->actingAs($stranger)
            ->get('/api/v1/learning/moodle/launch?slug=business-foundations')
            ->assertForbidden();

        $response = $this->actingAs($student)
            ->get('/api/v1/learning/moodle/launch?slug=business-foundations')
            ->assertRedirect();

        $location = (string) $response->headers->get('Location');
        $this->assertStringStartsWith('https://lms.example.test/local/yerhsso/login.php?', $location);

        parse_str((string) parse_url($location, PHP_URL_QUERY), $query);
        $this->assertNotEmpty($query['payload'] ?? null);
        $this->assertSame(
            hash_hmac('sha256', (string) $query['payload'], 'test-sso-secret-1234'),
            $query['sig'] ?? null,
        );

        $decoded = json_decode(base64_decode(strtr((string) $query['payload'], '-_', '+/')), true);
        $this->assertSame(42, $decoded['uid']);
        $this->assertSame(3, $decoded['course']);
    }

    public function test_auth_syncs_users_passwords_suspension_and_admin_moodle_launch(): void
    {
        config([
            'services.moodle.url' => 'https://lms.example.test',
            'services.moodle.token' => 'secret-token',
            'services.moodle.user_auth' => 'manual',
            'services.moodle.sso_secret' => 'test-sso-secret-1234',
        ]);

        $calls = [];
        Http::preventStrayRequests();
        Http::fake(function (Request $request) use (&$calls) {
            $calls[] = $request->data();

            return match ($request['wsfunction']) {
                'core_user_get_users_by_field' => Http::response([]),
                'core_user_create_users' => Http::response([['id' => 77, 'username' => 'yerh_1']]),
                'core_user_update_users' => Http::response(['warnings' => []]),
                default => Http::response(null),
            };
        });

        $this->postJson('/api/v1/auth/register', [
            'first_name' => 'Amina',
            'last_name' => 'Juma',
            'email' => 'amina.juma@example.test',
            'password' => 'Pass12',
            'password_confirmation' => 'Pass12',
            'terms' => true,
        ])->assertCreated();

        $user = User::query()->where('email', 'amina.juma@example.test')->sole();
        $this->assertSame(77, (int) $user->moodle_user_id);

        $createCall = collect($calls)->firstWhere('wsfunction', 'core_user_create_users');
        $this->assertNotNull($createCall);
        $this->assertSame('Pass12', $createCall['users'][0]['password'] ?? null);

        // Login syncs password and profile to Moodle.
        $this->postJson('/api/v1/auth/logout')->assertNoContent();
        $this->postJson('/api/v1/auth/login', [
            'email' => 'amina.juma@example.test',
            'password' => 'Pass12',
        ])->assertOk();

        $updateCalls = array_values(array_filter($calls, fn (array $c) => ($c['wsfunction'] ?? '') === 'core_user_update_users'));
        $this->assertNotEmpty($updateCalls);

        // Suspending user syncs suspended=1 to Moodle.
        $admin = User::factory()->create(['role' => 'admin', 'moodle_user_id' => 88]);
        $this->actingAs($admin)->patchJson('/api/v1/workspace/users/'.$user->id, [
            'role' => 'guest',
            'suspended' => true,
        ])->assertOk();

        $lastUpdate = collect($calls)->where('wsfunction', 'core_user_update_users')->last();
        $this->assertSame('1', (string) ($lastUpdate['users'][0]['suspended'] ?? ''));

        // Admin direct Moodle launch signs payload with allow_admin=true.
        $launch = $this->actingAs($admin)->get('/api/v1/learning/moodle/launch')->assertRedirect();
        parse_str((string) parse_url((string) $launch->headers->get('Location'), PHP_URL_QUERY), $query);
        $decoded = json_decode(base64_decode(strtr((string) $query['payload'], '-_', '+/')), true);
        $this->assertSame(88, $decoded['uid']);
        $this->assertTrue($decoded['allow_admin']);

        // JSON mode returns the signed Moodle SSO URL for the seamless SPA loader handoff.
        $jsonLaunch = $this->actingAs($admin)
            ->getJson('/api/v1/learning/moodle/launch?format=json')
            ->assertOk()
            ->json('data.url');
        $this->assertIsString($jsonLaunch);
        $this->assertStringContainsString('/local/yerhsso/login.php?payload=', $jsonLaunch);
    }

    public function test_sync_reconciles_existing_moodle_username_matching_idnumber(): void
    {
        config([
            'services.moodle.url' => 'https://lms.example.test',
            'services.moodle.token' => 'secret-token',
            'services.moodle.user_auth' => 'manual',
        ]);

        $staleUser = User::factory()->create([
            'role' => 'guest',
            'email' => 'new.email@example.test',
            'first_name' => 'New',
            'last_name' => 'Member',
        ]);

        $calls = [];
        Http::preventStrayRequests();
        Http::fake(function (Request $request) use ($staleUser, &$calls) {
            $calls[] = $request->data();
            if ($request['wsfunction'] === 'core_user_get_users_by_field' && ($request['field'] ?? '') === 'username') {
                return Http::response([[
                    'id' => 91,
                    'username' => 'yerh_'.$staleUser->id,
                    'idnumber' => (string) $staleUser->id,
                ]]);
            }

            return match ($request['wsfunction']) {
                'core_user_get_users_by_field' => Http::response([]),
                'core_user_update_users' => Http::response(['warnings' => []]),
                default => Http::response(null),
            };
        });

        app(\App\Integrations\Moodle\MoodleClient::class)->syncUserAccount($staleUser);
        $this->assertSame(91, (int) $staleUser->fresh()->moodle_user_id);

        $updateCall = collect($calls)->firstWhere('wsfunction', 'core_user_update_users');
        $this->assertNotNull($updateCall);
        $this->assertSame('new.email@example.test', $updateCall['users'][0]['email'] ?? null);
    }

    public function test_admin_custom_placements_and_artisan_sync_progress(): void
    {
        config([
            'services.moodle.url' => 'https://lms.example.test',
            'services.moodle.token' => 'secret-token',
            'services.moodle.user_auth' => 'manual',
        ]);
        Http::preventStrayRequests();
        Http::fake(function (Request $request) {
            return match ($request['wsfunction']) {
                'core_completion_get_course_completion_status' => Http::response([
                    'completionstatus' => ['completed' => false],
                ]),
                'core_completion_get_activities_completion_status' => Http::response([
                    'statuses' => [
                        ['state' => 1, 'tracking' => 1],
                        ['state' => 0, 'tracking' => 1],
                    ],
                ]),
                default => Http::response(null),
            };
        });

        $admin = User::factory()->create(['role' => 'admin']);
        $student = User::factory()->create(['role' => 'guest', 'moodle_user_id' => 55]);

        $this->actingAs($admin)
            ->putJson('/api/v1/learning/placements', [
                'placements' => [
                    [
                        'key' => 'public',
                        'label' => 'Public catalogue',
                        'description' => 'Shown on /learn',
                        'visible_on_public_learn' => true,
                        'auto_attach_incubation' => false,
                        'institution_scoped' => false,
                        'is_draft' => false,
                    ],
                    [
                        'key' => 'cohort-b',
                        'label' => 'Cohort B Spotlight',
                        'description' => 'Custom public spotlight cohort',
                        'visible_on_public_learn' => true,
                        'auto_attach_incubation' => false,
                        'institution_scoped' => false,
                        'is_draft' => false,
                    ],
                    [
                        'key' => 'incubation',
                        'label' => 'Incubation pathway',
                        'description' => 'Model A incubation',
                        'visible_on_public_learn' => false,
                        'auto_attach_incubation' => true,
                        'institution_scoped' => false,
                        'is_draft' => false,
                    ],
                    [
                        'key' => 'fellows',
                        'label' => 'Fellows only',
                        'description' => 'Restricted partner track',
                        'visible_on_public_learn' => false,
                        'auto_attach_incubation' => false,
                        'institution_scoped' => true,
                        'is_draft' => false,
                    ],
                    [
                        'key' => 'draft',
                        'label' => 'Hidden draft',
                        'description' => 'Unpublished draft',
                        'visible_on_public_learn' => false,
                        'auto_attach_incubation' => false,
                        'institution_scoped' => false,
                        'is_draft' => true,
                    ],
                ],
            ])
            ->assertOk()
            ->assertJsonCount(5, 'data');

        $courseId = DB::table('learning_courses')->insertGetId([
            'slug' => 'growing-your-business',
            'title' => 'Growing your business',
            'description' => 'Scale modules',
            'level' => 'Intermediate',
            'price' => 0,
            'discount' => 0,
            'royalty_rate' => 0,
            'status' => 'approved',
            'placement' => 'draft',
            'moodle_course_id' => 5,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->actingAs($admin)
            ->postJson('/api/v1/learning/authoring/'.$courseId.'/publish', [
                'price' => 0,
                'discount' => 0,
                'royalty_rate' => 0,
                'placement' => 'cohort-b',
                'featured' => false,
            ])
            ->assertOk();

        $this->getJson('/api/v1/learning')->assertOk()->assertJsonCount(1, 'data');

        $this->actingAs($admin)
            ->postJson('/api/v1/learning/authoring/'.$courseId.'/publish', [
                'price' => 0,
                'discount' => 0,
                'royalty_rate' => 0,
                'placement' => 'fellows',
                'featured' => false,
            ])
            ->assertOk();

        $this->getJson('/api/v1/learning')->assertOk()->assertJsonCount(0, 'data');

        DB::table('learning_enrolments')->insert([
            'course_id' => $courseId,
            'learner_id' => $student->id,
            'payment_status' => 'confirmed',
            'payment_reference' => 'FREE-2',
            'price_paid' => 0,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->artisan('moodle:sync-progress')->assertSuccessful();

        $enrolment = DB::table('learning_enrolments')->where('learner_id', $student->id)->first();
        $this->assertSame(50, (int) $enrolment->moodle_progress);
    }

    public function test_pending_course_payment_surfaces_in_admin_metrics_and_enrols_on_confirm(): void
    {
        config([
            'services.moodle.url' => 'https://lms.example.test',
            'services.moodle.token' => 'secret-token',
            'services.moodle.user_auth' => 'manual',
        ]);
        Http::preventStrayRequests();
        Http::fake(function (Request $request) {
            return match ($request['wsfunction']) {
                'core_user_get_users_by_field' => Http::response([]),
                'core_user_create_users' => Http::response([['id' => 61, 'username' => 'yerh_2']]),
                'enrol_manual_enrol_users' => Http::response(null),
                default => Http::response(null),
            };
        });

        $admin = User::factory()->create(['role' => 'admin']);
        $student = User::factory()->create(['role' => 'guest', 'first_name' => 'Asha', 'last_name' => 'Wambui']);

        $courseId = DB::table('learning_courses')->insertGetId([
            'slug' => 'paid-foundations',
            'title' => 'Paid Foundations',
            'description' => 'Paid course',
            'level' => 'Beginner',
            'price' => 750,
            'discount' => 0,
            'royalty_rate' => 0,
            'status' => 'published',
            'placement' => 'public',
            'moodle_course_id' => 3,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->actingAs($student)
            ->postJson('/api/v1/learning/courses/paid-foundations/enrolments', [
                'reference' => 'UKPBJ30N1P',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['receipt']);

        $this->actingAs($student)
            ->post('/api/v1/learning/courses/paid-foundations/enrolments', [
                'reference' => 'UKPBJ30N1P',
                'receipt' => \Illuminate\Http\UploadedFile::fake()->image('receipt.png'),
            ], ['Accept' => 'application/json'])
            ->assertOk();

        $this->actingAs($admin)
            ->getJson('/api/v1/workspace/summary')
            ->assertOk()
            ->assertJsonPath('data.metrics.payments', 1)
            ->assertJsonPath('data.metrics.approvals', 1);

        $registry = $this->actingAs($admin)
            ->getJson('/api/v1/learning/registry')
            ->assertOk()
            ->json('data');
        $this->assertCount(1, $registry);
        $this->assertSame('pending', $registry[0]['payment_status']);
        $this->assertSame('UKPBJ30N1P', $registry[0]['payment_reference']);

        $this->actingAs($admin)
            ->postJson('/api/v1/learning/registry/'.$registry[0]['id'].'/payment', [
                'decision' => 'confirmed',
            ])
            ->assertOk();

        $this->assertSame(61, (int) $student->fresh()->moodle_user_id);

        $this->actingAs($admin)
            ->getJson('/api/v1/workspace/summary')
            ->assertOk()
            ->assertJsonPath('data.metrics.payments', 0)
            ->assertJsonPath('data.metrics.approvals', 0);
    }

    public function test_course_overview_includes_moodle_syllabus_duration_and_editable_payment_instructions(): void
    {
        config([
            'services.moodle.url' => 'https://lms.example.test',
            'services.moodle.token' => 'secret-token',
            'services.moodle.user_auth' => 'manual',
        ]);
        Http::preventStrayRequests();
        Http::fake([
            '*' => Http::response([
                [
                    'id' => 11,
                    'section' => 1,
                    'name' => 'Module 1 · Validating your idea',
                    'summary' => '<p>Customer interviews and pilot tests.</p>',
                    'visible' => 1,
                    'modules' => [
                        ['name' => 'Module 1 Video & Notes', 'modname' => 'page', 'visible' => 1],
                        ['name' => 'Foundations Quiz', 'modname' => 'quiz', 'visible' => 1],
                    ],
                ],
            ]),
        ]);

        $admin = User::factory()->create(['role' => 'admin']);

        $this->actingAs($admin)
            ->putJson('/api/v1/workspace/payment-instructions', [
                'provider' => 'M-Pesa Paybill',
                'paybill_number' => '400200',
                'account_number' => 'YERH-001',
                'recipient_name' => 'YERH Kenya',
                'instructions' => 'Pay via M-Pesa Paybill and upload your receipt below.',
                'refund_notice' => 'Full refund plus 10% compensation applies if review exceeds 24 hours.',
            ])
            ->assertOk()
            ->assertJsonPath('data.account_number', 'YERH-001');

        DB::table('learning_courses')->insert([
            'slug' => 'overview-course',
            'title' => 'Overview Test Course',
            'description' => 'Rich overview details.',
            'level' => 'Getting Started',
            'price' => 500,
            'discount' => 0,
            'royalty_rate' => 0,
            'status' => 'published',
            'placement' => 'public',
            'moodle_course_id' => 12,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->getJson('/api/v1/learning/courses/overview-course')
            ->assertOk()
            ->assertJsonPath('data.overview.module_count', 1)
            ->assertJsonPath('data.overview.activity_count', 2)
            ->assertJsonPath('data.overview.estimated_duration', 'Approx. 50 mins')
            ->assertJsonPath('data.overview.sections.0.title', 'Module 1 · Validating your idea')
            ->assertJsonPath('data.payment_instructions.account_number', 'YERH-001')
            ->assertJsonPath('data.payment_instructions.refund_notice', 'Full refund plus 10% compensation applies if review exceeds 24 hours.');
    }

    public function test_high_school_admin_receives_moodle_guide_sync_and_sso_launch(): void
    {
        config([
            'services.moodle.url' => 'https://lms.example.test',
            'services.moodle.token' => 'secret-token',
            'services.moodle.user_auth' => 'manual',
            'services.moodle.sso_secret' => 'test-sso-secret-1234',
        ]);
        Http::preventStrayRequests();
        Http::fake(function (Request $request) {
            return match ($request['wsfunction']) {
                'core_course_get_contents' => Http::response([
                    [
                        'id' => 21,
                        'section' => 1,
                        'name' => 'Module 1 · Delivery Guidelines',
                        'summary' => '<p>Run weekly practical workshops.</p>',
                        'visible' => 1,
                        'modules' => [
                            ['name' => 'Teaching Guide', 'modname' => 'page', 'visible' => 1],
                        ],
                    ],
                ]),
                'core_completion_get_course_completion_status' => Http::response([
                    'completionstatus' => ['completed' => false],
                ]),
                'core_completion_get_activities_completion_status' => Http::response([
                    'statuses' => [['state' => 1, 'tracking' => 1]],
                ]),
                'gradereport_user_get_grade_items' => Http::response([
                    'usergrades' => [['gradeitems' => []]],
                ]),
                'enrol_manual_enrol_users' => Http::response(null),
                default => Http::response(null),
            };
        });

        $schoolId = DB::table('institutions')->insertGetId([
            'slug' => 'highridge-high',
            'name' => 'Highridge High School',
            'kind' => 'high-school',
            'status' => 'active',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $schoolAdmin = User::factory()->create(['role' => 'school_admin', 'moodle_user_id' => 70]);
        $outsider = User::factory()->create(['role' => 'guest']);

        DB::table('institution_access')->insert([
            'institution_id' => $schoolId,
            'user_id' => $schoolAdmin->id,
            'access' => 'manage',
        ]);

        DB::table('learning_courses')->insert([
            'slug' => 'high-school-facilitator-guide',
            'title' => 'High School Facilitator & Administrator Guide',
            'description' => 'Guidelines for classes, marks, and cohorts.',
            'level' => 'Facilitator Guide',
            'price' => 0,
            'discount' => 0,
            'royalty_rate' => 0,
            'status' => 'published',
            'placement' => 'institution',
            'moodle_course_id' => 6,
            'moodle_shortname' => 'YERH-SCHOOL-GUIDE',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->actingAs($schoolAdmin)
            ->getJson('/api/v1/workspace/schools/highridge-high')
            ->assertOk()
            ->assertJsonPath('data.moodle_guide.launch_url', '/api/v1/learning/moodle/launch?school_guide=1')
            ->assertJsonPath('data.moodle_guide.progress', 100)
            ->assertJsonPath('data.moodle_guide.sections.0.title', 'Module 1 · Delivery Guidelines');

        $this->actingAs($outsider)
            ->get('/api/v1/learning/moodle/launch?school_guide=1')
            ->assertForbidden();

        $redirect = $this->actingAs($schoolAdmin)
            ->get('/api/v1/learning/moodle/launch?school_guide=1')
            ->assertRedirect();

        $this->assertStringStartsWith(
            'https://lms.example.test/local/yerhsso/login.php?',
            (string) $redirect->headers->get('Location')
        );
    }
}
