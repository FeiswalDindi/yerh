import { Link, useSearchParams } from 'react-router-dom';
import type { DemoState } from '../../domain/demo';
import type { Course } from '../../domain/hub';
import { courseCertificateQueue } from '../../domain/courses';
import {
  WorkspaceDialog,
  WorkspaceFormDialog,
  WorkspaceStatus,
  WorkspaceTable,
  WorkspaceTabs,
} from './WorkspaceControls';
import {
  certificateStages,
  incubationCertificateQueue,
  feeLabels,
  feePurposes,
  getStage,
  incubationLearners,
  institutionForPath,
  completedStage,
  schoolCertificateScore,
  schoolDivision,
  schoolForVenture,
  type CredentialKind,
} from '../../domain/incubation';
import type { Incubation, PlatformState } from '../../domain/platform';
import { CourseCertificates } from './CourseCertificates';
import {
  amount,
  credentialTitle,
  field,
  submitTraining,
  TrainingForm,
  type Save,
} from './TrainingForms';

export function MentorStages({
  p,
  path,
  save,
  editable,
}: {
  p: PlatformState;
  path: Incubation;
  save: Save;
  editable: boolean;
}) {
  return p.training.curriculum.map((stage) => {
    const work = getStage(p.training, path.id, stage.id);
    if (!work) return null;
    const key = { incubationId: path.id, stage: stage.id };
    const pending = work.attempts.filter((attempt) => attempt.score === null);
    const needsReview = work.reviewRequestedAt && !work.examOpenedAt;
    return (
      <details
        className="training-stage"
        key={stage.id}
        open={!!needsReview || pending.length > 0 || work.steps.some((step) => step.requested)}
      >
        <summary>{stage.title}</summary>
        {stage.steps.map((step) => {
          const entry = work.steps.find((row) => row.id === step.id);
          if (!entry) return null;
          return (
            <div key={step.id} className="training-step">
              <h4>{step.title}</h4>
              <p>{entry.evidence}</p>
              {entry.feedback && <p>Feedback sent · {entry.feedback}</p>}
              {entry.requested && editable && (
                <TrainingForm
                  save={save}
                  label="Send step feedback"
                  dialog={{ action: 'Give feedback', title: step.title }}
                  build={(data) => ({
                    ...key,
                    type: 'stage-feedback',
                    stepId: step.id,
                    feedback: field(data, 'note'),
                  })}
                >
                  <label>
                    Feedback <textarea name="note" required minLength={5} maxLength={3000} />
                  </label>
                </TrainingForm>
              )}
            </div>
          );
        })}
        {needsReview && editable && (
          <>
            <TrainingForm
              save={save}
              label="Save meeting"
              dialog={{ action: work.meetingAt ? 'Reschedule meeting' : 'Schedule meeting' }}
              build={(data) => ({
                ...key,
                type: 'stage-meeting',
                meetingAt: `${field(data, 'meeting')}:00+03:00`,
                location: field(data, 'location'),
              })}
            >
              <label>
                Review meeting time (EAT) <input name="meeting" type="datetime-local" required />
              </label>
              <label>
                Meeting link or location{' '}
                <input
                  name="location"
                  minLength={3}
                  maxLength={300}
                  defaultValue={work.meetingLocation}
                />
              </label>
            </TrainingForm>
            {work.meetingAt && (
              <>
                <p>
                  Meeting scheduled for{' '}
                  {new Date(work.meetingAt).toLocaleString('en-KE', { timeZone: 'Africa/Nairobi' })}{' '}
                  EAT.
                </p>
                <TrainingForm
                  save={save}
                  label="Save review decision"
                  dialog={{ action: 'Record review decision' }}
                  build={(data) => ({
                    ...key,
                    type: field(data, 'decision') === 'ready' ? 'stage-open-exam' : 'stage-revise',
                    note: field(data, 'note'),
                  })}
                >
                  <label>
                    Review decision{' '}
                    <select name="decision">
                      <option value="ready">Ready · open stage exam</option>
                      <option value="revise">Request revisions</option>
                    </select>
                  </label>
                  <label>
                    Meeting outcome <textarea name="note" required minLength={5} maxLength={3000} />
                  </label>
                </TrainingForm>
              </>
            )}
          </>
        )}
        {pending.map((attempt) => (
          <div className="training-step" key={attempt.id}>
            <h4>Exam answer</h4>
            <p>{attempt.answer}</p>
            {editable && (
              <TrainingForm
                save={save}
                label="Save exam grade"
                dialog={{ action: 'Grade exam' }}
                build={(data) => ({
                  ...key,
                  type: 'stage-grade',
                  attemptId: attempt.id,
                  score: Number(field(data, 'score')),
                  note: field(data, 'note'),
                })}
              >
                <label>
                  Exam score (%){' '}
                  <input name="score" type="number" min="0" max="100" step="1" required />
                </label>
                <label>
                  Exam feedback <textarea name="note" required minLength={5} maxLength={3000} />
                </label>
              </TrainingForm>
            )}
          </div>
        ))}
      </details>
    );
  });
}

