import { Link, useParams } from 'react-router-dom';
import { ArrowRight, Check, Play } from 'lucide-react';
import { useCatalog } from '../../app/useCatalog';
import { useDemo } from '../../app/useDemo';
import { PageIntro } from '../../shared/PageIntro';
import { DemoNotice } from '../demo/DemoNotice';
import { NotFoundPage } from '../info/NotFoundPage';
import { usePageTitle } from '../../shared/usePageTitle';
import { can } from '../../domain/roles';
export function LearningPage() {
  const { courseId } = useParams();
  const { courses, lessons } = useCatalog();
  const { state, account, execute, enabled } = useDemo();
  const course = courses.find((c) => c.id === courseId);
  usePageTitle(course?.title ?? 'Learn');
  const done = account ? (state.progress[account.id] ?? []) : [];
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
            <Link className="text-link" to="/learn">
              ← All learning pathways
            </Link>
            {can(account, 'learn') && enabled ? (
              <div className="course-enrollment">
                <button
                  className="button"
                  onClick={() =>
                    execute({
                      type: 'enroll',
                      courseId: course.id,
                      operation: (state.platform.enrollments[account!.id] ?? []).includes(course.id)
                        ? 'withdraw'
                        : 'enroll',
                      now: new Date().toISOString(),
                    })
                  }
                >
                  {(state.platform.enrollments[account!.id] ?? []).includes(course.id)
                    ? 'Withdraw enrollment'
                    : 'Enroll in this course'}
                </button>
                <p>Enrollment and completion are saved to your own account in this preview.</p>
              </div>
            ) : (
              <p>
                <Link className="button" to={account ? '/apply' : '/login'}>
                  {account ? 'Apply for learner access' : 'Sign in to enroll'}
                </Link>
              </p>
            )}
            <div className="learning-progress">
              <span>
                {course.lessonIds.filter((id) => done.includes(id)).length} of{' '}
                {course.lessonIds.length} lessons marked complete
              </span>
              <progress
                value={course.lessonIds.filter((id) => done.includes(id)).length}
                max={course.lessonIds.length}
              />
            </div>
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
                    {account &&
                    enabled &&
                    can(account, 'learn') &&
                    (state.platform.enrollments[account.id] ?? []).includes(course.id) ? (
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
              <Link className="collection-card" key={c.id} to={`/learn/${c.id}`}>
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
