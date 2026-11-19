import { memberPath } from '../../domain/community';
import type { DemoAccount, DemoState } from '../../domain/demo';
import { can } from '../../domain/roles';
import {
  incubationCertificateQueue,
  incubationLearners,
  institutionAccess,
  institutionForPath,
  passedStage,
  stageUnlocked,
} from '../../domain/incubation';
import { courseLessonIds } from '../../domain/courses';
import { cmsHref, institutionHref, workspaceHref } from './dashboard-navigation';
import { roleAccessPath, roleApplicationPath } from '../accounts/role-requests';

export type DashboardUpdate = {
  label: string;
  itemIds: string[];
  to: string;
  readKeyScope?: string;
  sidebarHref?: string;
};

function pendingIds(records: { id: string; status: string }[], kind: string) {
  return records.filter(({ status }) => status === 'pending').map(({ id }) => `${kind}:${id}`);
}

export function dashboardUpdates(state: DemoState, account: DemoAccount): DashboardUpdate[] {
  const { id } = account;
  const platform = state.platform;
  const admin = can(account, 'admin');
  const schoolPaths = new Set(
    platform.incubations
      .filter((path) =>
        platform.ventures.some((venture) => venture.id === path.ventureId && !!venture.groupId),
      )
      .map((path) => path.id),
  );
  const marketplaceProducts = platform.products.filter((product) =>
    platform.ventures.some((venture) => venture.id === product.ventureId && !venture.groupId),
  );
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
              (path) =>
                path.id === work.incubationId && path.mentorId === id && !schoolPaths.has(path.id),
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

  if (admin) {
    const approvals = workspaceHref('approvals');
    const certificates = workspaceHref('certificates');
    const revision = (id: string, actions: string[]) => {
      const change = platform.audit.find(
        (entry) => entry.targetId === id && actions.includes(entry.action),
      );
      return change ? `${id}:${change.id}` : id;
    };
    const addApproval = (view: string, label: string, itemIds: string[]) =>
      updates.push({
        label,
        itemIds,
        to: `${approvals}&view=${view}`,
        readKeyScope: approvals,
        sidebarHref: approvals,
      });
    addApproval(
      'roles',
      'Role requests to review',
      platform.applications
        .filter((row) => row.status === 'pending')
        .map((row) => `role:${row.id}:${row.createdAt}`),
    );
    addApproval(
      'products',
      'Product listings to review',
      marketplaceProducts
        .filter((row) => row.status === 'pending')
        .map((row) => `product:${revision(row.id, ['product-save', 'venture-review'])}`),
    );
    addApproval('ventures', 'Ventures and organisations to review', [
      ...platform.ventures
        .filter((row) => row.status === 'pending')
        .map((row) => `venture:${revision(row.id, ['venture-save', 'venture-review'])}`),
      ...platform.organisations
        .filter((row) => row.status === 'pending')
        .map(
          (row) =>
            `organisation:${revision(row.accountId, ['organisation-save', 'venture-review'])}`,
        ),
    ]);
    addApproval(
      'incubation',
      'Incubation applications to review',
      pendingIds(platform.incubations, 'incubation'),
    );
    addApproval(
      'evidence',
      'Product evidence to review',
      platform.training.productReviews
        .filter(
          (row) =>
            row.status === 'pending' &&
            marketplaceProducts.some((item) => item.id === row.productId),
        )
        .map((row) => `evidence:${revision(row.productId, ['product-evidence'])}`),
    );
    updates.push(
      {
        label: 'School assessments to review',
        itemIds: platform.training.stages
          .filter(
            (work) =>
              schoolPaths.has(work.incubationId) && work.reviewRequestedAt && !work.examOpenedAt,
          )
          .map((work) => work.id + ':' + work.reviewRequestedAt),
        to: workspaceHref('approvals') + '&view=school-reviews',
      },
      {
        label: 'Course proposals to review',
        itemIds: pendingIds(platform.courseCommerce?.proposals ?? [], 'proposal'),
        to: workspaceHref('admin-courses'),
      },
      {
        label: 'Incubation certificates ready to issue',
        itemIds: incubationCertificateQueue(platform)
          .filter((row) => row.ready)
          .map((row) => row.key),
        to: certificates,
      },
      {
        label: 'Course certificates ready to issue',
        itemIds: Object.entries(platform.enrollments).flatMap(([learner, courses]) =>
          courses.flatMap((course) => {
            const lessons = courseLessonIds(platform, course);
            return lessons?.length &&
              lessons.every((lesson) => state.progress[learner]?.includes(lesson)) &&
              !platform.certificates.some(
                (record) => record.accountId === learner && record.courseId === course,
              )
              ? [JSON.stringify([learner, course])]
              : [];
          }),
        ),
        to: `${certificates}&view=courses`,
        sidebarHref: certificates,
      },
      {
        label: 'Institutions ready for activation',
        itemIds: platform.training.institutions
          .filter((school) => school.status === 'pending' && school.proof)
          .map((school) => revision(school.id, ['institution-proof'])),
        to: workspaceHref('institutions'),
      },
      {
        label: 'Payments awaiting confirmation',
        itemIds: pendingIds(platform.training.payments, 'payment'),
        to: workspaceHref('payments'),
      },
    );
  }

  for (const school of platform.training.institutions) {
    if (
      school.kind !== 'high-school' ||
      school.status !== 'active' ||
      institutionAccess(school, account) !== 'manage'
    )
      continue;
    const schoolPaths = new Map(
      platform.incubations
        .filter(
          (path) =>
            (path.status === 'active' || path.status === 'completed') &&
            institutionForPath(platform, path)?.id === school.id,
        )
        .map((path) => [path.id, path]),
    );
    const sidebarHref =
      school.adminId === id
        ? workspaceHref('member-results')
        : institutionHref('member-results', school.id);
    const itemIds = platform.training.stages.flatMap((work) => {
      const path = schoolPaths.get(work.incubationId);
      if (!path || !work.examOpenedAt) return [];
      const awaitingMarks = incubationLearners(platform, path).some(
        (learner) =>
          stageUnlocked(platform, path, work.stage, learner) &&
          !passedStage(platform.training, path.id, work.stage, learner),
      );
      return awaitingMarks ? [`${work.id}:${work.examOpenedAt}`] : [];
    });
    updates.push({
      label: `${school.name} assessment marks to record`,
      itemIds,
      to: `${sidebarHref}&cohort=all`,
      sidebarHref,
    });
  }

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
  return [
    ...new Set(
      updates.flatMap(({ itemIds, to, readKeyScope = to }) =>
        itemIds.map((id) => `${readKeyScope}:${id}`),
      ),
    ),
  ];
}

