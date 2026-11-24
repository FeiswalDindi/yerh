import { useEffect, useState, type FormEvent } from 'react';
import { ArrowRight, CircleAlert } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useLaravelSession } from '../../app/useLaravelSession';
import {
  localLaravelIdentity,
  type InstitutionChoice,
} from '../../services/laravel-identity-repository';
import { TermsDialog } from '../legal/TermsDialog';
import { PasswordField } from './PasswordField';

function errorMessage(error: unknown): string {
  if (error instanceof TypeError)
    return 'Could not reach the server. Check your connection and try again.';
  return error instanceof Error ? error.message : 'Your request could not be completed.';
}

export function LaravelAccountForm({
  title,
  register,
  institution,
  institutionLabel,
  verification,
  onComplete,
  onChangeInstitution,
  onErrorFeedback,
  onSwitch,
}: {
  title: string;
  register: boolean;
  institution: string;
  institutionLabel?: string;
  verification: string | null;
  onComplete: () => void;
  onChangeInstitution: () => void;
  onErrorFeedback?: () => void;
  onSwitch: () => void;
}) {
  const session = useLaravelSession();
  const navigate = useNavigate();
  const profile = session?.profile;
  const loading = session?.loading;
  const [busy, setBusy] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [choices, setChoices] = useState<InstitutionChoice[]>([]);
  const [selectedInstitution, setSelectedInstitution] = useState(
    institution && institution !== 'yerh' ? institution : '',
  );

  useEffect(() => {
    if (!register || profile) return;
    const controller = new AbortController();
    void localLaravelIdentity
      .choices(controller.signal)
      .then((rows) => {
        if (!controller.signal.aborted) {
          setChoices(rows.filter((row) => row.kind !== 'high-school'));
        }
      })
      .catch(() => {
        // Optional dropdown; ignore transient load errors and let user register directly.
      });
    return () => controller.abort();
  }, [register, profile]);

  const activeChoice = choices.find((item) => item.slug === selectedInstitution);
  const verifiedDomains = activeChoice?.allowed_domains ?? [];

  async function perform(action: () => Promise<void>) {
    setBusy(true);
    setNotice('');
    setError('');
    try {
      await action();
    } catch (failure) {
      setError(errorMessage(failure));
      onErrorFeedback?.();
    } finally {
      setBusy(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const field = (key: string) => String(data.get(key) ?? '');

    if (forgotMode) {
      void perform(async () => {
        const message = await localLaravelIdentity.forgotPassword(field('email').trim());
        setNotice(message);
      });
      return;
    }

    if (register && field('password') !== field('password_confirmation')) {
      setNotice('');
      setError('Password confirmation does not match.');
      onErrorFeedback?.();
      return;
    }

    const credentials = { email: field('email').trim(), password: field('password') };
    void perform(async () => {
      const signedIn = await localLaravelIdentity.authenticate(
        register ? 'register' : 'login',
        register
          ? {
              ...credentials,
              name: field('name').trim(),
              location: field('location').trim() || undefined,
              institution: selectedInstitution || undefined,
              password_confirmation: field('password_confirmation'),
            }
          : {
              ...credentials,
              institution: institution || 'yerh',
              remember: data.get('remember') === 'on',
            },
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

  const feedbackBanner = (
    <>
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
    </>
  );

  return (
    <>
      <header className="account-heading">
        <h2 id="account-title">{forgotMode ? 'Reset your password' : title}</h2>
        <p id="account-description">
          {forgotMode
            ? 'Enter your email address and we will send you a password reset link.'
            : register
              ? 'Create your Youth Entrepreneurship Resource Hub account.'
              : 'Access your YERH workspace.'}
        </p>
        {!register &&
          !forgotMode &&
          (verification === 'continue' || verification === 'wrong-account') && (
            <p role="status" className="account-status">
              {verification === 'wrong-account'
                ? 'This link belongs to another account. Sign out, then reopen the link and sign in with the email it was sent to.'
                : 'Sign in with the email this link was sent to. YERH will finish verifying your account.'}
            </p>
          )}
      </header>
      {loading ? (
        <p className="account-status" role="status">
          Checking your session…
        </p>
      ) : profile ? (
        <div className="account-form">
          {feedbackBanner}
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
                  setNotice('A new verification email has been sent. Check your inbox.');
                })
              }
            >
              Resend verification email
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
      ) : forgotMode ? (
        <>
          <form
            className="account-form"
            onSubmit={submit}
            onInvalidCapture={() => onErrorFeedback?.()}
          >
            {feedbackBanner}
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
            <button className="button account-submit" type="submit" disabled={busy}>
              {busy ? 'Sending link…' : 'Send reset link'}
              <ArrowRight size={18} aria-hidden="true" />
            </button>
          </form>
          <p className="account-switch">
            Remembered your password?{' '}
            <button
              className="account-link"
              type="button"
              disabled={busy}
              onClick={() => {
                setForgotMode(false);
                setError('');
                setNotice('');
              }}
            >
              Back to sign in
            </button>
          </p>
        </>
      ) : (
        <>
          <form
            className="account-form"
            onSubmit={submit}
            onInvalidCapture={() => onErrorFeedback?.()}
          >
            {!register && (
              <button type="button" className="account-link" onClick={onChangeInstitution}>
                {institutionLabel ? `${institutionLabel} · ` : ''}Change institution
              </button>
            )}
            {feedbackBanner}
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
            {register && (
              <>
                <label className="account-field">
                  University or hub (optional)
                  <select
                    name="institution"
                    value={selectedInstitution}
                    onChange={(event) => setSelectedInstitution(event.target.value)}
                  >
                    <option value="">No institution (Guest / YERH)</option>
                    {choices.map((school) => (
                      <option key={school.slug} value={school.slug}>
                        {school.name}
                      </option>
                    ))}
                  </select>
                </label>
                {activeChoice && (
                  <p className="account-status" role="status">
                    {verifiedDomains.length > 0
                      ? `Students using ${verifiedDomains.map((d) => '@' + d).join(' or ')} unlock ${activeChoice.name} automatically after verifying their email. Other emails are sent to ${activeChoice.name} for approval.`
                      : `After you verify your email, your affiliation request will be sent to ${activeChoice.name} and YERH for approval.`}
                  </p>
                )}
                <label className="account-field">
                  City or county
                  <input
                    name="location"
                    autoComplete="address-level2"
                    minLength={2}
                    maxLength={120}
                    required={Boolean(selectedInstitution)}
                    placeholder="e.g. Nairobi"
                  />
                </label>
              </>
            )}
            <PasswordField
              className="account-field"
              autoComplete={register ? 'new-password' : 'current-password'}
            />
            {register ? (
              <>
                <p className="form-note">Use at least 6 characters.</p>
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
            ) : (
              <div className="account-agreement">
                <label className="account-checkbox">
                  <input type="checkbox" name="remember" />
                  <span>Keep me signed in</span>
                </label>
                <button
                  type="button"
                  className="account-link"
                  onClick={() => {
                    setForgotMode(true);
                    setError('');
                    setNotice('');
                  }}
                >
                  Forgot password?
                </button>
              </div>
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
      {termsOpen && <TermsDialog onClose={() => setTermsOpen(false)} />}
    </>
  );
}
