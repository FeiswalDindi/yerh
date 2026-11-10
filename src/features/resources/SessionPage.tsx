import { Link, useParams } from 'react-router-dom';
import { useDemo } from '../../app/useDemo';
import { useCatalog } from '../../app/useCatalog';
import { contentPath } from '../../domain/content';
import { registrationProblem } from '../../domain/community';
import { PageIntro } from '../../shared/PageIntro';
import { usePageTitle } from '../../shared/usePageTitle';
import { DemoNotice } from '../demo/DemoNotice';
import { NotFoundPage } from '../info/NotFoundPage';
import { MemberCard } from '../community/CommunityCards';
import { can } from '../../domain/roles';

export function SessionPage() {
  const { sessionId } = useParams();
  const { state, account, enabled, execute } = useDemo();
  const { items } = useCatalog();
  const session = state.sessions.find((s) => s.id === sessionId);
  usePageTitle(session?.title ?? 'Session not found');
  if (!session) return <NotFoundPage />;
  const resource = items.find((i) => i.id === session.contentId);
  const group = state.groups.find((g) => g.id === session.groupId);
  const forum = state.forums.find((f) => f.id === session.forumId);
  const registration = state.registrations.find(
    (r) => r.sessionId === session.id && r.memberId === account?.id,
  );
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
      <PageIntro
        eyebrow={`${session.type} · ${session.status}`}
        title={session.title}
        description={session.summary}
      />
      <section className="container section">
        <DemoNotice />
        <Link
          className="text-link"
          to={
            session.type === 'workshop'
              ? '/workshops'
              : session.type === 'webinar'
                ? '/webinars'
                : '/events'
          }
        >
          ← All {session.type}s
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
            {session.hostIds.length ? (
              <div className="profile-card-grid">
                {state.accounts
                  .filter((a) => session.hostIds.includes(a.id))
                  .map((a) => (
                    <MemberCard key={a.id} member={a} />
                  ))}
              </div>
            ) : (
              <p className="empty-state">
                Member identities for the original facilitators have not been verified.
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
              ) : account && enabled && can(account, 'attend') ? (
                <button
                  className="button"
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
                <Link className="button" to={account ? '/apply' : '/login'}>
                  {account ? 'Apply for event access' : 'Login to reserve a place'}
                </Link>
              )}
              {account && (
                <Link
                  className="profile-sidebar-link"
                  to={`/network/members/${account.id}?tab=events`}
                >
                  My sessions & registrations →
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
