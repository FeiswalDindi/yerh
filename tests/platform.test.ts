import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { applyDemoAction, type DemoState } from '../src/domain/demo.ts';
import { isDemoState, migrateDemoState } from '../src/domain/demo-validation.ts';
import { can } from '../src/domain/roles.ts';
import { assertCmsSnapshot } from '../src/domain/cms.ts';
import type { Catalog } from '../src/domain/content.ts';
import { mediaAssets } from '../src/config/media.ts';
const fixture = (n: string) =>
  JSON.parse(readFileSync(new URL(`../src/mocks/data/${n}.json`, import.meta.url), 'utf8'));
const seed = (): DemoState => ({
  version: 2,
  activeAccountId: null,
  accounts: fixture('accounts'),
  ...fixture('community'),
  sessions: fixture('community-events'),
  platform: fixture('platform'),
  progress: {},
  interests: {},
  submissions: [],
});
const catalog = (): Catalog => ({
  items: ['blogs', 'stories', 'businesses', 'events', 'reports', 'member-posts'].flatMap(fixture),
  lessons: fixture('lessons'),
  courses: fixture('learning'),
  topics: fixture('entrepreneurship'),
  faqs: fixture('faqs'),
  homepage: fixture('homepage'),
  sidebar: fixture('sidebar'),
  terms: fixture('terms'),
  site: fixture('site'),
  media: { ...mediaAssets, partners: fixture('partners') },
});
const now = '2026-11-10T09:00:00Z';
const login = (s: DemoState, id: string) => applyDemoAction(s, { type: 'login', accountId: id });
test('signup creates only a guest, passwords are absent, and admin approval unlocks requested permissions', () => {
  let s = applyDemoAction(seed(), {
    type: 'signup',
    id: 'member-new',
    name: 'Test Founder',
    email: 'new@example.test',
    location: 'Nairobi',
    phone: '',
    ageRange: '18–24',
    consent: true,
    now,
  });
  assert.equal(s.accounts.at(-1)?.role, 'guest');
  assert.ok(isDemoState(s, fixture('accounts')), 'A newly signed-up active guest must persist.');
  assert.equal(can(s.accounts.at(-1), 'venture'), false);
  assert.ok(!JSON.stringify(s).includes('password'));
  assert.throws(() => applyDemoAction(s, { type: 'progress', lessonId: 'one' }), /approved role/);
  assert.throws(
    () =>
      applyDemoAction(s, {
        type: 'role-apply',
        id: 'staff',
        role: 'admin' as never,
        motivation: 'I would like to manage the whole platform.',
        organisation: '',
        expertise: '',
        now,
      }),
    /staff/,
  );
  s = applyDemoAction(s, {
    type: 'role-apply',
    id: 'application',
    role: 'entrepreneur',
    motivation: 'I am building a retail venture and would like structured learning and mentorship.',
    organisation: '',
    expertise: '',
    now,
  });
  assert.throws(
    () =>
      applyDemoAction(s, {
        type: 'role-apply',
        id: 'duplicate',
        role: 'mentor',
        motivation: 'I would like to support local entrepreneurs.',
        organisation: '',
        expertise: 'Business',
        now,
      }),
    /pending/,
  );
  assert.throws(
    () =>
      applyDemoAction(s, {
        type: 'role-review',
        id: 'application',
        decision: 'approved',
        reason: 'Eligible founder application.',
        now,
      }),
    /permission/,
  );
  s = applyDemoAction(login(s, 'demo-admin'), {
    type: 'role-review',
    id: 'application',
    decision: 'approved',
    reason: 'Eligible founder application with a clear business goal.',
    now,
  });
  assert.equal(s.accounts.find((a) => a.id === 'member-new')?.role, 'entrepreneur');
  assert.ok(isDemoState(s, fixture('accounts')));
  s = login(s, 'member-new');
  assert.ok(
    isDemoState(s, fixture('accounts')),
    'An approved newly created member must sign in and persist.',
  );
  assert.ok(
    can(
      s.accounts.find((a) => a.id === 'member-new'),
      'venture',
    ),
  );
});
test('staff assignment and suspension require admin and cannot modify own administrative access', () => {
  let s = login(seed(), 'demo-editor');
  assert.ok(
    can(
      s.accounts.find((a) => a.id === 'demo-editor'),
      'cms',
    ),
  );
  assert.throws(
    () =>
      applyDemoAction(s, { type: 'account-admin', accountId: 'demo-founder', role: 'admin', now }),
    /permission/,
  );
  s = login(s, 'demo-admin');
  assert.throws(
    () =>
      applyDemoAction(s, { type: 'account-admin', accountId: 'demo-admin', suspended: true, now }),
    /own/,
  );
  s = applyDemoAction(s, {
    type: 'account-admin',
    accountId: 'demo-founder',
    suspended: true,
    now,
  });
  assert.throws(() => login(s, 'demo-founder'), /suspended/);
  assert.ok(isDemoState(s, fixture('accounts')));
});
test('CMS drafts do not publish, stale drafts cannot overwrite a release, and rollback creates a new revision', () => {
  let s = login(seed(), 'demo-editor');
  const baseline = {
    catalog: catalog(),
    sessions: s.sessions,
    opportunities: s.platform.opportunities,
  };
  assert.doesNotThrow(() => assertCmsSnapshot(baseline, s));
  const snapshot = structuredClone(baseline);
  snapshot.catalog.homepage.slides[0]!.title = 'Updated homepage';
  s = applyDemoAction(s, {
    type: 'cms-save',
    draft: {
      id: 'draft',
      ownerId: 'demo-editor',
      title: 'Homepage refresh',
      baseRevision: 0,
      snapshot,
      updatedAt: now,
    },
    baseline,
    now,
  });
  assert.equal(s.platform.cmsReleases.at(-1)?.revision, 0);
  assert.notEqual(
    s.platform.cmsReleases.at(-1)?.snapshot.catalog.homepage.slides[0]?.title,
    'Updated homepage',
  );
  s = applyDemoAction(s, { type: 'cms-publish', id: 'draft', now });
  assert.equal(s.platform.cmsRevision, 1);
  assert.equal(
    s.platform.cmsReleases.at(-1)?.snapshot.catalog.homepage.slides[0]?.title,
    'Updated homepage',
  );
  assert.throws(
    () =>
      applyDemoAction(s, {
        type: 'cms-save',
        draft: {
          id: 'stale',
          ownerId: 'demo-editor',
          title: 'Stale copy',
          baseRevision: 0,
          snapshot,
          updatedAt: now,
        },
        now,
      }),
    /changed/,
  );
  s = applyDemoAction(s, { type: 'cms-rollback', revision: 0, now });
  assert.equal(s.platform.cmsRevision, 2);
  assert.equal(
    s.platform.cmsReleases.at(-1)?.snapshot.catalog.homepage.slides[0]?.title,
    baseline.catalog.homepage.slides[0]?.title,
  );
  assert.ok(isDemoState(s, fixture('accounts')));
});
test('CMS rejects unsafe links, broken featured references and capacity below reservations', () => {
  const s = seed();
  const snapshot = {
    catalog: catalog(),
    sessions: s.sessions,
    opportunities: s.platform.opportunities,
  };
  for (const mutate of [
    (v: typeof snapshot) => (v.catalog.homepage.slides[0]!.href = 'javascript:alert(1)'),
    (v: typeof snapshot) => v.catalog.homepage.featuredStories.push('missing'),
    (v: typeof snapshot) => (v.sessions[0]!.capacity = 0),
  ]) {
    const bad = structuredClone(snapshot);
    mutate(bad);
    assert.throws(() => assertCmsSnapshot(bad, s));
  }
  assert.throws(
    () => applyDemoAction(login(s, 'demo-founder'), { type: 'cms-publish', id: 'draft', now }),
    /permission/,
  );
});
test('opportunity applications require approved venture ownership, prevent duplicates and respect owner-only decisions', () => {
  let s = login(seed(), 'demo-founder');
  s = applyDemoAction(s, {
    type: 'opportunity-apply',
    id: 'opp-app',
    opportunityId: 'demo-seed-grant',
    ventureId: 'demo-venture-green',
    motivation:
      'Our sustainable retail venture is ready to test a new market and needs structured feedback.',
    now,
  });
  assert.throws(
    () =>
      applyDemoAction(s, {
        type: 'opportunity-apply',
        id: 'dup',
        opportunityId: 'demo-seed-grant',
        ventureId: 'demo-venture-green',
        motivation: 'I would like to apply again for the same opportunity.',
        now,
      }),
    /already/,
  );
  assert.throws(
    () =>
      applyDemoAction(login(s, 'demo-partner'), {
        type: 'opportunity-review',
        id: 'opp-app',
        status: 'accepted',
        now,
      }),
    /owner/,
  );
  s = applyDemoAction(login(s, 'demo-investor'), {
    type: 'opportunity-review',
    id: 'opp-app',
    status: 'accepted',
    now,
  });
  assert.equal(s.platform.opportunityApplications[0]?.status, 'accepted');
  assert.throws(
    () =>
      applyDemoAction(s, { type: 'opportunity-review', id: 'opp-app', status: 'rejected', now }),
    /transition/,
  );
});
test('enrollment is required for progress and certificates require completed coursework', () => {
  let s = login(seed(), 'demo-founder');
  const course = fixture('learning')[0];
  assert.throws(
    () => applyDemoAction(s, { type: 'progress', lessonId: course.lessonIds[0] }),
    /Enroll/,
  );
  s = applyDemoAction(s, { type: 'enroll', courseId: course.id, operation: 'enroll', now });
  for (const id of course.lessonIds) s = applyDemoAction(s, { type: 'progress', lessonId: id });
  s = applyDemoAction(login(s, 'demo-admin'), {
    type: 'certificate-issue',
    id: 'cert',
    accountId: 'demo-founder',
    courseId: course.id,
    now,
  });
  assert.equal(s.platform.certificates[0]?.accountId, 'demo-founder');
  assert.throws(
    () =>
      applyDemoAction(s, {
        type: 'certificate-issue',
        id: 'dup',
        accountId: 'demo-founder',
        courseId: course.id,
        now,
      }),
    /already/,
  );
});
test('legacy version-2 records migrate to canonical roles without losing contributions or activity', () => {
  const original = seed();
  const legacy = { ...original } as Partial<DemoState>;
  delete legacy.platform;
  const migrated = migrateDemoState(legacy, seed());
  assert.ok(isDemoState(migrated, fixture('accounts')));
  assert.deepEqual(migrated.activity, original.activity);
  assert.equal(migrated.accounts.find((a) => a.id === 'demo-editor')?.role, 'content_manager');
});