export function ProductReviewQueue({
  p,
  save,
  mentorId,
}: {
  p: PlatformState;
  save: Save;
  mentorId?: string;
}) {
  const entries = p.training.productReviews.filter(
    (review) =>
      review.status === 'pending' &&
      p.incubations.some(
        (path) =>
          path.id === review.incubationId &&
          (!mentorId || path.mentorId === mentorId) &&
          p.ventures.some((venture) => venture.id === path.ventureId && !venture.groupId),
      ),
  );
  return (
    <WorkspaceTable
      label="product evidence"
      columns={['Product', 'Venture', 'Action']}
      empty="No product evidence is awaiting review."
      rows={entries.map((review) => {
        const product = p.products.find((product) => product.id === review.productId);
        const productName = product?.name ?? 'Product';
        const venture = p.ventures.find((venture) => venture.id === product?.ventureId);
        return {
          id: review.productId,
          search: [productName, venture?.name].join(' '),
          cells: [
            productName,
            venture?.name,
            <TrainingForm
              save={save}
              dialog={{ action: 'Review evidence', title: productName }}
              label="Save product evidence decision"
              build={(data) => ({
                type: 'product-evidence-review',
                productId: review.productId,
                decision: field(data, 'decision') === 'approved' ? 'approved' : 'rejected',
                feedback: field(data, 'feedback'),
              })}
            >
              <p className="workspace-detail-copy">{review.evidence}</p>
              <label>
                Decision{' '}
                <select name="decision">
                  <option value="approved">Approve product evidence</option>
                  <option value="rejected">Return for revisions</option>
                </select>
              </label>
              <label>
                Reviewer feedback{' '}
                <textarea name="feedback" required minLength={5} maxLength={3000} />
              </label>
            </TrainingForm>,
          ],
        };
      })}
    />
  );
}

export function TrainingPayments({
  p,
  save,
  name,
}: {
  p: PlatformState;
  save: Save;
  name: (id: string) => string;
}) {
  const payments = [...p.training.payments].reverse();
  const paymentRows = (entries: typeof payments) =>
    entries.map((payment) => {
      const item =
        payment.purpose === 'marketplace'
          ? p.products.find((product) => product.id === payment.targetId)?.name
          : p.ventures.find(
              (venture) =>
                venture.id ===
                p.incubations.find((path) => path.id === payment.targetId)?.ventureId,
            )?.name;
      return {
        id: payment.id,
        search: [item, feeLabels[payment.purpose], name(payment.accountId), payment.status].join(
          ' ',
        ),
        cells: [
          item ?? 'Payment',
          feeLabels[payment.purpose],
          name(payment.accountId),
          amount(payment.amount),
          <WorkspaceStatus>{payment.status}</WorkspaceStatus>,
          payment.status === 'pending' ? (
            <WorkspaceDialog action="Review payment" title={item ?? 'Review payment'}>
              {(finish) => (
                <>
                  <p>
                    {feeLabels[payment.purpose]} · {name(payment.accountId)} ·{' '}
                    {amount(payment.amount)}
                  </p>
                  <p>Confirm or decline this simulated payment.</p>
                  <div className="workspace-form-footer">
                    <button
                      className="button button-outline"
                      onClick={() =>
                        finish(
                          submitTraining(save, {
                            type: 'training-payment-review',
                            id: payment.id,
                            decision: 'declined',
                          }),
                        )
                      }
                    >
                      Decline payment
                    </button>
                    <button
                      className="button"
                      onClick={() =>
                        finish(
                          submitTraining(save, {
                            type: 'training-payment-review',
                            id: payment.id,
                            decision: 'confirmed',
                          }),
                        )
                      }
                    >
                      Confirm demo payment
                    </button>
                  </div>
                </>
              )}
            </WorkspaceDialog>
          ) : (
            '—'
          ),
        ],
      };
    });
  const pending = payments.filter((payment) => payment.status === 'pending');
  const columns = ['Item', 'Purpose', 'Member', 'Amount', 'Status', 'Action'];
  return (
    <WorkspaceTabs
      label="Payment views"
      views={[
        {
          id: 'pending',
          label: 'Awaiting confirmation',
          count: pending.length,
          content: (
            <WorkspaceTable
              label="pending payments"
              columns={columns}
              rows={paymentRows(pending)}
              empty="No payments are awaiting confirmation."
            />
          ),
        },
        {
          id: 'records',
          label: 'All payment records',
          count: payments.length,
          content: (
            <WorkspaceTable
              label="payment records"
              columns={columns}
              rows={paymentRows(payments)}
            />
          ),
        },
        {
          id: 'settings',
          label: 'Fee settings',
          content: (
            <WorkspaceTable
              label="fee settings"
              columns={['Purpose', 'Fee']}
              rows={feePurposes.map((purpose) => ({
                id: purpose,
                search: feeLabels[purpose],
                cells: [feeLabels[purpose], amount(p.training.fees[purpose])],
              }))}
              actions={
                <TrainingForm
                  save={save}
                  label="Save payment settings"
                  dialog={{ action: 'Edit payment settings' }}
                  build={(data) => ({
                    type: 'training-fees-save',
                    bypassEnabled: data.get('bypass') === 'on',
                    fees: {
                      'getting-started': Number(field(data, 'getting-started')),
                      advanced: Number(field(data, 'advanced')),
                      marketplace: Number(field(data, 'marketplace')),
                    },
                  })}
                >
                  {feePurposes.map((purpose) => (
                    <label key={purpose}>
                      {feeLabels[purpose]} (KES)
                      <input
                        name={purpose}
                        type="number"
                        min={purpose === 'marketplace' ? 1 : 0}
                        step="1"
                        required
                        defaultValue={p.training.fees[purpose]}
                      />
                    </label>
                  ))}
                  <label className="inline-checkbox">
                    <input
                      name="bypass"
                      type="checkbox"
                      defaultChecked={p.training.bypassEnabled}
                    />{' '}
                    Allow new paid listings without incubation
                  </label>
                </TrainingForm>
              }
            />
          ),
        },
      ]}
    />
  );
}

