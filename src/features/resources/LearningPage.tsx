import { Link, useLocation, useParams } from 'react-router-dom';
import { AccountLink } from '../accounts/AccountLink';
import { roleAccessPath } from '../accounts/role-requests';
import { dashboardCatalogueItemPath, dashboardCataloguePaths } from '../dashboard/catalogue-paths';
import { ArrowRight, Check, Play } from 'lucide-react';
import { useCatalog } from '../../app/useCatalog';
import { useDemo } from '../../app/useDemo';
import { PageIntro } from '../../shared/PageIntro';
import { DemoNotice } from '../demo/DemoNotice';
import { NotFoundPage } from '../info/NotFoundPage';
import { usePageTitle } from '../../shared/usePageTitle';
import { can } from '../../domain/roles';
export function LearningPage({ dashboard = false }: { dashboard?: boolean }) {
  const { courseId } = useParams();
  const { search } = useLocation();
  const { courses, lessons } = useCatalog();
  const { state, account, execute, enabled } = useDemo();
  const course = courses.find((c) => c.id === courseId);
  usePageTitle(course?.title ?? 'Learn');
  const done = account ? (state.progress[account.id] ?? []) : [];
  const enrolled = !!(
    course &&
    account &&
    state.platform.enrollments[account.id]?.includes(course.id)
  );
  const completed = course?.lessonIds.filter((id) => done.includes(id)).length ?? 0;
  const finished = !!course?.lessonIds.length && completed === course.lessonIds.length;
  const certificate =
    course &&
    account &&
    state.platform.certificates.find(
      (record) => record.accountId === account.id && record.courseId === course.id,
    );
  if (courseId && !course) return <NotFoundPage />;
  return (
    <>
      <PageIntro
        eyebrow="Learn"
        title={course?.title ?? 'Learn at your own pace.'}
        description={
          course?.description ??
          'Explore structured pathways built from the original YERH videos, with local demo progress tracking.'
        }
      />
      <section className="container section">
        <DemoNotice />
        {course ? (
          <>
            <Link
              className="text-link"
              to={dashboard ? `${dashboardCataloguePaths.learning}${search}` : '/learn'}
            >
              {dashboard ? '← Back to courses' : '← All learning pathways'}
            </Link>
            {can(account, 'learn') && enabled ? (
              <div className="course-enrollment">
                <button
                  className="button"
                  onClick={() =>
                    execute({
                      type: 'enroll',
                      courseId: course.id,
                      operation: enrolled ? 'withdraw' : 'enroll',
                      now: new Date().toISOString(),
                    })
                  }
                >
                  {enrolled ? 'Withdraw enrollment' : 'Enroll in this course'}
                </button>
                <p role="status">
                  {enrolled
                    ? 'You’re enrolled. Your progress is saved as you mark lessons complete.'
                    : 'Enroll to track your progress and qualify for a course completion certificate.'}
                </p>
                {enrolled && !dashboard && (
                  <Link className="text-link" to="/dashboard/learning">
                    Go to My learning
                  </Link>
                )}
              </div>
            ) : (
              <p>
                <AccountLink
                  className="button"
                  to={account ? roleAccessPath : undefined}
                  search={`?${new URLSearchParams({ redirect: `/learn/${encodeURIComponent(course.id)}` })}`}
                >
                  {account ? 'Request learner access' : 'Sign in to enroll'}
                </AccountLink>
              </p>
            )}
            <div className="learning-progress">
              <span>
                {completed} of {course.lessonIds.length} lessons marked complete
              </span>
              <progress value={completed} max={course.lessonIds.length} />
            </div>
            {certificate ? (
              <p className="course-completion-notice" role="status">
                Certificate issued.{' '}
                <Link className="text-link" to={`/certificates/${certificate.id}`}>
                  View certificate
                </Link>
              </p>
            ) : (
              enrolled &&
              finished && (
                <p className="course-completion-notice" role="status">
                  Course complete. Your certificate will appear in My certificates after an
                  administrator issues it.
                </p>
              )
            )}
            <div className="learning-lessons">
              {course.lessonIds.map((id, i) => {
                const lesson = lessons.find((l) => l.id === id);
                return lesson ? (
                  <article key={id}>
                    <span className="lesson-number">{String(i + 1).padStart(2, '0')}</span>
                    <div>
                      <h2>{lesson.title}</h2>
                      <a className="text-link" href={lesson.href} target="_blank" rel="noreferrer">
                        <Play size={15} />
                        Watch original video
                      </a>
                    </div>
                    {account && enabled && can(account, 'learn') && enrolled ? (
                      <button
                        className={`button ${done.includes(id) ? 'button-gold' : ''}`}
                        aria-pressed={done.includes(id)}
                        onClick={() => execute({ type: 'progress', lessonId: id })}
                      >
                        {done.includes(id) ? (
                          <>
                            <Check size={15} />
                            Complete
                          </>
                        ) : (
                          'Mark complete'
                        )}
                      </button>
                    ) : (
                      <span className="source-note">Enroll to track progress</span>
                    )}
                  </article>
                ) : null;
              })}
            </div>
            <p className="source-note">
              Completion is self-reported in this browser. It is not an accredited certificate or
              proof of video attendance.
            </p>
          </>
        ) : (
          <div className="collection-grid">
            {courses.map((c) => (
              <Link
                className="collection-card"
                key={c.id}
                to={
                  dashboard
                    ? dashboardCatalogueItemPath('learning', c.id)
                    : `/learn/${encodeURIComponent(c.id)}`
                }
              >
                <p className="eyebrow">{c.level}</p>
                <h2>{c.title}</h2>
                <p>{c.description}</p>
                <small>
                  {c.lessonIds.length} video lessons
                  {account
                    ? ` · ${c.lessonIds.filter((id) => done.includes(id)).length} completed`
                    : ''}
                </small>
                <ArrowRight />
              </Link>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
