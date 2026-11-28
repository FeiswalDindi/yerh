import { useRef, useState, type FormEvent } from 'react';
import { ArrowRight, Check, Circle, CircleAlert, KeyRound, ShieldCheck } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { INLINE_YERH_LOGO } from '../../config/brand-inline';
import { localLaravelIdentity } from '../../services/laravel-identity-repository';
import { triggerCardErrorFeedback } from '../../shared/error-feedback';
import { usePageTitle } from '../../shared/usePageTitle';
import { AccountLink } from './AccountLink';
import { PasswordField } from './PasswordField';
import './account.css';
import './reset-password.css';

function passwordStrength(password: string): {
  level: 0 | 1 | 2 | 3 | 4;
  label: string;
} {
  if (!password) return { level: 0, label: 'Not entered' };
  if (password.length < 6) return { level: 1, label: 'Too short' };
  let score = 1;
  if (password.length >= 10) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password) && /[^\da-zA-Z]/.test(password)) score += 1;
  else if (/\d/.test(password) || /[^\da-zA-Z]/.test(password)) score += 1;

  const level = Math.min(4, Math.max(1, score)) as 1 | 2 | 3 | 4;
  const labels: Record<1 | 2 | 3 | 4, string> = {
    1: 'Weak',
    2: 'Fair',
    3: 'Good',
    4: 'Strong',
  };
  return { level, label: labels[level] };
}

export function ResetPasswordPage() {
  usePageTitle('Reset password');
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const initialEmail = params.get('email') ?? '';
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const panelRef = useRef<HTMLDivElement>(null);

  const strength = passwordStrength(password);
  const hasMinLength = password.length >= 6;
  const passwordsMatch = hasMinLength && passwordConfirmation === password;
  const hasMix = /[a-zA-Z]/.test(password) && /[\d\W_]/.test(password);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!hasMinLength) {
      setError('Password must be at least 6 characters.');
      triggerCardErrorFeedback(panelRef.current);
      return;
    }
    if (password !== passwordConfirmation) {
      setError('Password confirmation does not match.');
      triggerCardErrorFeedback(panelRef.current);
      return;
    }

    setBusy(true);
    setError('');
    try {
      const message = await localLaravelIdentity.resetPassword({
        token: token.trim(),
        email: email.trim(),
        password,
        password_confirmation: passwordConfirmation,
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
    <section className="container section reset-password-section">
      <div ref={panelRef} className="reset-password-card">
        <header className="reset-password-header">
          <img
            src={INLINE_YERH_LOGO}
            className="reset-password-logo"
            width={84}
            height={84}
            decoding="sync"
            alt="YERH"
          />
          <span className="reset-password-badge">
            <KeyRound size={14} aria-hidden="true" />
            Account recovery
          </span>
          <h1>{done ? 'Password updated' : 'Choose a new password'}</h1>
          <p>
            {done
              ? 'Your YERH credentials have been saved.'
              : 'Set a new password with at least 6 characters to regain access.'}
          </p>
        </header>

        {done ? (
          <div className="reset-password-state">
            <span className="reset-password-state-icon is-success" aria-hidden="true">
              <ShieldCheck size={24} />
            </span>
            <p role="status" className="account-status">
              {done}
            </p>
            <AccountLink className="button account-submit" style={{ width: '100%' }}>
              Sign in to YERH <ArrowRight size={18} aria-hidden="true" />
            </AccountLink>
          </div>
        ) : !token ? (
          <div className="reset-password-state">
            <span className="reset-password-state-icon is-error" aria-hidden="true">
              <CircleAlert size={24} />
            </span>
            <p role="alert" className="account-error">
              <CircleAlert size={17} aria-hidden="true" />
              This password reset link is incomplete or expired. Request a new link from the sign-in
              dialog.
            </p>
            <AccountLink className="button account-submit" style={{ width: '100%' }}>
              Return to sign in <ArrowRight size={18} aria-hidden="true" />
            </AccountLink>
          </div>
        ) : (
          <form
            className="account-form"
            onSubmit={(e) => void submit(e)}
            onInvalidCapture={() => triggerCardErrorFeedback(panelRef.current)}
          >
            {error && (
              <p role="alert" className="account-error">
                <CircleAlert size={17} aria-hidden="true" />
                {error}
              </p>
            )}
            <label className="account-field">
              Email address
              <input
                name="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                required
                maxLength={254}
              />
            </label>
            <PasswordField
              className="account-field"
              label="New password"
              name="password"
              value={password}
              onChange={setPassword}
              autoComplete="new-password"
              placeholder="Minimum 6 characters"
            />
            <div className="password-strength" aria-live="polite">
              <div className="password-strength-header">
                <span>Password strength</span>
                <strong data-level={strength.level}>{strength.label}</strong>
              </div>
              <div
                className="password-strength-bars"
                data-level={strength.level}
                aria-hidden="true"
              >
                <span />
                <span />
                <span />
                <span />
              </div>
            </div>
            <PasswordField
              className="account-field"
              label="Confirm new password"
              name="password_confirmation"
              value={passwordConfirmation}
              onChange={setPasswordConfirmation}
              autoComplete="new-password"
              placeholder="Re-enter your new password"
            />
            <ul className="password-checklist" aria-label="Password requirements">
              <li data-met={hasMinLength}>
                {hasMinLength ? (
                  <Check size={14} aria-hidden="true" />
                ) : (
                  <Circle size={14} aria-hidden="true" />
                )}
                <span>At least 6 characters</span>
              </li>
              <li data-met={passwordsMatch}>
                {passwordsMatch ? (
                  <Check size={14} aria-hidden="true" />
                ) : (
                  <Circle size={14} aria-hidden="true" />
                )}
                <span>Passwords match</span>
              </li>
              <li data-met={hasMix}>
                {hasMix ? (
                  <Check size={14} aria-hidden="true" />
                ) : (
                  <Circle size={14} aria-hidden="true" />
                )}
                <span>Mix of letters, numbers, or symbols (recommended)</span>
              </li>
            </ul>
            <button className="button account-submit" type="submit" disabled={busy}>
              {busy ? 'Resetting password…' : 'Reset password'}
              <ArrowRight size={18} aria-hidden="true" />
            </button>
            <p className="account-switch">
              Remembered your password?{' '}
              <Link className="account-link" to="/login">
                Back to sign in
              </Link>
            </p>
          </form>
        )}
      </div>
    </section>
  );
}