type CertificateCandidate = ReturnType<typeof incubationCertificateQueue>[number];

function SchoolCertificateReview({
  p,
  path,
  kind,
  recipients,
  save,
  back,
  onReviewed,
}: {
  p: PlatformState;
  path: Incubation;
  kind: CredentialKind;
  recipients: CertificateCandidate[];
  save: Save;
  back: string;
  onReviewed: () => void;
}) {
  const venture = p.ventures.find((row) => row.id === path.ventureId);
  const school = schoolForVenture(p, venture);
  const requiredStages = certificateStages(kind);
  const classes = p.training.classes.filter((record) =>
    (record.groupIds ?? [record.groupId]).some((id) => id === venture?.groupId),
  );
  const title = credentialTitle(p.training, kind);
  const ready = recipients.filter((entry) => entry.ready);
  const learnerName = (id: string) =>
    p.training.students.find((student) => student.id === id)?.name ?? id;
  const reviewBatch = (
    entries: CertificateCandidate[],
    action: 'accept' | 'reject',
    all = false,
  ) => {
    if (!entries.length) return null;
    const count = entries.length;
    const heading = all ? title : learnerName(entries[0]!.learnerId);
    const accept = action === 'accept';
    return (
      <WorkspaceFormDialog
        action={all ? (accept ? 'Accept eligible' : 'Reject all') : accept ? 'Accept' : 'Reject'}
        title={heading}
        submit={accept ? 'Accept and issue' : 'Reject with reason'}
        onSave={(data) => {
          const success = submitTraining(
            save,
            accept
              ? {
                  type: 'school-credentials-issue',
                  incubationId: path.id,
                  kind,
                  recipients: entries.map(({ learnerId }) => ({
                    id: crypto.randomUUID(),
                    learnerId,
                  })),
                }
              : {
                  type: 'school-certificates-reject',
                  incubationId: path.id,
                  kind,
                  learnerIds: entries.map(({ learnerId }) => learnerId),
                  reason: field(data, 'reason'),
                },
          );
          if (success && count === recipients.length) onReviewed();
          return success;
        }}
      >
        <p>
          {venture?.name} · {count} {count === 1 ? 'request' : 'requests'}
        </p>
        {!accept && (
          <label>
            Reason shared with the school
            <textarea name="reason" minLength={5} maxLength={3000} required />
          </label>
        )}
      </WorkspaceFormDialog>
    );
  };
  return (
    <section className="workspace-record">
      <Link to={back}>← Awaiting approval</Link>
      <h3>
        {venture?.name} · {title}
      </h3>
      <p>
        {school?.name} · {recipients.length} requested
      </p>
      <h4>Stage evidence</h4>
      {requiredStages.map((id) => {
        const stage = p.training.curriculum.find((definition) => definition.id === id);
        const work = getStage(p.training, path.id, id);
        return (
          <details className="training-stage" key={id}>
            <summary>{stage?.title}</summary>
            {stage?.steps.map((step) => (
              <div className="training-step" key={step.id}>
                <strong>{step.title}</strong>
                <p className="workspace-detail-copy">
                  {work?.steps.find((entry) => entry.id === step.id)?.evidence ??
                    'No evidence recorded.'}
                </p>
              </div>
            ))}
          </details>
        );
      })}
      {(classes.length > 0 || path.milestones.length > 0) && (
        <details className="training-stage">
          <summary>Class activities and milestones</summary>
          {classes.map((record) => (
            <p key={record.id}>
              <strong>{record.date}</strong> · {record.challenge}
            </p>
          ))}
          {path.milestones.map((milestone) => (
            <p key={milestone.id}>
              <strong>{milestone.title}</strong> · {milestone.note}
            </p>
          ))}
        </details>
      )}
      <WorkspaceTable
        label="certificate recipients"
        columns={[
          'Student',
          'Classification',
          ...requiredStages.map(
            (id) => p.training.curriculum.find((stage) => stage.id === id)?.title ?? id,
          ),
          'Decision',
        ]}
        actions={
          <div className="workspace-row-actions">
            {reviewBatch(ready, 'accept', true)}
            {reviewBatch(recipients, 'reject', true)}
          </div>
        }
        rows={recipients.map((entry) => {
          const { key, learnerId } = entry;
          const student = learnerName(learnerId);
          const score = schoolCertificateScore(p.training, {
            incubationId: path.id,
            learnerId,
            kind,
          });
          return {
            id: key,
            search: student,
            cells: [
              student,
              score === undefined ? '—' : schoolDivision(score),
              ...requiredStages.map((id) => {
                const attempts =
                  getStage(p.training, path.id, id)?.attempts.filter(
                    (attempt) => attempt.learnerId === learnerId && attempt.score !== null,
                  ) ?? [];
                return attempts.map((attempt) => (
                  <p key={attempt.id}>
                    <strong>{attempt.score}%</strong> · {attempt.note}
                  </p>
                ));
              }),
              <div className="workspace-row-actions">
                {entry.ready ? (
                  reviewBatch([entry], 'accept')
                ) : (
                  <span>Requirements no longer met</span>
                )}
                {reviewBatch([entry], 'reject')}
              </div>,
            ],
          };
        })}
      />
    </section>
  );
}

