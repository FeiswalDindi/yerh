import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useDemo } from '../../app/useDemo';
import { useCatalog } from '../../app/useCatalog';
import { can, roleLabels, type Role } from '../../domain/roles';
import type { PlatformAction } from '../../domain/platform';
import { OpportunityForm, MilestoneEditor } from './WorkspaceEditors';
import { PageIntro } from '../../shared/PageIntro';
import { DemoNotice } from '../demo/DemoNotice';
import { usePageTitle } from '../../shared/usePageTitle';

const now = () => new Date().toISOString();
function Field({
  label,
  name,
  type = 'text',
  required = true,
  minLength = 2,
  defaultValue = '',
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  minLength?: number;
  defaultValue?: string;
}) {
  return (
    <label>
      {label}
      {type === 'textarea' ? (
        <textarea
          name={name}
          required={required}
          minLength={minLength}
          maxLength={3000}
          defaultValue={defaultValue}
        />
      ) : (
        <input
          name={name}
          type={type}
          required={required}
          minLength={type === 'text' ? minLength : undefined}
          defaultValue={defaultValue}
        />
      )}
    </label>
  );
}
function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="workspace-panel">
      <h2>{title}</h2>
      {children}
    </section>
  );
}
export function WorkspacePage() {
  const { state, account, execute } = useDemo();
  const { courses, media } = useCatalog();
  const [params, setParams] = useSearchParams();
  const [success, setSuccess] = useState('');
  usePageTitle('Platform workspace');
  if (!account) return null;
  const p = state.platform;
  const tabs: { id: string; label: string }[] = [];
  if (can(account, 'venture'))
    tabs.push(
      { id: 'ventures', label: 'My ventures' },
      { id: 'products', label: 'Products' },
      { id: 'incubation', label: 'Incubation' },
      { id: 'applications', label: 'My applications' },
    );
  if (can(account, 'mentor'))
    tabs.push(
      { id: 'mentor', label: 'Mentor profile' },
      { id: 'mentees', label: 'Mentees & milestones' },
    );
  if (can(account, 'organisation'))
    tabs.push(
      { id: 'organisation', label: 'Organisation' },
      { id: 'opportunities', label: 'My opportunities' },
      { id: 'applicants', label: 'Applicants' },
      { id: 'discovery', label: 'Venture discovery' },
    );
  if (can(account, 'admin'))
    tabs.push(
      { id: 'approvals', label: 'Approval queue' },
      { id: 'users', label: 'Users & roles' },
      { id: 'certificates', label: 'Certificates' },
      { id: 'reports', label: 'Analytics & reports' },
    );
  const tab = tabs.some((t) => t.id === params.get('tab')) ? params.get('tab')! : tabs[0]?.id;
  const myVentures = p.ventures.filter((v) => v.ownerId === account.id);
  const org = p.organisations.find((o) => o.accountId === account.id);
  const mentor = p.mentors.find((m) => m.accountId === account.id);
  function run(action: PlatformAction) {
    const ok = execute(action);
    if (ok) setSuccess('Saved successfully.');
    return ok;
  }
  function form(event: FormEvent<HTMLFormElement>, build: (data: FormData) => PlatformAction) {
    event.preventDefault();
    const node = event.currentTarget;
    if (run(build(new FormData(node)))) node.reset();
  }
  const selectVenture = (
    <label>
      Venture
      <select name="ventureId" required>
        {myVentures
          .filter((v) => v.status === 'approved')
          .map((v) => (
            <option value={v.id} key={v.id}>
              {v.name}
            </option>
          ))}
      </select>
    </label>
  );
  const name = (id: string) =>
    state.accounts.find((a) => a.id === id)?.name ?? 'Member unavailable';
  return (
    <>
      <PageIntro
        eyebrow={roleLabels[account.role]}
        title="Your work, connected."
        description="Manage your approved role’s workflows, review statuses and keep your next steps moving."
      />
      <section className="container section">
        <DemoNotice />
        <div className="platform-workspace">
          <nav className="workspace-sidebar" aria-label="Workspace modules">
            <Link to="/dashboard">Overview</Link>
            {tabs.map((t) => (
              <button
                className={tab === t.id ? 'active' : ''}
                key={t.id}
                onClick={() => {
                  setSuccess('');
                  setParams({ tab: t.id });
                }}
              >
                {t.label}
              </button>
            ))}
            {can(account, 'cms') && <Link to="/dashboard/cms">Content management</Link>}
            <Link to="/dashboard/mentorship">Mentorship requests</Link>
            <Link to="/apply">Role applications</Link>
          </nav>
          <div className="workspace-main">
            {success && (
              <p className="form-success" role="status">
                {success}
              </p>
            )}
            {tab === 'ventures' && (
              <Panel title="My ventures">
                <form
                  className="workspace-form"
                  onSubmit={(e) =>
                    form(e, (f) => ({
                      type: 'venture-save',
                      now: now(),
                      venture: {
                        id: crypto.randomUUID(),
                        ownerId: account.id,
                        name: String(f.get('name')),
                        description: String(f.get('description')),
                        sector: String(f.get('sector')),
                        stage: String(f.get('stage')),
                        location: String(f.get('location')),
                        status: 'pending',
                      },
                    }))
                  }
                >
                  <Field label="Venture name" name="name" minLength={3} />
                  <Field
                    label="What problem do you solve?"
                    name="description"
                    type="textarea"
                    minLength={30}
                  />
                  <div className="form-field-grid">
                    <Field label="Sector" name="sector" />
                    <Field label="Stage" name="stage" />
                    <Field label="Location" name="location" />
                  </div>
                  <button className="button">Submit venture for approval</button>
                </form>
                {myVentures.map((v) => (
                  <article className="workspace-record" key={v.id}>
                    <h3>{v.name}</h3>
                    <span className={`status-pill ${v.status}`}>{v.status}</span>
                    <p>{v.description}</p>
                    <details>
                      <summary>Edit & resubmit</summary>
                      <p>Changes require approval again before the venture appears publicly.</p>
                      <form
                        className="workspace-form"
                        onSubmit={(e) =>
                          form(e, (f) => ({
                            type: 'venture-save',
                            now: now(),
                            venture: {
                              ...v,
                              name: String(f.get('name')),
                              description: String(f.get('description')),
                              sector: String(f.get('sector')),
                              stage: String(f.get('stage')),
                              location: String(f.get('location')),
                            },
                          }))
                        }
                      >
                        <Field
                          label="Venture name"
                          name="name"
                          minLength={3}
                          defaultValue={v.name}
                        />
                        <Field
                          label="Description"
                          name="description"
                          type="textarea"
                          minLength={30}
                          defaultValue={v.description}
                        />
                        <Field label="Sector" name="sector" defaultValue={v.sector} />
                        <Field label="Stage" name="stage" defaultValue={v.stage} />
                        <Field label="Location" name="location" defaultValue={v.location} />
                        <button className="button button-outline">Resubmit venture</button>
                      </form>
                    </details>
                  </article>
                ))}
              </Panel>
            )}
            {tab === 'products' && (
              <Panel title="Products & services">
                {myVentures.some((v) => v.status === 'approved') ? (
                  <form
                    className="workspace-form"
                    onSubmit={(e) =>
                      form(e, (f) => ({
                        type: 'product-save',
                        now: now(),
                        product: {
                          id: crypto.randomUUID(),
                          ventureId: String(f.get('ventureId')),
                          ownerId: account.id,
                          name: String(f.get('name')),
                          description: String(f.get('description')),
                          price: Number(f.get('price')),
                          status: 'pending',
                        },
                      }))
                    }
                  >
                    {selectVenture}
                    <Field label="Product / service name" name="name" minLength={3} />
                    <Field label="Description" name="description" type="textarea" minLength={20} />
                    <Field label="Price (KES)" name="price" type="number" />
                    <button className="button">Submit product for approval</button>
                  </form>
                ) : (
                  <p>Create an approved venture before listing products.</p>
                )}
                {p.products
                  .filter((v) => v.ownerId === account.id)
                  .map((v) => (
                    <article className="workspace-record" key={v.id}>
                      <h3>{v.name}</h3>
                      <p>
                        KES {v.price.toLocaleString()} · {v.status}
                      </p>
                      <details>
                        <summary>Edit & resubmit</summary>
                        <form
                          className="workspace-form"
                          onSubmit={(e) =>
                            form(e, (f) => ({
                              type: 'product-save',
                              now: now(),
                              product: {
                                ...v,
                                name: String(f.get('name')),
                                description: String(f.get('description')),
                                price: Number(f.get('price')),
                              },
                            }))
                          }
                        >
                          <Field
                            label="Product name"
                            name="name"
                            minLength={3}
                            defaultValue={v.name}
                          />
                          <Field
                            label="Description"
                            name="description"
                            type="textarea"
                            minLength={20}
                            defaultValue={v.description}
                          />
                          <Field
                            label="Price (KES)"
                            name="price"
                            type="number"
                            defaultValue={String(v.price)}
                          />
                          <button className="button button-outline">Resubmit product</button>
                        </form>
                      </details>
                    </article>
                  ))}
              </Panel>
            )}
            {tab === 'incubation' && (
              <Panel title="Incubation applications">
                <form
                  className="workspace-form"
                  onSubmit={(e) =>
                    form(e, (f) => ({
                      type: 'incubation-apply',
                      id: crypto.randomUUID(),
                      ventureId: String(f.get('ventureId')),
                      goal: String(f.get('goal')),
                      now: now(),
                    }))
                  }
                >
                  {selectVenture}
                  <Field label="Your incubation goals" name="goal" type="textarea" minLength={30} />
                  <button
                    className="button"
                    disabled={!myVentures.some((v) => v.status === 'approved')}
                  >
                    Apply for incubation
                  </button>
                </form>
                {p.incubations
                  .filter((i) => i.ownerId === account.id)
                  .map((i) => (
                    <article className="workspace-record" key={i.id}>
                      <h3>{p.ventures.find((v) => v.id === i.ventureId)?.name}</h3>
                      <p>
                        {i.status} ·{' '}
                        {i.mentorId
                          ? `Mentor: ${name(i.mentorId)}`
                          : 'Awaiting administrator review'}
                      </p>
                      <p>{i.goal}</p>
                      {i.milestones.map((m) => (
                        <p key={m.id}>
                          <strong>{m.title}</strong> · {m.validated ? 'Validated' : 'In progress'}
                          <br />
                          {m.note}
                        </p>
                      ))}
                    </article>
                  ))}
              </Panel>
            )}
            {tab === 'applications' && (
              <Panel title="My opportunity applications">
                {p.opportunityApplications
                  .filter((a) => a.accountId === account.id)
                  .map((a) => (
                    <article className="workspace-record" key={a.id}>
                      <h3>{p.opportunities.find((o) => o.id === a.opportunityId)?.title}</h3>
                      <p>{a.status}</p>
                      <p>{a.motivation}</p>
                    </article>
                  ))}
                <Link className="button" to="/opportunities">
                  Find opportunities
                </Link>
              </Panel>
            )}
            {tab === 'mentor' && (
              <Panel title="Mentor profile & availability">
                <form
                  className="workspace-form"
                  onSubmit={(e) =>
                    form(e, (f) => ({
                      type: 'mentor-profile',
                      now: now(),
                      profile: {
                        accountId: account.id,
                        expertise: String(f.get('expertise')),
                        availability: String(f.get('availability')),
                        bio: String(f.get('bio')),
                      },
                    }))
                  }
                >
                  <Field
                    label="Expertise"
                    name="expertise"
                    minLength={5}
                    defaultValue={mentor?.expertise}
                  />
                  <Field
                    label="Availability (include timezone)"
                    name="availability"
                    minLength={5}
                    defaultValue={mentor?.availability}
                  />
                  <Field
                    label="Mentor biography"
                    name="bio"
                    type="textarea"
                    minLength={20}
                    defaultValue={mentor?.bio}
                  />
                  <button className="button">Save mentor profile</button>
                </form>
                <Link to="/dashboard/mentorship">Review mentorship requests →</Link>
              </Panel>
            )}
            {tab === 'mentees' && (
              <Panel title="Assigned incubation milestones">
                {p.incubations
                  .filter(
                    (i) =>
                      (i.mentorId === account.id || can(account, 'admin')) && i.status === 'active',
                  )
                  .map((i) => (
                    <article className="workspace-record" key={i.id}>
                      <h3>
                        {p.ventures.find((v) => v.id === i.ventureId)?.name} · {name(i.ownerId)}
                      </h3>
                      <p>{i.goal}</p>
                      {i.milestones.map((m) => (
                        <MilestoneEditor
                          key={m.id}
                          incubationId={i.id}
                          milestone={m}
                          onSave={run}
                        />
                      ))}
                      <form
                        className="workspace-form"
                        onSubmit={(e) =>
                          form(e, (f) => ({
                            type: 'milestone',
                            id: i.id,
                            milestoneId: crypto.randomUUID(),
                            title: String(f.get('title')),
                            note: String(f.get('note')),
                            validated: f.get('validated') === 'on',
                            now: now(),
                          }))
                        }
                      >
                        <Field label="Milestone title" name="title" minLength={3} />
                        <Field
                          label="Guidance / progress notes"
                          name="note"
                          type="textarea"
                          minLength={10}
                        />
                        <label className="inline-checkbox">
                          <input type="checkbox" name="validated" />
                          Validate this milestone
                        </label>
                        <button className="button">Save milestone</button>
                      </form>
                    </article>
                  ))}
                {!p.incubations.some((i) => i.mentorId === account.id) && (
                  <p>No active incubation has been assigned to you yet.</p>
                )}
              </Panel>
            )}
            {tab === 'organisation' && (
              <Panel title={`${roleLabels[account.role]} organisation profile`}>
                <p>Profile approval is required before opportunities can be submitted.</p>
                {org && <p className="status-pill">{org.status}</p>}
                <form
                  className="workspace-form"
                  onSubmit={(e) =>
                    form(e, (f) => ({
                      type: 'organisation-save',
                      now: now(),
                      organisation: {
                        accountId: account.id,
                        name: String(f.get('name')),
                        type: String(f.get('type')),
                        sectors: String(f.get('sectors')),
                        contact: String(f.get('contact')),
                        website: String(f.get('website')),
                        status: 'pending',
                      },
                    }))
                  }
                >
                  <Field
                    label="Organisation name"
                    name="name"
                    minLength={3}
                    defaultValue={org?.name}
                  />
                  <Field label="Organisation type" name="type" defaultValue={org?.type} />
                  <Field label="Sectors supported" name="sectors" defaultValue={org?.sectors} />
                  <Field label="Primary contact" name="contact" defaultValue={org?.contact} />
                  <Field
                    label="Website (HTTPS)"
                    name="website"
                    type="url"
                    required={false}
                    defaultValue={org?.website}
                  />
                  <button className="button">Submit profile for approval</button>
                </form>
              </Panel>
            )}
            {tab === 'opportunities' && (
              <Panel title="My opportunities">
                <details>
                  <summary>Create an opportunity</summary>
                  <OpportunityForm
                    ownerId={account.id}
                    organiser={org?.name ?? account.name}
                    image={media.business}
                    onSave={run}
                  />
                </details>
                {p.opportunities
                  .filter((o) => o.ownerId === account.id)
                  .map((o) => (
                    <article className="workspace-record" key={o.id}>
                      <h3>{o.title}</h3>
                      <p>{o.status}</p>
                      {o.status !== 'archived' && (
                        <details>
                          <summary>Edit opportunity</summary>
                          <p>
                            Saving an edit returns this listing to draft. Submit it for review to
                            publish the new version.
                          </p>
                          <OpportunityForm
                            opportunity={o}
                            ownerId={account.id}
                            organiser={org?.name ?? account.name}
                            image={media.business}
                            onSave={run}
                          />
                        </details>
                      )}
                      {o.status === 'draft' && (
                        <button
                          className="button"
                          onClick={() =>
                            run({
                              type: 'opportunity-status',
                              id: o.id,
                              status: 'review',
                              now: now(),
                            })
                          }
                        >
                          Submit for review
                        </button>
                      )}
                      {['published', 'closed'].includes(o.status) && (
                        <Link to={`/opportunities/${o.slug}`}>View public listing →</Link>
                      )}
                    </article>
                  ))}
              </Panel>
            )}
            {tab === 'applicants' && (
              <Panel title="Opportunity applicants">
                {p.opportunityApplications
                  .filter((a) =>
                    p.opportunities.some(
                      (o) =>
                        o.id === a.opportunityId &&
                        (o.ownerId === account.id || can(account, 'admin')),
                    ),
                  )
                  .map((a) => (
                    <article className="workspace-record" key={a.id}>
                      <h3>{name(a.accountId)}</h3>
                      <p>
                        {p.opportunities.find((o) => o.id === a.opportunityId)?.title} · {a.status}
                      </p>
                      <p>{a.motivation}</p>
                      {['submitted', 'shortlisted'].includes(a.status) && (
                        <div className="form-actions">
                          {(['shortlisted', 'accepted', 'rejected'] as const).map((status) => (
                            <button
                              className="button button-outline"
                              key={status}
                              onClick={() =>
                                run({ type: 'opportunity-review', id: a.id, status, now: now() })
                              }
                            >
                              {status}
                            </button>
                          ))}
                        </div>
                      )}
                    </article>
                  ))}
              </Panel>
            )}
            {tab === 'discovery' && (
              <Panel title="Discover youth-led ventures">
                <div className="platform-table-wrap">
                  <table className="platform-table">
                    <thead>
                      <tr>
                        <th>Venture</th>
                        <th>Sector</th>
                        <th>Stage</th>
                        <th>Location</th>
                      </tr>
                    </thead>
                    <tbody>
                      {p.ventures
                        .filter((v) => v.status === 'approved')
                        .map((v) => (
                          <tr key={v.id}>
                            <td>
                              <strong>{v.name}</strong>
                              <p>{v.description}</p>
                            </td>
                            <td>{v.sector}</td>
                            <td>{v.stage}</td>
                            <td>{v.location}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </Panel>
            )}
            {tab === 'approvals' && (
              <Panel title="Approval queue">
                <h3>Role applications</h3>
                {p.applications
                  .filter((a) => a.status === 'pending')
                  .map((a) => (
                    <article className="workspace-record" key={a.id}>
                      <h3>
                        {name(a.accountId)} · {roleLabels[a.role]}
                      </h3>
                      <p>{a.motivation}</p>
                      <p>
                        {a.organisation} {a.expertise}
                      </p>
                      <form
                        className="workspace-form"
                        onSubmit={(e) =>
                          form(e, (f) => ({
                            type: 'role-review',
                            id: a.id,
                            decision: String(f.get('decision')) as 'approved' | 'rejected',
                            reason: String(f.get('reason')),
                            now: now(),
                          }))
                        }
                      >
                        <label>
                          Decision
                          <select name="decision">
                            <option value="approved">Approve</option>
                            <option value="rejected">Reject</option>
                          </select>
                        </label>
                        <Field
                          label="Decision reason / feedback"
                          name="reason"
                          type="textarea"
                          minLength={10}
                        />
                        <button className="button">Save decision</button>
                      </form>
                    </article>
                  ))}
                <h3>Ventures, products & organisations</h3>
                {[
                  ...p.ventures
                    .filter((v) => v.status === 'pending')
                    .map((v) => ({
                      id: v.id,
                      name: v.name,
                      detail: `${v.description} · ${v.sector} · ${v.stage} · ${v.location}`,
                      ownerId: v.ownerId,
                      entity: 'venture' as const,
                    })),
                  ...p.products
                    .filter((v) => v.status === 'pending')
                    .map((v) => ({
                      id: v.id,
                      name: v.name,
                      detail: `${v.description} · KES ${v.price}`,
                      ownerId: v.ownerId,
                      entity: 'product' as const,
                    })),
                  ...p.organisations
                    .filter((v) => v.status === 'pending')
                    .map((v) => ({
                      id: v.accountId,
                      name: v.name,
                      detail: `${v.type} · ${v.sectors} · ${v.contact} · ${v.website}`,
                      ownerId: v.accountId,
                      entity: 'organisation' as const,
                    })),
                ].map((v) => (
                  <article className="workspace-record" key={v.id}>
                    <h3>{v.name}</h3>
                    <p>
                      {v.entity} · {name(v.ownerId)}
                    </p>
                    <p>{v.detail}</p>
                    <div className="form-actions">
                      {(['approved', 'rejected'] as const).map((decision) => (
                        <button
                          className="button button-outline"
                          key={decision}
                          onClick={() =>
                            run({
                              type: 'venture-review',
                              id: v.id,
                              entity: v.entity,
                              decision,
                              now: now(),
                            })
                          }
                        >
                          {decision}
                        </button>
                      ))}
                    </div>
                  </article>
                ))}
                <h3>Active incubations</h3>
                {p.incubations
                  .filter((i) => i.status === 'active')
                  .map((i) => (
                    <article className="workspace-record" key={i.id}>
                      <h3>{p.ventures.find((v) => v.id === i.ventureId)?.name}</h3>
                      <p>
                        {name(i.ownerId)} · Mentor: {name(i.mentorId)}
                      </p>
                      <p>
                        {i.milestones.filter((m) => m.validated).length} / {i.milestones.length}{' '}
                        milestones validated
                      </p>
                      <Link to="/dashboard/workspace?tab=mentees">Review milestone notes →</Link>
                      <button
                        className="button button-outline"
                        disabled={!i.milestones.length || i.milestones.some((m) => !m.validated)}
                        onClick={() => run({ type: 'incubation-complete', id: i.id, now: now() })}
                      >
                        Graduate incubation
                      </button>
                    </article>
                  ))}
                <h3>Incubation applications</h3>
                {p.incubations
                  .filter((i) => i.status === 'pending')
                  .map((i) => (
                    <form
                      className="workspace-form"
                      key={i.id}
                      onSubmit={(e) =>
                        form(e, (f) => ({
                          type: 'incubation-assign',
                          id: i.id,
                          mentorId: String(f.get('mentor')),
                          decision: String(f.get('decision')) as 'active' | 'rejected',
                          now: now(),
                        }))
                      }
                    >
                      <h3>{name(i.ownerId)}</h3>
                      <p>{i.goal}</p>
                      <label>
                        Mentor
                        <select name="mentor">
                          {state.accounts
                            .filter((a) => a.role === 'mentor' && !a.suspended)
                            .map((a) => (
                              <option value={a.id} key={a.id}>
                                {a.name}
                              </option>
                            ))}
                        </select>
                      </label>
                      <label>
                        Decision
                        <select name="decision">
                          <option value="active">Accept & assign</option>
                          <option value="rejected">Reject</option>
                        </select>
                      </label>
                      <button className="button">Save incubation decision</button>
                    </form>
                  ))}
              </Panel>
            )}
            {tab === 'users' && (
              <Panel title="Users & access">
                <div className="platform-table-wrap">
                  <table className="platform-table">
                    <thead>
                      <tr>
                        <th>Member</th>
                        <th>Role</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {state.accounts.map((a) => (
                        <tr key={a.id}>
                          <td>
                            {a.name}
                            <small>{a.email}</small>
                          </td>
                          <td>
                            <select
                              aria-label={`Role for ${a.name}`}
                              disabled={a.id === account.id}
                              value={a.role}
                              onChange={(e) =>
                                run({
                                  type: 'account-admin',
                                  accountId: a.id,
                                  role: e.target.value as Role,
                                  now: now(),
                                })
                              }
                            >
                              {Object.entries(roleLabels).map(([id, label]) => (
                                <option value={id} key={id}>
                                  {label}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>{a.suspended ? 'Suspended' : 'Active'}</td>
                          <td>
                            <button
                              className="text-link"
                              disabled={a.id === account.id}
                              onClick={() =>
                                run({
                                  type: 'account-admin',
                                  accountId: a.id,
                                  suspended: !a.suspended,
                                  now: now(),
                                })
                              }
                            >
                              {a.suspended ? 'Restore' : 'Suspend'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Panel>
            )}
            {tab === 'certificates' && (
              <Panel title="Certificates">
                <form
                  className="workspace-form"
                  onSubmit={(e) =>
                    form(e, (f) => ({
                      type: 'certificate-issue',
                      id: crypto.randomUUID(),
                      accountId: String(f.get('account')),
                      courseId: String(f.get('course')),
                      now: now(),
                    }))
                  }
                >
                  <label>
                    Learner
                    <select name="account">
                      {state.accounts.map((a) => (
                        <option value={a.id} key={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Course
                    <select name="course">
                      {courses.map((c) => (
                        <option value={c.id} key={c.id}>
                          {c.title}
                        </option>
                      ))}
                    </select>
                  </label>
                  <p>
                    All lessons must be completed. This issues a local demo record, not an academic
                    qualification.
                  </p>
                  <button className="button">Issue completion record</button>
                </form>
                {p.certificates.map((c) => (
                  <p key={c.id}>
                    {name(c.accountId)} ·{' '}
                    {courses.find((course) => course.id === c.courseId)?.title} ·{' '}
                    <Link to={`/certificates/${c.id}`}>View verification record</Link>
                  </p>
                ))}
              </Panel>
            )}
            {tab === 'reports' && (
              <Panel title="Analytics, reporting & audit">
                <div className="workspace-stats">
                  {[
                    ['Accounts', state.accounts.length],
                    ['Pending roles', p.applications.filter((a) => a.status === 'pending').length],
                    ['Approved ventures', p.ventures.filter((v) => v.status === 'approved').length],
                    [
                      'Reservations',
                      state.registrations.filter((r) => r.status === 'registered').length,
                    ],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <strong>{value}</strong>
                      <span>{label}</span>
                    </div>
                  ))}
                </div>
                <p>Counts are derived from current local records.</p>
                <button
                  className="button button-outline"
                  onClick={() => {
                    const rows = [
                      ['Actor', 'Action', 'Target', 'Time'],
                      ...p.audit.map((a) => [name(a.actorId), a.action, a.targetId, a.createdAt]),
                    ];
                    const csv = rows
                      .map((r) =>
                        r
                          .map(
                            (s) =>
                              '"' +
                              (/^[=+@\-\t\r]/.test(String(s)) ? "'" : '') +
                              String(s).replaceAll('"', '""') +
                              '"',
                          )
                          .join(','),
                      )
                      .join('\r\n');
                    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
                    const node = document.createElement('a');
                    node.href = url;
                    node.download = 'yerh-audit.csv';
                    node.click();
                    setTimeout(() => URL.revokeObjectURL(url), 1000);
                  }}
                >
                  Export audit CSV
                </button>
                <div className="platform-table-wrap">
                  <table className="platform-table">
                    <thead>
                      <tr>
                        <th>Actor</th>
                        <th>Action</th>
                        <th>Target</th>
                        <th>Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {p.audit.slice(0, 100).map((a) => (
                        <tr key={a.id}>
                          <td>{name(a.actorId)}</td>
                          <td>{a.action}</td>
                          <td>{a.targetId}</td>
                          <td>{new Date(a.createdAt).toLocaleString('en-KE')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Panel>
            )}
            {!tab && (
              <Panel title="Choose your pathway">
                <p>Your account is ready. Apply for an approved role to unlock a workspace.</p>
                <Link className="button" to="/apply">
                  Apply for a role
                </Link>
              </Panel>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
