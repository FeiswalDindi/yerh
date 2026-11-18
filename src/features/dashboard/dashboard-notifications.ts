import { memberPath } from '../../domain/community';
import type { DemoAccount, DemoState } from '../../domain/demo';
import { can } from '../../domain/roles';
import { cmsHref, workspaceHref } from './dashboard-navigation';
import { roleAccessPath, roleApplicationPath } from '../accounts/role-requests';

type DashboardUpdate = { label: string; itemIds: string[]; to: string; readKeyScope?: string };

function pendingIds(records: { id: string; status: string }[], kind: string) {
  return records.filter(({ status }) => status === 'pending').map(({ id }) => `${kind}:${id}`);
}

export function dashboardUpdates(state: DemoState, account: DemoAccount): DashboardUpdate[] {
  const { id } = account;
  const platform = state.platform;
  const admin = can(account, 'admin');
  const updates: DashboardUpdate[] = [
    {
      label: 'Role request decisions',
      itemIds: platform.applications
        .filter((a) => a.accountId === id && a.status !== 'pending')
        .map((a) => `${a.id}:${a.status}`),
      to: roleAccessPath,
      readKeyScope: roleApplicationPath,
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
    updates.push(
      {
        label: 'Mentorship requests to review',
        itemIds: state.requests
          .filter((r) => r.status === 'pending' && (admin || r.mentorId === id))
          .map((r) => r.id),
        to: '/dashboard/mentorship',
      },
      {
        label: 'Incubation reviews and exams',
        itemIds: platform.training.stages
          .filter((work) =>
            platform.incubations.some(
              (path) => path.id === work.incubationId && (admin || path.mentorId === id),
            ),
          )
          .flatMap((work) => [
            ...(work.reviewRequestedAt && !work.examOpenedAt
              ? [`${work.id}:review:${work.reviewRequestedAt}`]
              : []),
            ...work.steps
              .filter((step) => step.requested)
              .map((step) => `${work.id}:step:${step.id}`),
            ...work.attempts
              .filter((attempt) => attempt.score === null)
              .map((attempt) => attempt.id),
          ]),
        to: workspaceHref('mentees'),
      },
    );

  if (admin)
    updates.push(
      {
        label: 'Items awaiting approval',
        itemIds: [
          ...pendingIds(platform.applications, 'role'),
          ...pendingIds(platform.ventures, 'venture'),
          ...pendingIds(platform.products, 'product'),
          ...pendingIds(platform.incubations, 'incubation'),
          ...platform.training.productReviews
            .filter((row) => row.status === 'pending')
            .map((row) => `evidence:${row.productId}`),
          ...platform.organisations
            .filter((organisation) => organisation.status === 'pending')
            .map(({ accountId }) => `organisation:${accountId}`),
        ],
        to: workspaceHref('approvals'),
      },
      {
        label: 'Payments awaiting confirmation',
        itemIds: pendingIds(platform.training.payments, 'payment'),
        to: workspaceHref('payments'),
      },
    );

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
  return updates.flatMap(({ itemIds, to, readKeyScope = to }) =>
    itemIds.map((id) => `${readKeyScope}:${id}`),
  );
}
