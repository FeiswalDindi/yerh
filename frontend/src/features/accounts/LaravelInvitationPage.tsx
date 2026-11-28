import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowRight, CircleAlert } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLaravelSession } from '../../app/useLaravelSession';
import {
  localInstitution,
  type InvitationPreview,
} from '../../services/local-institution-repository';
import { triggerCardErrorFeedback } from '../../shared/error-feedback';
import { PageIntro } from '../../shared/PageIntro';
import { LoadingDots } from '../../shared/SiteLoader';
import { usePageTitle } from '../../shared/usePageTitle';
import { AccountLink } from './AccountLink';

export function LaravelInvitationPage() {
  usePageTitle('Institution invitation');
  const { id: token = '' } = useParams();
  const session = useLaravelSession();
  const navigate = useNavigate();
  const [preview, setPreview] = useState<InvitationPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [location, setLocation] = useState(session?.profile?.location ?? '');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (session?.profile?.location && !location) {
      setLocation(session.profile.location);
    }
  }, [session?.profile?.location, location]);

  useEffect(() => {
    if (!/^[a-f0-9]{64}$/i.test(token)) {
      setLoadError('This invitation link is invalid.');
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setLoadError('');
    void localInstitution
      .preview(token, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) {
          setPreview(data);
          setLoading(false);
        }
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) {
          setLoadError(
            cause instanceof Error ? cause.message : 'This invitation could not be found.',
          );
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [token]);

  async function accept(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await localInstitution.accept(token, location.trim(), consent);
      await session?.refresh();
      navigate('/dashboard', { replace: true });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not accept this invitation.');
      triggerCardErrorFeedback(panelRef.current);
    } finally {
      setBusy(false);
    }
  }

  const profile = session?.profile;

  return (
    <>
      <PageIntro
        eyebrow="Institution invitation"
        title={preview ? `Join ${preview.institution_name}` : 'Institution invitation'}
        description="Accept your institutional affiliation to unlock your YERH Entrepreneur dashboard."
      />
      <section className="container section">
        <div
          ref={panelRef}
          className="profile-panel"
          style={{ maxWidth: '38rem', margin: '0 auto' }}
        >
          {loading ? (
            <p role="status" className="yerh-status-loading">
              <LoadingDots label="Checking your invitation" />
            </p>
          ) : loadError || !preview ? (
            <>
              <p role="alert" className="account-error">
                <CircleAlert size={17} aria-hidden="true" />
                {loadError || 'This invitation is no longer available.'}
              </p>
              <Link className="button button-outline" to="/account">
                Go to your account
              </Link>
            </>
          ) : !preview.valid ? (
            <>
              <p role="alert" className="account-error">
                <CircleAlert size={17} aria-hidden="true" />
                {preview.accepted
                  ? 'This invitation has already been accepted.'
                  : preview.revoked
                    ? 'This invitation has been revoked by the institution.'
                    : preview.expired
                      ? 'This invitation has expired. Ask your institution coordinator for a new one.'
                      : 'This invitation is no longer active.'}
              </p>
              <Link className="button button-outline" to="/account">
                Go to your account
              </Link>
            </>
          ) : !profile ? (
            <div className="account-form">
              <p>
                <strong>{preview.invitee_name}</strong>, you were invited to join{' '}
                <strong>{preview.institution_name}</strong> on YERH.
              </p>
              <p>Sign in or create an account with the invited email address to accept.</p>
              <div className="workspace-row-actions">
                <AccountLink className="button">
                  Sign in <ArrowRight size={18} aria-hidden="true" />
                </AccountLink>
                <AccountLink mode="register" className="button button-outline">
                  Create account
                </AccountLink>
              </div>
            </div>
          ) : !profile.email_verified ? (
            <div className="account-form">
              <p>Verify your email address ({profile.email}) before accepting this invitation.</p>
              <Link className="button" to="/account">
                Verify email address
              </Link>
            </div>
          ) : (
            <form
              className="account-form"
              onSubmit={(e) => void accept(e)}
              onInvalidCapture={() => triggerCardErrorFeedback(panelRef.current)}
            >
              <p>
                Signed in as <strong>{profile.name}</strong> ({profile.email}). Accepting links your
                account to <strong>{preview.institution_name}</strong> and unlocks your Entrepreneur
                dashboard.
              </p>
              <label className="account-field">
                City or county
                <input
                  required
                  minLength={2}
                  maxLength={120}
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. Nairobi"
                />
              </label>
              <label className="account-checkbox">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  required
                />
                <span>
                  I agree to share my affiliation and incubation progress with{' '}
                  {preview.institution_name} and YERH.
                </span>
              </label>
              {error && (
                <p role="alert" className="account-error">
                  <CircleAlert size={17} aria-hidden="true" />
                  {error}
                </p>
              )}
              <button className="button account-submit" type="submit" disabled={busy}>
                {busy ? 'Accepting…' : `Accept invitation to ${preview.institution_name}`}
                <ArrowRight size={18} aria-hidden="true" />
              </button>
            </form>
          )}
        </div>
      </section>
    </>
  );
}
