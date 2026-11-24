import {
  learningRepository,
  type CourseDraft,
} from '../../../services/laravel-learning-repository';
import { WorkspaceTable, WorkspaceTabs } from '../workspace/WorkspaceControls';
import { StatusIndicator } from '../../../shared/StatusIndicator';
import { shillings } from './LearningWorkspace';
import {
  DecisionAction,
  fieldValue,
  RecordsFeedback,
  useWorkspaceRecords,
  WorkspaceAction,
} from './WorkspaceActions';

function AddLesson({ record, reload }: { record: CourseDraft; reload: () => void }) {
  return (
    <WorkspaceAction
      action="Add lesson"
      title={record.title}
      save={async (form) => {
        await learningRepository.addLesson(record.id, {
          title: fieldValue(form, 'title'),
          content: fieldValue(form, 'content'),
          url: fieldValue(form, 'url'),
        });
        reload();
      }}
    >
      <label>
        Lesson title
        <input name="title" required maxLength={160} />
      </label>
      <label>
        Lesson material
        <textarea name="content" maxLength={10000} />
      </label>
      <label>
        Resource URL
        <input name="url" type="url" maxLength={500} />
      </label>
    </WorkspaceAction>
  );
}

function PublishCourse({ record, reload }: { record: CourseDraft; reload: () => void }) {
  return (
    <WorkspaceAction
      action={record.status === 'published' ? 'Edit' : 'Publish'}
      title={record.title}
      save={async (form) => {
        await learningRepository.publish(record.id, {
          price: fieldValue(form, 'price'),
          discount: fieldValue(form, 'discount'),
          royalty_rate: fieldValue(form, 'royalty_rate'),
        });
        reload();
      }}
    >
      <label>
        Price (KES)
        <input
          name="price"
          type="number"
          min="0"
          max="1000000"
          defaultValue={record.price}
          required
        />
      </label>
      <label>
        Discount (KES)
        <input
          name="discount"
          type="number"
          min="0"
          max="1000000"
          defaultValue={record.discount}
          required
        />
      </label>
      <label>
        Mentor royalty (%)
        <input
          name="royalty_rate"
          type="number"
          min="0"
          max="100"
          defaultValue={record.royalty_rate}
          required
        />
      </label>
    </WorkspaceAction>
  );
}

function CourseAuthoring({ admin }: { admin: boolean }) {
  const { records, error, reload } = useWorkspaceRecords(learningRepository.authoring);
  return (
    <>
      <RecordsFeedback error={error} loading={records === null} />
      {records && (
        <WorkspaceTable
          label={admin ? 'course proposals and drafts' : 'your course proposals'}
          columns={['Course', 'Review', 'Lessons', 'Enrolments', 'Accrued royalty', 'Actions']}
          actions={
            <WorkspaceAction
              action={admin ? 'Add course' : 'Propose course'}
              create
              submit={admin ? 'Create draft' : 'Submit proposal'}
              save={async (form) => {
                await learningRepository.propose(form);
                reload();
              }}
            >
              <label>
                Title
                <input name="title" maxLength={140} required />
              </label>
              <label>
                Level
                <input name="level" maxLength={80} required />
              </label>
              <label>
                Description
                <textarea name="description" maxLength={5000} required />
              </label>
              {!admin && (
                <label>
                  Supporting document (PDF)
                  <input name="proposal" type="file" accept="application/pdf" required />
                </label>
              )}
            </WorkspaceAction>
          }
          rows={records.rows.map((record) => {
            const count = records.lessons.filter((lesson) => lesson.course_id === record.id).length;
            const royalty = records.royalties.find((entry) => entry.course_id === record.id);
            return {
              id: String(record.id),
              search: [record.title, record.description, record.status].join(' '),
              cells: [
                <>
                  <strong>{record.title}</strong>
                  <div>{record.description}</div>
                </>,
                <>
                  <StatusIndicator status={record.status} />
                  {record.review_notes && <div>{record.review_notes}</div>}
                </>,
                count,
                royalty?.enrolments ?? 0,
                shillings(royalty?.accrued ?? 0),
                <div className="workspace-row-actions">
                  {!!record.has_attachment && (
                    <a href={learningRepository.attachment(record.id)}>Download proposal</a>
                  )}
                  {admin && record.status === 'proposed' && (
                    <DecisionAction
                      name={record.title}
                      decide={async (decision, note) => {
                        await learningRepository.review(record.id, decision, note);
                        reload();
                      }}
                    />
                  )}
                  {record.status === 'approved' && <AddLesson record={record} reload={reload} />}
                  {admin &&
                    ((record.status === 'approved' && count > 0) ||
                      record.status === 'published') && (
                      <PublishCourse record={record} reload={reload} />
                    )}
                </div>,
              ],
            };
          })}
        />
      )}
    </>
  );
}

