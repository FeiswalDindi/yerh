import type { DemoAccount, DemoState } from '../../domain/demo';
import type { Role } from '../../domain/roles';
import { workspaceHref } from './dashboard-navigation';
import { roleAccessPath } from '../accounts/role-requests';

export const dashboardTitles: Record<Role, string> = {
  guest: 'Guest dashboard',
  entrepreneur: 'Entrepreneur dashboard',
  mentor: 'Mentor dashboard',
  content_manager: 'Content management dashboard',
  investor: 'Investor dashboard',
  partner: 'Partner dashboard',
  admin: 'Administration dashboard',
};

type Metric = { label: string; value: string | number; to: string };

export function dashboardMetrics(state: DemoState, account: DemoAccount): Metric[] {
  const p = state.platform;
  const id = account.id;
  switch (account.role) {
    case 'guest':
      return [
        {
          label: 'Pending role requests',
          value: p.applications.filter((a) => a.accountId === id && a.status === 'pending').length,
          to: roleAccessPath,
        },
      ];
    case 'entrepreneur':
      return [
        {
          label: 'My ventures',
          value: p.ventures.filter((v) => v.ownerId === id).length,
          to: workspaceHref('ventures'),
        },
        {
          label: 'Courses enrolled',
          value: p.enrollments[id]?.length ?? 0,
          to: '/dashboard/learning',
        },
        {
          label: 'Active incubations',
          value: p.incubations.filter((i) => i.ownerId === id && i.status === 'active').length,
          to: workspaceHref('incubation'),
        },
        {
          label: 'Opportunity applications',
          value: p.opportunityApplications.filter((a) => a.accountId === id).length,
          to: workspaceHref('applications'),
        },
      ];
    case 'mentor':
      return [
        {
          label: 'Incoming requests',
          value: state.requests.filter((r) => r.mentorId === id && r.status === 'pending').length,
          to: '/dashboard/mentorship',
        },
        {
          label: 'Accepted requests',
          value: state.requests.filter((r) => r.mentorId === id && r.status === 'accepted').length,
          to: '/dashboard/mentorship',
        },
        {
          label: 'Active incubations',
          value: p.incubations.filter((i) => i.mentorId === id && i.status === 'active').length,
          to: workspaceHref('mentees'),
        },
      ];
    case 'content_manager':
      return [
        {
          label: 'My editorial drafts',
          value: p.cmsDrafts.filter((d) => d.ownerId === id).length,
          to: '/dashboard/cms',
        },
        {
          label: 'Contributions to review',
          value: state.submissions.filter((s) => s.status === 'review').length,
          to: '/dashboard/content',
        },
        {
          label: 'Published site revision',
          value: p.cmsRevision,
          to: '/dashboard/cms?module=revisions',
        },
      ];
    case 'investor':
    case 'partner': {
      const organisation = p.organisations.find((o) => o.accountId === id);
      const ownOpportunities = p.opportunities.filter((o) => o.ownerId === id);
      const ownIds = new Set(ownOpportunities.map((o) => o.id));
      return [
        {
          label: 'Organisation status',
          value: organisation?.status ?? 'Set up',
          to: workspaceHref('organisation'),
        },
        {
          label: 'Published opportunities',
          value: ownOpportunities.filter((o) => o.status === 'published').length,
          to: workspaceHref('opportunities'),
        },
        {
          label: 'New applicants',
          value: p.opportunityApplications.filter(
            (a) => ownIds.has(a.opportunityId) && a.status === 'submitted',
          ).length,
          to: workspaceHref('applicants'),
        },
      ];
    }
    case 'admin':
      return [
        {
          label: 'Pending role requests',
          value: p.applications.filter((a) => a.status === 'pending').length,
          to: workspaceHref('approvals'),
        },
        {
          label: 'Active accounts',
          value: state.accounts.filter((a) => !a.suspended).length,
          to: workspaceHref('users'),
        },
        {
          label: 'Opportunities to review',
          value: p.opportunities.filter((o) => o.status === 'review').length,
          to: '/dashboard/cms?module=opportunities',
        },
        {
          label: 'Certificates issued',
          value: p.certificates.length,
          to: workspaceHref('certificates'),
        },
      ];
  }
}
