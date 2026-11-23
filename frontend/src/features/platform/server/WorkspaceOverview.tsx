import { useCallback } from 'react';
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { dashboardTitles } from '../../dashboard/dashboard-overview';
import { roleLabels } from '../../../domain/roles';
import type { LaravelProfile } from '../../../services/laravel-identity-repository';
import {
  laravelWorkspace,
  type WorkspaceSummary,
} from '../../../services/laravel-workspace-repository';
import { WorkspaceTable } from '../workspace/WorkspaceControls';
import {
  WorkspaceAction,
  fieldValue,
  RecordsFeedback,
  useWorkspaceRecords,
} from './WorkspaceActions';
import type { NavigationGroup } from './LaravelDashboardFrame';

const tab = (key: string) => '/dashboard/workspace?tab=' + key;
const metrics: Record<string, [string, string]> = {
  listings: ['Product listings awaiting approval', tab('approvals')],
  roles: ['Pending role requests', tab('approvals') + '&view=roles'],
  accounts: ['Active accounts', tab('users')],
  payments: ['Payments awaiting review', tab('payments')],
  institutions: ['Institutions', tab('institutions')],
  approvals: ['Pending approvals', tab('approvals')],
  ventures: ['Ventures', tab('ventures')],
  enrolments: ['Courses enrolled', '/dashboard/learning'],
  opportunities: ['Opportunity applications', '/dashboard/opportunities'],
  paths: ['Incubation pathways', tab('incubation')],
  assigned: ['Active incubations', tab('incubation')],
  graduated: ['Graduated ventures', tab('incubation')],
  students: ['Students', '&view=students'],
  cohorts: ['Cohorts', '&view=cohorts'],
  members: ['Members', '&view=members'],
  affiliatedVentures: ['Ventures', '&view=progress'],
};
const descriptions: Record<string, string> = {
  'Approval queue': 'Moderate product listings, assign incubation mentors, and review requests.',
  'Institution directory': 'Manage institutional onboarding and access.',
  'Manage ventures': 'Find and manage ventures across the platform.',
  'Marketplace products': 'Review and manage marketplace listings.',
  Portal: 'Manage programme participants and agreements.',
  'Member Progress': 'Track member activity and venture pathways.',
  'Incubation Pathway': 'Run team pathways and open assessments.',
  Ventures: 'Create a venture or continue an existing one.',
  Incubation: 'Launch or continue a venture pathway.',
  'Assigned pathways': 'Review evidence and assessments for your assigned ventures.',
  Courses: 'Open your course workspace.',
};

export function WorkspaceOverview({
  profile,
  groups,
  summary,
}: {
  profile: LaravelProfile;
  groups: NavigationGroup[];
  summary: WorkspaceSummary | null;
}) {
  const available = groups
    .filter((g) => g.label !== 'Dashboard' && g.label !== 'Account')
    .flatMap((g) => g.links);
  const priority =
    available.find(
      (l) =>
        l.label ===
        (profile.role === 'admin'
          ? 'Institution directory'
          : profile.role === 'entrepreneur'
            ? 'Incubation'
            : 'Member Progress'),
    ) ?? available.find((l) => l.label === 'Incubation Pathway');
  const shortcuts = [
    ...available.slice(0, 1),
    ...(priority && priority !== available[0] ? [priority] : []),
    ...available.slice(1).filter((l) => l !== priority),
  ].slice(0, 4);
  const tiles = Object.entries(summary?.metrics ?? {})
    .filter(([key]) => key !== 'approvals')
    .map(([key, value]) => ({ label: metrics[key]![0], to: metrics[key]![1], value }));
  for (const [slug, counts] of Object.entries(summary?.portals ?? {})) {
    for (const [key, value] of Object.entries(counts)) {
      tiles.push({
        label: metrics[key]![0],
        to: tab('school') + '&institution=' + encodeURIComponent(slug) + metrics[key]![1],
        value,
      });
    }
  }
  return (
    <section className="dashboard-overview">
      <header className="workspace-page-intro">
        <p className="eyebrow">
          {
            dashboardTitles[
              profile.staff.length && profile.role === 'guest' ? 'school_admin' : profile.role
            ]
          }
        </p>
        <h1>Welcome, {profile.name.split(' ')[0]}.</h1>
        {[
          ...new Set(
            [profile.affiliation?.name, ...profile.staff.map((s) => s.name)].filter(Boolean),
          ),
        ].map((name) => (
          <p key={name}>{name}</p>
        ))}
      </header>
      <div className="workspace-stats" aria-label="Workspace activity">
        {tiles.map((m) => (
          <Link key={m.to + m.label} className="dashboard-metric" to={m.to}>
            <strong>{m.value}</strong>
            <span>{m.label}</span>
          </Link>
        ))}
      </div>
      <h2 className="dashboard-section-title">Quick actions</h2>
      <div className="workspace-quick-links">
        {shortcuts.map((l) => (
          <Link key={l.to} to={l.to} className="workspace-quick-link">
            <div>
              <h3>{l.label === 'Institution directory' ? 'Institutions' : l.label}</h3>
              {descriptions[l.label] && <p>{descriptions[l.label]}</p>}
            </div>
            <ArrowRight size={18} aria-hidden="true" />
          </Link>
        ))}
      </div>
    </section>
  );
}

