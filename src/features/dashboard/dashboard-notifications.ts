import { memberPath } from '../../domain/community';
import type { DemoAccount, DemoState } from '../../domain/demo';
import { can } from '../../domain/roles';
import { cmsHref, workspaceHref } from './dashboard-navigation';

type DashboardUpdate = { label: string; count: number; to: string };

export function dashboardUpdates(state: DemoState, account: DemoAccount): DashboardUpdate[] {
  const { id } = account;
  const platform = state.platform;
  const admin = can(account, 'admin');
  const updates: DashboardUpdate[] = [
    {
      label: 'Role application decisions',
      count: platform.applications.filter((a) => a.accountId === id && a.status !== 'pending')
        .length,
      to: '/dashboard/applications',
    },
  ];

  if (can(account, 'community'))
    updates.push({
      label: 'Pending connection requests',
      count: state.connections.filter((c) => c.recipientId === id && c.status === 'pending').length,
      to: `${memberPath(id)}?tab=friends`,
    });

  if (can(account, 'mentor'))
    updates.push({
      label: 'Mentorship requests to review',
      count: state.requests.filter((r) => r.status === 'pending' && (admin || r.mentorId === id))
        .length,
      to: '/dashboard/mentorship',
    });

  if (admin)
    updates.push({
      label: 'Items awaiting approval',
      count: [
        ...platform.applications,
        ...platform.ventures,
        ...platform.products,
        ...platform.organisations,
        ...platform.incubations,
      ].filter((item) => item.status === 'pending').length,
      to: workspaceHref('approvals'),
    });

  if (can(account, 'cms'))
    updates.push(
      {
        label: 'Contributions to review',
        count: state.submissions.filter((item) => item.status === 'review').length,
        to: '/dashboard/content',
      },
      {
        label: 'Opportunities to review',
        count: platform.opportunities.filter((item) => item.status === 'review').length,
        to: cmsHref('opportunities'),
      },
    );

  if (can(account, 'organisation')) {
    const listings = new Set(
      platform.opportunities.filter((o) => o.ownerId === id).map((o) => o.id),
    );
    updates.push({
      label: 'Opportunity applications to review',
      count: platform.opportunityApplications.filter(
        (a) => a.status === 'submitted' && listings.has(a.opportunityId),
      ).length,
      to: workspaceHref('applicants'),
    });
  }

  return updates.filter(({ count }) => count > 0);
}
