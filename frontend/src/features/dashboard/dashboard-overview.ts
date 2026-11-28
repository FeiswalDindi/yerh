import type { DemoAccount, DemoState } from '../../domain/demo';
import { institutionProgramme } from '../../domain/institution-programme';
import type { Role } from '../../domain/roles';
import { workspaceHref } from './dashboard-navigation';
import { dashboardOpportunityApplicationsPath } from './catalogue-paths';
import { roleAccessPath } from '../accounts/role-requests';

export const dashboardTitles: Record<Role, string> = {
  guest: 'Guest',
  entrepreneur: 'Entrepreneur',
  mentor: 'Mentor',
  content_manager: 'YERH Team',
  investor: 'Investor',
  partner: 'Partner',
  admin: 'YERH Team',
  school_admin: 'Institution',
};

type Metric = { label: string; value: string | number; to: string };

export function dashboardMetrics(state: DemoState, account: DemoAccount): Metric[] {
  const p = state.platform;
  const id = account.id;
  switch (account.role) {
    case 'school_admin': {
      const school = p.training.institutions.find((entry) => entry.adminId === id);
      if (school?.kind !== 'high-school') {
        const programme = school && institutionProgramme(p, state.accounts, school.id, account);
        if (!programme) return [];
        const ventures = programme.members.flatMap((member) => member.ventures);
        const progress = workspaceHref('school') + '&view=progress';
        return [
          { label: 'Members', value: programme.members.length, to: workspaceHref('school') },
          { label: 'Ventures', value: ventures.length, to: progress },
          {
            label: 'Ventures with all stages assessed',
            value: ventures.filter((venture) => venture.assessments === venture.stages.length)
              .length,
            to: progress,
          },
        ];
      }
      return [
        {
          label: 'Students',
          value: p.training.students.filter((student) => student.institutionId === school?.id)
            .length,
          to: workspaceHref('school') + '&view=students',
        },
        {
          label: 'Cohorts',
          value: (p.training.cohorts ?? []).filter((cohort) => cohort.institutionId === school?.id)
            .length,
          to: workspaceHref('member-results'),
        },
        {
          label: 'Venture teams',
          value: p.training.groups.filter((g) => g.institutionId === school?.id).length,
          to: workspaceHref('school') + '&view=teams',
        },
      ];
    }
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
          label: 'Ventures',
          value: p.ventures.filter((v) => v.ownerId === id).length,
          to: workspaceHref('ventures'),
        },
        {
          label: 'Courses enrolled',
          value: p.enrollments[id]?.length ?? 0,
          to: '/dashboard/learning',
        },
        {
          label: 'Incubation pathways',
          value: p.incubations.filter((i) => i.ownerId === id).length,
          to: workspaceHref('incubation'),
        },
        {
          label: 'Opportunity applications',
          value: p.opportunityApplications.filter((a) => a.accountId === id).length,
          to: dashboardOpportunityApplicationsPath,
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
          label: 'Mentorship requests',
          value: state.requests.filter((r) => r.mentorId === id).length,
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
          label: 'Editorial drafts',
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
          label: 'Organisation',
          value: organisation?.name ?? 'Set up',
          to: workspaceHref('organisation'),
        },
        {
          label: 'Opportunities',
          value: ownOpportunities.length,
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
          label: 'Product listings awaiting approval',
          value: p.products.filter(
            (product) =>
              product.status === 'pending' &&
              p.ventures.some((venture) => venture.id === product.ventureId && !venture.groupId),
          ).length,
          to: workspaceHref('approvals'),
        },
        {
          label: 'Pending role requests',
          value: p.applications.filter((a) => a.status === 'pending').length,
          to: workspaceHref('approvals') + '&view=roles',
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
          value: p.certificates.length + p.training.credentials.length,
          to: workspaceHref('certificates'),
        },
        {
          label: 'Payments awaiting confirmation',
          value: p.training.payments.filter((payment) => payment.status === 'pending').length,
          to: workspaceHref('payments'),
        },
      ];
  }
}