export function TrainingCertificates({
  state,
  save,
  name,
  courses,
}: {
  state: DemoState;
  save: Save;
  name: (id: string) => string;
  courses: Course[];
}) {
  const p = state.platform;
  const courseQueue = courseCertificateQueue(state);
  const [params, setParams] = useSearchParams();
  const approvalHref = '/dashboard/workspace?tab=certificates&view=approval';
  const learnerName = (id: string) =>
    p.training.students.find((student) => student.id === id)?.name ?? name(id);
  const ventureName = (id: string) =>
    p.ventures.find((venture) => venture.id === id)?.name ?? 'Venture';
  const credentials = p.training.credentials;
  const columns = ['Certificate', 'Learner', 'Venture', 'Status', 'Action'];
  const candidates = incubationCertificateQueue(p);
  const schoolRequests = new Map<string, CertificateCandidate[]>();
  const individualRequests = candidates.filter((entry) => {
    if (institutionForPath(p, entry.path)?.kind !== 'high-school') return true;
    const key = entry.path.id + ':' + entry.kind;
    const requests = schoolRequests.get(key);
    if (requests) requests.push(entry);
    else schoolRequests.set(key, [entry]);
    return false;
  });
  const selected = schoolRequests.get(params.get('schoolReview') ?? '');
  if (selected?.[0] && params.get('view') === 'approval')
    return (
      <SchoolCertificateReview
        p={p}
        path={selected[0].path}
        kind={selected[0].kind}
        recipients={selected}
        save={save}
        back={approvalHref}
        onReviewed={() => setParams({ tab: 'certificates', view: 'approval' }, { replace: true })}
      />
    );
  const queue = individualRequests.map(({ key, path, learnerId, kind, fee, payment, ready }) => {
    const title = credentialTitle(p.training, kind);
    const learner = learnerName(learnerId);
    const venture = ventureName(path.ventureId);
    const status = ready
      ? 'Ready to issue'
      : payment?.status === 'pending'
        ? 'Payment under review'
        : 'Payment due';
    return {
      id: key,
      search: [title, learner, venture, status].join(' '),
      cells: [
        title,
        learner,
        venture,
        <WorkspaceStatus>{status}</WorkspaceStatus>,
        ready ? (
          <WorkspaceDialog action="Issue certificate" title={title}>
            {(finish) => (
              <>
                <p>
                  {learner} · {venture}
                </p>
                <div className="workspace-form-footer">
                  <button
                    className="button"
                    onClick={() =>
                      finish(
                        submitTraining(save, {
                          type: 'training-credential-issue',
                          id: crypto.randomUUID(),
                          incubationId: path.id,
                          learnerId,
                          kind,
                        }),
                      )
                    }
                  >
                    Approve and issue certificate
                  </button>
                </div>
              </>
            )}
          </WorkspaceDialog>
        ) : payment?.status === 'pending' ? (
          <Link to="/dashboard/workspace?tab=payments" aria-label="Review payment">
            Review
          </Link>
        ) : (
          <span>{amount(fee)} · Learner to record payment</span>
        ),
      ],
    };
  });
  for (const [key, records] of schoolRequests) {
    const { path, kind } = records[0]!;
    const title = credentialTitle(p.training, kind);
    const venture = ventureName(path.ventureId);
    const institution = institutionForPath(p, path)?.name;
    queue.push({
      id: key,
      search: [
        title,
        venture,
        institution,
        ...records.map(({ learnerId }) => learnerName(learnerId)),
      ].join(' '),
      cells: [
        title,
        `${records.length} ${records.length === 1 ? 'student' : 'students'}`,
        `${venture} · ${institution}`,
        <WorkspaceStatus>Awaiting review</WorkspaceStatus>,
        <Link
          to={approvalHref + '&schoolReview=' + encodeURIComponent(key)}
          aria-label={`Review ${title} for ${venture}`}
        >
          Review
        </Link>,
      ],
    });
  }
  return (
    <WorkspaceTabs
      label="Certificate views"
      views={[
        {
          id: 'approval',
          label: 'Awaiting approval',
          count: candidates.length,
          content: (
            <WorkspaceTable
              label="certificates awaiting approval"
              columns={columns}
              rows={queue}
              empty="No incubation certificates are awaiting approval. Check Learner progress for eligibility."
            />
          ),
        },
        {
          id: 'issued',
          label: 'Issued certificates',
          count: credentials.length,
          content: (
            <WorkspaceTable
              label="issued certificates"
              columns={columns}
              rows={credentials.map((c) => {
                const path = p.incubations.find((path) => path.id === c.incubationId);
                const title = credentialTitle(p.training, c.kind);
                const learner = learnerName(c.learnerId);
                const venture = ventureName(path?.ventureId ?? '');
                return {
                  id: c.id,
                  search: [title, learner, venture].join(' '),
                  cells: [
                    title,
                    learner,
                    venture,
                    <WorkspaceStatus>Issued</WorkspaceStatus>,
                    <Link to={`/certificates/${c.id}`} aria-label="View certificate">
                      View
                    </Link>,
                  ],
                };
              })}
            />
          ),
        },
        {
          id: 'progress',
          label: 'Learner progress',
          content: (
            <WorkspaceTable
              label="learner progress"
              columns={['Learner', 'Venture', 'Next milestone']}
              rows={p.incubations
                .filter((path) => path.status === 'active' || path.status === 'pending')
                .flatMap((path) =>
                  incubationLearners(p, path).map((learnerId) => {
                    const next = p.training.curriculum.find(
                      (stage) => !completedStage(p.training, path.id, stage.id, learnerId),
                    );
                    const learner = learnerName(learnerId);
                    const title = ventureName(path.ventureId);
                    return {
                      id: path.id + ':' + learnerId,
                      search: [learner, title, next?.title].join(' '),
                      cells: [
                        learner,
                        title,
                        path.status === 'pending' ? (
                          <Link to="/dashboard/workspace?tab=approvals&view=incubation">
                            Assign a mentor
                          </Link>
                        ) : next ? (
                          `Complete the ${next.title} assessment.`
                        ) : (
                          'All stages completed.'
                        ),
                      ],
                    };
                  }),
                )}
            />
          ),
        },
        {
          id: 'courses',
          label: 'Course certificates',
          count: courseQueue.length,
          content: (
            <CourseCertificates state={state} courses={courses} pending={courseQueue} save={save} />
          ),
        },
      ]}
    />
  );
}
