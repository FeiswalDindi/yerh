import { useEffect, useRef, useState, type FormEvent } from 'react';
import { localLaravelIdentity } from '../../services/laravel-identity-repository';
import { triggerCardErrorFeedback } from '../../shared/error-feedback';
import { PasswordField } from './PasswordField';
import { LoadingDots } from '../../shared/SiteLoader';
import './LocalLaravelAccountPage.css';

type Mode = 'login' | 'register';
type Profile = Awaited<ReturnType<typeof localLaravelIdentity.profile>>;

function message(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'Could not reach Laravel. Check that the local backend is running.';
}

export function LocalLaravelAccountPage() {
  const [mode, setMode] = useState<Mode>('login');
  const [profile, setProfile] = useState<Profile>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    localLaravelIdentity
      .profile(controller.signal)
      .then((current) => {
        if (!controller.signal.aborted) setProfile(current);
      })
      .catch((failure: unknown) => {
        if (!controller.signal.aborted) setError(message(failure));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);

  async function act(action: () => Promise<void>) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await action();
    } catch (failure) {
      setError(message(failure));
      triggerCardErrorFeedback(panelRef.current);
    } finally {
      setBusy(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const field = (name: string) => String(data.get(name) ?? '');
    const values = { email: field('email'), password: field('password') };
    void act(async () => {
      const firstName = field('first_name').trim();
      const lastName = field('last_name').trim();
      const account = await localLaravelIdentity.authenticate(
        mode,
        mode === 'register'
          ? {
              ...values,
              first_name: firstName,
              last_name: lastName,
              name: `${firstName} ${lastName}`.trim(),
              password_confirmation: field('password_confirmation'),
              terms: true,
            }
          : values,
      );
      setProfile(account);
      setNotice(mode === 'register' ? 'Account saved in Laravel.' : 'Signed in to Laravel.');
    });
  }

  return (
    <div className="local-account">
      <section
        ref={panelRef}
        className="local-account__panel"
        aria-labelledby="local-account-heading"
      >
        <p className="local-account__label">Local development</p>
        <h1 id="local-account-heading">YERH Laravel accounts</h1>
        <p>
          This screen uses Laravel and the configured database, not demo browser storage. Use only
          fictional test accounts here.
        </p>
        {error && <p role="alert">{error}</p>}
        {notice && <p role="status">{notice}</p>}
        {loading ? (
          <p role="status" className="yerh-status-loading">
            <LoadingDots label="Checking your Laravel session" />
          </p>
        ) : profile ? (
          <>
            <h2>Signed in as {profile.name}</h2>
            <dl>
              <dt>Email</dt>
              <dd>{profile.email}</dd>
              <dt>Role</dt>
              <dd>{profile.role}</dd>
              <dt>Email verification</dt>
              <dd>{profile.email_verified ? 'Verified' : 'Pending'}</dd>
            </dl>
            {!profile.email_verified && (
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void act(async () => {
                    await localLaravelIdentity.resendVerification();
                    setNotice('Verification requested. Check the local Laravel mail log.');
                  })
                }
              >
                Request verification again
              </button>
            )}
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void act(async () => {
                  await localLaravelIdentity.logout();
                  setProfile(null);
                  setMode('login');
                  setNotice('Signed out.');
                })
              }
            >
              Sign out
            </button>
          </>
        ) : (
          <>
            <div className="local-account__modes" aria-label="Account action" role="group">
              <button
                type="button"
                disabled={busy}
                aria-pressed={mode === 'login'}
                onClick={() => {
                  setMode('login');
                  setError('');
                }}
              >
                Sign in
              </button>
              <button
                type="button"
                disabled={busy}
                aria-pressed={mode === 'register'}
                onClick={() => {
                  setMode('register');
                  setError('');
                }}
              >
                Register
              </button>
            </div>
            <form
              key={mode}
              onSubmit={submit}
              onInvalidCapture={() => triggerCardErrorFeedback(panelRef.current)}
            >
              {mode === 'register' && (
                <>
                  <label>
                    First name
                    <input
                      name="first_name"
                      autoComplete="given-name"
                      minLength={1}
                      maxLength={80}
                      required
                    />
                  </label>
                  <label>
                    Last name
                    <input
                      name="last_name"
                      autoComplete="family-name"
                      minLength={1}
                      maxLength={80}
                      required
                    />
                  </label>
                </>
              )}
              <label>
                Email
                <input name="email" type="email" autoComplete="email" maxLength={254} required />
              </label>
              <PasswordField
                autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
              />
              {mode === 'register' && (
                <PasswordField
                  label="Confirm password"
                  name="password_confirmation"
                  autoComplete="new-password"
                />
              )}
              <button type="submit" disabled={busy}>
                {busy
                  ? 'Please wait…'
                  : mode === 'register'
                    ? 'Create account'
                    : 'Sign in to Laravel'}
              </button>
            </form>
          </>
        )}
      </section>
    </div>
  );
}
