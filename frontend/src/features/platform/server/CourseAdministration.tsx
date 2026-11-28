import { useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ReceiptPreviewModal } from './ReceiptPreviewModal';
import {
  learningRepository,
  type CourseDraft,
  type CoursePlacementConfig,
  type MentorOption,
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

const DEFAULT_PLACEMENTS: CoursePlacementConfig[] = [
  {
    key: 'public',
    label: 'Public catalogue (/learn)',
    description: 'Shown on the public YERH course storefront and open for learner enrolment.',
    visible_on_public_learn: true,
    auto_attach_incubation: false,
    institution_scoped: false,
    is_draft: false,
    system: true,
  },
  {
    key: 'incubation',
    label: 'Incubation pathway (Model A)',
    description:
      'Hidden from public /learn; automatically assigned to ventures when a mentor is linked.',
    visible_on_public_learn: false,
    auto_attach_incubation: true,
    institution_scoped: false,
    is_draft: false,
    system: true,
  },
  {
    key: 'institution',
    label: 'Institution exclusive',
    description: 'Reserved for partner universities and innovation hubs.',
    visible_on_public_learn: false,
    auto_attach_incubation: false,
    institution_scoped: true,
    is_draft: false,
    system: true,
  },
  {
    key: 'draft',
    label: 'Hidden draft',
    description: 'Kept unpublished while preparing content in Moodle or YERH.',
    visible_on_public_learn: false,
    auto_attach_incubation: false,
    institution_scoped: false,
    is_draft: true,
    system: true,
  },
];

type PlacementKind = 'public' | 'incubation' | 'exclusive' | 'draft';

function placementKind(item: CoursePlacementConfig): PlacementKind {
  if (item.is_draft) return 'draft';
  if (item.auto_attach_incubation) return 'incubation';
  if (item.visible_on_public_learn) return 'public';
  return 'exclusive';
}

function applyPlacementKind(
  item: CoursePlacementConfig,
  kind: PlacementKind,
): CoursePlacementConfig {
  const lockedDraft = item.key === 'draft' ? 'draft' : kind;
  return {
    ...item,
    visible_on_public_learn: lockedDraft === 'public',
    auto_attach_incubation: lockedDraft === 'incubation',
    institution_scoped: lockedDraft === 'exclusive',
    is_draft: lockedDraft === 'draft',
  };
}

function placementLabel(placements: CoursePlacementConfig[], key?: string | null) {
  const target = key || 'draft';
  return placements.find((item) => item.key === target)?.label ?? target;
}

function ManagePlacements({
  placements,
  reload,
}: {
  placements: CoursePlacementConfig[];
  reload: () => void;
}) {
  const [rows, setRows] = useState<CoursePlacementConfig[]>(placements);

  return (
    <WorkspaceAction
      action="Placements"
      title="Course visibility & placements"
      submit="Save placements"
      save={async () => {
        const cleaned = rows
          .map((item) => {
            const normalizedKey = item.key
              .trim()
              .toLowerCase()
              .replace(/[^a-z0-9_-]+/g, '-')
              .replace(/^-+|-+$/g, '');
            return {
              ...item,
              key: normalizedKey,
              label: item.label.trim(),
              description: item.description.trim(),
              visible_on_public_learn:
                normalizedKey === 'draft' ? false : item.visible_on_public_learn,
              auto_attach_incubation:
                normalizedKey === 'draft' ? false : item.auto_attach_incubation,
              institution_scoped: normalizedKey === 'draft' ? false : item.institution_scoped,
              is_draft: normalizedKey === 'draft' ? true : item.is_draft,
            };
          })
          .filter((item) => item.key && item.label);
        await learningRepository.updatePlacements(cleaned);
        reload();
      }}
    >
      <p className="source-note">
        Configure where courses can be published. Keep Hidden draft so unpublished syncs stay safely
        hidden.
      </p>
      {rows.map((item, index) => {
        const isLockedDraft = item.key === 'draft';
        return (
          <div key={index} className="workspace-row-actions">
            <label>
              Key
              <input
                value={item.key}
                maxLength={24}
                disabled={isLockedDraft}
                required
                onChange={(event) => {
                  const value = event.target.value;
                  setRows((prev) =>
                    prev.map((row, i) => (i === index ? { ...row, key: value } : row)),
                  );
                }}
              />
            </label>
            <label>
              Label
              <input
                value={item.label}
                maxLength={80}
                required
                onChange={(event) => {
                  const value = event.target.value;
                  setRows((prev) =>
                    prev.map((row, i) => (i === index ? { ...row, label: value } : row)),
                  );
                }}
              />
            </label>
            <label>
              Behaviour
              <select
                value={placementKind(item)}
                disabled={isLockedDraft}
                onChange={(event) => {
                  const kind = event.target.value as PlacementKind;
                  setRows((prev) =>
                    prev.map((row, i) => (i === index ? applyPlacementKind(row, kind) : row)),
                  );
                }}
              >
                <option value="public">Public catalogue (/learn)</option>
                <option value="incubation">Incubation classroom (Model A)</option>
                <option value="exclusive">Exclusive / Cohort-only</option>
                <option value="draft">Hidden draft</option>
              </select>
            </label>
            <label>
              Description
              <input
                value={item.description}
                maxLength={300}
                onChange={(event) => {
                  const description = event.target.value;
                  setRows((prev) =>
                    prev.map((row, i) => (i === index ? { ...row, description } : row)),
                  );
                }}
              />
            </label>
            {rows.length > 1 && !isLockedDraft && (
              <button
                type="button"
                className="button secondary"
                onClick={() => setRows((prev) => prev.filter((_, i) => i !== index))}
              >
                Remove
              </button>
            )}
          </div>
        );
      })}
      <button
        type="button"
        className="button secondary"
        onClick={() =>
          setRows((prev) => [
            ...prev,
            {
              key: `cohort-${prev.length + 1}`,
              label: 'New placement',
              description: '',
              visible_on_public_learn: true,
              auto_attach_incubation: false,
              institution_scoped: false,
              is_draft: false,
              system: false,
            },
          ])
        }
      >
        Add placement
      </button>
    </WorkspaceAction>
  );
}

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

function PublishCourse({
  record,
  placements,
  mentors,
  reload,
}: {
  record: CourseDraft;
  placements: CoursePlacementConfig[];
  mentors: MentorOption[];
  reload: () => void;
}) {
  const defaultPlacement =
    record.placement && record.placement !== 'draft'
      ? record.placement
      : (placements.find((item) => !item.is_draft)?.key ?? 'public');

  return (
    <WorkspaceAction
      action={record.status === 'published' ? 'Edit' : 'Publish'}
      title={record.title}
      save={async (form) => {
        const authorValue = fieldValue(form, 'author_id');
        await learningRepository.publish(record.id, {
          price: fieldValue(form, 'price'),
          discount: fieldValue(form, 'discount'),
          royalty_rate: fieldValue(form, 'royalty_rate'),
          author_id: authorValue ? Number(authorValue) : null,
          placement: fieldValue(form, 'placement'),
          featured: form.get('featured') === 'on',
        });
        reload();
      }}
    >
      <label>
        Visibility / Placement
        <select name="placement" defaultValue={defaultPlacement}>
          {placements.map((item) => (
            <option key={item.key} value={item.key}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      <label className="inline-checkbox">
        <input type="checkbox" name="featured" defaultChecked={Boolean(record.featured)} /> Featured
        on front page
      </label>
      <label>
        Assigned mentor (royalty recipient)
        <select name="author_id" defaultValue={record.author_id ? String(record.author_id) : ''}>
          <option value="">None (YERH house course)</option>
          {mentors.map((mentor) => (
            <option key={mentor.id} value={String(mentor.id)}>
              {mentor.name} ({mentor.email})
            </option>
          ))}
        </select>
      </label>
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
        <small className="source-note">
          Calculated on confirmed net payments whenever a mentor is assigned.
        </small>
      </label>
    </WorkspaceAction>
  );
}

function CourseAuthoring({ admin }: { admin: boolean }) {
  const { records, error, reload } = useWorkspaceRecords(learningRepository.authoring);
  const [syncing, setSyncing] = useState(false);
  const [syncNotice, setSyncNotice] = useState('');
  const [syncError, setSyncError] = useState('');
  const placements = records?.placements?.length ? records.placements : DEFAULT_PLACEMENTS;
  const mentors = records?.mentors ?? [];
  const summary = records?.earnings_summary;

  async function handleSyncMoodle() {
    setSyncing(true);
    setSyncNotice('');
    setSyncError('');
    try {
      const result = await learningRepository.syncMoodle();
      setSyncNotice(
        `Synced ${result.synced} Moodle course(s): ${result.created} added as hidden drafts, ${result.updated} updated.`,
      );
      reload();
    } catch (failure) {
      setSyncError(failure instanceof Error ? failure.message : 'Moodle sync failed.');
    } finally {
      setSyncing(false);
    }
  }

  return (
    <>
      <RecordsFeedback error={error || syncError} loading={records === null} />
      {!admin && summary && (
        <div className="account-status" role="region" aria-label="Mentor royalty summary">
          <strong>Accrued royalties: {shillings(summary.accrued_royalties)}</strong>
          {summary.pending_royalties > 0
            ? ` · ${shillings(summary.pending_royalties)} awaiting payment confirmation`
            : ''}{' '}
          ·{' '}
          <Link to="/dashboard/workspace?tab=earnings" className="account-link">
            Open Earnings &amp; royalties
          </Link>
        </div>
      )}
      {syncNotice && (
        <p className="account-status" role="status">
          {syncNotice}
        </p>
      )}
      {records && (
        <WorkspaceTable
          label={admin ? 'course proposals and drafts' : 'your course proposals'}
          columns={['Course', 'Review', 'Lessons', 'Enrolments', 'Accrued royalty', 'Actions']}
          actions={
            <div className="workspace-row-actions">
              {admin && (
                <ManagePlacements
                  key={placements
                    .map((item) => `${item.key}:${item.label}:${placementKind(item)}`)
                    .join('|')}
                  placements={placements}
                  reload={reload}
                />
              )}
              {admin && records.moodle?.configured && (
                <button
                  type="button"
                  className="button secondary"
                  disabled={syncing}
                  onClick={() => void handleSyncMoodle()}
                >
                  {syncing ? 'Syncing Moodle…' : 'Sync from Moodle'}
                </button>
              )}
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
            </div>
          }
          rows={records.rows.map((record) => {
            const count = records.lessons.filter((lesson) => lesson.course_id === record.id).length;
            const royalty = records.royalties.find((entry) => entry.course_id === record.id);
            const isMoodle = Boolean(record.moodle_course_id);
            const netPrice = Math.max(0, Number(record.price) - Number(record.discount));
            const confirmedCount = Number(royalty?.enrolments ?? 0);
            const pendingCount = Number(royalty?.pending_enrolments ?? 0);
            const pendingRoyalty = Number(royalty?.pending_accrued ?? 0);
            return {
              id: String(record.id),
              search: [
                record.title,
                record.description,
                record.status,
                record.placement ?? '',
                record.author_name ?? '',
                isMoodle ? 'moodle' : '',
              ].join(' '),
              cells: [
                <>
                  <strong>{record.title}</strong>
                  <div>{record.description}</div>
                  <div className="workspace-detail-copy">
                    {netPrice > 0 ? shillings(netPrice) : 'Free'} · {record.royalty_rate}% royalty
                    {admin && record.author_name
                      ? ` · ${record.author_role === 'partner' ? 'Partner' : 'Mentor'}: ${record.author_name}`
                      : ''}
                    {isMoodle
                      ? ` · Moodle #${record.moodle_course_id} · ${placementLabel(placements, record.placement)}`
                      : ''}
                    {record.featured ? ' · Featured' : ''}
                  </div>
                </>,
                <>
                  <StatusIndicator status={record.status} />
                  {record.review_notes && <div>{record.review_notes}</div>}
                </>,
                isMoodle ? 'Moodle' : count,
                <>
                  <span>{confirmedCount} confirmed</span>
                  {pendingCount > 0 && (
                    <div className="workspace-detail-copy">+ {pendingCount} pending</div>
                  )}
                </>,
                <>
                  <strong>{shillings(royalty?.accrued ?? 0)}</strong>
                  {pendingRoyalty > 0 && (
                    <div className="workspace-detail-copy">
                      + {shillings(pendingRoyalty)} pending
                    </div>
                  )}
                </>,
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
                  {!isMoodle && record.status === 'approved' && (
                    <AddLesson record={record} reload={reload} />
                  )}
                  {admin &&
                    ((record.status === 'approved' && (count > 0 || isMoodle)) ||
                      record.status === 'published') && (
                      <PublishCourse
                        record={record}
                        placements={placements}
                        mentors={mentors}
                        reload={reload}
                      />
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

export function CourseEnrolmentRegistry({ pendingOnly = false }: { pendingOnly?: boolean } = {}) {
  const { records, error, reload } = useWorkspaceRecords(learningRepository.registry);
  const visibleRows = records
    ? pendingOnly
      ? records.filter((record) => record.payment_status === 'pending')
      : records
    : null;
  return (
    <>
      <RecordsFeedback error={error} loading={records === null} />
      {visibleRows && (
        <WorkspaceTable
          label="course enrolments"
          columns={['Learner', 'Course', 'Payment', 'Progress', 'Certificate', 'Actions']}
          empty={
            pendingOnly ? 'No course payments are awaiting review.' : 'There are no records yet.'
          }
          rows={visibleRows.map((record) => ({
            id: String(record.id),
            search: [
              record.learner,
              record.course,
              record.payment_status,
              record.payment_reference ?? '',
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
                  <ReceiptPreviewModal
                    url={learningRepository.receiptUrl(record.id)}
                    title={`${record.learner} · ${record.course}`}
                    reference={record.payment_reference}
                  />
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
                  {record.has_receipt && (
                    <p>
                      <ReceiptPreviewModal
                        url={learningRepository.receiptUrl(record.id)}
                        label="View uploaded payment receipt"
                        title={`${record.learner} · ${record.course}`}
                        reference={record.payment_reference}
                      />
                    </p>
                  )}
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

export function MentorEarningsWorkspace({ admin }: { admin: boolean }) {
  const { records, error } = useWorkspaceRecords(learningRepository.authoring);
  const summary = records?.earnings_summary;
  const ledger = records?.ledger ?? [];

  return (
    <>
      <RecordsFeedback error={error} loading={records === null} />
      {records && summary && (
        <>
          <div className="workspace-stats" aria-label="Royalty earnings summary">
            <div className="dashboard-metric">
              <strong>{shillings(summary.accrued_royalties)}</strong>
              <span>Accrued royalties</span>
            </div>
            <div className="dashboard-metric">
              <strong>{shillings(summary.pending_royalties)}</strong>
              <span>Pending confirmation</span>
            </div>
            <div className="dashboard-metric">
              <strong>{summary.confirmed_enrolments}</strong>
              <span>Confirmed enrolments</span>
            </div>
            <div className="dashboard-metric">
              <strong>{shillings(summary.gross_revenue)}</strong>
              <span>Gross course sales</span>
            </div>
          </div>

          <p className="source-note">
            Royalties are calculated automatically as Net Price Paid × Assigned Royalty Rate (%)
            once an enrolment payment is confirmed by YERH administration.
          </p>

          <WorkspaceTabs
            label="Earnings and royalties"
            param={admin ? 'section' : 'view'}
            views={[
              {
                id: 'courses',
                label: admin ? 'Course royalties' : 'Your course royalties',
                count: records.rows.length,
                content: (
                  <WorkspaceTable
                    label="course royalty breakdown"
                    empty="No courses assigned for royalties yet."
                    columns={
                      admin
                        ? [
                            'Course',
                            'Mentor',
                            'Net price',
                            'Royalty rate',
                            'Confirmed',
                            'Pending',
                            'Gross sales',
                            'Accrued royalty',
                          ]
                        : [
                            'Course',
                            'Net price',
                            'Royalty rate',
                            'Confirmed',
                            'Pending',
                            'Gross sales',
                            'Accrued royalty',
                          ]
                    }
                    rows={records.rows.map((record) => {
                      const royalty = records.royalties.find(
                        (entry) => entry.course_id === record.id,
                      );
                      const netPrice = Math.max(0, Number(record.price) - Number(record.discount));
                      return {
                        id: String(record.id),
                        search: [record.title, record.author_name ?? ''].join(' '),
                        cells: [
                          <strong>{record.title}</strong>,
                          ...(admin ? [record.author_name || 'YERH house course'] : []),
                          netPrice > 0 ? shillings(netPrice) : 'Free',
                          `${record.royalty_rate}%`,
                          Number(royalty?.enrolments ?? 0),
                          Number(royalty?.pending_enrolments ?? 0),
                          shillings(royalty?.gross_revenue ?? 0),
                          <strong>{shillings(royalty?.accrued ?? 0)}</strong>,
                        ],
                      };
                    })}
                  />
                ),
              },
              {
                id: 'enrolments',
                label: 'Enrolment earnings',
                count: ledger.length,
                content: (
                  <WorkspaceTable
                    label="enrolment earnings"
                    empty="No course enrolments recorded yet."
                    exportLabel="Export royalties CSV"
                    exportName="yerh-royalties.csv"
                    columns={
                      admin
                        ? ['Date', 'Course', 'Mentor', 'Learner', 'Payment', 'Paid', 'Rate', 'Royalty']
                        : ['Date', 'Course', 'Learner', 'Payment', 'Paid', 'Rate', 'Royalty']
                    }
                    rows={ledger.map((entry) => ({
                      id: String(entry.id),
                      search: [
                        entry.course_title,
                        entry.author_name ?? '',
                        entry.learner_name,
                        entry.payment_status,
                      ].join(' '),
                      cells: [
                        entry.updated_at,
                        entry.course_title,
                        ...(admin ? [entry.author_name || 'YERH house course'] : []),
                        entry.learner_name,
                        <StatusIndicator status={entry.payment_status} />,
                        shillings(entry.price_paid),
                        `${entry.royalty_rate}%`,
                        <strong>{shillings(entry.royalty_amount)}</strong>,
                      ],
                    }))}
                  />
                ),
              },
            ]}
          />
        </>
      )}
    </>
  );
}

function PartnerCourseProposals() {
  const { records, error, reload } = useWorkspaceRecords(learningRepository.authoring);

  return (
    <>
      <RecordsFeedback error={error} loading={records === null} />
      <p className="source-note">
        Propose a course topic with a syllabus PDF. YERH administration reviews approved proposals
        and sets up the published course inside Moodle.
      </p>
      {records && (
        <WorkspaceTable
          label="course proposals"
          columns={['Course', 'Level', 'Status & review notes', 'Proposal PDF']}
          empty="You have not submitted any course proposals yet."
          actions={
            <WorkspaceAction
              action="Propose course"
              create
              submit="Submit proposal"
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
                <input
                  name="level"
                  maxLength={80}
                  placeholder="e.g. Getting started, Intermediate"
                  required
                />
              </label>
              <label>
                Description &amp; learning outcomes
                <textarea name="description" maxLength={5000} required />
              </label>
              <label>
                Syllabus / proposal document (PDF)
                <input name="proposal" type="file" accept="application/pdf" required />
              </label>
            </WorkspaceAction>
          }
          rows={records.rows.map((record) => ({
            id: String(record.id),
            search: [record.title, record.level, record.status, record.description].join(' '),
            cells: [
              <>
                <strong>{record.title}</strong>
                <div className="workspace-detail-copy">{record.description}</div>
              </>,
              record.level,
              <>
                <StatusIndicator status={record.status} />
                {record.review_notes && (
                  <div className="workspace-detail-copy">{record.review_notes}</div>
                )}
              </>,
              record.has_attachment ? (
                <a href={learningRepository.attachment(record.id)}>Download PDF</a>
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

export function CourseAdministration({
  admin,
  partner = false,
}: {
  admin: boolean;
  partner?: boolean;
}) {
  if (partner) {
    return <PartnerCourseProposals />;
  }
  return admin ? (
    <>
      <div className="workspace-admin-topbar">
        <a
          className="button button-gold workspace-moodle-btn"
          href={learningRepository.moodleLaunchUrl()}
          target="_blank"
          rel="noreferrer"
        >
          Moodle <ExternalLink size={16} aria-hidden="true" />
        </a>
      </div>
      <WorkspaceTabs
        label="Course administration"
        views={[
          { id: 'authoring', label: 'Courses & proposals', content: <CourseAuthoring admin /> },
          {
            id: 'enrolments',
            label: 'Enrolments & certificates',
            content: <CourseEnrolmentRegistry />,
          },
          {
            id: 'royalties',
            label: 'Mentor royalties',
            content: <MentorEarningsWorkspace admin />,
          },
        ]}
      />
    </>
  ) : (
    <CourseAuthoring admin={false} />
  );
}
