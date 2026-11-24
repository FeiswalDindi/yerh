import { useCallback } from 'react';
import { ArrowUpRight, Paperclip } from 'lucide-react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useLaravelSession } from '../../../app/useLaravelSession';
import {
  engagementRepository,
  type OpportunityRecord,
} from '../../../services/laravel-engagement-repository';
import { laravelWorkspace } from '../../../services/laravel-workspace-repository';
import { PageIntro } from '../../../shared/PageIntro';
import { SmartImage } from '../../../shared/SmartImage';
import { StatusIndicator } from '../../../shared/StatusIndicator';
import { WorkspaceTable, WorkspaceTabs } from '../workspace/WorkspaceControls';
import {
  fieldValue,
  RecordsFeedback,
  useWorkspaceRecords,
  WorkspaceAction,
} from './WorkspaceActions';

const opportunityPath = (slug: string) => '/opportunities/' + encodeURIComponent(slug);
const deadline = (item: OpportunityRecord) =>
  item.deadline ? item.deadline.replace('T', ' ') + ' EAT' : 'Rolling';
const publicStatus = (item: OpportunityRecord) =>
  item.open
    ? 'Open'
    : item.opens_at && Date.parse(item.opens_at + '+03:00') > Date.now()
      ? 'Opening soon'
      : 'Closed';

function OpportunityCatalogue() {
  const { records, error } = useWorkspaceRecords(engagementRepository.opportunities);
  return (
    <>
      <RecordsFeedback loading={records === null} error={error} />
      {records && (
        <WorkspaceTable
          label="opportunities"
          columns={['Opportunity', 'Organiser', 'Category', 'Deadline', 'Applications', 'Action']}
          rows={records.map((item) => ({
            id: String(item.id),
            search: [item.title, item.organiser, item.category, publicStatus(item)].join(' '),
            cells: [
              item.title,
              item.organiser,
              item.category,
              deadline(item),
              <StatusIndicator status={publicStatus(item)} />,
              <Link to={opportunityPath(item.slug)}>View</Link>,
            ],
          }))}
        />
      )}
    </>
  );
}

