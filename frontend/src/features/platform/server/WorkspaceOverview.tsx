import { useCallback, useMemo, useState } from 'react';
import { ArrowRight, ChevronDown, ChevronUp, ExternalLink, Filter } from 'lucide-react';
import { Link } from 'react-router-dom';
import { dashboardTitles } from '../../dashboard/dashboard-overview';
import { roleLabels, type Role } from '../../../domain/roles';
import type { LaravelProfile } from '../../../services/laravel-identity-repository';
import { learningRepository } from '../../../services/laravel-learning-repository';
import { shillings } from './LearningWorkspace';
import {
  laravelWorkspace,
  type WorkspaceSummary,
} from '../../../services/laravel-workspace-repository';
import { WorkspaceTable } from '../workspace/WorkspaceControls';
import { StatusIndicator } from '../../../shared/StatusIndicator';
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
  onboarding: ['Institution onboarding', tab('approvals') + '&view=institutions'],
  careerRequests: ['Partner, mentor & investor requests', tab('approvals') + '&view=careers'],
  enquiries: ['New enquiries', tab('enquiries')],
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
  authoredCourses: ['Authored courses', tab('courses')],
  courseEnrolments: ['Confirmed course enrolments', tab('earnings')],
  accruedRoyalties: ['Accrued royalties', tab('earnings')],
  students: ['Students', '&view=students'],
  cohorts: ['Cohorts', '&view=cohorts'],
  members: ['Members', '&view=members'],
  affiliatedVentures: ['Ventures', '&view=progress'],
  pendingRequests: ['Affiliation requests', '&view=requests'],
  editorial: ['Editorial posts', '/dashboard/cms'],
  media: ['Media library assets', '/dashboard/cms'],
  events: ['Events', '/dashboard/events'],
  myEvents: ['My events', '/dashboard/events'],
  publishedEvents: ['Published events', '/dashboard/events'],
  eventBookings: ['Event registrations', '/dashboard/events'],
  courseProposals: ['Course proposals', tab('courses')],
  partnerEvents: ['Partner events awaiting review', tab('approvals') + '&view=events'],
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
  'Course proposals': 'Propose courses, add lessons, and track course royalty rates.',
  'Earnings & royalties': 'Track confirmed enrolments, pending payments, and accrued course royalties.',
  'My events': 'Create events, submit for YERH review, and view attendee registrations.',
  Community: 'Join circles, access WhatsApp groups, discuss in forums, and view the leaderboard.',
  Courses: 'Open your course workspace.',
  Enquiries: 'Respond to enquiries submitted from the public contact form.',
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
    .filter(([key]) => key !== 'approvals' && Boolean(metrics[key]))
    .map(([key, value]) => ({
      label: metrics[key]![0],
      to: metrics[key]![1],
      value: key === 'accruedRoyalties' ? shillings(value) : value,
    }));
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
      <header className="workspace-page-intro workspace-overview-head">
        <div>
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
        </div>
        {profile.role === 'admin' && (
          <div className="workspace-overview-actions">
            <a
              className="button button-gold workspace-moodle-btn"
              href={learningRepository.moodleLaunchUrl()}
              target="_blank"
              rel="noreferrer"
            >
              Moodle <ExternalLink size={16} aria-hidden="true" />
            </a>
          </div>
        )}
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

type UserFilters = {
  search: string;
  role: string;
  institutionId: string;
  accountState: 'all' | 'active' | 'suspended' | 'verified' | 'unverified';
  authSync: 'all' | 'google' | 'password_only' | 'moodle_linked' | 'moodle_unlinked';
  journey:
    | 'all'
    | 'venture_approved'
    | 'venture_pending'
    | 'venture_none'
    | 'incubation_active'
    | 'incubation_graduated';
  location: string;
};

const EMPTY_USER_FILTERS: UserFilters = {
  search: '',
  role: 'all',
  institutionId: 'all',
  accountState: 'all',
  authSync: 'all',
  journey: 'all',
  location: 'all',
};

