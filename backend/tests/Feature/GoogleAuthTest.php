<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Laravel\Socialite\Facades\Socialite;
use Laravel\Socialite\Two\User as SocialiteUser;
use Mockery;
use Tests\TestCase;

final class GoogleAuthTest extends TestCase
{
    use RefreshDatabase;

    private function configureGoogle(): void
    {
        config([
            'services.google.client_id' => 'test-google-client-id',
            'services.google.client_secret' => 'test-google-client-secret',
            'services.google.redirect' => 'http://localhost:8000/api/v1/auth/google/callback',
        ]);
    }

    private function mockSocialiteUser(array $attributes): void
    {
        $socialiteUser = Mockery::mock(SocialiteUser::class);
        $socialiteUser->shouldReceive('getId')->andReturn($attributes['id']);
        $socialiteUser->shouldReceive('getEmail')->andReturn($attributes['email']);
        $socialiteUser->shouldReceive('getName')->andReturn($attributes['name']);
        $socialiteUser->shouldReceive('getAvatar')->andReturn($attributes['avatar'] ?? 'https://lh3.googleusercontent.com/a/default');
        $socialiteUser->shouldReceive('getRaw')->andReturn([
            'sub' => $attributes['id'],
            'email' => $attributes['email'],
            'email_verified' => $attributes['email_verified'] ?? true,
            'given_name' => $attributes['given_name'] ?? '',
            'family_name' => $attributes['family_name'] ?? '',
            'name' => $attributes['name'],
            'picture' => $attributes['avatar'] ?? 'https://lh3.googleusercontent.com/a/default',
        ]);

        $provider = Mockery::mock();
        $provider->shouldReceive('user')->once()->andReturn($socialiteUser);
        Socialite::shouldReceive('driver')->with('google')->once()->andReturn($provider);
    }

    public function test_providers_and_redirect_reflect_google_configuration(): void
    {
        config([
            'services.google.client_id' => '',
            'services.google.client_secret' => '',
        ]);

        $this->getJson('/api/v1/auth/providers')
            ->assertOk()
            ->assertJsonPath('data.google', false);

        $this->get('/api/v1/auth/google/redirect')
            ->assertRedirect('/login?oauth_error=not-configured');

        $this->configureGoogle();

        $this->getJson('/api/v1/auth/providers')
            ->assertOk()
            ->assertJsonPath('data.google', true);

        $redirectResponse = $this->get('/api/v1/auth/google/redirect?mode=register&redirect=%2Flearn');
        $redirectResponse->assertRedirect();
        $this->assertStringStartsWith('https://accounts.google.com/o/oauth2/auth', (string) $redirectResponse->headers->get('Location'));
    }

    public function test_google_callback_creates_verified_passwordless_user_and_logs_in(): void
    {
        Notification::fake();
        $this->configureGoogle();

        $this->mockSocialiteUser([
            'id' => 'google-sub-101',
            'email' => 'Neema.Ochieng@gmail.com',
            'name' => 'Neema Ochieng',
            'given_name' => 'Neema',
            'family_name' => 'Ochieng',
            'email_verified' => true,
        ]);

        $this->get('/api/v1/auth/google/callback')
            ->assertRedirect('/account');

        $user = User::query()->where('email', 'neema.ochieng@gmail.com')->sole();
        $this->assertSame('google-sub-101', $user->google_id);
        $this->assertSame('Neema', $user->first_name);
        $this->assertSame('Ochieng', $user->last_name);
        $this->assertNull($user->password);
        $this->assertNotNull($user->email_verified_at);
        $this->assertNotNull($user->terms_accepted_at);
        $this->assertAuthenticatedAs($user);

        $this->getJson('/api/v1/auth/me')
            ->assertOk()
            ->assertJsonPath('data.has_password', false)
            ->assertJsonPath('data.google_connected', true)
            ->assertJsonPath('data.email_verified', true);
    }

