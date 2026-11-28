import { useEffect, useState, type FormEvent } from 'react';
import { ArrowRight, CircleAlert } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useLaravelSession } from '../../app/useLaravelSession';
import {
  localLaravelIdentity,
  type InstitutionChoice,
} from '../../services/laravel-identity-repository';
import { TermsDialog } from '../legal/TermsDialog';
import { accountDestination } from './account-navigation';
import { GoogleAccountButton } from './GoogleAccountButton';
import { PasswordField } from './PasswordField';
import { LoadingDots } from '../../shared/SiteLoader';

function errorMessage(error: unknown): string {
  if (error instanceof TypeError)
    return 'Could not reach the server. Check your connection and try again.';
  return error instanceof Error ? error.message : 'Your request could not be completed.';
}

const oauthErrorMessages: Record<string, string> = {
  'not-configured':
    'Google sign-in is not configured yet. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to backend/.env.',
  cancelled: 'Google sign-in was cancelled.',
  'state-mismatch':
    'Your sign-in session expired or did not match this browser origin. Make sure you open http://localhost:8000 and try again.',
  suspended: 'This account has been suspended. Please contact YERH support.',
  'unverified-email':
    'Your Google account email must be verified by Google before signing in to YERH.',
  'account-conflict':
    'This email is already linked to another Google account. Sign in with your password or contact support.',
  'missing-email': 'Google did not provide an email address for this account.',
  failed: 'Could not complete Google sign-in. Please try again.',
};

export function LaravelAccountForm({
  title,
  register,
  institution,
  institutionLabel,
  search = '',
  verification,
  onComplete,
  onClearInstitution,
  onErrorFeedback,
  onSwitch,
}: {
  title: string;
  register: boolean;
  institution: string;
  institutionLabel?: string;
  search?: string;
  verification: string | null;
  onComplete: () => void;
  onClearInstitution?: () => void;
  onErrorFeedback?: () => void;
  onSwitch: () => void;
}) {
  const session = useLaravelSession();
  const navigate = useNavigate();
  const profile = session?.profile;
  const loading = session?.loading;
  const queryParams = new URLSearchParams(search);
  const oauthErrorCode = queryParams.get('oauth_error') ?? '';
  const redirectTarget = queryParams.get('redirect') ?? undefined;
  const [busy, setBusy] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const [error, setError] = useState(() => oauthErrorMessages[oauthErrorCode] ?? '');
  const [notice, setNotice] = useState('');
  const [choices, setChoices] = useState<InstitutionChoice[]>([]);
  const [selectedInstitution, setSelectedInstitution] = useState(
    institution && institution !== 'yerh' ? institution : '',
  );
  const [location, setLocation] = useState('');
  const [googleEnabled, setGoogleEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    setError(oauthErrorMessages[oauthErrorCode] ?? '');
  }, [oauthErrorCode]);

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

  useEffect(() => {
    if (profile) return;
    const controller = new AbortController();
    void localLaravelIdentity
      .providers(controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setGoogleEnabled(result.google);
      })
      .catch(() => {
        if (!controller.signal.aborted) setGoogleEnabled(null);
      });
    return () => controller.abort();
  }, [profile]);

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
    const firstName = field('first_name').trim();
    const lastName = field('last_name').trim();
    void perform(async () => {
      const signedIn = await localLaravelIdentity.authenticate(
        register ? 'register' : 'login',
        register
          ? {
              ...credentials,
              first_name: firstName,
              last_name: lastName,
              name: `${firstName} ${lastName}`.trim(),
              location: location.trim() || undefined,
              institution: selectedInstitution || undefined,
              password_confirmation: field('password_confirmation'),
              terms: data.get('terms') === 'on',
            }
          : {
              ...credentials,
              ...(institution ? { institution } : {}),
              remember: data.get('remember') === 'on',
            },
      );
      session?.setProfile(signedIn);
      onComplete();
      const fallback =
        signedIn.email_verified && (signedIn.role !== 'guest' || signedIn.staff.length > 0)
          ? '/dashboard'
          : '/account';
      navigate(accountDestination(search, fallback));
    });
  }

  const googleHref =
    googleEnabled === false
      ? undefined
      : localLaravelIdentity.googleAuthUrl({
          mode: register ? 'register' : 'login',
          institution: register ? selectedInstitution || undefined : institution || undefined,
          location: register ? location.trim() || undefined : undefined,
          redirect: redirectTarget,
        });

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
        <p className="account-status yerh-status-loading" role="status">
          <LoadingDots label="Checking your session" />
        </p>
      ) : profile ? (
        <div className="account-form">
          {feedbackBanner}
          <p>
            You’re signed in as <strong>{profile.name}</strong>.
          </p>
          <p>Email verification: {profile.email_verified ? 'verified' : 'pending'}.</p>
          {!profile.email_verified && (
            <>
              {profile.local_verification_available && (
                <button
                  type="button"
                  className="button account-submit"
                  disabled={busy}
                  onClick={() =>
                    void perform(async () => {
                      window.location.assign(await localLaravelIdentity.localVerificationLink());
                    })
                  }
                >
                  Verify email address
                </button>
              )}
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
            </>
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
          {feedbackBanner}
          <GoogleAccountButton
            divider
            dividerPosition="bottom"
            disabled={busy}
            href={googleHref}
            unavailableMessage="Google sign-in is wired up, but GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are not set in backend/.env yet."
            onUnavailable={() => onErrorFeedback?.()}
          />
          <form
            className="account-form"
            onSubmit={submit}
            onInvalidCapture={() => onErrorFeedback?.()}
          >
            {!register && institution && (
              <p className="account-status" role="status">
                Signing in for <strong>{institutionLabel || institution}</strong>.{' '}
                {onClearInstitution && (
                  <button type="button" className="account-link" onClick={onClearInstitution}>
                    Sign in without filter
                  </button>
                )}
              </p>
            )}
            {register && (
              <>
                <label className="account-field">
                  First name
                  <input
                    name="first_name"
                    autoComplete="given-name"
                    required
                    minLength={1}
                    maxLength={80}
                  />
                </label>
                <label className="account-field">
                  Last name
                  <input
                    name="last_name"
                    autoComplete="family-name"
                    required
                    minLength={1}
                    maxLength={80}
                  />
                </label>
              </>
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
                    <option value="">No Institution</option>
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
                    value={location}
                    onChange={(event) => setLocation(event.target.value)}
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
          {!register && (
            <p className="account-switch">
              School, university, or hub administrator?{' '}
              <Link className="account-link" to="/institutions/apply" onClick={onComplete}>
                Register your institution
              </Link>
            </p>
          )}
        </>
      )}
      {termsOpen && <TermsDialog onClose={() => setTermsOpen(false)} />}
    </>
  );
}
