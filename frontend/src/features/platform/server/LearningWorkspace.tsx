import { useCallback, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Clock,
  Compass,
  Layers,
  Search,
  TrendingUp,
  X,
} from 'lucide-react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { laravelWorkspace } from '../../../services/laravel-workspace-repository';
import { laravelProgramme } from '../../../services/laravel-programme-repository';
import { MpesaInstructionsBox } from './ProgrammeFinance';
import { ReceiptPreviewModal } from './ReceiptPreviewModal';
import { WorkspaceDialog, WorkspaceTable } from '../workspace/WorkspaceControls';
import { useLaravelSession } from '../../../app/useLaravelSession';
import {
  learningRepository,
  type CourseOffer,
} from '../../../services/laravel-learning-repository';
import { PageIntro } from '../../../shared/PageIntro';
import { StatusIndicator } from '../../../shared/StatusIndicator';
import { youtubeEmbedUrl } from '../../../domain/media';
import { AccountLink } from '../../accounts/AccountLink';
import {
  fieldValue,
  RecordsFeedback,
  useWorkspaceRecords,
  WorkspaceAction,
} from './WorkspaceActions';

export const shillings = (value: number | string) => 'KES ' + Number(value).toLocaleString('en-KE');
const charge = (course: CourseOffer) => course.price - course.discount;
const courseIcons = [BookOpen, TrendingUp, Compass, Layers] as const;
type CourseTabFilter = 'all' | 'enrolled' | 'free' | 'paid';