function PublicOpportunityCatalogue() {
  const { records, error } = useWorkspaceRecords(engagementRepository.opportunities);
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const category = params.get('category') ?? '';
  const status = params.get('status') ?? 'Open';
  const update = (key: string, value: string) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: key === 'q' },
    );
  const matches = records?.filter(
    (item) =>
      (!category || item.category === category) &&
      (status === 'all' || publicStatus(item) === status) &&
      [item.title, item.organiser, item.category, item.description]
        .join(' ')
        .toLowerCase()
        .includes(q.trim().toLowerCase()),
  );
  return (
    <>
      <RecordsFeedback loading={records === null} error={error} />
      {records && (
        <div className="benefit-toolbar">
          <label>
            Search{' '}
            <input type="search" value={q} onChange={(event) => update('q', event.target.value)} />
          </label>
          <label>
            Category{' '}
            <select value={category} onChange={(event) => update('category', event.target.value)}>
              <option value="">All categories</option>
              {[...new Set(records.map((item) => item.category))].sort().map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          <label>
            Status{' '}
            <select value={status} onChange={(event) => update('status', event.target.value)}>
              <option value="all">All statuses</option>
              <option>Open</option>
              <option>Opening soon</option>
              <option>Closed</option>
            </select>
          </label>
          <button className="text-link" onClick={() => setParams({})}>
            Reset
          </button>
        </div>
      )}
      {matches && (
        <>
          <p className="result-count" role="status">
            {matches.length} {matches.length === 1 ? 'opportunity' : 'opportunities'}
          </p>
          {matches.length ? (
            <div className="benefit-grid">
              {matches.map((item) => {
                const path = opportunityPath(item.slug);
                return (
                  <article className="benefit-card" key={item.id}>
                    <Link to={path} tabIndex={-1} aria-hidden="true">
                      <SmartImage
                        src="/media/be-part-of-the-team-3382b8d1.webp"
                        alt=""
                        targetWidth={640}
                      />
                    </Link>
                    <div>
                      <div className="tag-list">
                        <span>{publicStatus(item)}</span>
                      </div>
                      <p className="eyebrow">
                        {item.organiser} · {item.category}
                      </p>
                      <h3>
                        <Link to={path}>{item.title}</Link>
                      </h3>
                      <p className="opportunity-summary">{item.description}</p>
                      <p className="opportunity-meta">Deadline: {deadline(item)}</p>
                      <Link className="text-link" to={path}>
                        View opportunity <ArrowUpRight size={15} aria-hidden="true" />
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <p className="empty-state">No opportunities match these filters.</p>
          )}
        </>
      )}
    </>
  );
}

function ApplyForOpportunity({ slug }: { slug: string }) {
  const { records, error } = useWorkspaceRecords(laravelWorkspace.ventures);
  const ventures = records?.filter((venture) => venture.status === 'approved');
  return (
    <>
      <RecordsFeedback loading={records === null} error={error} />
      {ventures &&
        (ventures.length ? (
          <WorkspaceAction
            action="Apply"
            submit="Submit application"
            save={async (form) => {
              const file = form.get('attachment');
              if (file instanceof File && file.size > 0) {
                const payload = new FormData();
                payload.append('venture_id', fieldValue(form, 'venture_id'));
                payload.append('motivation', fieldValue(form, 'motivation'));
                payload.append('attachment', file);
                await engagementRepository.apply(slug, payload);
                return;
              }
              await engagementRepository.apply(slug, {
                venture_id: fieldValue(form, 'venture_id'),
                motivation: fieldValue(form, 'motivation'),
              });
            }}
          >
            <label>
              Approved venture
              <select name="venture_id" required>
                {ventures.map((venture) => (
                  <option key={venture.id} value={venture.id}>
                    {venture.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Why are you applying?
              <textarea name="motivation" minLength={10} maxLength={5000} required />
            </label>
            <label>
              Pitch deck or supporting file (optional: PDF, Office, image, max 8 MB)
              <input
                name="attachment"
                type="file"
                accept=".pdf,.ppt,.pptx,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp"
              />
            </label>
          </WorkspaceAction>
        ) : (
          <Link to="/dashboard/workspace?tab=ventures">Submit a venture for approval</Link>
        ))}
      <p>
        <Link to="/dashboard/workspace?tab=opportunities&view=applications">
          Track applications
        </Link>
      </p>
    </>
  );
}

function OpportunityDetails({ slug }: { slug: string }) {
  const session = useLaravelSession();
  const load = useCallback(
    (signal: AbortSignal) => engagementRepository.opportunity(slug, signal),
    [slug],
  );
  const { records, error } = useWorkspaceRecords(load);
  return (
    <>
      <PageIntro
        eyebrow="Opportunities"
        title={records?.title ?? 'Opportunity'}
        description={records?.description ?? ''}
      />
      <section className="container section">
        <Link
          to={
            session?.profile?.role === 'entrepreneur'
              ? '/dashboard/workspace?tab=opportunities'
              : '/opportunities'
          }
        >
          All opportunities
        </Link>
        <RecordsFeedback loading={records === null} error={error} />
        {records && (
          <>
            <p>
              {records.organiser} · {records.category} · {publicStatus(records)}
            </p>
            <p>Deadline {deadline(records)}</p>
            {records.open &&
              (records.external_url ? (
                <a href={records.external_url} target="_blank" rel="noreferrer">
                  Apply on the organiser’s website
                </a>
              ) : session?.profile?.role === 'entrepreneur' ? (
                <ApplyForOpportunity slug={slug} />
              ) : (
                <Link to="/account">Sign in or apply for incubation to submit an application</Link>
              ))}
          </>
        )}
      </section>
    </>
  );
}

export function LaravelOpportunitiesPage() {
  const { slug } = useParams();
  return slug ? (
    <OpportunityDetails key={slug} slug={slug} />
  ) : (
    <>
      <PageIntro
        eyebrow="Benefits"
        title="Opportunities"
        description="Explore funding, training and market access opportunities for youth entrepreneurs."
      />
      <section className="container section">
        <PublicOpportunityCatalogue />
      </section>
    </>
  );
}

function OpportunityEditor({ item, reload }: { item?: OpportunityRecord; reload: () => void }) {
  return (
    <WorkspaceAction
      action={item ? 'Edit' : 'Add opportunity'}
      title={item?.title}
      create={!item}
      save={async (form) => {
        await engagementRepository.saveOpportunity(
          {
            title: fieldValue(form, 'title'),
            organiser: fieldValue(form, 'organiser'),
            category: fieldValue(form, 'category'),
            description: fieldValue(form, 'description'),
            opens_at: fieldValue(form, 'opens_at'),
            deadline: fieldValue(form, 'deadline'),
            external_url: fieldValue(form, 'external_url'),
            status: fieldValue(form, 'status'),
          },
          item?.id,
        );
        reload();
      }}
    >
      <label>
        Title
        <input name="title" defaultValue={item?.title} maxLength={140} required />
      </label>
      <label>
        Organiser
        <input name="organiser" defaultValue={item?.organiser} maxLength={140} required />
      </label>
      <label>
        Category
        <input name="category" defaultValue={item?.category} maxLength={80} required />
      </label>
      <label>
        Description
        <textarea name="description" defaultValue={item?.description} maxLength={5000} required />
      </label>
      <div className="workspace-form-grid">
        <label>
          Opens (EAT)
          <input name="opens_at" type="datetime-local" defaultValue={item?.opens_at ?? undefined} />
        </label>
        <label>
          Deadline (EAT)
          <input name="deadline" type="datetime-local" defaultValue={item?.deadline ?? undefined} />
        </label>
      </div>
      <label>
        External application URL (optional)
        <input
          name="external_url"
          type="url"
          defaultValue={item?.external_url ?? undefined}
          maxLength={500}
        />
      </label>
      <label>
        Publication
        <select name="status" defaultValue={item?.status ?? 'draft'}>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
          <option value="closed">Closed</option>
        </select>
      </label>
    </WorkspaceAction>
  );
}

function OpportunityRegistry() {
  const { records, error, reload } = useWorkspaceRecords(engagementRepository.manageOpportunities);
  return (
    <>
      <RecordsFeedback loading={records === null} error={error} />
      {records && (
        <WorkspaceTable
          label="managed opportunities"
          columns={['Opportunity', 'Organiser', 'Category', 'Deadline', 'Status', 'Action']}
          actions={<OpportunityEditor reload={reload} />}
          rows={records.map((item) => ({
            id: String(item.id),
            search: [item.title, item.organiser, item.category, item.status].join(' '),
            cells: [
              item.title,
              item.organiser,
              item.category,
              deadline(item),
              <StatusIndicator status={item.status} />,
              <OpportunityEditor item={item} reload={reload} />,
            ],
          }))}
        />
      )}
    </>
  );
}

function Applications({ admin }: { admin: boolean }) {
  const { records, error, reload } = useWorkspaceRecords(engagementRepository.applications);
  return (
    <>
      <RecordsFeedback loading={records === null} error={error} />
      {records && (
        <WorkspaceTable
          label="opportunity applications"
          columns={[
            'Opportunity',
            'Venture',
            ...(admin ? ['Applicant'] : []),
            'Application',
            'Decision',
            'Action',
          ]}
          rows={records.map((item) => {
            const actionable = ['submitted', 'shortlisted'].includes(item.status);
            return {
              id: String(item.id),
              search: [item.opportunity, item.applicant, item.venture, item.status].join(' '),
              cells: [
                item.opportunity,
                item.venture,
                ...(admin ? [item.applicant] : []),
                <>
                  <div>{item.motivation}</div>
                  {item.has_attachment && (
                    <p>
                      <a
                        className="workspace-attachment-link"
                        href={engagementRepository.applicationAttachmentUrl(item.id)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <Paperclip size={14} aria-hidden="true" />{' '}
                        {item.attachment_name || 'Download attached file'}
                      </a>
                    </p>
                  )}
                </>,
                <>
                  <StatusIndicator status={item.status} />
                  {item.review_notes && <div>{item.review_notes}</div>}
                </>,
                actionable && (
                  <WorkspaceAction
                    action={admin ? 'Review' : 'Withdraw'}
                    title={item.opportunity}
                    save={async (form) => {
                      await engagementRepository.decide(
                        item.id,
                        admin ? fieldValue(form, 'decision') : 'withdrawn',
                        fieldValue(form, 'note'),
                      );
                      reload();
                    }}
                  >
                    {admin ? (
                      <>
                        <label>
                          Decision
                          <select name="decision">
                            <option value="shortlisted">Shortlist</option>
                            <option value="accepted">Accept</option>
                            <option value="rejected">Reject</option>
                          </select>
                        </label>
                        <label>
                          Note (required to reject)
                          <textarea name="note" maxLength={1500} />
                        </label>
                      </>
                    ) : (
                      <p>Withdraw the application for {item.venture}?</p>
                    )}
                  </WorkspaceAction>
                ),
              ],
            };
          })}
        />
      )}
    </>
  );
}

export function OpportunityWorkspace({
  admin,
  canReviewSubmissions = admin,
}: {
  admin: boolean;
  canReviewSubmissions?: boolean;
}) {
  if (admin && !canReviewSubmissions) {
    return <OpportunityRegistry />;
  }
  return (
    <WorkspaceTabs
      label="Opportunity sections"
      views={[
        {
          id: 'directory',
          label: admin ? 'Manage opportunities' : 'Browse opportunities',
          content: admin ? <OpportunityRegistry /> : <OpportunityCatalogue />,
        },
        { id: 'applications', label: 'Applications', content: <Applications admin={admin} /> },
      ]}
    />
  );
}
