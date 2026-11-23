<?php

namespace Tests\Feature;

use App\Models\User;
use App\Notifications\VerifyAccountEmail;
use Illuminate\Foundation\Http\Middleware\ValidateCsrfToken;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\URL;
use Tests\TestCase;

final class IdentityTest extends TestCase
{
    use RefreshDatabase;

    private const API = '/api/v1/auth';

    public function test_guests_can_register_verify_sign_out_and_sign_back_in(): void
    {
        Notification::fake();
        $credentials = ['email' => 'learner@example.test', 'password' => 'Riv3r!'];
        $this->postJson(self::API.'/register', [
            'email' => $credentials['email'], 'name' => 'Test Learner',
            'password' => 'Riv3r', 'password_confirmation' => 'Riv3r',
        ])->assertUnprocessable()->assertJsonValidationErrors('password');

        $this->postJson(self::API.'/register', [
            ...$credentials, 'email' => 'Learner@example.test', 'name' => 'Test Learner',
            'password_confirmation' => $credentials['password'],
        ])->assertCreated()->assertJsonPath('data.email', $credentials['email'])
            ->assertJsonPath('data.email_verified', false)->assertJsonMissingPath('data.password');

        $user = User::query()->sole();
        $this->assertTrue(Hash::check($credentials['password'], $user->password));
        Notification::assertSentTo($user, VerifyAccountEmail::class);

        $url = URL::temporarySignedRoute('verification.verify', now()->addMinute(), [
            'id' => $user->id, 'hash' => sha1($user->email),
        ]);
        $this->getJson($url)->assertOk()->assertJsonPath('data.email_verified', true);
        $this->assertNotNull($user->fresh()->email_verified_at);
        $this->postJson(self::API.'/logout')->assertNoContent();
        $this->getJson(self::API.'/me')->assertUnauthorized();
        $this->postJson(self::API.'/login', $credentials)->assertOk()->assertJsonPath('data.email_verified', true);
    }

    public function test_opening_a_browser_link_signed_out_verifies_the_matching_account_on_sign_in(): void
    {
        $user = User::factory()->unverified()->create();
        $url = $this->verificationUrl($user);

        $this->get($url)->assertRedirect('/login?verification=continue')->assertHeader('Cache-Control', 'no-store, private');
        $this->assertNull($user->fresh()->email_verified_at);

        $this->postJson(self::API.'/login', ['email' => $user->email, 'password' => 'password'])
            ->assertOk()->assertJsonPath('data.email_verified', true);
        $this->assertNotNull($user->fresh()->email_verified_at);
    }

    public function test_pending_verification_does_not_verify_another_account_or_outlive_the_link(): void
    {
        $user = User::factory()->unverified()->create();
        $other = User::factory()->unverified()->create();
        $url = $this->verificationUrl($user);

        $this->get($url)->assertRedirect('/login?verification=continue');
        $this->postJson(self::API.'/login', ['email' => $other->email, 'password' => 'password'])
            ->assertOk()->assertJsonPath('data.email_verified', false);
        $this->postJson(self::API.'/logout')->assertNoContent();
        $this->get($url)->assertRedirect('/login?verification=continue');
        $this->travel(2)->minutes();

        $this->postJson(self::API.'/login', ['email' => $user->email, 'password' => 'password'])
            ->assertOk()->assertJsonPath('data.email_verified', false);
        $this->assertNull($user->fresh()->email_verified_at);
        $this->assertNull($other->fresh()->email_verified_at);
    }

    public function test_browser_receives_an_account_destination_for_verification_and_expiry(): void
    {
        $user = User::factory()->unverified()->create();
        $other = User::factory()->unverified()->create();
        $url = $this->verificationUrl($user);

        $this->actingAs($other)->get($url)->assertRedirect('/login?verification=wrong-account');
        $this->actingAs($user)->get($url.'&unexpected=1')->assertRedirect('/account?verification=invalid');
        $this->assertNull($user->fresh()->email_verified_at);
        $this->get($url)->assertRedirect('/account?verification=verified');
        $this->assertNotNull($user->fresh()->email_verified_at);
    }

    private function verificationUrl(User $user): string
    {
        return URL::temporarySignedRoute('verification.verify', now()->addMinute(), [
            'id' => $user->id,
            'hash' => sha1($user->email),
        ]);
    }

    public function test_local_verify_button_only_issues_a_signed_link_for_the_current_test_session(): void
    {
        $account = User::factory()->unverified()->create();
        config(['app.local_email_verification' => true, 'mail.default' => 'log']);
        $this->actingAs($account)->postJson(self::API.'/verify-email/local-link')->assertNotFound();

        $this->withoutMiddleware(ValidateCsrfToken::class);
        $this->app->detectEnvironment(fn () => 'local');
        $this->getJson(self::API.'/me')->assertJsonPath('data.local_verification_available', true);
        $this->withServerVariables(['REMOTE_ADDR' => '192.0.2.23'])
            ->postJson(self::API.'/verify-email/local-link')->assertNotFound();
        $this->withServerVariables(['REMOTE_ADDR' => '127.0.0.1']);
        $url = $this->postJson(self::API.'/verify-email/local-link', ['id' => 47])
            ->assertOk()->json('data.url');
        $this->get($url)->assertRedirect('/account?verification=verified');
        $this->assertNotNull($account->fresh()->email_verified_at);
        $this->getJson(self::API.'/me')->assertJsonPath('data.local_verification_available', false);
    }

    public function test_role_injection_and_wrong_password_are_rejected(): void
    {
        Notification::fake();
        $this->postJson(self::API.'/register', [
            'name' => 'Test Learner', 'email' => 'learner@example.test', 'role' => 'administrator',
            'password' => 'Local-test-pass-832', 'password_confirmation' => 'Local-test-pass-832',
        ])->assertUnprocessable()->assertJsonValidationErrors('role');
        $this->assertDatabaseCount('users', 0);

        $user = User::factory()->create();
        $this->postJson(self::API.'/login', [
            'email' => $user->email, 'password' => 'incorrect-pass-832',
        ])->assertUnprocessable()->assertJsonValidationErrors('email');
        $this->assertGuest();
    }

    public function test_verification_requires_matching_authenticated_account_and_valid_signature(): void
    {
        $account = User::factory()->unverified()->create();
        $other = User::factory()->unverified()->create();
        $url = URL::temporarySignedRoute('verification.verify', now()->addMinute(), [
            'id' => $account->id, 'hash' => sha1($account->email),
        ]);
        $this->getJson($url)->assertUnauthorized();
        $this->actingAs($other)->getJson($url)->assertForbidden();
        $this->actingAs($account)->getJson($url.'&unexpected=1')->assertForbidden();
        $this->assertNull($account->fresh()->email_verified_at);
    }
}
