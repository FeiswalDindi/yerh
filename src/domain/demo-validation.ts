import type { DemoState, DemoAccount } from './demo';
import { canonicalRole, roleLabels } from './roles.ts';
import { isPlatformState } from './platform-validation.ts';
import { assertCmsSnapshot, assertOpportunity } from './cms.ts';
type RecordValue = Record<string, unknown>;
const record = (v: unknown): v is RecordValue => !!v && typeof v === 'object' && !Array.isArray(v);
const strings = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((x) => typeof x === 'string');
const fields = (v: unknown, keys: string[]): v is RecordValue =>
  record(v) && keys.every((k) => typeof v[k] === 'string');
const list = (v: unknown, check: (x: unknown) => boolean): boolean =>
  Array.isArray(v) && v.every(check);
const member = (v: unknown, values: string[]) => typeof v === 'string' && values.includes(v);
const reply = (v: unknown) => fields(v, ['id', 'authorId', 'body', 'createdAt']);
const nullableText = (v: unknown) => v === null || typeof v === 'string';
const date = (v: string) => Number.isFinite(Date.parse(v));
const unique = (ids: string[]) => new Set(ids).size === ids.length;
function timezone(value: string) {
  try {
    new Intl.DateTimeFormat('en-KE', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}
/** Preserve existing browser edits while adding fixture-owned metadata and new collections. */
export function migrateDemoState(value: unknown, seed: DemoState): unknown {
  if (
    record(value) &&
    value.version === 2 &&
    record(value.platform) &&
    (!value.platform.courseLessons || !value.platform.certificates)
  )
    return { ...value, platform: { ...structuredClone(seed.platform), ...value.platform } };
  if (record(value) && value.version === 2 && !value.platform && Array.isArray(value.accounts)) {
    return {
      ...value,
      platform: structuredClone(seed.platform),
      accounts: [
        ...value.accounts.map((a) =>
          record(a)
            ? {
                ...a,
                role: canonicalRole(String(a.role)),
                email: seed.accounts.find((s) => s.id === a.id)?.email ?? `${a.id}@example.test`,
              }
            : a,
        ),
        ...seed.accounts.filter(
          (s) => !(value.accounts as unknown[]).some((a: unknown) => record(a) && a.id === s.id),
        ),
      ],
    };
  }
  if (!record(value) || value.version !== 1 || !Array.isArray(value.accounts)) return value;
  return {
    ...value,
    version: 2,
    platform: structuredClone(seed.platform),
    connections: seed.connections,
    registrations: seed.registrations,
    sessions: seed.sessions,
    pointRules: seed.pointRules,
    accounts: [
      ...value.accounts.map((a) =>
        record(a)
          ? {
              ...seed.accounts.find((s) => s.id === a.id),
              ...a,
              role: canonicalRole(String(a.role)),
              handle: seed.accounts.find((s) => s.id === a.id)?.handle,
              joinedAt: seed.accounts.find((s) => s.id === a.id)?.joinedAt,
            }
          : a,
      ),
      ...seed.accounts.filter(
        (s) => !(value.accounts as unknown[]).some((a) => record(a) && a.id === s.id),
      ),
    ],
    forums: Array.isArray(value.forums)
      ? value.forums.map((f) =>
          record(f)
            ? {
                ...f,
                groupId: seed.forums.find((s) => s.id === f.id)?.groupId,
              }
            : f,
        )
      : value.forums,
  };
}
/** Validate persisted browser records and the audit trail for approved role changes. */
export function isDemoState(
  value: unknown,
  expectedAccounts: Pick<DemoAccount, 'id' | 'role'>[],
): value is DemoState {
  if (!record(value) || value.version !== 2) return false;
  const s = value;
  if (!(
    s.activeAccountId === null ||
    (Array.isArray(s.accounts) &&
      s.accounts.some((a: unknown) => record(a) && a.id === s.activeAccountId))
  ))
    return false;
  const valid =
    Array.isArray(s.accounts) &&
    new Set(s.accounts.map((a) => (record(a) ? a.id : null))).size === s.accounts.length &&
    s.accounts.every(
      (a) =>
        fields(a, [
          'id',
          'name',
          'role',
          'email',
          'headline',
          'location',
          'bio',
          'handle',
          'joinedAt',
        ]) &&
        strings(a.skills) &&
        typeof a.role === 'string' &&
        Object.hasOwn(roleLabels, a.role) &&
        (a.suspended === undefined || typeof a.suspended === 'boolean'),
    ) &&
    list(
      s.forums,
      (v) =>
        fields(v, ['id', 'name', 'description']) &&
        (v.memberIds === undefined || strings(v.memberIds)),
    ) &&
    list(
      s.threads,
      (v) =>
        fields(v, ['id', 'authorId', 'body', 'createdAt', 'forumId', 'title']) &&
        typeof v.hidden === 'boolean' &&
        list(v.replies, reply),
    ) &&
    list(
      s.groups,
      (v) => fields(v, ['id', 'name', 'category', 'description']) && strings(v.memberIds),
    ) &&
    list(
      s.requests,
      (v) =>
        fields(v, ['id', 'menteeId', 'mentorId', 'goal']) &&
        member(v.status, ['pending', 'accepted', 'declined']),
    ) &&
    list(s.activity, (v) => fields(v, ['id', 'actorId', 'text', 'createdAt'])) &&
    list(
      s.submissions,
      (v) =>
        fields(v, ['id', 'ownerId', 'title', 'category', 'body']) &&
        member(v.kind, ['article', 'story', 'business']) &&
        member(v.status, ['draft', 'review', 'published']),
    ) &&
    record(s.progress) &&
    Object.values(s.progress).every(strings) &&
    record(s.interests) &&
    Object.values(s.interests).every(strings) &&
    list(
      s.connections,
      (v) => fields(v, ['requesterId', 'recipientId']) && member(v.status, ['pending', 'accepted']),
    ) &&
    list(
      s.registrations,
      (v) =>
        fields(v, ['sessionId', 'memberId']) &&
        member(v.status, ['registered', 'cancelled', 'attended']),
    ) &&
    record(s.pointRules) &&
    ['topic', 'reply', 'blog', 'lesson', 'attendance'].every(
      (k) =>
        typeof s.pointRules === 'object' &&
        s.pointRules !== null &&
        typeof (s.pointRules as RecordValue)[k] === 'number' &&
        Number.isFinite((s.pointRules as RecordValue)[k]) &&
        Number((s.pointRules as RecordValue)[k]) >= 0,
    ) &&
    list(
      s.sessions,
      (v) =>
        fields(v, ['id', 'title', 'summary', 'type', 'status', 'timezone', 'venue']) &&
        member(v.type, [
          'workshop',
          'webinar',
          'bootcamp',
          'masterclass',
          'summit',
          'exhibition',
        ]) &&
        member(v.status, ['upcoming', 'completed', 'postponed']) &&
        strings(v.hostIds) &&
        ['startsAt', 'endsAt', 'registrationDeadline', 'groupId', 'forumId', 'contentId'].every(
          (k) => nullableText(v[k]),
        ) &&
        (v.capacity === null ||
          (typeof v.capacity === 'number' && Number.isInteger(v.capacity) && v.capacity > 0)) &&
        typeof v.fictional === 'boolean',
    );
  if (!valid || !isPlatformState(s.platform)) return false;
  const state = value as unknown as DemoState;
  const staffActors = new Set(expectedAccounts.filter((a) => a.role === 'admin').map((a) => a.id));
  for (let pass = 0; pass < state.accounts.length; pass++)
    for (const e of state.platform.audit)
      if (e.action === 'account-admin' && staffActors.has(e.actorId)) staffActors.add(e.targetId);
  if (
    !state.accounts.every((a) => {
      const baseline = expectedAccounts.find((s) => s.id === a.id)?.role ?? 'guest';
      return (
        a.role === baseline ||
        state.platform.applications.some(
          (r) =>
            r.accountId === a.id &&
            r.role === a.role &&
            r.status === 'approved' &&
            state.platform.audit.some(
              (e) =>
                e.action === 'role-review' &&
                e.targetId === r.id &&
                e.actorId === r.reviewedBy &&
                staffActors.has(e.actorId),
            ),
        ) ||
        state.platform.audit.some(
          (e) => e.action === 'account-admin' && e.targetId === a.id && staffActors.has(e.actorId),
        )
      );
    })
  )
    return false;
  try {
    for (const draft of state.platform.cmsDrafts) assertCmsSnapshot(draft.snapshot);
    for (const release of state.platform.cmsReleases) assertCmsSnapshot(release.snapshot);
  } catch {
    return false;
  }
  const accounts = new Set(state.accounts.map((a) => a.id));
  const forums = new Set(state.forums.map((f) => f.id));
  const groups = new Set(state.groups.map((g) => g.id));
  const sessions = new Set(state.sessions.map((e) => e.id));
  const p = state.platform;
  try {
    p.opportunities.forEach(assertOpportunity);
  } catch {
    return false;
  }
  const ventures = new Set(p.ventures.map((v) => v.id));
  const opportunities = new Set(p.opportunities.map((o) => o.id));
  if (
    !unique(state.accounts.map((a) => a.email.toLowerCase())) ||
    !state.accounts.every((a) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a.email))
  )
    return false;
  if (
    ![
      p.applications,
      p.ventures,
      p.products,
      p.opportunities,
      p.opportunityApplications,
      p.incubations,
      p.certificates,
      p.cmsDrafts,
      p.cmsReleases,
    ].every((rows) => unique(rows.map((row) => row.id)))
  )
    return false;
  if (
    !p.applications.every(
      (a) =>
        accounts.has(a.accountId) &&
        date(a.createdAt) &&
        (a.status === 'pending' || (!!a.reviewedBy && accounts.has(a.reviewedBy))),
    )
  )
    return false;
  if (
    !p.ventures.every((v) => accounts.has(v.ownerId)) ||
    !p.products.every(
      (v) =>
        accounts.has(v.ownerId) &&
        p.ventures.some((venture) => venture.id === v.ventureId && venture.ownerId === v.ownerId),
    )
  )
    return false;
  if (
    !p.opportunities.every((o) => accounts.has(o.ownerId)) ||
    !p.opportunityApplications.every(
      (a) =>
        accounts.has(a.accountId) &&
        opportunities.has(a.opportunityId) &&
        p.ventures.some((v) => v.id === a.ventureId && v.ownerId === a.accountId) &&
        date(a.createdAt),
    )
  )
    return false;
  if (
    !p.incubations.every(
      (i) =>
        accounts.has(i.ownerId) &&
        ventures.has(i.ventureId) &&
        p.ventures.some((v) => v.id === i.ventureId && v.ownerId === i.ownerId) &&
        (!i.mentorId || accounts.has(i.mentorId)) &&
        (!['active', 'completed'].includes(i.status) || !!i.mentorId) &&
        unique(i.milestones.map((m) => m.id)),
    )
  )
    return false;
  if (
    !p.mentors.every((m) => accounts.has(m.accountId)) ||
    !p.organisations.every((o) => accounts.has(o.accountId)) ||
    !unique(p.mentors.map((m) => m.accountId)) ||
    !unique(p.organisations.map((o) => o.accountId))
  )
    return false;
  if (
    !Object.entries(p.enrollments).every(
      ([id, courses]) =>
        accounts.has(id) &&
        unique(courses) &&
        courses.every((c) => Object.hasOwn(p.courseLessons, c)),
    )
  )
    return false;
  if (
    !p.certificates.every(
      (c) =>
        accounts.has(c.accountId) &&
        accounts.has(c.issuedBy) &&
        Object.hasOwn(p.courseLessons, c.courseId) &&
        date(c.issuedAt),
    ) ||
    !p.audit.every((e) => accounts.has(e.actorId) && date(e.createdAt))
  )
    return false;
  return (
    unique(state.forums.map((f) => f.id)) &&
    unique(state.groups.map((g) => g.id)) &&
    unique(state.sessions.map((e) => e.id)) &&
    unique(state.threads.map((t) => t.id)) &&
    state.accounts.every((a) => date(a.joinedAt)) &&
    unique(state.accounts.map((a) => a.handle)) &&
    state.forums.every(
      (f) =>
        (f.groupId === undefined || groups.has(f.groupId)) &&
        (f.memberIds === undefined ||
          (unique(f.memberIds) && f.memberIds.every((id) => accounts.has(id)))),
    ) &&
    state.groups.every((g) => unique(g.memberIds) && g.memberIds.every((id) => accounts.has(id))) &&
    state.threads.every(
      (t) =>
        accounts.has(t.authorId) &&
        forums.has(t.forumId) &&
        date(t.createdAt) &&
        unique(t.replies.map((r) => r.id)) &&
        t.replies.every((r) => accounts.has(r.authorId) && date(r.createdAt)),
    ) &&
    state.activity.every(
      (a) =>
        accounts.has(a.actorId) &&
        date(a.createdAt) &&
        (a.groupId === undefined || groups.has(a.groupId)),
    ) &&
    unique(state.submissions.map((s) => s.id)) &&
    state.submissions.every((s) => accounts.has(s.ownerId)) &&
    state.requests.every((r) => accounts.has(r.menteeId) && accounts.has(r.mentorId)) &&
    [state.progress, state.interests].every((map) =>
      Object.keys(map).every((id) => accounts.has(id)),
    ) &&
    unique(state.connections.map((c) => [c.requesterId, c.recipientId].sort().join(':'))) &&
    state.connections.every(
      (c) =>
        c.requesterId !== c.recipientId &&
        accounts.has(c.requesterId) &&
        accounts.has(c.recipientId),
    ) &&
    unique(state.registrations.map((r) => `${r.sessionId}:${r.memberId}`)) &&
    state.registrations.every((r) => accounts.has(r.memberId) && sessions.has(r.sessionId)) &&
    state.sessions.every(
      (e) =>
        timezone(e.timezone) &&
        unique(e.hostIds) &&
        e.hostIds.every((id) => accounts.has(id)) &&
        (e.groupId === null || groups.has(e.groupId)) &&
        (e.forumId === null || forums.has(e.forumId)) &&
        [e.startsAt, e.endsAt, e.registrationDeadline].every((v) => v === null || date(v)) &&
        (e.status !== 'upcoming' || (!!e.startsAt && !!e.endsAt)) &&
        (!e.startsAt || !e.endsAt || Date.parse(e.endsAt) > Date.parse(e.startsAt)) &&
        (e.capacity === null ||
          state.registrations.filter((r) => r.sessionId === e.id && r.status !== 'cancelled')
            .length <= e.capacity),
    )
  );
}