test('venture approval, incubation assignment, mentor updates and graduation preserve ownership and validated progress', () => {
  let s = login(seed(), 'demo-founder');
  const act = (action: Parameters<typeof applyDemoAction>[1]) => {
    s = applyDemoAction(s, action);
    assert.ok(isDemoState(s, fixture('accounts')), action.type);
  };
  act({
    type: 'incubation-apply',
    id: 'incubation',
    ventureId: 'demo-venture-green',
    goal: 'Validate customer demand and prepare a sustainable route to market.',
    now,
  });
  assert.throws(
    () =>
      applyDemoAction(s, {
        type: 'incubation-assign',
        id: 'incubation',
        mentorId: 'demo-mentor',
        decision: 'active',
        now,
      }),
    /permission/,
  );
  s = login(s, 'demo-admin');
  act({
    type: 'incubation-assign',
    id: 'incubation',
    mentorId: 'demo-mentor',
    decision: 'active',
    now,
  });
  assert.throws(
    () => applyDemoAction(s, { type: 'incubation-complete', id: 'incubation', now }),
    /milestone/,
  );
  s = login(s, 'demo-mentor');
  act({
    type: 'milestone',
    id: 'incubation',
    milestoneId: 'one',
    title: 'Customer discovery',
    note: 'Interview five customers and review the evidence together.',
    validated: false,
    now,
  });
  s = login(s, 'demo-founder');
  assert.throws(
    () =>
      applyDemoAction(s, {
        type: 'milestone',
        id: 'incubation',
        milestoneId: 'one',
        title: 'Customer discovery',
        note: 'The founder cannot validate their own milestone.',
        validated: true,
        now,
      }),
    /permission/,
  );
  s = login(s, 'demo-mentor');
  act({
    type: 'milestone',
    id: 'incubation',
    milestoneId: 'one',
    title: 'Customer discovery',
    note: 'Reviewed five interview records and validated the findings.',
    validated: true,
    now,
  });
  assert.equal(s.platform.incubations[0]!.milestones.length, 1);
  s = login(s, 'demo-admin');
  act({ type: 'incubation-complete', id: 'incubation', now });
  assert.equal(s.platform.incubations[0]!.status, 'completed');
  assert.throws(
    () =>
      applyDemoAction(login(s, 'demo-mentor'), {
        type: 'milestone',
        id: 'incubation',
        milestoneId: 'one',
        title: 'Changed milestone',
        note: 'Cannot change an already completed incubation.',
        validated: true,
        now,
      }),
    /assigned/,
  );
});

