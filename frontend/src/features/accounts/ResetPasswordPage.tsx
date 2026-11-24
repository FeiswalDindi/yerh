import { useRef, useState, type FormEvent } from 'react';
import { ArrowRight, CircleAlert } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { localLaravelIdentity } from '../../services/laravel-identity-repository';
import { triggerCardErrorFeedback } from '../../shared/error-feedback';
import { PageIntro } from '../../shared/PageIntro';
import { usePageTitle } from '../../shared/usePageTitle';
import { AccountLink } from './AccountLink';
import { PasswordField } from './PasswordField';

export function ResetPasswordPage() {
  usePageTitle('Reset password');
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const initialEmail = params.get('email') ?? '';
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const panelRef = useRef<HTMLDivElement>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError('');
    try {
      const message = await localLaravelIdentity.resetPassword({
        token: String(form.get('token') ?? '').trim(),
        email: String(form.get('email') ?? '').trim(),
        password: String(form.get('password') ?? ''),
        password_confirmation: String(form.get('password_confirmation') ?? ''),
      });
      setDone(message);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not reset your password.');
      triggerCardErrorFeedback(panelRef.current);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageIntro
        eyebrow="Account recovery"
        title="Choose a new password."
        description="Set a new password with at least 6 characters."
      />
      <section className="container section">
        <div
          ref={panelRef}
          className="profile-panel"
          style={{ maxWidth: '34rem', margin: '0 auto' }}
        >
          {done ? (
            <div className="account-form">
              <p role="status" className="form-success">
                {done}
              </p>
              <AccountLink className="button">
                Sign in <ArrowRight size={18} aria-hidden="true" />
              </AccountLink>
            </div>
          ) : !token ? (
            <div className="account-form">
              <p role="alert" className="account-error">
                <CircleAlert size={17} aria-hidden="true" />
                This password reset link is incomplete or invalid. Request a new link from the sign
                in screen.
              </p>
              <AccountLink className="button">Return to sign in</AccountLink>
            </div>
          ) : (
            <form
              className="account-form"
              onSubmit={(e) => void submit(e)}
              onInvalidCapture={() => triggerCardErrorFeedback(panelRef.current)}
            >
              <input type="hidden" name="token" value={token} />
              <label className="account-field">
                Email address
                <input
                  name="email"
                  type="email"
                  defaultValue={initialEmail}
                  autoComplete="email"
                  required
                  maxLength={254}
                />
              </label>
              <PasswordField
                className="account-field"
                label="New password"
                name="password"
                autoComplete="new-password"
              />
              <PasswordField
                className="account-field"
                label="Confirm new password"
                name="password_confirmation"
                autoComplete="new-password"
              />
              {error && (
                <p role="alert" className="account-error">
                  <CircleAlert size={17} aria-hidden="true" />
                  {error}
                </p>
              )}
              <button className="button account-submit" type="submit" disabled={busy}>
                {busy ? 'Resetting password…' : 'Reset password'}
                <ArrowRight size={18} aria-hidden="true" />
              </button>
            </form>
          )}
        </div>
      </section>
    </>
  );
}
