import { useState, type FormEvent } from 'react';
import { ArrowRight, CircleAlert } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useLaravelSession } from '../../app/useLaravelSession';
import { localLaravelIdentity } from '../../services/laravel-identity-repository';
import { TermsDialog } from '../legal/TermsDialog';
import { PasswordField } from './PasswordField';

function errorMessage(error: unknown): string {
  if (error instanceof TypeError)
    return 'Could not reach the local Laravel server. Check that it is running.';
  return error instanceof Error ? error.message : 'Laravel could not complete the request.';
}

export function LaravelAccountForm({
  title,
  register,
  institution,
  verification,
  onComplete,
  onChangeInstitution,
  onSwitch,
}: {
  title: string;
  register: boolean;
  institution: string;
  verification: string | null;
  onComplete: () => void;
  onChangeInstitution: () => void;
  onSwitch: () => void;
}) {
  const session = useLaravelSession();
  const navigate = useNavigate();
  const profile = session?.profile;
  const loading = session?.loading;
  const [busy, setBusy] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function perform(action: () => Promise<void>) {
    setBusy(true);
    setNotice('');
    setError('');
    try {
      await action();
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const field = (key: string) => String(data.get(key) ?? '');
    const credentials = { email: field('email').trim(), password: field('password') };
    void perform(async () => {
      const signedIn = await localLaravelIdentity.authenticate(
        register ? 'register' : 'login',
        register
          ? {
              ...credentials,
              name: field('name').trim(),
              password_confirmation: field('password_confirmation'),
            }
          : { ...credentials, institution },
      );
      session?.setProfile(signedIn);
      onComplete();
      navigate(
        signedIn.email_verified && (signedIn.role !== 'guest' || signedIn.staff.length > 0)
          ? '/dashboard'
          : '/account',
      );
    });
  }

  return (
    <>
      <header className="account-heading">
        <h2 id="account-title">{title}</h2>
        <p id="account-description">
          {register ? 'Youth Entrepreneurship Resource Hub.' : 'Access your YERH account.'}
        </p>
        {!register && (verification === 'continue' || verification === 'wrong-account') && (
          <p role="status" className="account-status">
            {verification === 'wrong-account'
              ? 'This link belongs to another account. Sign out, then reopen the link and sign in with the email it was sent to.'
              : 'Sign in with the email this link was sent to. YERH will finish verifying your account.'}
          </p>
        )}
        <aside className="account-preview">
          Local Laravel mode · fictional test accounts only.
        </aside>
      </header>
      {loading ? (
        <p className="account-status" role="status">
          Checking your session…
        </p>
      ) : profile ? (
        <div className="account-form">
          <p>
            You’re signed in as <strong>{profile.name}</strong>.
          </p>
          <p>Email verification: {profile.email_verified ? 'verified' : 'pending'}.</p>
          {!profile.email_verified && (
            <button
              type="button"
              className="account-link"
              disabled={busy}
              onClick={() =>
                void perform(async () => {
                  await localLaravelIdentity.resendVerification();
                  setNotice(
                    'Verification queued. Run the local queue worker and check the mail log.',
                  );
                })
              }
            >
              Request verification again
            </button>
          )}
          <button
            type="button"
            className="account-link"
            disabled={busy}
            onClick={() =>
              void perform(async () => {
                await localLaravelIdentity.logout();
                session?.setProfile(null);
                setNotice('Signed out.');
              })
            }
          >
            Sign out
          </button>
          <Link className="account-link" to="/account" onClick={onComplete}>
            Open account
          </Link>
        </div>
      ) : (
        <>
          <form className="account-form" onSubmit={submit}>
            {!register && (
              <button type="button" className="account-link" onClick={onChangeInstitution}>
                Change institution
              </button>
            )}
            {register && (
              <label className="account-field">
                Full name
                <input name="name" autoComplete="name" required minLength={2} maxLength={120} />
              </label>
            )}
            <label className="account-field">
              Email address
              <input
                name="email"
                type="email"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                required
                maxLength={254}
              />
            </label>
            <PasswordField
              className="account-field"
              autoComplete={register ? 'new-password' : 'current-password'}
            />
            {register && (
              <>
                <PasswordField
                  className="account-field"
                  label="Confirm password"
                  name="password_confirmation"
                  autoComplete="new-password"
                />
                <div className="account-agreement">
                  <label className="account-checkbox">
                    <input type="checkbox" name="terms" required />
                    <span>I accept the terms and privacy notice.</span>
                  </label>
                  <div className="account-legal-links">
                    <button
                      className="account-link"
                      type="button"
                      onClick={() => setTermsOpen(true)}
                    >
                      Terms of use
                    </button>
                    <Link className="account-link" to="/privacy">
                      Privacy notice
                    </Link>
                  </div>
                </div>
              </>
            )}
            <button className="button account-submit" type="submit" disabled={busy}>
              {busy ? 'Please wait…' : register ? 'Create account' : 'Sign in'}
              <ArrowRight size={18} aria-hidden="true" />
            </button>
          </form>
          <p className="account-switch">
            {register ? 'Already have an account?' : 'New to YERH?'}{' '}
            <button className="account-link" type="button" disabled={busy} onClick={onSwitch}>
              {register ? 'Sign in' : 'Create an account'}
            </button>
          </p>
        </>
      )}
      {error && (
        <p className="account-error" role="alert">
          <CircleAlert size={17} aria-hidden="true" />
          {error}
        </p>
      )}
      {notice && (
        <p className="account-status" role="status">
          {notice}
        </p>
      )}
      {termsOpen && <TermsDialog onClose={() => setTermsOpen(false)} />}
    </>
  );
}
