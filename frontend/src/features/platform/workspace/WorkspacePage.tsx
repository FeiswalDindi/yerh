import { lazy, useEffect, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { useDemo } from '../../../app/useDemo';
import { useCatalog } from '../../../app/useCatalog';
import { can } from '../../../domain/roles';
import type { PlatformAction } from '../../../domain/platform';
import { PageIntro } from '../../../shared/PageIntro';
import { DemoNotice } from '../../demo/DemoNotice';
import { usePageTitle } from '../../../shared/usePageTitle';
import {
  activeWorkspaceModule,
  institutionHref,
  institutionModule,
  workspaceHref,
} from '../../dashboard/dashboard-navigation';
import { dashboardOpportunityApplicationsPath } from '../../dashboard/catalogue-paths';
import { institutionAccess } from '../../../domain/incubation';
import { MentorWorkspace } from '../mentors/MentorWorkspace';
import { ApprovalWorkspace } from '../admin/ApprovalWorkspace';
import { IncubationWorkspace } from '../incubation/IncubationWorkspace';
import { InstitutionPortal } from '../institutions/InstitutionPortal';
import { InstitutionsAdmin } from '../institutions/InstitutionDirectory';
import { InstitutionResults } from '../institutions/InstitutionResults';
import { InstitutionProgramme, programmeHref } from '../institutions/InstitutionProgramme';
import { TrainingCertificates } from '../incubation/TrainingCertificates';
import { TrainingPayments } from '../incubation/TrainingPayments';
import { AdminVentures } from '../admin/AdminVentures';

import { Panel } from './WorkspacePanel';
import { AdminProducts } from '../admin/AdminProducts';
import { MentorProfile } from '../mentors/MentorProfile';
import { PartnerWorkspace } from '../partners/PartnerWorkspace';
import { UserAccessDirectory } from '../admin/UserAccessDirectory';
import { AuditReports } from '../admin/AuditReports';
const VentureRegistry = lazy(() => import('../ventures/VentureWorkspace'));
const ProductRegistry = lazy(() => import('../ventures/ProductWorkspace'));
const AdminCourseWorkspace = lazy(() =>
  import('../courses/CourseWorkspace').then(({ AdminCourseWorkspace }) => ({
    default: AdminCourseWorkspace,
  })),
);
const MentorCourseWorkspace = lazy(() =>
  import('../courses/CourseWorkspace').then(({ MentorCourseWorkspace }) => ({
    default: MentorCourseWorkspace,
  })),
);

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
        ? institutionModule(params.get('tab'), access === 'manage', school?.kind)
        : undefined
      : activeWorkspaceModule(account, params.get('tab'))
    : undefined;
  const tab = activeModule?.id;
  useEffect(() => setSuccess(''), [tab, account?.id, contextId]);
  usePageTitle(activeModule?.label ?? 'Workspace');
  if (!account) return null;
  if (!contextId && params.get('tab') === 'applications' && can(account, 'apply')) {
    const application = params.get('application');
    return (
      <Navigate
        to={
          dashboardOpportunityApplicationsPath +
          (application ? '&application=' + encodeURIComponent(application) : '')
        }
        replace
      />
    );
  }
  const programmeAccess =
    !!school && school.status === 'active' && school.kind !== 'high-school' && access === 'manage';
  if (tab === 'school' && programmeAccess && params.get('view') === 'programme-payments')
    return (
      <Navigate
        to={programmeHref(
          params,
          'view',
          'programme-payments',
          params.get('member') ?? undefined,
          params.get('venture') ?? undefined,
        )}
        replace
      />
    );
  const schoolStaff = contextId ? access === 'manage' : can(account, 'school');
  const affiliation = p.training.institutions.find(
    (row) => row.id === p.training.affiliations[account.id],
  );
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
    tab !== 'member-results' &&
    tab !== 'programme-payments';
  function run(action: PlatformAction) {
    const ok = execute(contextId ? { ...action, institutionContextId: contextId } : action);
    if (ok) {
      const messages: Record<string, string> = {
        'institution-certificates-request':
          'Certificate requests sent to the platform administrator.',
        'institution-invite':
          'Invitation created. Open the invitation link from the invitations list.',
        'institution-invite-bulk': 'Invitations created. Open the links from the invitations list.',
        'institution-invite-revoke': 'Invitation revoked.',
        'institution-create':
          'Institution created. Follow the Portal activation steps to open access.',
        'institution-assign-admin': 'Institution administrator assigned.',
        'institution-activate': 'Institution activated. The portal is open to assigned staff.',
        'product-save': schoolStaff
          ? 'Product saved.'
          : 'Product submitted. A platform administrator can review it under Approval queue → Product listings.',
        'incubation-apply': schoolStaff
          ? 'Pathway launched. Open it to record stage evidence.'
          : 'Venture submitted. A platform administrator can assign a mentor under Approval queue → Incubation applications.',
        'product-evidence':
          'Product evidence submitted. The mentor or platform administrator can review it under Product evidence reviews.',
        'school-credentials-issue': 'School certificates issued.',
        'certificate-issue': 'Course certificate issued.',
        'school-certificates-reject': 'Certificate decision saved and shared with the school.',
        'stage-offline-score-edit': 'Mark updated.',
        'school-stage-open': 'Assessment opened. You can now record marks.',
        'stage-request': 'Stage review requested.',
      };
      setSuccess(messages[action.type] ?? 'Saved successfully.');
    }
    return ok;
  }
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
              <Link to={schoolLink('school')}>Open portal</Link>
            </p>
          )}
          {tab === 'school' && (
            <Panel title={school?.name ?? 'Portal'} showTitle={!!school}>
              <InstitutionPortal
                p={p}
                account={account}
                school={school}
                accounts={state.accounts}
                save={run}
                portalHref={schoolLink}
              />
            </Panel>
          )}
          {tab === 'programme-payments' && (
            <Panel title="Payments & Certificates">
              {programmeAccess && school ? (
                <InstitutionProgramme
                  p={p}
                  institution={school}
                  accounts={state.accounts}
                  operator={account}
                  tab="programme-payments"
                />
              ) : (
                <p>This report is available to authorized staff of an active university or hub.</p>
              )}
            </Panel>
          )}
          {tab === 'member-results' && (
            <Panel title="Results & Certificates">
              {school?.status === 'active' && access && school.kind === 'high-school' ? (
                <InstitutionResults
                  p={p}
                  school={school}
                  accounts={state.accounts}
                  save={run}
                  readonly={access === 'view'}
                  incubationHref={schoolLink('incubation')}
                />
              ) : school?.status === 'active' && access ? (
                <Link to={schoolLink('school') + '&view=progress'}>Member Progress</Link>
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
              <p>
                <Link to={workspaceHref('certificates') + '&view=courses'}>
                  Course certificates
                </Link>
              </p>
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
          {tab === 'manage-products' && <AdminProducts p={p} name={name} run={run} />}
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
                  <Link to={schoolLink('member-results')}>Results &amp; Certificates</Link>
                </p>
              )}
              {!schoolStaff && affiliation && <p>Affiliated institution · {affiliation.name}</p>}
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
          {tab === 'mentor' && <MentorProfile p={p} account={account} run={run} />}
          {tab === 'mentees' && (
            <Panel title="Assigned incubation milestones">
              <MentorWorkspace p={p} account={account} save={run} name={name} />
            </Panel>
          )}
          {tab && ['organisation', 'opportunities', 'applicants', 'discovery'].includes(tab) && (
            <PartnerWorkspace
              tab={tab}
              account={account}
              p={p}
              params={params}
              name={name}
              run={run}
              opportunityImage={media.business}
            />
          )}
          {tab === 'approvals' && (
            <Panel title="Approval queue">
              <ApprovalWorkspace p={p} accounts={state.accounts} save={run} name={name} />
            </Panel>
          )}
          {tab === 'users' && <UserAccessDirectory state={state} account={account} run={run} />}
          {tab === 'certificates' && (
            <Panel title="Certificates">
              <TrainingCertificates state={state} courses={courses} save={run} name={name} />
            </Panel>
          )}
          {tab === 'reports' && <AuditReports state={state} name={name} />}
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
