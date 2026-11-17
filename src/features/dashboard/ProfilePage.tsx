import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowUpRight, CalendarDays, Mail, MapPin, Phone } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useDemo } from '../../app/useDemo';
import { memberPath } from '../../domain/community';
import type { DemoAccount } from '../../domain/demo';
import { roleLabels } from '../../domain/roles';
import { PageIntro } from '../../shared/PageIntro';
import { usePageTitle } from '../../shared/usePageTitle';
import { RoleRequestForm, RoleRequestHistory } from '../accounts/RoleRequestForm';
import { accountRoleRequests, roleAccessSectionId } from '../accounts/role-requests';
import { DemoNotice } from '../demo/DemoNotice';
import { workspaceHref } from './dashboard-navigation';

type ProfileFields = Pick<DemoAccount, 'name' | 'location' | 'headline' | 'bio'>;

function ProfileForm({ person }: { person: DemoAccount }) {
  const { execute } = useDemo();
  const [changes, setChanges] = useState<Partial<ProfileFields>>({});
  const [saved, setSaved] = useState(false);
  const { name, location, headline, bio } = { ...person, ...changes };
  const dirty =
    name.trim() !== person.name ||
    location.trim() !== person.location ||
    headline.trim() !== person.headline ||
    bio.trim() !== person.bio;

  function update(field: keyof ProfileFields, value: string) {
    setSaved(false);
    setChanges((current) => ({ ...current, [field]: value }));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (dirty && execute({ type: 'profile', name, location, headline, bio })) {
      setChanges({});
      setSaved(true);
    }
  }

  return (
    <form className="dashboard-profile-form" onSubmit={submit}>
      <section
        className="profile-panel dashboard-profile-card"
        aria-labelledby="personal-details-title"
      >
        <h2 id="personal-details-title">Personal details</h2>
        <dl className="dashboard-profile-email">
          <dt>Account email</dt>
          <dd>{person.email}</dd>
        </dl>
        <div className="workspace-form dashboard-profile-fields">
          <label>
            Full name
            <input
              autoComplete="name"
              required
              minLength={2}
              maxLength={80}
              value={name}
              onChange={(e) => update('name', e.target.value)}
            />
          </label>
          <label>
            City or county
            <input
              autoComplete="address-level2"
              required
              minLength={2}
              maxLength={80}
              value={location}
              onChange={(e) => update('location', e.target.value)}
            />
          </label>
        </div>
      </section>
      <section
        className="profile-panel dashboard-profile-card"
        aria-labelledby="community-details-title"
      >
        <h2 id="community-details-title">Community profile</h2>
        <p>Introduce yourself to other YERH members.</p>
        <div className="workspace-form dashboard-profile-fields">
          <label>
            Headline
            <input
              required
              minLength={3}
              maxLength={120}
              value={headline}
              onChange={(e) => update('headline', e.target.value)}
            />
          </label>
          <label>
            Bio
            <textarea
              required
              minLength={10}
              maxLength={600}
              rows={3}
              value={bio}
              onChange={(e) => update('bio', e.target.value)}
            />
          </label>
        </div>
      </section>
      {dirty && (
        <div className="dashboard-profile-actions">
          <button className="text-link" type="button" onClick={() => setChanges({})}>
            Discard changes
          </button>
          <button className="button button-gold" type="submit">
            Save changes
          </button>
        </div>
      )}
      {saved && (
        <p role="status" className="form-success">
          Profile saved.
        </p>
      )}
    </form>
  );
}

export function ProfilePage() {
  usePageTitle('My profile');
  const { account, state } = useDemo();
  const { hash, key } = useLocation();
  const roleAccess = useRef<HTMLElement>(null);
  useEffect(() => {
    if (hash !== `#${roleAccessSectionId}`) return;
    const frame = requestAnimationFrame(() => {
      roleAccess.current?.scrollIntoView({ block: 'start', behavior: 'instant' });
      roleAccess.current?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [hash, key]);

  if (!account) return null;
  const requests = accountRoleRequests(state.platform.applications, account.id);
  const pending = requests.find((request) => request.status === 'pending');
  const isGuest = account.role === 'guest';
  const initials = account.name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

  return (
    <>
      <PageIntro
        eyebrow="My profile"
        title="My profile"
        description="Manage your personal details, community profile, and role."
        className="dashboard-pane-intro"
      />
      <div className="container section dashboard-profile">
        <DemoNotice />
        <div className="dashboard-profile-grid">
          <aside className="dashboard-profile-settings" aria-label="Account summary">
            <div className="profile-panel dashboard-profile-card dashboard-profile-summary">
              <span className="avatar-initials" aria-hidden="true">
                {initials}
              </span>
              <div>
                <h2>{account.name}</h2>
                <p>{account.headline}</p>
              </div>
              <span className="dashboard-profile-role">{roleLabels[account.role]}</span>
            </div>
            <section
              className="profile-panel dashboard-profile-card dashboard-profile-contact"
              aria-label="Account overview"
            >
              <h2>Account overview</h2>
              <p>
                <Mail size={16} aria-hidden="true" />
                {account.email}
              </p>
              {account.location && (
                <p>
                  <MapPin size={16} aria-hidden="true" />
                  {account.location}
                </p>
              )}
              {account.phone && (
                <p>
                  <Phone size={16} aria-hidden="true" />
                  {account.phone}
                </p>
              )}
              <p>
                <CalendarDays size={16} aria-hidden="true" /> Member since{' '}
                {new Date(account.joinedAt).toLocaleDateString('en-KE', {
                  month: 'short',
                  year: 'numeric',
                  timeZone: 'Africa/Nairobi',
                })}
              </p>
              <Link className="text-link" to={memberPath(account.id)}>
                View community profile <ArrowUpRight size={16} aria-hidden="true" />
              </Link>
            </section>
          </aside>
          <div className="dashboard-profile-settings">
            <ProfileForm key={account.id} person={account} />
            <section
              className="profile-panel dashboard-profile-card role-request-panel"
              id={roleAccessSectionId}
              ref={roleAccess}
              tabIndex={-1}
              aria-labelledby="role-access-title"
            >
              <h2 id="role-access-title">Role &amp; access</h2>
              <p>
                Current role: <strong>{roleLabels[account.role]}</strong>
              </p>
              <h3>{isGuest ? 'Apply for a role' : 'Request a different role'}</h3>
              {!pending && (
                <p>
                  {isGuest
                    ? 'Choose a role when you’re ready to access its tools.'
                    : 'Your current access stays active while an administrator reviews your request.'}
                </p>
              )}
              <RoleRequestForm key={account.id} account={account} pending={pending} />
              <RoleRequestHistory requests={requests} />
            </section>
            {account.role === 'mentor' && (
              <section className="profile-panel dashboard-profile-card">
                <h2>Mentor settings</h2>
                <p>Update the expertise, availability, and bio shown to entrepreneurs.</p>
                <Link to={workspaceHref('mentor')} className="text-link">
                  Edit mentor profile <ArrowUpRight size={16} aria-hidden="true" />
                </Link>
              </section>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