test('organisation approval gates opportunity creation and later owner edits invalidate older CMS drafts', () => {
  let s = login(seed(), 'demo-partner');
  s = applyDemoAction(s, {
    type: 'organisation-save',
    organisation: {
      ...s.platform.organisations.find((o) => o.accountId === 'demo-partner')!,
      name: 'Updated partner organisation',
    },
    now,
  });
  const o = { ...s.platform.opportunities[1]!, id: 'new-opportunity', slug: 'new-opportunity' };
  assert.throws(
    () => applyDemoAction(s, { type: 'opportunity-save', opportunity: o, now }),
    /approved/,
  );
  s = applyDemoAction(login(s, 'demo-admin'), {
    type: 'venture-review',
    entity: 'organisation',
    id: 'demo-partner',
    decision: 'approved',
    now,
  });
  s = applyDemoAction(login(s, 'demo-partner'), { type: 'opportunity-save', opportunity: o, now });
  assert.equal(s.platform.opportunities.at(-1)?.status, 'draft');
  s = applyDemoAction(s, { type: 'opportunity-status', id: o.id, status: 'review', now });
  assert.throws(
    () => applyDemoAction(s, { type: 'opportunity-status', id: o.id, status: 'published', now }),
    /permission/,
  );
  s = applyDemoAction(login(s, 'demo-editor'), {
    type: 'opportunity-status',
    id: o.id,
    status: 'published',
    now,
  });
  const rev = s.platform.cmsRevision;
  s = applyDemoAction(s, {
    type: 'cms-save',
    draft: {
      id: 'editor-draft',
      ownerId: 'demo-editor',
      title: 'Editorial changes',
      baseRevision: rev,
      snapshot: {
        catalog: catalog(),
        sessions: s.sessions,
        opportunities: s.platform.opportunities,
      },
      updatedAt: now,
    },
    now,
  });
  s = applyDemoAction(login(s, 'demo-partner'), {
    type: 'opportunity-save',
    opportunity: { ...o, title: 'Updated partner opportunity' },
    now,
  });
  assert.equal(s.platform.opportunities.at(-1)?.status, 'draft');
  assert.throws(
    () =>
      applyDemoAction(login(s, 'demo-editor'), { type: 'cms-publish', id: 'editor-draft', now }),
    /stale/,
  );
  assert.ok(isDemoState(s, fixture('accounts')));
});