export function AccountDirectory({ actor }: { actor: number }) {
  const { records, error, reload } = useWorkspaceRecords(laravelWorkspace.users);
  return (
    <>
      <RecordsFeedback loading={!records} error={error} />
      {records && (
        <WorkspaceTable
          label="users"
          columns={['Member', 'Email', 'Role', 'Status', 'Action']}
          rows={records.map((u) => ({
            id: String(u.id),
            search: [u.name, u.email, roleLabels[u.role]].join(' '),
            cells: [
              u.name,
              u.email,
              roleLabels[u.role],
              <span
                className="workspace-status"
                data-status={u.suspended_at ? 'suspended' : 'active'}
              >
                {u.suspended_at ? 'Suspended' : 'Active'}
              </span>,
              u.id === actor ? (
                'Your account'
              ) : (
                <WorkspaceAction
                  action="Manage access"
                  title={u.name}
                  submit="Save access"
                  save={async (data) => {
                    await laravelWorkspace.updateAccess(
                      u.id,
                      fieldValue(data, 'role'),
                      data.has('suspended'),
                    );
                    reload();
                  }}
                >
                  <label>
                    Role
                    <select name="role" defaultValue={u.role}>
                      {Object.entries(roleLabels)
                        .filter(
                          ([r]) =>
                            r === u.role ||
                            (u.email_verified_at &&
                              !u.suspended_at &&
                              ['guest', 'content_manager', 'admin'].includes(u.role) &&
                              ['guest', 'content_manager', 'admin'].includes(r)),
                        )
                        .map(([id, label]) => (
                          <option value={id} key={id}>
                            {label}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label className="inline-checkbox">
                    <input type="checkbox" name="suspended" defaultChecked={!!u.suspended_at} />{' '}
                    Suspend account
                  </label>
                </WorkspaceAction>
              ),
            ],
          }))}
        />
      )}
    </>
  );
}
export function ActivityReport({ summary }: { summary: WorkspaceSummary }) {
  return (
    <>
      <div className="workspace-stats">
        {Object.entries(summary.metrics).map(([key, value]) => (
          <Link key={key} className="dashboard-metric" to={metrics[key]![1]}>
            <strong>{value}</strong>
            <span>{metrics[key]![0]}</span>
          </Link>
        ))}
      </div>
      <ActivityTable />
    </>
  );
}

export function ActivityTable({ institution }: { institution?: string }) {
  const load = useCallback(
    (signal: AbortSignal) => laravelWorkspace.activity(signal, institution),
    [institution],
  );
  const activity = useWorkspaceRecords(load);
  return (
    <>
      {' '}
      <RecordsFeedback error={activity.error} loading={!activity.records} />
      {activity.records && (
        <WorkspaceTable
          label="audit activity"
          columns={['Actor', 'Action', 'Target', 'Time']}
          exportLabel="Export audit CSV"
          exportName="yerh-audit.csv"
          rows={activity.records.map((a) => ({
            id: String(a.id),
            search: [a.actor, a.action, a.target, a.created_at].join(' '),
            cells: [a.actor || 'Deleted account', a.action, a.target, a.created_at],
          }))}
        />
      )}
    </>
  );
}
