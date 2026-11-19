import { Link, useLocation, useParams } from 'react-router-dom';
import { AccountLink } from '../accounts/AccountLink';
import { roleAccessPath } from '../accounts/role-requests';
import { dashboardCataloguePaths } from '../dashboard/catalogue-paths';
import { useDemo } from '../../app/useDemo';
import { useCatalog } from '../../app/useCatalog';
import { contentPath } from '../../domain/content';
import { memberPath, registrationProblem, sessionPath } from '../../domain/community';
import { PageIntro } from '../../shared/PageIntro';
import { usePageTitle } from '../../shared/usePageTitle';
import { isPublishedSession, sessionCategory, sessionPresenters } from '../../domain/events';
import { DemoNotice } from '../demo/DemoNotice';
import { NotFoundPage } from '../info/NotFoundPage';
import { EventPresenters } from './EventPresenters';
import { can } from '../../domain/roles';

export function SessionPage({ dashboard = false }: { dashboard?: boolean }) {
  const { sessionId } = useParams();
  const { search } = useLocation();
  const { state, account, enabled, execute } = useDemo();
  const { items } = useCatalog();
  const session = state.sessions.find((s) => s.id === sessionId);
  const adminView = dashboard && account?.role === 'admin';
  const preview = adminView && new URLSearchParams(search).get('eventView') === 'preview';
  const existing = state.registrations.find(
    (row) =>
      row.sessionId === sessionId && row.memberId === account?.id && row.status !== 'cancelled',
  );
  const visible =
    session && (isPublishedSession(session) || (!preview && (adminView || !!existing)));
  usePageTitle(visible ? session.title : 'Session not found');
  if (!session || !visible) return <NotFoundPage />;
  const presenters = sessionPresenters(session, state.accounts);
  const resource = items.find((i) => i.id === session.contentId);
  const group = state.groups.find((g) => g.id === session.groupId);
  const forum = state.forums.find((f) => f.id === session.forumId);
  const registration = state.registrations.find(
    (r) => !preview && r.sessionId === session.id && r.memberId === account?.id,
  );
  const canAttend = can(account, 'attend');
  const count = state.registrations.filter(
    (r) => r.sessionId === session.id && r.status !== 'cancelled',
  ).length;
  const problem = registrationProblem(state, session, new Date().toISOString());
  const started = !!session.startsAt && Date.parse(session.startsAt) <= Date.now();
  function formatDate(value: string) {
    return new Date(value).toLocaleString('en-KE', {
      dateStyle: 'long',
      timeStyle: 'short',
      timeZone: session!.timezone,
    });
  }
  return (
    <>
      {!adminView && (
        <PageIntro
          eyebrow={sessionCategory(session, state.platform.eventCategories).label}
          title={session.title}
          description={session.summary}
        />
      )}
      <section className="container section">
        {adminView && (
          <>
            <h1 className="workspace-heading">{session.title}</h1>
            <p>{session.summary}</p>
          </>
        )}
        <DemoNotice />
        <Link
          className="text-link"
          to={
            dashboard
              ? `${dashboardCataloguePaths.events}${search}`
              : session.type === 'workshop'
                ? '/workshops'
                : session.type === 'webinar'
                  ? '/webinars'
                  : '/events'
          }
        >
          {dashboard ? '← Back to events' : `← All ${session.type}s`}
        </Link>
        <div className="session-layout">
          <div>
            <article className="profile-panel">
              <h2>Session details</h2>
              <dl className="session-details">
                <dt>Starts</dt>
                <dd>
                  {session.startsAt ? formatDate(session.startsAt) : 'Not recorded in the archive'}
                </dd>
                <dt>Ends</dt>
                <dd>
                  {session.endsAt ? formatDate(session.endsAt) : 'Not recorded in the archive'}
                </dd>
                <dt>Timezone</dt>
                <dd>{session.timezone} (EAT)</dd>
                <dt>Venue</dt>
                <dd>{session.venue}</dd>
                {session.registrationDeadline && (
                  <>
                    <dt>Registration closes</dt>
                    <dd>{formatDate(session.registrationDeadline)}</dd>
                  </>
                )}
              </dl>
              {session.fictional && (
                <p className="source-note">
                  Fictional development session. Reservations stay in this browser; no real booking
                  or meeting invitation is sent.
                </p>
              )}
              {resource && (
                <Link className="button" to={contentPath(resource)}>
                  Explore archived resource →
                </Link>
              )}
            </article>
            <h2 className="community-section-title">Hosts & facilitators</h2>
            {presenters.length ? (
              <EventPresenters presenters={presenters} />
            ) : (
              <p className="empty-state">
                Host and facilitator details will appear here when added.
              </p>
            )}
          </div>
          <aside>
            <section className="profile-panel">
              <h2>Your place</h2>
              {session.status !== 'completed' && (
                <p>
                  {session.capacity === null
                    ? 'No capacity limit recorded'
                    : `${Math.max(0, session.capacity - count)} of ${session.capacity} places available`}
                </p>
              )}
              {registration && (
                <p role="status">
                  Your registration: <strong>{registration.status}</strong>
                </p>
              )}
              {session.status === 'completed' ? (
                <p>Historical session · registration closed.</p>
              ) : registration?.status === 'attended' ? (
                <p>Attendance recorded.</p>
              ) : registration?.status === 'registered' ? (
                <>
                  <p>Your place is reserved locally.</p>
                  {!started && account && enabled && (
                    <button
                      className="button button-outline"
                      onClick={() =>
                        execute({
                          type: 'registration',
                          sessionId: session.id,
                          operation: 'cancel',
                          now: new Date().toISOString(),
                        })
                      }
                    >
                      Cancel my place
                    </button>
                  )}
                </>
              ) : problem ? (
                <p role="status">{problem}</p>
              ) : account && enabled && canAttend ? (
                <button
                  className="button"
                  type="button"
                  disabled={preview}
                  onClick={() =>
                    execute({
                      type: 'registration',
                      sessionId: session.id,
                      operation: 'register',
                      now: new Date().toISOString(),
                    })
                  }
                >
                  Reserve a demo place
                </button>
              ) : (
                <AccountLink
                  className="button"
                  to={account ? roleAccessPath : undefined}
                  search={`?${new URLSearchParams({ redirect: sessionPath(session.id) })}`}
                >
                  {account ? 'Request event access' : 'Sign in to reserve a place'}
                </AccountLink>
              )}
              {account && !adminView && (
                <Link
                  className="profile-sidebar-link"
                  to={
                    canAttend
                      ? `${dashboardCataloguePaths.events}?view=mine`
                      : `${memberPath(account.id)}?tab=events`
                  }
                >
                  {canAttend ? 'My events →' : 'My sessions & registrations →'}
                </Link>
              )}
            </section>
            {(group || forum) && (
              <section className="profile-panel">
                <h2>Keep the conversation going</h2>
                {group && (
                  <Link className="profile-sidebar-link" to={`/network/groups/${group.id}`}>
                    {group.name}
                    <small>Explore the group</small>
                  </Link>
                )}
                {forum && (
                  <Link className="profile-sidebar-link" to={`/forums?forum=${forum.id}`}>
                    {forum.name}
                    <small>Ask a question or share what you learned</small>
                  </Link>
                )}
              </section>
            )}
          </aside>
        </div>
      </section>
    </>
  );
}
