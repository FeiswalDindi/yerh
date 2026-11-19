import { lazy, useEffect, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useDemo } from '../../app/useDemo';
import { useCatalog } from '../../app/useCatalog';
import { can, roleLabels, type Role } from '../../domain/roles';
import type { Opportunity, PlatformAction } from '../../domain/platform';
import { OpportunityForm } from './WorkspaceEditors';
import { PageIntro } from '../../shared/PageIntro';
import { DemoNotice } from '../demo/DemoNotice';
import { usePageTitle } from '../../shared/usePageTitle';
import {
  activeWorkspaceModule,
  institutionHref,
  institutionModule,
  workspaceHref,
} from '../dashboard/dashboard-navigation';
import { canPublishProduct, institutionAccess } from '../../domain/incubation';
import { amount, field } from './TrainingForms';
import { MentorWorkspace } from './MentorWorkspace';
import {
  WorkspaceDialog,
  WorkspaceFormDialog,
  WorkspaceStatus,
  WorkspaceTable,
} from './WorkspaceControls';
import { ApprovalWorkspace } from './ApprovalWorkspace';
import { IncubationWorkspace, UniversitySelection } from './IncubationWorkspace';
import { InstitutionPortal, InstitutionsAdmin } from './InstitutionWorkspace';
import { InstitutionResults } from './InstitutionResults';
import { TrainingCertificates, TrainingPayments } from './TrainingReview';
import { AdminVentures } from './AdminVentures';

