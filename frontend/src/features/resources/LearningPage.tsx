import { useEffect, useRef } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { AccountLink } from '../accounts/AccountLink';
import { roleAccessPath } from '../accounts/role-requests';
import { dashboardCatalogueItemPath, dashboardCataloguePaths } from '../dashboard/catalogue-paths';
import { ArrowRight, Check, CircleCheck, Play } from 'lucide-react';
import { useCatalog } from '../../app/useCatalog';
import { useDemo } from '../../app/useDemo';
import { PageIntro } from '../../shared/PageIntro';
import { DemoNotice } from '../demo/DemoNotice';
import { NotFoundPage } from '../info/NotFoundPage';
import { usePageTitle } from '../../shared/usePageTitle';
import { can } from '../../domain/roles';
import {
  authoredCourseId,
  authoredLessonId,
  courseCharge,
  courseCompletionRecords,
  coursePricing,
  coursePurchased,
} from '../../domain/courses';
import { WorkspaceDialog } from '../platform/workspace/WorkspaceControls';
import { amount } from '../platform/incubation/TrainingForms';
import { CourseEntryLink } from './CourseEntryLink';
export function LearningPage({ dashboard = false }: { dashboard?: boolean }) {
  const { courseId } = useParams();
  const { search } = useLocation();
  const { courses, lessons } = useCatalog();
  const { state, account, execute, enabled, error } = useDemo();
  const course = courses.find((c) => c.id === courseId);
  usePageTitle(course?.title ?? 'Learn');
  const done = account ? (state.progress[account.id] ?? []) : [];
  const enrolled = !!(
    course &&
    account &&
    state.platform.enrollments[account.id]?.includes(course.id)
  );
  const paid = !!(course && account && coursePurchased(state.platform, course.id, account.id));
  const fee = course ? courseCharge(state.platform, course.id) : 0;
  const access = !!(enabled && can(account, 'learn') && enrolled);
  const proposal = state.platform.courseCommerce?.proposals.find(
    (row) => row.status === 'published' && authoredCourseId(row) === courseId,
  );
  const completed = course?.lessonIds.filter((id) => done.includes(id)).length ?? 0;
  const completion =
    course &&
    account &&
    courseCompletionRecords(state).find(
      (record) => record.accountId === account.id && record.courseId === course.id,
    );
  const certificate =
    course &&
    account &&
    state.platform.certificates.find(
      (record) => record.accountId === account.id && record.courseId === course.id,
    );
  const finished = !!(completion || certificate);
  const completionBanner = useRef<HTMLElement>(null);
  const justCompleted = useRef(false);
  useEffect(() => {
    if (finished && justCompleted.current) {
      justCompleted.current = false;
      completionBanner.current?.focus();
    }
  }, [finished]);
  if (courseId && !course) return <NotFoundPage />;
  return (
    <>
      <PageIntro
        eyebrow="Learn"
        title={course?.title ?? 'Courses'}
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
                {fee > 0 && !paid && !enrolled ? (
                  <WorkspaceDialog action={`Pay ${amount(fee)} and enroll`} title="Course payment">
                    {(finish) => (
                      <>
                        <p>
                          {course.title} · {amount(fee)}
                        </p>
                        <p>This is a simulated payment. Course materials unlock after payment.</p>
                        <button
                          type="button"
                          className="button"
                          onClick={() =>
                            finish(
                              execute({
                                type: 'course-purchase',
                                id: course.id,
                                expectedPrice: fee,
                                now: new Date().toISOString(),
                              }),
                            )
                          }
                        >
                          Confirm demo payment
                        </button>
                      </>
                    )}
                  </WorkspaceDialog>
                ) : (
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
                )}
                {!finished && (
                  <p role="status">
                    {enrolled
                      ? 'You’re enrolled. Your progress is saved as you mark lessons complete.'
                      : fee > 0 && !paid
                        ? 'Pay upfront to unlock all modules.'
                        : 'Enroll to track your progress and qualify for a course completion certificate.'}
                  </p>
                )}
                {enrolled && !dashboard && (
                  <Link
                    className="text-link"
                    to={account?.role === 'guest' ? '/learn' : '/dashboard/learning'}
                  >
                    Go to courses
                  </Link>
                )}
              </div>
            ) : !account || account.role === 'guest' || account.role === 'entrepreneur' ? (
              <p>
                <AccountLink
                  className="button"
                  to={account ? roleAccessPath : undefined}
                  search={`?${new URLSearchParams({ redirect: `/learn/${encodeURIComponent(course.id)}` })}`}
                >
                  {account ? 'Request learner access' : 'Sign in to enroll'}
                </AccountLink>
              </p>
            ) : (
              <p>Course enrollment is available to learner accounts.</p>
            )}
            <div className="learning-progress">
              <span>
                {completed} of {course.lessonIds.length} lessons marked complete
              </span>
              <progress value={completed} max={course.lessonIds.length} />
            </div>
            {error && (
              <p className="workspace-dialog-error" role="alert">
                {error}
              </p>
            )}
            {finished && (
              <section
                className="course-completion-notice"
                ref={completionBanner}
                tabIndex={-1}
                aria-labelledby="course-complete-title"
              >
                <CircleCheck size={26} aria-hidden="true" />
                <div>
                  <div role="status">
                    <h2 id="course-complete-title">Course completed</h2>
                    <p>
                      Congratulations, {account?.name.split(' ')[0]}! You completed {course.title}.
                    </p>
                    <p>
                      {certificate
                        ? 'Your certificate is ready.'
                        : 'Your completion is in the administrator’s certificate queue.'}
                    </p>
                  </div>
                  <Link
                    className="text-link"
                    to={
                      certificate
                        ? `/certificates/${certificate.id}`
                        : account?.role === 'guest'
                          ? '/account/certificates'
                          : '/dashboard/certificates'
                    }
                  >
                    {certificate ? 'View certificate' : 'Track your certificate'}
                  </Link>
                </div>
              </section>
            )}
            <div className="learning-lessons">
              {course.lessonIds.map((id, i) => {
                const lesson = lessons.find((l) => l.id === id);
                const module = proposal?.modules.find(
                  (module) => authoredLessonId(proposal, module) === id,
                );
                return lesson || module ? (
                  <article key={id}>
                    <span className="lesson-number">{String(i + 1).padStart(2, '0')}</span>
                    <div>
                      <h2>{lesson?.title ?? module?.title}</h2>
                      {(access ||
                        (fee === 0 && !proposal && (!account || can(account, 'learn')))) &&
                        lesson && (
                          <a
                            className="text-link"
                            href={lesson.href}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <Play size={15} />
                            Watch original video
                          </a>
                        )}
                      {access && module && <p className="workspace-detail-copy">{module.body}</p>}
                    </div>
                    {access ? (
                      <button
                        className={`button ${done.includes(id) ? 'button-gold' : ''}`}
                        aria-pressed={done.includes(id)}
                        onClick={() => {
                          const finalLesson =
                            !finished &&
                            !done.includes(id) &&
                            completed === course.lessonIds.length - 1;
                          if (
                            execute({
                              type: 'progress',
                              lessonId: id,
                              now: new Date().toISOString(),
                            }) &&
                            finalLesson
                          )
                            justCompleted.current = true;
                        }}
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
                      <span className="source-note">
                        {fee > 0 ? 'Module locked until enrollment' : 'Enroll to track progress'}
                      </span>
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
          <div className="course-directory">
            <section className="profile-panel" aria-labelledby="incubation-catalogue-title">
              <h2 id="incubation-catalogue-title">Incubation Pathway</h2>
              <p>
                Build a venture through three stages of practical learning with an affiliated
                university or hub.
              </p>
              <Link
                className="button"
                to={
                  account?.role === 'entrepreneur'
                    ? '/dashboard/workspace?tab=incubation'
                    : account?.role === 'guest'
                      ? '/account#incubation'
                      : '/apply'
                }
              >
                {account?.role === 'entrepreneur' ? 'Open pathway' : 'Apply for incubation'}
              </Link>
            </section>
            <section aria-labelledby="general-courses-title">
              <h2 id="general-courses-title">General Courses</h2>
              <div className="collection-grid">
                {courses.map((c) => (
                  <CourseEntryLink
                    className="collection-card"
                    key={c.id}
                    courseId={c.id}
                    courseName={c.title}
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
                      {c.lessonIds.length} lessons ·{' '}
                      {coursePricing(state.platform, c.id).price
                        ? amount(courseCharge(state.platform, c.id))
                        : 'Free'}
                      {account
                        ? ` · ${c.lessonIds.filter((id) => done.includes(id)).length} completed`
                        : ''}
                    </small>
                    <ArrowRight />
                  </CourseEntryLink>
                ))}
              </div>
            </section>
          </div>
        )}
      </section>
    </>
  );
}
