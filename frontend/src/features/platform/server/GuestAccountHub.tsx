import { useState } from 'react';
import { BookOpen, CalendarDays, ExternalLink, MailCheck, ShieldCheck, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  localLaravelIdentity,
  type LaravelProfile,
} from '../../../services/laravel-identity-repository';
import { learningRepository } from '../../../services/laravel-learning-repository';
import { ChangePasswordDialog } from '../../accounts/ChangePasswordForm';
import { ProfileForm } from '../../dashboard/ProfileForm';
import { AffiliationWorkspace } from './AffiliationWorkspace';
import { errorText } from './WorkspaceActions';

function initialsForName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'Y';
  return parts
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('');
}

export function GuestAccountHub({
  profile,
  refresh,
  verificationNotice,
}: {
  profile: LaravelProfile;
  refresh: () => Promise<void>;
  verificationNotice?: boolean;
}) {
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);

  async function verifyLocally() {
    setBusy(true);
    setError('');
    try {
      window.location.assign(await localLaravelIdentity.localVerificationLink());
    } catch (failure) {
      setError(errorText(failure));
      setBusy(false);
    }
  }

  async function resendVerification() {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await localLaravelIdentity.resendVerification();
      setNotice('A new verification email has been queued. Check your inbox.');
    } catch (failure) {
      setError(errorText(failure));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="guest-profile-grid">
      <aside className="guest-profile-sidebar" aria-label="Account summary and security">
        <div className="profile-panel guest-identity-card">
          <div className="guest-avatar-wrap">
            <span className="guest-avatar-circle" aria-hidden="true">
              {profile.avatar && !avatarFailed ? (
                <img
                  src={profile.avatar}
                  alt=""
                  referrerPolicy="no-referrer"
                  onError={() => setAvatarFailed(true)}
                />
              ) : (
                initialsForName(profile.name)
              )}
            </span>
          </div>
          <h1 className="guest-profile-name">{profile.name}</h1>
          <p className="guest-profile-email">{profile.email}</p>

          {verificationNotice && !profile.email_verified && (
            <p role="alert" className="form-error">
              This verification link has expired or is invalid. Send a fresh link below.
            </p>
          )}

          {!profile.email_verified && (
            <div className="guest-verify-box" role="region" aria-label="Email verification">
              <p>
                {profile.requested_institution
                  ? `Verify your email to complete affiliation with ${profile.requested_institution.name}.`
                  : 'Verify your email address to affiliate with an institution or hub and edit your profile.'}
              </p>
              <div className="guest-verify-actions">
                {profile.local_verification_available && (
                  <button
                    type="button"
                    className="button button-gold"
                    disabled={busy}
                    onClick={() => void verifyLocally()}
                  >
                    <MailCheck size={16} aria-hidden="true" />
                    Verify email now
                  </button>
                )}
                <button
                  type="button"
                  className="button button-outline"
                  disabled={busy}
                  onClick={() => void resendVerification()}
                >
                  Resend verification email
                </button>
              </div>
              {notice && (
                <p role="status" className="form-success">
                  {notice}
                </p>
              )}
              {error && (
                <p role="alert" className="form-error">
                  {error}
                </p>
              )}
            </div>
          )}

          <div className="guest-security-section">
            <h2>Sign-in &amp; security</h2>
            <div className="guest-security-badges">
              {profile.google_connected && (
                <span className="users-badge">
                  <ShieldCheck size={12} aria-hidden="true" />
                  Google connected
                </span>
              )}
              <span className="users-badge">
                {profile.has_password === false ? 'Passwordless Google' : 'Password active'}
              </span>
            </div>
            <ChangePasswordDialog
              hasPassword={profile.has_password !== false}
              onUpdated={refresh}
            />
          </div>

          <div className="guest-quick-links" role="navigation" aria-label="Account shortcuts">
            <Link to="/learn" className="guest-quick-link">
              <BookOpen size={16} aria-hidden="true" />
              <span>Browse courses</span>
            </Link>
            <a href={learningRepository.moodleLaunchUrl()} className="guest-quick-link">
              <ExternalLink size={16} aria-hidden="true" />
              <span>Open Moodle Classroom</span>
            </a>
            <Link to="/groups" className="guest-quick-link">
              <Users size={16} aria-hidden="true" />
              <span>Community groups</span>
            </Link>
            <Link to="/events" className="guest-quick-link">
              <CalendarDays size={16} aria-hidden="true" />
              <span>Events</span>
            </Link>
          </div>
        </div>
      </aside>

      <div className="guest-profile-stack">
        <section
          id="incubation"
          className="profile-panel guest-card"
          aria-labelledby="guest-affiliation-title"
        >
          <header className="guest-card-head">
            <div>
              <p className="eyebrow">Institutional affiliation</p>
              <h2 id="guest-affiliation-title">Join a university or innovation hub</h2>
              <p className="guest-card-copy">
                Affiliate with a partner institution to unlock Entrepreneur status, venture launches,
                and guided incubation pathways.
              </p>
            </div>
          </header>

          <ol className="guest-journey-steps" aria-label="Affiliation progress">
            <li data-state={profile.email_verified ? 'done' : 'current'}>
              <span className="guest-step-num">1</span>
              <span>Verify email</span>
            </li>
            <li data-state={profile.email_verified ? 'current' : 'upcoming'}>
              <span className="guest-step-num">2</span>
              <span>Affiliate with institution / hub</span>
            </li>
            <li data-state="upcoming">
              <span className="guest-step-num">3</span>
              <span>Entrepreneur</span>
            </li>
          </ol>

          {profile.email_verified ? (
            <AffiliationWorkspace
              refresh={refresh}
              profileEmail={profile.email}
              defaultLocation={profile.location ?? ''}
            />
          ) : (
            <p className="account-status">
              {profile.requested_institution
                ? `Verify your email address to activate or submit your request for ${profile.requested_institution.name}.`
                : 'Verify your email address using the button on the left to apply to a university or hub or redeem an invitation code.'}
            </p>
          )}
        </section>

        <div className="guest-profile-form-wrap">
          {profile.email_verified ? (
            <ProfileForm
              person={{
                first_name: profile.first_name ?? '',
                last_name: profile.last_name ?? '',
                name: profile.name,
                email: profile.email,
                location: profile.location ?? '',
                headline: profile.headline ?? '',
                bio: profile.bio ?? '',
              }}
              splitName
              save={async (fields) => {
                await localLaravelIdentity.updateProfile(fields);
                await refresh();
                return true;
              }}
            />
          ) : (
            <section className="profile-panel guest-card" aria-labelledby="guest-profile-locked">
              <h2 id="guest-profile-locked">Personal &amp; community profile</h2>
              <p className="account-status">
                Verify your email address first to edit your name, location, headline, and bio.
              </p>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
