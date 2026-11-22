import { useEffect } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { useDemo } from '../../app/useDemo';
import { sessionPath } from '../../domain/community';
import { institutionAccess } from '../../domain/incubation';
import { PageIntro } from '../../shared/PageIntro';
import { usePageTitle } from '../../shared/usePageTitle';
import { institutionHref } from '../dashboard/dashboard-navigation';
import { DemoNotice } from '../demo/DemoNotice';
import { RoleRequestForm, RoleRequestHistory } from './RoleRequestForm';
import { accountRoleRequests } from './role-requests';

export function GuestAccount() {
  const { account, state } = useDemo();
  const { hash } = useLocation();
  usePageTitle('Account');
  useEffect(() => {
    if (hash === '#incubation' || hash === '#reservations')
      document.getElementById(hash.slice(1))?.scrollIntoView();
  }, [hash]);
  if (!account) return null;
  if (account.role !== 'guest') return <Navigate to="/dashboard" replace />;
  const requests = accountRoleRequests(state.platform.applications, account.id);
  const pending = requests.find((request) => request.status === 'pending');
  const rejected = requests[0]?.status === 'rejected';
  const reservations = state.registrations.filter((row) => row.memberId === account.id);
  const institutions = state.platform.training.institutions.filter((row) =>
    institutionAccess(row, account),
  );
  return (
    <>
      <PageIntro eyebrow="YERH" title="Account" description={account.name} />
      <div className="container section narrow-content guest-account-content">
        <DemoNotice />
        <div className="form-actions">
          <Link to="/learn" className="button">
            Browse courses
          </Link>
          <Link to="/events" className="button button-outline">
            Browse events
          </Link>
          <Link to="/account/certificates" className="button button-outline">
            Certificates
          </Link>
        </div>
        {institutions.length > 0 && (
          <section className="profile-panel">
            <h2>Institution access</h2>
            <ul>
              {institutions.map((row) => (
                <li key={row.id}>
                  <Link
                    className="text-link"
                    to={institutionHref(
                      row.kind === 'high-school' && institutionAccess(row, account) === 'view'
                        ? 'member-results'
                        : 'school',
                      row.id,
                    )}
                  >
                    {row.name}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
        <section id="incubation" className="profile-panel" aria-labelledby="guest-incubation">
          <h2 id="guest-incubation">Incubation and role applications</h2>
          {rejected && <p>You can apply again after reviewing the feedback below.</p>}
          <RoleRequestForm account={account} pending={pending} />
          <RoleRequestHistory requests={requests} />
        </section>
        <section id="reservations" className="profile-panel" aria-labelledby="guest-reservations">
          <h2 id="guest-reservations">Event reservations</h2>
          {reservations.length ? (
            <ul>
              {reservations.map((reservation) => {
                const session = state.sessions.find((item) => item.id === reservation.sessionId);
                return session ? (
                  <li key={reservation.sessionId}>
                    <Link className="text-link" to={sessionPath(session.id)}>
                      {session.title}
                    </Link>
                    {' · '}
                    {reservation.status === 'cancelled'
                      ? 'Cancelled'
                      : reservation.status === 'attended'
                        ? 'Attended'
                        : 'Reserved'}
                  </li>
                ) : null;
              })}
            </ul>
          ) : (
            <p>Your event reservations will appear here.</p>
          )}
        </section>
      </div>
    </>
  );
}
