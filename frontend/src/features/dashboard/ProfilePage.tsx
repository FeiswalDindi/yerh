import { ProfileForm } from './ProfileForm';
import { useEffect, useRef } from 'react';
import { ArrowUpRight, CalendarDays, Mail, MapPin, Phone } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useDemo } from '../../app/useDemo';
import { memberPath } from '../../domain/community';
import { accountInstitution } from '../../domain/incubation';
import { roleLabels } from '../../domain/roles';
import { usePageTitle } from '../../shared/usePageTitle';
import { RoleRequestForm, RoleRequestHistory } from '../accounts/RoleRequestForm';
import { accountRoleRequests, roleAccessSectionId } from '../accounts/role-requests';
import { DemoNotice } from '../demo/DemoNotice';
import { workspaceHref } from './dashboard-navigation';

export function ProfilePage() {
  usePageTitle('Profile');
  const { account, state, execute } = useDemo();
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
  const affiliation = accountInstitution(state.platform, account.id);
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
      <div className="container section dashboard-profile">
        <h1 className="sr-only">Profile</h1>
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
              <Link
                className="text-link"
                to={memberPath(account.id)}
                aria-label="View community profile"
              >
                View <ArrowUpRight size={16} aria-hidden="true" />
              </Link>
            </section>
          </aside>
          <div className="dashboard-profile-settings">
            <ProfileForm
              key={account.id}
              person={account}
              save={(fields) => execute({ type: 'profile', ...fields })}
            />
            {affiliation && (
              <section className="profile-panel dashboard-profile-card">
                <h2>Institution affiliation</h2>
                <p>{affiliation.name}</p>
              </section>
            )}
            {account.role !== 'school_admin' && (
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
            )}
            {account.role === 'mentor' && (
              <section className="profile-panel dashboard-profile-card">
                <h2>Mentor settings</h2>
                <p>Update the expertise, availability, and bio shown to entrepreneurs.</p>
                <Link
                  to={workspaceHref('mentor')}
                  className="text-link"
                  aria-label="Edit mentor profile"
                >
                  Edit <ArrowUpRight size={16} aria-hidden="true" />
                </Link>
              </section>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