function FounderPathwayCard() {
  const paths = useWorkspaceRecords(laravelProgramme.paths);
  const ventures = useWorkspaceRecords(laravelWorkspace.ventures);
  const active = paths.records?.find((p) => !p.graduated_at) ?? paths.records?.[0];
  const completedStages = active?.graded_stages ?? 0;

  return (
    <div className="learning-pathway-footer">
      <RecordsFeedback
        error={paths.error || ventures.error}
        loading={!paths.records || !ventures.records}
      />
      {active && (
        <div className="learning-pathway-progress">
          <span className="learning-pathway-venture">
            <strong>{active.venture}</strong> · {completedStages} of 3 stages completed
          </span>
          <div className="learning-stage-track" aria-hidden="true">
            {[1, 2, 3].map((stage) => (
              <span
                key={stage}
                className="learning-stage-segment"
                data-done={stage <= completedStages ? 'true' : 'false'}
              />
            ))}
          </div>
        </div>
      )}
      <div className="learning-pathway-actions">
        {active && (
          <Link className="button" to={'/dashboard/workspace?tab=incubation&path=' + active.id}>
            Continue pathway
          </Link>
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
      </div>
    </div>
  );
}

function CourseCatalogue() {
  const { pathname } = useLocation();
  const dashboard = pathname.startsWith('/dashboard/');
  const session = useLaravelSession();
  const { records, error } = useWorkspaceRecords(learningRepository.catalogue);
  const founder = session?.profile?.role === 'entrepreneur';
  const canTrackEnrolment = Boolean(
    session?.profile?.email_verified &&
    ['guest', 'entrepreneur'].includes(session?.profile?.role ?? ''),
  );
  const [tab, setTab] = useState<CourseTabFilter>('all');
  const [level, setLevel] = useState('');
  const [query, setQuery] = useState('');

  const courseLink = (slug: string) =>
    (dashboard ? '/dashboard/learning/' : '/learn/') + encodeURIComponent(slug);

  const allCourses = records ?? [];
  const levels = Array.from(new Set(allCourses.map((course) => course.level).filter(Boolean)));
  const myCoursesCount = allCourses.filter(
    (c) => c.enrolment_status === 'confirmed' || c.enrolment_status === 'pending',
  ).length;
  const freeCount = allCourses.filter((c) => charge(c) <= 0).length;
  const paidCount = allCourses.filter((c) => charge(c) > 0).length;

  const term = query.trim().toLocaleLowerCase();
  const filtered = allCourses.filter((course) => {
    if (
      tab === 'enrolled' &&
      course.enrolment_status !== 'confirmed' &&
      course.enrolment_status !== 'pending'
    ) {
      return false;
    }
    if (tab === 'free' && charge(course) > 0) return false;
    if (tab === 'paid' && charge(course) <= 0) return false;
    if (level && course.level !== level) return false;
    if (term) {
      const hay = `${course.title} ${course.description} ${course.level}`.toLocaleLowerCase();
      if (!hay.includes(term)) return false;
    }
    return true;
  });

  const directoryContent = (
    <div className="learning-hub-stack" aria-label="Courses directory">
      <section className="learning-pathway-banner" aria-labelledby="incubation-catalogue-title">
        <div className="learning-pathway-info">
          <div className="learning-pathway-head">
            <span className="learning-pathway-icon" aria-hidden="true">
              <Compass size={18} />
            </span>
            <div>
              <p className="eyebrow">Venture development</p>
              <h2 id="incubation-catalogue-title">Incubation pathway</h2>
            </div>
          </div>
          <p className="learning-pathway-copy">
            Develop a venture through three structured stages with mentor guidance and assessment.
          </p>
        </div>
        {founder ? (
          <FounderPathwayCard />
        ) : (
          <div className="learning-pathway-actions">
            <Link className="button" to="/account">
              Apply for incubation
            </Link>
          </div>
        )}
      </section>

      {records && (
        <div className="learning-filter-bar" role="region" aria-label="Filter courses">
          <div className="learning-filter-tabs" role="group" aria-label="Course view">
            <button
              type="button"
              className="learning-filter-tab"
              aria-pressed={tab === 'all'}
              onClick={() => setTab('all')}
            >
              All <span>{allCourses.length}</span>
            </button>
            {canTrackEnrolment && (
              <button
                type="button"
                className="learning-filter-tab"
                aria-pressed={tab === 'enrolled'}
                onClick={() => setTab('enrolled')}
              >
                My courses <span>{myCoursesCount}</span>
              </button>
            )}
            <button
              type="button"
              className="learning-filter-tab"
              aria-pressed={tab === 'free'}
              onClick={() => setTab('free')}
            >
              Free <span>{freeCount}</span>
            </button>
            <button
              type="button"
              className="learning-filter-tab"
              aria-pressed={tab === 'paid'}
              onClick={() => setTab('paid')}
            >
              Paid <span>{paidCount}</span>
            </button>
          </div>

          <div className="learning-filter-controls">
            {levels.length > 1 && (
              <select
                aria-label="Filter by level"
                value={level}
                onChange={(event) => setLevel(event.target.value)}
              >
                <option value="">All levels</option>
                {levels.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            )}
            <div className="learning-search-box">
              <Search size={15} aria-hidden="true" />
              <input
                type="search"
                aria-label="Search courses"
                placeholder="Search courses…"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              {query && (
                <button
                  type="button"
                  className="learning-search-clear"
                  aria-label="Clear course search"
                  onClick={() => setQuery('')}
                >
                  <X size={14} aria-hidden="true" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {(records === null || Boolean(error)) && (
        <RecordsFeedback loading={records === null} error={error} />
      )}

      {records && filtered.length === 0 && (
        <div className="empty-state learning-empty-filtered">
          <p>
            {allCourses.length === 0
              ? 'No courses have been published yet.'
              : 'No courses match your current filter.'}
          </p>
          {allCourses.length > 0 && (
            <button
              type="button"
              className="button button-outline"
              onClick={() => {
                setTab('all');
                setLevel('');
                setQuery('');
              }}
            >
              Reset filters
            </button>
          )}
        </div>
      )}

      {records && filtered.length > 0 && (
        <div className="learning-courses-grid">
          {filtered.map((course, index) => {
            const Icon = courseIcons[index % courseIcons.length] ?? BookOpen;
            const isConfirmed = course.enrolment_status === 'confirmed';
            const isPending = course.enrolment_status === 'pending';
            const progress = course.enrolment_progress ?? 0;

            return (
              <Link className="learning-course-card" key={course.slug} to={courseLink(course.slug)}>
                <div className="learning-course-banner" data-tone={index % 4} aria-hidden="true">
                  {course.cover_image ? (
                    <img src={course.cover_image} alt="" />
                  ) : (
                    <span className="learning-course-glyph" aria-hidden="true">
                      <Icon size={20} />
                    </span>
                  )}
                </div>
                <div className="learning-course-body">
                  <span className="learning-course-level">{course.level}</span>
                  <h3>{course.title}</h3>
                  <p>{course.description}</p>
                  {isConfirmed && (
                    <div className="learning-card-progress">
                      <div>
                        <span>{course.enrolment_completed ? 'Completed' : 'In progress'}</span>
                        <strong>{progress}%</strong>
                      </div>
                      <progress max={100} value={progress} />
                    </div>
                  )}
                  {isPending && (
                    <p className="learning-card-pending">Payment awaiting admin approval</p>
                  )}
                </div>
                <div className="learning-course-footer">
                  <span className="learning-course-price">
                    <strong>{charge(course) > 0 ? shillings(charge(course)) : 'Free'}</strong>
                    {course.discount > 0 && <del>{shillings(course.price)}</del>}
                  </span>
                  <span className="learning-course-open">
                    {isConfirmed ? 'Continue' : isPending ? 'Check status' : 'View & enrol'}
                    <ArrowRight size={14} aria-hidden="true" />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );

  if (dashboard) {
    return directoryContent;
  }

  return (
    <>
      <PageIntro
        eyebrow="Learn"
        title="Courses"
        description="Choose an incubation pathway or a standalone course."
      />
      <section className="container section">{directoryContent}</section>
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

  const isConfirmed = records?.enrolment?.payment_status === 'confirmed';
  const visibleLessons = records
    ? records.course.moodle_course_id
      ? []
      : records.lessons.filter((lesson) => !(lesson.url && youtubeEmbedUrl(lesson.url)))
    : [];
  const localProgress =
    records && visibleLessons.length > 0
      ? Math.round(
          (visibleLessons.filter((lesson) => records.completed.includes(lesson.id)).length /
            visibleLessons.length) *
            100,
        )
      : 0;
  const displayProgress = records?.course.moodle_course_id
    ? (records.enrolment?.moodle_progress ?? (records.enrolment?.completed_at ? 100 : 0))
    : records?.enrolment?.completed_at
      ? 100
      : localProgress;
  const sections = records?.overview?.sections ?? [];
  const priceDue = records ? charge(records.course) : 0;

  return (
    <>
      {!dashboard && !records && (
        <PageIntro eyebrow="Courses" title="Course overview" description="" />
      )}
      <section className={dashboard ? '' : 'container section'}>
        <nav aria-label="Course navigation" className="workspace-row-actions">
          {!dashboard && <Link to="/">Home</Link>}
          <Link className="learning-back-link" to={dashboard ? '/dashboard/learning' : '/learn'}>
            <ArrowLeft size={15} aria-hidden="true" />
            Back to courses
          </Link>
        </nav>
        <RecordsFeedback loading={records === null} error={error} />
        {records && (
          <>
            <div className="course-overview-layout">
              <div className="course-overview-main">
                <p className="eyebrow">{records.course.level}</p>
                <h1>{records.course.title}</h1>
                <p className="course-overview-lead">{records.course.description}</p>
                <div className="course-facts-grid" aria-label="Course summary">
                  <div>
                    <span>Estimated time</span>
                    <strong>{records.overview?.estimated_duration ?? 'Self-paced'}</strong>
                  </div>
                  <div>
                    <span>Curriculum</span>
                    <strong>
                      {records.overview?.module_count ?? 0}{' '}
                      {(records.overview?.module_count ?? 0) === 1 ? 'module' : 'modules'}
                      {records.overview?.activity_count
                        ? ` · ${records.overview.activity_count} activities`
                        : ''}
                    </strong>
                  </div>
                  <div>
                    <span>Format</span>
                    <strong>{records.overview?.format ?? 'Self-paced online'}</strong>
                  </div>
                  <div>
                    <span>Course fee</span>
                    <strong>
                      {priceDue > 0 ? shillings(priceDue) : 'Free'}
                      {records.course.discount > 0 && (
                        <>
                          {' '}
                          <del>{shillings(records.course.price)}</del>
                        </>
                      )}
                    </strong>
                  </div>
                </div>
              </div>

              <aside className="course-overview-sidebar" aria-label="Enrolment and progress">
                {isConfirmed && (
                  <>
                    <div className="course-progress-row">
                      <span className="eyebrow">Your progress</span>
                      <strong>{displayProgress}%</strong>
                    </div>
                    <progress className="course-progress-bar" max={100} value={displayProgress} />
                    {records.enrolment?.completed_at ? (
                      <div role="status" className="mpesa-refund-notice">
                        <strong>
                          <CheckCircle2 size={15} aria-hidden="true" /> Course completed
                        </strong>
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
                    ) : (
                      <p className="source-note">
                        {records.course.moodle_course_id
                          ? 'Progress syncs automatically as you finish lessons, quizzes, and assignments.'
                          : 'Complete each lesson below to unlock your course certificate.'}
                      </p>
                    )}
                    {records.course.moodle_course_id && records.enrolment?.moodle_launch_url && (
                      <a
                        className="button"
                        href={learningRepository.toMoodleHandoffUrl(
                          records.enrolment.moodle_launch_url,
                        )}
                      >
                        Open course in Moodle
                      </a>
                    )}
                  </>
                )}

                {records.enrolment?.payment_status === 'pending' && (
                  <>
                    <p className="eyebrow">Verification pending</p>
                    <p role="status">
                      Your M-Pesa payment reference{' '}
                      {records.enrolment.payment_reference ? (
                        <strong>{records.enrolment.payment_reference}</strong>
                      ) : (
                        'submission'
                      )}{' '}
                      is awaiting administrator approval.
                    </p>
                    {records.enrolment.has_receipt && records.enrolment.id && (
                      <ReceiptPreviewModal
                        url={learningRepository.receiptUrl(records.enrolment.id)}
                        label="Preview submitted receipt"
                        title={records.course.title}
                        reference={records.enrolment.payment_reference}
                      />
                    )}
                    {records.payment_instructions?.refund_notice && (
                      <div className="mpesa-refund-notice" role="note">
                        <strong>24-Hour Approval &amp; Refund Guarantee</strong>
                        <p>{records.payment_instructions.refund_notice}</p>
                      </div>
                    )}
                  </>
                )}

                {(!records.enrolment || records.enrolment.payment_status === 'rejected') && (
                  <>
                    <p className="eyebrow">Enrolment</p>
                    <p>
                      Fee: <strong>{priceDue > 0 ? shillings(priceDue) : 'Free'}</strong>
                    </p>
                    {records.enrolment?.payment_note && (
                      <p className="account-error" role="alert">
                        Previous payment note: {records.enrolment.payment_note}
                      </p>
                    )}
                    {!session?.loading && !accountId && (
                      <AccountLink className="button">Sign in to enrol</AccountLink>
                    )}
                    {profile && !profile.email_verified && (
                      <Link className="button" to="/account">
                        Verify your email to enrol
                      </Link>
                    )}
                    {canLearn && (
                      <WorkspaceAction
                        action={priceDue > 0 ? 'Enrol & pay via M-Pesa' : 'Enrol now'}
                        create
                        title={records.course.title}
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
                        {priceDue > 0 ? (
                          <>
                            <MpesaInstructionsBox
                              amount={priceDue}
                              instructions={records.payment_instructions}
                            />
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
                              Payment receipt screenshot or PDF (required · JPG, PNG, WebP or PDF,
                              max 5 MB)
                              <input
                                name="receipt"
                                type="file"
                                required
                                accept="image/jpeg,image/png,image/webp,application/pdf"
                              />
                            </label>
                          </>
                        ) : (
                          <p>Enrol for free and start learning immediately.</p>
                        )}
                      </WorkspaceAction>
                    )}
                  </>
                )}
              </aside>
            </div>

            {sections.length > 0 && (
              <section className="course-syllabus" aria-label="Course outline">
                <h2>
                  <Clock size={18} aria-hidden="true" /> What you will cover
                </h2>
                <div className="course-syllabus-list">
                  {sections.map((section, idx) => (
                    <article className="course-syllabus-item" key={idx}>
                      <div className="course-syllabus-head">
                        <h3>{section.title}</h3>
                        <span className="learning-courses-count">
                          {section.activities.length}{' '}
                          {section.activities.length === 1 ? 'activity' : 'activities'}
                        </span>
                      </div>
                      {section.summary && <p>{section.summary}</p>}
                      {section.activities.length > 0 && (
                        <ul className="course-syllabus-activities">
                          {section.activities.map((activity, actIdx) => (
                            <li key={actIdx}>
                              {activity.name} · {activity.type}
                            </li>
                          ))}
                        </ul>
                      )}
                    </article>
                  ))}
                </div>
              </section>
            )}

            {visibleLessons.length > 0 && (
              <>
                <h2>Lessons</h2>
                {dashboard ? (
                  <WorkspaceTable
                    label="lessons"
                    columns={['Lesson', 'Materials', 'Progress']}
                    rows={visibleLessons.map((lesson) => ({
                      id: String(lesson.id),
                      search: lesson.title,
                      cells: [
                        lesson.title,
                        isConfirmed ? (
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
                        ) : isConfirmed ? (
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
                    {visibleLessons.map((lesson, index) => (
                      <article key={lesson.id}>
                        <span className="lesson-number">{String(index + 1).padStart(2, '0')}</span>
                        <div>
                          <h3>{lesson.title}</h3>
                          {isConfirmed ? (
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
                          isConfirmed && (
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
                  </div>
                )}
              </>
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