export function CourseEnrolmentRegistry() {
  const { records, error, reload } = useWorkspaceRecords(learningRepository.registry);
  return (
    <>
      <RecordsFeedback error={error} loading={records === null} />
      {records && (
        <WorkspaceTable
          label="course enrolments"
          columns={['Learner', 'Course', 'Payment', 'Progress', 'Certificate', 'Actions']}
          rows={records.map((record) => ({
            id: String(record.id),
            search: [
              record.learner,
              record.course,
              record.payment_status,
              record.completed_at && 'completed',
            ].join(' '),
            cells: [
              record.learner,
              record.course,
              <>
                <span className="status-indicator-group">
                  <span>{shillings(record.price_paid)}</span>
                  <StatusIndicator status={record.payment_status} />
                </span>
                <div>{record.payment_reference}</div>
                {record.has_receipt && (
                  <a
                    href={learningRepository.receiptUrl(record.id)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    View receipt
                  </a>
                )}
              </>,
              <StatusIndicator status={record.completed_at ? 'completed' : 'in progress'} />,
              record.certificate_id ? (
                <a
                  href={learningRepository.certificate(record.certificate_id)}
                  target="_blank"
                  rel="noreferrer"
                >
                  View
                </a>
              ) : (
                '—'
              ),
              record.payment_status === 'pending' ? (
                <WorkspaceAction
                  action="Review"
                  title={record.learner + ' · ' + record.course}
                  save={async (form) => {
                    await learningRepository.reviewPayment(
                      record.id,
                      fieldValue(form, 'decision'),
                      fieldValue(form, 'note'),
                    );
                    reload();
                  }}
                >
                  <p>
                    {shillings(record.price_paid)} · {record.payment_reference}
                  </p>
                  <label>
                    Decision
                    <select name="decision">
                      <option value="confirmed">Confirm</option>
                      <option value="rejected">Reject</option>
                    </select>
                  </label>
                  <label>
                    Note (required to reject)
                    <textarea name="note" maxLength={1500} />
                  </label>
                </WorkspaceAction>
              ) : record.completed_at && !record.certificate_id ? (
                <WorkspaceAction
                  action="Issue certificate"
                  title={record.learner}
                  submit="Issue"
                  save={async () => {
                    await learningRepository.issue(record.id);
                    reload();
                  }}
                >
                  <p>Issue the certificate of completion for {record.course}.</p>
                </WorkspaceAction>
              ) : (
                '—'
              ),
            ],
          }))}
        />
      )}
    </>
  );
}

export function CourseAdministration({ admin }: { admin: boolean }) {
  return admin ? (
    <WorkspaceTabs
      label="Course administration"
      views={[
        { id: 'authoring', label: 'Courses & proposals', content: <CourseAuthoring admin /> },
        {
          id: 'enrolments',
          label: 'Enrolments & certificates',
          content: <CourseEnrolmentRegistry />,
        },
      ]}
    />
  ) : (
    <CourseAuthoring admin={false} />
  );
}