const defaultViews: Record<string, string> = {
  approvals: 'products',
  payments: 'pending',
  'admin-courses': 'proposals',
  certificates: 'approval',
  mentees: 'ventures',
};

function updateScope(href: string) {
  const { pathname, searchParams: params } = new URL(href, 'https://yerh.example');
  if (pathname === '/dashboard/workspace') {
    const tab = params.get('tab') ?? '';
    if (tab === 'member-results')
      return JSON.stringify([
        pathname,
        tab,
        params.get('institution'),
        params.has('cohort') && params.get('view') !== 'certificates' && !params.has('learner'),
      ]);
    const view = params.get('view') ?? defaultViews[tab] ?? '';
    return JSON.stringify([
      pathname,
      tab,
      view,
      params.get('institution'),
      params.get('record'),
      params.get('path'),
      params.get('proposal'),
    ]);
  }
  if (pathname === '/dashboard/cms')
    return JSON.stringify([pathname, params.get('module') ?? 'overview']);
  if (pathname === '/dashboard/mentorship')
    return JSON.stringify([pathname, params.get('view') ?? 'pending', params.get('request')]);
  return pathname;
}

export function updatesForDestination(updates: DashboardUpdate[], href: string) {
  const scope = updateScope(href);
  return updates.filter((update) => updateScope(update.to) === scope);
}

export function dashboardBadges(updates: DashboardUpdate[], seen: ReadonlySet<string>) {
  const byNavigation = new Map<string, Set<string>>();
  for (const update of updates) {
    const href = (update.sidebarHref ?? update.to).split('#')[0]!;
    const unread = byNavigation.get(href) ?? new Set<string>();
    for (const key of dashboardUpdateKeys([update])) if (!seen.has(key)) unread.add(key);
    byNavigation.set(href, unread);
  }
  return new Map([...byNavigation].map(([href, keys]) => [href, keys.size]));
}
