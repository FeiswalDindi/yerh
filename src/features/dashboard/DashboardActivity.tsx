import { Link } from 'react-router-dom';
import { useCatalog } from '../../app/useCatalog';
import { useDemo } from '../../app/useDemo';
import { sessionPath } from '../../domain/community';
import { PageIntro } from '../../shared/PageIntro';
import { usePageTitle } from '../../shared/usePageTitle';

export function DashboardActivity({ kind }: { kind: 'learning' | 'events' }) {
  const { state, account } = useDemo();
  const { courses } = useCatalog();
  const learning = kind === 'learning';
  const title = learning ? 'My learning' : 'My events';
  usePageTitle(title);
  if (!account) return null;
  const enrolled = courses.filter((course) =>
    state.platform.enrollments[account.id]?.includes(course.id),
  );
  const certificates = state.platform.certificates.filter(
    (certificate) => certificate.accountId === account.id,
  );
  const done = state.progress[account.id] ?? [];
  const registrations = state.registrations.filter(
    (registration) => registration.memberId === account.id,
  );

  return (
    <>
      <PageIntro
        eyebrow="Dashboard"
        title={title}
        description={
          learning
            ? 'Track course progress and completion records.'
            : 'Review the sessions you registered for.'
        }
      />
      <section className="container section">
        <Link className="button" to={learning ? '/learn' : '/events'}>
          {learning ? 'Browse courses' : 'Browse events'}
        </Link>
        {learning ? (
          <>
            {!enrolled.length && <p className="empty-state">You have no course enrollments yet.</p>}
            {enrolled.map((course) => {
              const complete = course.lessonIds.filter((id) => done.includes(id)).length;
              return (
                <article className="workspace-record" key={course.id}>
                  <h2>
                    <Link to={`/dashboard/learning/${encodeURIComponent(course.id)}`}>
                      {course.title}
                    </Link>
                  </h2>
                  <p>
                    {complete} of {course.lessonIds.length} lessons complete
                  </p>
                  <progress
                    aria-label={`Progress in ${course.title}`}
                    value={complete}
                    max={course.lessonIds.length}
                  />
                </article>
              );
            })}
            {!!certificates.length && (
              <section className="profile-panel">
                <h2>Completion records</h2>
                {certificates.map((record) => (
                  <Link
                    className="profile-sidebar-link"
                    key={record.id}
                    to={`/certificates/${record.id}`}
                  >
                    {courses.find((course) => course.id === record.courseId)?.title ??
                      'View completion record'}
                  </Link>
                ))}
              </section>
            )}
          </>
        ) : (
          <>
            {!registrations.length && (
              <p className="empty-state">You have no event registrations yet.</p>
            )}
            {registrations.map((registration) => {
              const session = state.sessions.find((item) => item.id === registration.sessionId);
              if (!session) return null;
              return (
                <article className="workspace-record" key={session.id}>
                  <h2>
                    <Link to={sessionPath(session.id)}>{session.title}</Link>
                  </h2>
                  <p>{session.venue}</p>
                  <span className="status-pill">{registration.status}</span>
                </article>
              );
            })}
          </>
        )}
      </section>
    </>
  );
}