    public function test_google_signup_auto_approves_matching_domain_and_queues_non_domain(): void
    {
        Notification::fake();
        $this->configureGoogle();

        $instId = DB::table('institutions')->insertGetId([
            'slug' => 'kca-university',
            'name' => 'KCA University',
            'kind' => 'university',
            'status' => 'active',
            'allowed_domains' => json_encode(['students.kcau.ac.ke']),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // Domain-matching Google user unlocks entrepreneur dashboard immediately.
        $this->withSession([
            'google_oauth.intent' => [
                'mode' => 'register',
                'institution' => 'kca-university',
                'location' => 'Nairobi',
                'redirect' => null,
            ],
        ]);
        $this->mockSocialiteUser([
            'id' => 'google-kca-1',
            'email' => 'zuri@students.kcau.ac.ke',
            'name' => 'Zuri Kamau',
            'given_name' => 'Zuri',
            'family_name' => 'Kamau',
            'email_verified' => true,
        ]);

        $this->get('/api/v1/auth/google/callback')
            ->assertRedirect('/dashboard');

        $zuri = User::query()->where('email', 'zuri@students.kcau.ac.ke')->sole();
        $this->assertSame('entrepreneur', $zuri->role);
        $this->assertDatabaseHas('institution_memberships', [
            'user_id' => $zuri->id,
            'institution_id' => $instId,
        ]);

        $this->postJson('/api/v1/auth/logout')->assertNoContent();

        // Non-domain Google user stays guest with a pending affiliation application.
        $this->withSession([
            'google_oauth.intent' => [
                'mode' => 'register',
                'institution' => 'kca-university',
                'location' => 'Kiambu',
                'redirect' => null,
            ],
        ]);
        $this->mockSocialiteUser([
            'id' => 'google-gmail-2',
            'email' => 'dan@gmail.com',
            'name' => 'Dan Mwangi',
            'given_name' => 'Dan',
            'family_name' => 'Mwangi',
            'email_verified' => true,
        ]);

        $this->get('/api/v1/auth/google/callback')
            ->assertRedirect('/account');

        $dan = User::query()->where('email', 'dan@gmail.com')->sole();
        $this->assertSame('guest', $dan->role);
        $this->assertDatabaseHas('affiliation_applications', [
            'user_id' => $dan->id,
            'institution_id' => $instId,
            'status' => 'pending',
        ]);
    }

    public function test_google_links_existing_verified_account_and_blocks_unverified_or_suspended(): void
    {
        $this->configureGoogle();

        $existing = User::factory()->create([
            'email' => 'mentor@example.test',
            'role' => 'mentor',
        ]);

        $this->mockSocialiteUser([
            'id' => 'google-mentor-1',
            'email' => 'mentor@example.test',
            'name' => 'Existing Mentor',
            'email_verified' => true,
        ]);

        $this->get('/api/v1/auth/google/callback')
            ->assertRedirect('/dashboard');

        $fresh = $existing->fresh();
        $this->assertSame('google-mentor-1', $fresh->google_id);
        $this->assertSame('mentor', $fresh->role);
        $this->assertTrue(Hash::check('password', $fresh->password));

        $this->postJson('/api/v1/auth/logout')->assertNoContent();

        // Unverified Google email must not link an existing account.
        $target = User::factory()->create(['email' => 'victim@example.test']);
        $this->mockSocialiteUser([
            'id' => 'google-unverified',
            'email' => 'victim@example.test',
            'name' => 'Unverified User',
            'email_verified' => false,
        ]);
        $this->get('/api/v1/auth/google/callback')
            ->assertRedirect('/login?oauth_error=unverified-email');
        $this->assertGuest();
        $this->assertNull($target->fresh()->google_id);

        // Suspended account cannot sign in with Google.
        $suspended = User::factory()->create([
            'email' => 'blocked@example.test',
            'google_id' => 'google-blocked',
            'suspended_at' => now(),
        ]);
        $this->mockSocialiteUser([
            'id' => 'google-blocked',
            'email' => $suspended->email,
            'name' => 'Blocked User',
            'email_verified' => true,
        ]);
        $this->get('/api/v1/auth/google/callback')
            ->assertRedirect('/login?oauth_error=suspended');
        $this->assertGuest();
    }

    public function test_google_only_user_can_set_local_password_without_current_password(): void
    {
        $user = User::factory()->create([
            'email' => 'googleonly@example.test',
            'google_id' => 'google-only-1',
            'password' => null,
        ]);

        $this->actingAs($user)
            ->getJson('/api/v1/auth/me')
            ->assertOk()
            ->assertJsonPath('data.has_password', false);

        $this->postJson('/api/v1/auth/change-password', [
            'password' => 'MyPass',
            'password_confirmation' => 'MyPass',
        ])->assertOk()
            ->assertJsonPath('data.message', 'Your password has been set.');

        $this->assertTrue(Hash::check('MyPass', (string) $user->fresh()->password));

        $this->getJson('/api/v1/auth/me')
            ->assertOk()
            ->assertJsonPath('data.has_password', true);
    }

    public function test_google_login_from_moodle_preserves_moodle_launch_redirect(): void
    {
        Notification::fake();
        $this->configureGoogle();

        $this->get('/api/v1/auth/google/redirect?mode=login&redirect=%2Fmoodle%2Flaunch')
            ->assertRedirect();

        $this->mockSocialiteUser([
            'id' => 'google-moodle-202',
            'email' => 'learner.moodle@example.test',
            'name' => 'Samora Otieno',
            'given_name' => 'Samora',
            'family_name' => 'Otieno',
            'email_verified' => true,
        ]);

        $this->get('/api/v1/auth/google/callback')
            ->assertRedirect('/moodle/launch');

        $this->assertAuthenticated();
    }
}
