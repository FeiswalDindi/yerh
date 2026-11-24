import { useCallback } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { laravelWorkspace } from '../../../services/laravel-workspace-repository';
import { laravelProgramme } from '../../../services/laravel-programme-repository';
import { MpesaInstructionsBox } from './ProgrammeFinance';
import { WorkspaceDialog, WorkspaceTable } from '../workspace/WorkspaceControls';
import { useLaravelSession } from '../../../app/useLaravelSession';
import {
  learningRepository,
  type CourseOffer,
} from '../../../services/laravel-learning-repository';
import { PageIntro } from '../../../shared/PageIntro';
import { StatusIndicator } from '../../../shared/StatusIndicator';
import { AccountLink } from '../../accounts/AccountLink';
import {
  fieldValue,
  RecordsFeedback,
  useWorkspaceRecords,
  WorkspaceAction,
} from './WorkspaceActions';

export const shillings = (value: number | string) => 'KES ' + Number(value).toLocaleString('en-KE');
const charge = (course: CourseOffer) => course.price - course.discount;

function FounderPathwayCard() {
  const paths = useWorkspaceRecords(laravelProgramme.paths);
  const ventures = useWorkspaceRecords(laravelWorkspace.ventures);
  const active = paths.records?.find((p) => !p.graduated_at) ?? paths.records?.[0];
  return (
    <>
      <RecordsFeedback
        error={paths.error || ventures.error}
        loading={!paths.records || !ventures.records}
      />
      {active && (
        <p>
          {active.venture} / {active.graded_stages ?? 0} of 3 stages completed
        </p>
      )}
      <WorkspaceDialog action="Choose a venture" title="Choose a venture">
        {() => (
          <>
            <ul>
              {ventures.records?.map((v) => {
                const path = paths.records?.find((p) => p.venture_id === v.id);
                return (
                  <li key={v.id}>
                    {path || v.status === 'approved' ? (
                      <Link
                        to={
                          '/dashboard/workspace?tab=incubation' +
                          (path ? '&path=' + path.id : '&launch=' + v.id)
                        }
                      >
                        {v.name}
                      </Link>
                    ) : (
                      <>
                        {v.name} / {v.status}
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
            <Link to="/dashboard/workspace?tab=ventures">Create a venture</Link>
          </>
        )}
      </WorkspaceDialog>
    </>
  );
}

function CourseCatalogue() {
  const navigate = useNavigate();
  const session = useLaravelSession();
  const { records, error } = useWorkspaceRecords(learningRepository.catalogue);
  const founder = session?.profile?.role === 'entrepreneur';
  return (
    <>
      <PageIntro
        eyebrow="Learn"
        title="Courses"
        description="Choose an incubation pathway or a standalone course."
      />
      <section className="container section">
        {founder && <Link to="/dashboard">Home</Link>}
        <div className="course-directory">
          <section className="profile-panel" aria-labelledby="incubation-catalogue-title">
            <p className="eyebrow">Venture development</p>
            <h2 id="incubation-catalogue-title">Incubation pathway</h2>
            <p>Develop a venture through three stages, with assessment and mentor feedback.</p>
            {founder ? (
              <FounderPathwayCard />
            ) : (
              <Link className="button" to="/account">
                Apply for incubation
              </Link>
            )}
          </section>
          <section aria-labelledby="general-courses-heading">
            <h2 id="general-courses-heading">General courses</h2>
            <RecordsFeedback loading={records === null} error={error} />
            {records &&
              (records.length ? (
                <div className="collection-grid">
                  {records.map((course) => (
                    <article className="collection-card" key={course.slug}>
                      <p className="eyebrow">{course.level}</p>
                      <h3>{course.title}</h3>
                      <p>{course.description}</p>
                      <p>
                        <strong>{charge(course) > 0 ? shillings(charge(course)) : 'Free'}</strong>
                        {course.discount > 0 && (
                          <>
                            {' '}
                            <del>{shillings(course.price)}</del>
                          </>
                        )}
                      </p>
                      <WorkspaceAction
                        action="Open course"
                        title={course.title}
                        submit="Continue"
                        save={async () => {
                          void navigate('/learn/' + encodeURIComponent(course.slug));
                        }}
                      >
                        <p>Open the course workspace for {course.title}?</p>
                      </WorkspaceAction>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="empty-state">No courses have been published yet.</p>
              ))}
          </section>
        </div>
      </section>
    </>
  );
}

function CoursePage({ slug }: { slug: string }) {
  const { pathname } = useLocation();
  const dashboard = pathname.startsWith('/dashboard/');
  const session = useLaravelSession();
  const profile = session?.profile;
  const canLearn = profile?.email_verified && ['guest', 'entrepreneur'].includes(profile.role);
  const load = useCallback((signal: AbortSignal) => learningRepository.show(slug, signal), [slug]);
  const { records, error, reload } = useWorkspaceRecords(load);
  const accountId = profile?.id;
  return (
    <>
      <PageIntro
        eyebrow="Courses"
        title={records?.course.title ?? 'Course workspace'}
        description={records?.course.description ?? ''}
      />
      <section className="container section">
        <nav aria-label="Course navigation" className="workspace-row-actions">
          <Link to={profile?.role === 'entrepreneur' ? '/dashboard' : '/'}>Home</Link>
          <Link to="/learn">All courses</Link>
        </nav>
        <RecordsFeedback loading={records === null} error={error} />
        {records && (
          <>
            {!session?.loading && !accountId && (
              <AccountLink className="button">Sign in to enrol</AccountLink>
            )}
            {profile && !profile.email_verified && (
              <Link to="/account">Verify your email to enrol</Link>
            )}
            {canLearn &&
              (!records.enrolment || records.enrolment.payment_status === 'rejected') && (
                <WorkspaceAction
                  action={charge(records.course) ? 'Submit payment reference' : 'Enrol'}
                  submit="Confirm enrolment"
                  save={async (form) => {
                    const receipt = form.get('receipt');
                    await learningRepository.enrol(
                      slug,
                      fieldValue(form, 'reference') || undefined,
                      receipt instanceof File && receipt.size > 0 ? receipt : null,
                    );
                    reload();
                  }}
                >
                  {records.enrolment?.payment_note && <p>{records.enrolment.payment_note}</p>}
                  {charge(records.course) > 0 ? (
                    <>
                      <MpesaInstructionsBox amount={charge(records.course)} />
                      <label>
                        M-Pesa confirmation code / transaction reference
                        <input
                          name="reference"
                          required
                          maxLength={120}
                          placeholder="e.g. SLK89XYZ12"
                        />
                      </label>
                      <label>
                        Payment receipt (optional · JPG, PNG, WebP or PDF, max 5 MB)
                        <input
                          name="receipt"
                          type="file"
                          accept="image/jpeg,image/png,image/webp,application/pdf"
                        />
                      </label>
                    </>
                  ) : (
                    <p>Enrol for free and start the lessons.</p>
                  )}
                </WorkspaceAction>
              )}
            {records.enrolment?.payment_status === 'pending' && (
              <p role="status">Your payment reference is awaiting confirmation.</p>
            )}
            {records.enrolment?.completed_at && (
              <div role="status" className="notice">
                <h2>Course completed</h2>
                {records.enrolment.certificate_id ? (
                  <a
                    href={learningRepository.certificate(records.enrolment.certificate_id)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    View certificate
                  </a>
                ) : (
                  <p>Your certificate is ready for an administrator to issue.</p>
                )}
              </div>
            )}
            <h2>Lessons</h2>
            {dashboard ? (
              <WorkspaceTable
                label="lessons"
                columns={['Lesson', 'Materials', 'Progress']}
                rows={records.lessons.map((lesson) => ({
                  id: String(lesson.id),
                  search: lesson.title,
                  cells: [
                    lesson.title,
                    records.enrolment?.payment_status === 'confirmed' ? (
                      <>
                        {lesson.content && <p>{lesson.content}</p>}
                        {lesson.url && (
                          <a href={lesson.url} target="_blank" rel="noreferrer">
                            Open resource
                          </a>
                        )}
                      </>
                    ) : (
                      'Available after enrolment'
                    ),
                    records.completed.includes(lesson.id) ? (
                      'Completed'
                    ) : records.enrolment?.payment_status === 'confirmed' ? (
                      <WorkspaceAction
                        action="Mark complete"
                        title={lesson.title}
                        submit="Mark complete"
                        save={async () => {
                          await learningRepository.complete(slug, lesson.id);
                          reload();
                        }}
                      >
                        <p>Record this lesson as completed.</p>
                      </WorkspaceAction>
                    ) : (
                      '-'
                    ),
                  ],
                }))}
              />
            ) : (
              <div className="learning-lessons">
                {records.lessons.map((lesson, index) => (
                  <article key={lesson.id}>
                    <span className="lesson-number">{String(index + 1).padStart(2, '0')}</span>
                    <div>
                      <h3>{lesson.title}</h3>
                      {records.enrolment?.payment_status === 'confirmed' ? (
                        <>
                          {lesson.content && (
                            <p className="workspace-detail-copy">{lesson.content}</p>
                          )}
                          {lesson.url && (
                            <a
                              className="text-link"
                              href={lesson.url}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Open resource
                            </a>
                          )}
                        </>
                      ) : (
                        <p className="source-note">Available after enrolment</p>
                      )}
                    </div>
                    {records.completed.includes(lesson.id) ? (
                      <StatusIndicator status="completed" />
                    ) : (
                      records.enrolment?.payment_status === 'confirmed' && (
                        <WorkspaceAction
                          action="Mark complete"
                          title={lesson.title}
                          submit="Mark complete"
                          save={async () => {
                            await learningRepository.complete(slug, lesson.id);
                            reload();
                          }}
                        >
                          <p>Record this lesson as completed.</p>
                        </WorkspaceAction>
                      )
                    )}
                  </article>
                ))}
                {!records.lessons.length && (
                  <p className="empty-state">No lessons have been published for this course.</p>
                )}
              </div>
            )}
          </>
        )}
      </section>
    </>
  );
}

export function LearningWorkspace() {
  const { courseId } = useParams();
  const session = useLaravelSession();
  return courseId ? (
    <CoursePage
      key={
        courseId +
        ':' +
        (session?.profile?.id ?? 'anonymous') +
        ':' +
        !!session?.profile?.email_verified
      }
      slug={courseId}
    />
  ) : (
    <CourseCatalogue />
  );
}