const VentureRegistry = lazy(() => import('./VentureWorkspace'));
const ProductRegistry = lazy(() => import('./ProductWorkspace'));
const AdminCourseWorkspace = lazy(() =>
  import('./CourseWorkspace').then(({ AdminCourseWorkspace }) => ({
    default: AdminCourseWorkspace,
  })),
);
const MentorCourseWorkspace = lazy(() =>
  import('./CourseWorkspace').then(({ MentorCourseWorkspace }) => ({
    default: MentorCourseWorkspace,
  })),
);

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
function Panel({
  title,
  children,
  showTitle = false,
}: {
  title: string;
  children: ReactNode;
  showTitle?: boolean;
}) {
  return (
    <section className="workspace-panel">
      <h2 className={showTitle ? undefined : 'workspace-panel-title'}>{title}</h2>
      {children}
    </section>
  );
}
export function WorkspacePage() {
  const { state, account, execute } = useDemo();
  const { courses, media } = useCatalog();
  const [params] = useSearchParams();
  const [success, setSuccess] = useState('');
  const p = state.platform;
  const contextId = params.get('institution');
  const school = p.training.institutions.find((entry) =>
    contextId ? entry.id === contextId : entry.adminId === account?.id,
  );
  const access = school && account ? institutionAccess(school, account) : null;
  const activeModule = account
    ? contextId
      ? access
        ? institutionModule(params.get('tab'), access === 'manage')
        : undefined
      : activeWorkspaceModule(account, params.get('tab'))
    : undefined;
  const tab = activeModule?.id;
  useEffect(() => setSuccess(''), [tab, account?.id, contextId]);
  usePageTitle(activeModule?.label ?? 'Workspace');
  if (!account) return null;
  const schoolStaff = contextId ? access === 'manage' : can(account, 'school');
  const workspaceAccount =
    contextId && school && schoolStaff
      ? { ...account, id: school.adminId, role: 'school_admin' as const }
      : account;
  const schoolLink = (tab: string) =>
    contextId ? institutionHref(tab, contextId) : workspaceHref(tab);
  const schoolLocked =
    schoolStaff &&
    (school?.status !== 'active' || school.kind !== 'high-school') &&
    tab !== 'school' &&
    tab !== 'member-results';
  const org = p.organisations.find((o) => o.accountId === account.id);
  const mentor = p.mentors.find((m) => m.accountId === account.id);
  const displayedApplication = p.opportunityApplications.find(
    (application) =>
      application.id === params.get('application') &&
      (tab === 'applications'
        ? application.accountId === account.id
        : tab === 'applicants' &&
          p.opportunities.some(
            (opportunity) =>
              opportunity.id === application.opportunityId && opportunity.ownerId === account.id,
          )),
  );
  function run(action: PlatformAction) {
    const ok = execute(contextId ? { ...action, institutionContextId: contextId } : action);
    if (ok) {
      const messages: Record<string, string> = {
        'institution-contributions': 'Team contributions saved.',
        'institution-certificates-request':
          'Certificate requests sent to the platform administrator.',
        'product-save': schoolStaff
          ? 'Product saved.'
          : 'Product submitted. A platform administrator can review it under Approval queue → Product listings.',
        'incubation-apply': schoolStaff
          ? 'Pathway submitted to the platform team.'
          : 'Venture submitted. A platform administrator can assign a mentor under Approval queue → Incubation applications.',
        'product-evidence':
          'Product evidence submitted. The mentor or platform administrator can review it under Product evidence reviews.',
      };
      setSuccess(messages[action.type] ?? 'Saved successfully.');
    }
    return ok;
  }
  const opportunityEditor = (opportunity?: Opportunity) => (
    <WorkspaceDialog
      action={opportunity ? 'Edit opportunity' : 'Add opportunity'}
      title={opportunity?.title}
      create={!opportunity}
    >
      {(finish) => (
        <OpportunityForm
          opportunity={opportunity}
          ownerId={account.id}
          organiser={org?.name ?? account.name}
          image={media.business}
          onSave={(action) => {
            const saved = run(action);
            finish(saved);
            return saved;
          }}
        />
      )}
    </WorkspaceDialog>
  );
  const name = (id: string) =>
    state.accounts.find((a) => a.id === id)?.name ?? 'Member unavailable';
  const compact = can(account, 'admin') || schoolStaff || !!contextId;
  return (
    <>
      {!compact && (
        <PageIntro
          className="workspace-page-intro"
          eyebrow={activeModule?.label ?? 'Workspace'}
          title={activeModule?.label ?? 'Workspace'}
          description={activeModule?.description ?? 'Choose an available tool from your dashboard.'}
        />
      )}
      <section className="container section workspace-content">
        {compact && <h1 className="sr-only">{activeModule?.label ?? 'Workspace'}</h1>}
        <DemoNotice />
        <div className="workspace-main">
          {success && (
            <p className="form-success" role="status">
              {success}
            </p>
          )}
          {schoolLocked && (
            <p>
              Contact the platform team for access to group venture tools.{' '}
              <Link to={schoolLink('school')}>Open institution portal</Link>
            </p>
          )}
          {tab === 'school' && (
            <Panel title="Institution portal">
              <InstitutionPortal
                p={p}
                account={workspaceAccount}
                accounts={state.accounts}
                save={run}
                portalHref={schoolLink}
              />
            </Panel>
          )}
          {tab === 'member-results' && (
            <Panel title="Results & Certificates">
              {school?.status === 'active' && access ? (
                <InstitutionResults
                  p={p}
                  school={school}
                  accounts={state.accounts}
                  save={run}
                  readonly={access === 'view'}
                  incubationHref={schoolLink('incubation')}
                />
              ) : (
                <p>Contact the platform team for access to results and certificates.</p>
              )}
            </Panel>
          )}
          {tab === 'institutions' && (
            <Panel title="Institution directory">
              <InstitutionsAdmin p={p} accounts={state.accounts} save={run} operator={account} />
            </Panel>
          )}
          {tab === 'admin-courses' && (
            <Panel title="Course administration">
              <AdminCourseWorkspace p={p} courses={courses} save={run} name={name} />
            </Panel>
          )}
          {tab === 'course-proposals' && (
            <Panel title="Course proposals">
              <MentorCourseWorkspace p={p} mentorId={account.id} save={run} />
            </Panel>
          )}
          {tab === 'payments' && (
            <Panel title="Payments">
              <TrainingPayments p={p} save={run} name={name} />
            </Panel>
          )}
          {tab === 'manage-ventures' && <AdminVentures p={p} save={run} name={name} />}
          {tab === 'manage-products' &&
            (() => {
              const rows = p.products.filter((product) =>
                p.ventures.some((venture) => venture.id === product.ventureId && !venture.groupId),
              );
              return (
                <WorkspaceTable
                  label="marketplace products"
                  columns={['Name', 'Owner', 'Status', 'Marketplace', 'Action']}
                  rows={rows.map((row) => {
                    const owner = name(row.ownerId);
                    return {
                      id: row.id,
                      search: [
                        row.name,
                        owner,
                        row.status,
                        p.ventures.find((venture) => venture.id === row.ventureId)?.name,
                      ].join(' '),
                      cells: [
                        row.name,
                        owner,
                        <WorkspaceStatus>{row.status}</WorkspaceStatus>,
                        canPublishProduct(p, row) ? 'Live' : 'Private',
                        <WorkspaceFormDialog
                          action="Review record"
                          title={row.name}
                          submit="Save status"
                          onSave={(data) =>
                            run({
                              type: 'venture-review',
                              id: row.id,
                              entity: 'product',
                              decision: field(data, 'status') as typeof row.status,
                              now: now(),
                            })
                          }
                        >
                          <p className="workspace-detail-copy">{row.description}</p>
                          {'price' in row && (
                            <p>
                              {p.ventures.find((venture) => venture.id === row.ventureId)?.name} ·{' '}
                              {amount(row.price)}
                            </p>
                          )}
                          <label>
                            Status
                            <select name="status" defaultValue={row.status}>
                              <option value="pending">Pending review</option>
                              <option value="approved">Approved</option>
                              <option value="rejected">Rejected</option>
                            </select>
                          </label>
                        </WorkspaceFormDialog>,
                      ],
                    };
                  })}
                />
              );
            })()}
          {tab === 'ventures' && !schoolLocked && (
            <Panel title="Ventures">
              <VentureRegistry
                p={p}
                account={workspaceAccount}
                save={run}
                portalHref={schoolLink}
              />
            </Panel>
          )}
          {tab === 'products' && !schoolLocked && (
            <Panel title="Products & services">
              <ProductRegistry
                p={p}
                account={workspaceAccount}
                save={run}
                portalHref={schoolLink}
              />
            </Panel>
          )}
          {tab === 'incubation' && !schoolLocked && (
            <Panel title="Venture incubation">
              {schoolStaff && (
                <p>
                  <Link to={schoolLink('member-results')}>View results and certificates</Link>
                </p>
              )}
              {can(workspaceAccount, 'learn') && (
                <UniversitySelection p={p} account={account} save={run} modal />
              )}
              <IncubationWorkspace
                key={contextId ?? account.id}
                p={p}
                account={workspaceAccount}
                save={run}
                accountName={name}
                selectedVenture={params.get('venture')}
                portalHref={schoolLink}
              />
            </Panel>
          )}
          {tab === 'applications' && (
            <Panel title="Opportunity applications">
              {displayedApplication ? (
                <section className="workspace-record">
                  <Link to={workspaceHref('applications')}>← Opportunity applications</Link>
                  <h3>
                    {p.opportunities.find(
                      (entry) => entry.id === displayedApplication.opportunityId,
                    )?.title ?? 'Opportunity'}
                  </h3>
                  <p className="workspace-detail-copy">{displayedApplication.motivation}</p>
                </section>
              ) : (
                <WorkspaceTable
                  label="opportunity applications"
                  columns={['Opportunity', 'Action']}
                  actions={
                    <Link to="/opportunities" className="button button-outline workspace-action">
                      Find opportunities
                    </Link>
                  }
                  rows={p.opportunityApplications
                    .filter((a) => a.accountId === account.id)
                    .map((application) => {
                      const title =
                        p.opportunities.find((o) => o.id === application.opportunityId)?.title ??
                        'Opportunity';
                      return {
                        id: application.id,
                        search: title,
                        cells: [
                          title,
                          <Link
                            to={
                              workspaceHref('applications') +
                              '&application=' +
                              encodeURIComponent(application.id)
                            }
                          >
                            View application
                          </Link>,
                        ],
                      };
                    })}
                />
              )}
            </Panel>
          )}
          {tab === 'mentor' && (
            <Panel title="Mentor profile & availability">
              {mentor && (
                <dl className="workspace-profile">
                  <div>
                    <dt>Expertise</dt>
                    <dd>{mentor.expertise}</dd>
                  </div>
                  <div>
                    <dt>Availability</dt>
                    <dd>{mentor.availability}</dd>
                  </div>
                  <div>
                    <dt>Biography</dt>
                    <dd>{mentor.bio}</dd>
                  </div>
                </dl>
              )}
              <div className="workspace-toolbar-actions">
                <WorkspaceFormDialog
                  action={mentor ? 'Edit mentor profile' : 'Set up mentor profile'}
                  create={!mentor}
                  submit="Save mentor profile"
                  onSave={(f) =>
                    run({
                      type: 'mentor-profile',
                      now: now(),
                      profile: {
                        accountId: account.id,
                        expertise: String(f.get('expertise')),
                        availability: String(f.get('availability')),
                        bio: String(f.get('bio')),
                      },
                    })
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
                </WorkspaceFormDialog>
                <Link to="/dashboard/mentorship">Review mentorship requests →</Link>
              </div>
            </Panel>
          )}
          {tab === 'mentees' && (
            <Panel title="Assigned incubation milestones">
              <MentorWorkspace p={p} account={account} save={run} name={name} />
            </Panel>
          )}
          {tab === 'organisation' && (
            <Panel title={`${roleLabels[account.role]} organisation profile`}>
              <p>Profile approval is required before opportunities can be submitted.</p>
              {org && (
                <dl className="workspace-profile">
                  <div>
                    <dt>Organisation</dt>
                    <dd>{org.name}</dd>
                  </div>
                  <div>
                    <dt>Type</dt>
                    <dd>{org.type}</dd>
                  </div>
                  <div>
                    <dt>Sectors</dt>
                    <dd>{org.sectors}</dd>
                  </div>
                </dl>
              )}
              <WorkspaceFormDialog
                action={org ? 'Edit organisation' : 'Add organisation'}
                create={!org}
                submit="Submit profile for approval"
                onSave={(f) =>
                  run({
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
                  })
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
              </WorkspaceFormDialog>
            </Panel>
          )}
          {tab === 'opportunities' && (
            <Panel title="Opportunities">
              <WorkspaceTable
                label="opportunities"
                columns={['Opportunity', 'Category', 'Actions']}
                actions={opportunityEditor()}
                rows={p.opportunities
                  .filter((item) => item.ownerId === account.id)
                  .map((item) => ({
                    id: item.id,
                    search: [item.title, item.category].join(' '),
                    cells: [
                      item.title,
                      item.category,
                      <div className="workspace-row-actions">
                        {item.status !== 'archived' && opportunityEditor(item)}
                        {item.status === 'draft' && (
                          <button
                            type="button"
                            className="button button-outline workspace-action"
                            onClick={() =>
                              run({
                                type: 'opportunity-status',
                                id: item.id,
                                status: 'review',
                                now: now(),
                              })
                            }
                          >
                            Submit for review
                          </button>
                        )}
                        {['published', 'closed'].includes(item.status) && (
                          <Link to={'/opportunities/' + item.slug}>View public listing</Link>
                        )}
                      </div>,
                    ],
                  }))}
              />
            </Panel>
          )}
          {tab === 'applicants' && (
            <Panel title="Opportunity applicants">
              {displayedApplication ? (
                <section className="workspace-record">
                  <Link to={workspaceHref('applicants')}>← Applicants</Link>
                  <h3>{name(displayedApplication.accountId)}</h3>
                  <p className="workspace-detail-copy">{displayedApplication.motivation}</p>
                </section>
              ) : (
                <WorkspaceTable
                  label="applicants"
                  columns={['Applicant', 'Opportunity', 'Action']}
                  rows={p.opportunityApplications.flatMap((application) => {
                    const opportunity = p.opportunities.find(
                      (item) => item.id === application.opportunityId,
                    );
                    if (
                      !opportunity ||
                      (opportunity.ownerId !== account.id && !can(account, 'admin'))
                    )
                      return [];
                    const applicant = name(application.accountId);
                    const canDecide = ['submitted', 'shortlisted'].includes(application.status);
                    return [
                      {
                        id: application.id,
                        search: [applicant, opportunity.title].join(' '),
                        cells: [
                          applicant,
                          opportunity.title,
                          canDecide ? (
                            <WorkspaceDialog action="Review applicant" title={applicant}>
                              {(finish) => (
                                <>
                                  <p className="workspace-detail-copy">{application.motivation}</p>
                                  {canDecide && (
                                    <div className="workspace-form-footer">
                                      {(['shortlisted', 'accepted', 'rejected'] as const).map(
                                        (status) => (
                                          <button
                                            key={status}
                                            type="button"
                                            className="button button-outline"
                                            onClick={() =>
                                              finish(
                                                run({
                                                  type: 'opportunity-review',
                                                  id: application.id,
                                                  status,
                                                  now: now(),
                                                }),
                                              )
                                            }
                                          >
                                            {
                                              {
                                                shortlisted: 'Shortlist',
                                                accepted: 'Accept',
                                                rejected: 'Reject',
                                              }[status]
                                            }
                                          </button>
                                        ),
                                      )}
                                    </div>
                                  )}
                                </>
                              )}
                            </WorkspaceDialog>
                          ) : (
                            <Link
                              to={
                                workspaceHref('applicants') +
                                '&application=' +
                                encodeURIComponent(application.id)
                              }
                            >
                              View application
                            </Link>
                          ),
                        ],
                      },
                    ];
                  })}
                />
              )}
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
              <ApprovalWorkspace p={p} accounts={state.accounts} save={run} name={name} />
            </Panel>
          )}
          {tab === 'users' && (
            <Panel title="Users & access">
              <WorkspaceTable
                label="members"
                columns={['Member', 'Email', 'Role', 'Status', 'Action']}
                rows={state.accounts.map((member) => {
                  const status = member.suspended ? 'Suspended' : 'Active';
                  return {
                    id: member.id,
                    search: [member.name, member.email, roleLabels[member.role], status].join(' '),
                    cells: [
                      member.name,
                      member.email,
                      roleLabels[member.role],
                      <WorkspaceStatus>{status}</WorkspaceStatus>,
                      member.id === account.id ? (
                        'Your account'
                      ) : (
                        <WorkspaceFormDialog
                          action="Manage access"
                          title={member.name}
                          submit="Save access"
                          onSave={(data) =>
                            run({
                              type: 'account-admin',
                              accountId: member.id,
                              role: String(data.get('role')) as Role,
                              suspended: data.get('suspended') === 'on',
                              now: now(),
                            })
                          }
                        >
                          <label>
                            Role
                            <select name="role" defaultValue={member.role}>
                              {Object.entries(roleLabels).map(([id, label]) => (
                                <option key={id} value={id}>
                                  {label}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="inline-checkbox">
                            <input
                              type="checkbox"
                              name="suspended"
                              defaultChecked={member.suspended}
                            />
                            Suspend account
                          </label>
                        </WorkspaceFormDialog>
                      ),
                    ],
                  };
                })}
              />
            </Panel>
          )}
          {tab === 'certificates' && (
            <Panel title="Certificates">
              <TrainingCertificates
                p={p}
                save={run}
                name={name}
                courseRecords={
                  <WorkspaceTable
                    label="course completion records"
                    columns={['Learner', 'Course', 'Action']}
                    empty="No course completion records have been issued."
                    actions={
                      <WorkspaceFormDialog
                        action="Issue course record"
                        create
                        submit="Issue completion record"
                        onSave={(data) =>
                          run({
                            type: 'certificate-issue',
                            id: crypto.randomUUID(),
                            accountId: String(data.get('account')),
                            courseId: String(data.get('course')),
                            now: now(),
                          })
                        }
                      >
                        <p>All lessons must be completed before a demo record can be issued.</p>
                        <label>
                          Learner
                          <select name="account">
                            {state.accounts.map((a) => (
                              <option key={a.id} value={a.id}>
                                {a.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          Course
                          <select name="course">
                            {courses.map((course) => (
                              <option key={course.id} value={course.id}>
                                {course.title}
                              </option>
                            ))}
                          </select>
                        </label>
                      </WorkspaceFormDialog>
                    }
                    rows={p.certificates.map((record) => {
                      const title =
                        courses.find((course) => course.id === record.courseId)?.title ??
                        'Course completion';
                      const learner = name(record.accountId);
                      return {
                        id: record.id,
                        search: learner + ' ' + title,
                        cells: [
                          learner,
                          title,
                          <Link to={'/certificates/' + record.id}>View verification record</Link>,
                        ],
                      };
                    })}
                  />
                }
              />
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
            <Panel title="This workspace is unavailable for your role" showTitle>
              <Link className="button" to="/dashboard">
                Return to your dashboard
              </Link>
            </Panel>
          )}
        </div>
      </section>
    </>
  );
}