export function AccountDirectory({ actor }: { actor: number }) {
  const { records, error, reload } = useWorkspaceRecords(laravelWorkspace.users);
  const [filters, setFilters] = useState<UserFilters>(EMPTY_USER_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const institutions = useMemo(() => {
    if (!records) return [];
    const map = new Map<string, string>();
    for (const u of records) {
      if (u.institution_id && u.institution_name) {
        map.set(String(u.institution_id), u.institution_name);
      }
    }
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [records]);

  const locations = useMemo(() => {
    if (!records) return [];
    return [
      ...new Set(records.map((u) => (u.location ?? '').trim()).filter((loc) => loc !== '')),
    ].sort((a, b) => a.localeCompare(b));
  }, [records]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.role !== 'all') count++;
    if (filters.institutionId !== 'all') count++;
    if (filters.accountState !== 'all') count++;
    if (filters.authSync !== 'all') count++;
    if (filters.journey !== 'all') count++;
    if (filters.location !== 'all') count++;
    return count;
  }, [filters]);

  const filteredUsers = useMemo(() => {
    if (!records) return [];
    const q = filters.search.trim().toLowerCase();
    return records.filter((u) => {
      if (q) {
        const haystack = [
          u.name,
          u.email,
          roleLabels[u.role] ?? u.role,
          u.institution_name ?? '',
          u.location ?? '',
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }

      if (filters.role !== 'all' && u.role !== filters.role) return false;

      if (filters.institutionId === 'none') {
        if (u.institution_id != null) return false;
      } else if (filters.institutionId !== 'all') {
        if (String(u.institution_id ?? '') !== filters.institutionId) return false;
      }

      if (filters.accountState === 'active' && u.suspended_at) return false;
      if (filters.accountState === 'suspended' && !u.suspended_at) return false;
      if (filters.accountState === 'verified' && !u.email_verified_at) return false;
      if (filters.accountState === 'unverified' && u.email_verified_at) return false;

      if (filters.authSync === 'google' && !u.google_connected) return false;
      if (filters.authSync === 'password_only' && (u.google_connected || !u.has_password))
        return false;
      if (filters.authSync === 'moodle_linked' && !u.moodle_linked) return false;
      if (filters.authSync === 'moodle_unlinked' && u.moodle_linked) return false;

      if (filters.journey === 'venture_approved' && u.venture_status !== 'approved') return false;
      if (filters.journey === 'venture_pending' && u.venture_status !== 'pending') return false;
      if (filters.journey === 'venture_none' && (u.venture_count ?? 0) > 0) return false;
      if (filters.journey === 'incubation_active' && u.incubation_status !== 'active') return false;
      if (filters.journey === 'incubation_graduated' && u.incubation_status !== 'graduated')
        return false;

      if (
        filters.location !== 'all' &&
        (u.location ?? '').trim().toLowerCase() !== filters.location.toLowerCase()
      ) {
        return false;
      }

      return true;
    });
  }, [records, filters]);

  return (
    <>
      <RecordsFeedback loading={!records} error={error} />
      {records && (
        <div className="users-directory-wrap">
          <div className="users-filter-panel">
            <div className="users-filter-bar">
              <label className="users-search-inline">
                <span className="sr-only">Search users</span>
                <input
                  type="search"
                  placeholder="Search by name, email, role, institution, or location…"
                  value={filters.search}
                  onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
                />
              </label>

              <button
                type="button"
                className="button button-outline button-small users-filter-toggle"
                aria-expanded={filtersOpen}
                onClick={() => setFiltersOpen((open) => !open)}
              >
                <Filter size={15} aria-hidden="true" />
                Filters {activeFilterCount > 0 ? `(${activeFilterCount})` : ''}
                {filtersOpen ? (
                  <ChevronUp size={15} aria-hidden="true" />
                ) : (
                  <ChevronDown size={15} aria-hidden="true" />
                )}
              </button>

              {(activeFilterCount > 0 || filters.search !== '') && (
                <button
                  type="button"
                  className="button button-outline button-small"
                  onClick={() => setFilters(EMPTY_USER_FILTERS)}
                >
                  Reset filters
                </button>
              )}

              <span className="users-filter-count">
                Showing <strong>{filteredUsers.length}</strong> of {records.length} users
              </span>
            </div>

            {filtersOpen && (
              <div className="users-filter-grid">
                <label>
                  Role
                  <select
                    value={filters.role}
                    onChange={(e) => setFilters((prev) => ({ ...prev, role: e.target.value }))}
                  >
                    <option value="all">All roles</option>
                    {Object.entries(roleLabels).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Institution
                  <select
                    value={filters.institutionId}
                    onChange={(e) =>
                      setFilters((prev) => ({ ...prev, institutionId: e.target.value }))
                    }
                  >
                    <option value="all">All institutions</option>
                    <option value="none">Independent / No institution</option>
                    {institutions.map(([id, name]) => (
                      <option key={id} value={id}>
                        {name}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Account &amp; Verification
                  <select
                    value={filters.accountState}
                    onChange={(e) =>
                      setFilters((prev) => ({
                        ...prev,
                        accountState: e.target.value as UserFilters['accountState'],
                      }))
                    }
                  >
                    <option value="all">All accounts</option>
                    <option value="active">Active accounts</option>
                    <option value="verified">Verified email</option>
                    <option value="unverified">Unverified email</option>
                    <option value="suspended">Suspended accounts</option>
                  </select>
                </label>

                <label>
                  Sign-in &amp; Moodle sync
                  <select
                    value={filters.authSync}
                    onChange={(e) =>
                      setFilters((prev) => ({
                        ...prev,
                        authSync: e.target.value as UserFilters['authSync'],
                      }))
                    }
                  >
                    <option value="all">All sign-in methods</option>
                    <option value="google">Google connected</option>
                    <option value="password_only">Email &amp; password only</option>
                    <option value="moodle_linked">Synced to Moodle</option>
                    <option value="moodle_unlinked">Not synced to Moodle</option>
                  </select>
                </label>

                <label>
                  Venture &amp; Incubation
                  <select
                    value={filters.journey}
                    onChange={(e) =>
                      setFilters((prev) => ({
                        ...prev,
                        journey: e.target.value as UserFilters['journey'],
                      }))
                    }
                  >
                    <option value="all">All stages</option>
                    <option value="venture_approved">Approved venture</option>
                    <option value="venture_pending">Pending venture</option>
                    <option value="venture_none">No venture yet</option>
                    <option value="incubation_active">Active in incubation</option>
                    <option value="incubation_graduated">Graduated incubation</option>
                  </select>
                </label>

                <label>
                  Location
                  <select
                    value={filters.location}
                    onChange={(e) => setFilters((prev) => ({ ...prev, location: e.target.value }))}
                  >
                    <option value="all">All locations</option>
                    {locations.map((loc) => (
                      <option key={loc} value={loc}>
                        {loc}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}
          </div>

          <WorkspaceTable
            label="users"
            hideSearch
            empty="No users match the selected filters."
            columns={['Member', 'Email', 'Role & Institution', 'Status', 'Action']}
            rows={filteredUsers.map((u) => ({
              id: String(u.id),
              search: [u.name, u.email, roleLabels[u.role], u.institution_name ?? ''].join(' '),
              cells: [
                <div className="users-member-cell">
                  <strong>{u.name}</strong>
                  <div className="users-member-meta">
                    {!u.email_verified_at && (
                      <span className="users-badge users-badge--warn">Unverified</span>
                    )}
                    {u.google_connected && <span className="users-badge">Google</span>}
                    {u.moodle_linked && <span className="users-badge">Moodle</span>}
                    {u.location && <span className="users-meta-text">{u.location}</span>}
                  </div>
                </div>,
                u.email,
                <div className="users-member-cell">
                  <span>{roleLabels[u.role as Role] ?? u.role}</span>
                  <small className="users-meta-text">{u.institution_name || 'Independent'}</small>
                </div>,
                <StatusIndicator status={u.suspended_at ? 'suspended' : 'active'} />,
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
                                ['guest', 'content_manager', 'partner', 'admin'].includes(u.role) &&
                                ['guest', 'content_manager', 'partner', 'admin'].includes(r)),
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
        </div>
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