test('rejected role applications may be resubmitted and legacy accounts retain edits when new seed roles are introduced', () => {
  let s = login(seed(), 'demo-guest');
  const application = {
    type: 'role-apply',
    id: 'first',
    role: 'mentor',
    motivation:
      'I have experience supporting small businesses and would like to offer structured guidance.',
    expertise: 'Marketing and customer discovery',
    organisation: '',
    now,
  } as const;
  s = applyDemoAction(s, application);
  s = applyDemoAction(login(s, 'demo-admin'), {
    type: 'role-review',
    id: 'first',
    decision: 'rejected',
    reason: 'Please provide more evidence of mentoring experience.',
    now,
  });
  s = applyDemoAction(login(s, 'demo-guest'), { ...application, id: 'second' });
  assert.equal(s.accounts.find((a) => a.id === 'demo-guest')?.role, 'guest');
  assert.equal(s.platform.applications.filter((a) => a.status === 'pending').length, 1);
  const legacy = {
    ...seed(),
    version: 1,
    accounts: fixture('accounts').filter(
      (a: { id: string }) => !['demo-guest', 'demo-partner', 'demo-investor'].includes(a.id),
    ),
  };
  legacy.accounts[0].bio = 'A preserved profile biography from the older demo.';
  const migrated = migrateDemoState(legacy, seed()) as DemoState;
  assert.ok(isDemoState(migrated, fixture('accounts')));
  assert.equal(migrated.accounts[0]?.bio, legacy.accounts[0].bio);
  assert.ok(migrated.accounts.some((a) => a.id === 'demo-investor'));
});
