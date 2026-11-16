import { memberPath } from '../../domain/community';
import type { DemoAccount, DemoState } from '../../domain/demo';
import { can } from '../../domain/roles';
import { cmsHref, workspaceHref } from './dashboard-navigation';

type DashboardUpdate = { label: string; itemIds: string[]; to: string };

function pendingIds(records: { id: string; status: string }[], kind: string) {
  return records.filter(({ status }) => status === 'pending').map(({ id }) => `${kind}:${id}`);
}

export function dashboardUpdates(state: DemoState, account: DemoAccount): DashboardUpdate[] {
  const { id } = account;
  const platform = state.platform;
  const admin = can(account, 'admin');
  const updates: DashboardUpdate[] = [
    {
      label: 'Role application decisions',
      itemIds: platform.applications
        .filter((a) => a.accountId === id && a.status !== 'pending')
        .map((a) => `${a.id}:${a.status}`),
      to: '/dashboard/applications',
    },
  ];

  if (can(account, 'community'))
    updates.push({
      label: 'Pending connection requests',
      itemIds: state.connections
        .filter((c) => c.recipientId === id && c.status === 'pending')
        .map((c) => c.requesterId),
      to: `${memberPath(id)}?tab=friends`,
    });

  if (can(account, 'mentor'))
    updates.push({
      label: 'Mentorship requests to review',
      itemIds: state.requests
        .filter((r) => r.status === 'pending' && (admin || r.mentorId === id))
        .map((r) => r.id),
      to: '/dashboard/mentorship',
    });

  if (admin)
    updates.push({
      label: 'Items awaiting approval',
      itemIds: [
        ...pendingIds(platform.applications, 'role'),
        ...pendingIds(platform.ventures, 'venture'),
        ...pendingIds(platform.products, 'product'),
        ...pendingIds(platform.incubations, 'incubation'),
        ...platform.organisations
          .filter((organisation) => organisation.status === 'pending')
          .map(({ accountId }) => `organisation:${accountId}`),
      ],
      to: workspaceHref('approvals'),
    });

  if (can(account, 'cms'))
    updates.push(
      {
        label: 'Contributions to review',
        itemIds: state.submissions
          .filter((item) => item.status === 'review')
          .map((item) => item.id),
        to: '/dashboard/content',
      },
      {
        label: 'Opportunities to review',
        itemIds: platform.opportunities
          .filter((item) => item.status === 'review')
          .map((item) => item.id),
        to: cmsHref('opportunities'),
      },
    );

  if (can(account, 'organisation')) {
    const listings = new Set(
      platform.opportunities.filter((o) => o.ownerId === id).map((o) => o.id),
    );
    updates.push({
      label: 'Opportunity applications to review',
      itemIds: platform.opportunityApplications
        .filter((a) => a.status === 'submitted' && listings.has(a.opportunityId))
        .map((a) => a.id),
      to: workspaceHref('applicants'),
    });
  }

  return updates.filter(({ itemIds }) => itemIds.length > 0);
}

export function dashboardUpdateKeys(updates: DashboardUpdate[]): string[] {
  return updates.flatMap(({ itemIds, to }) => itemIds.map((id) => `${to}:${id}`));
}
