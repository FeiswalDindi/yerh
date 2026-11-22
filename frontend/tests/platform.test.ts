import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { applyDemoAction, type DemoAction, type DemoState } from '../src/domain/demo.ts';
import { isDemoState, migrateDemoState } from '../src/domain/demo-validation.ts';
import { can } from '../src/domain/roles.ts';
import { institutionProgramme } from '../src/domain/institution-programme.ts';
import { assertCmsSnapshot } from '../src/domain/cms.ts';
import type { Catalog } from '../src/domain/content.ts';
import { mediaAssets } from '../src/config/media.ts';
import {
  canPublishProduct,
  cohortForVenture,
  incubationCertificateQueue,
  migrateSchoolPathways,
  schoolDivision,
  stageUnlocked,
  type StageId,
} from '../src/domain/incubation.ts';
import { sessionCategory } from '../src/domain/events.ts';
import { courseCertificateQueue, courseCompletionRecords } from '../src/domain/courses.ts';
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
  team: fixture('team'),
  media: { ...mediaAssets, partners: fixture('partners') },
});
const now = '2026-11-10T09:00:00Z';
const login = (s: DemoState, id: string) => applyDemoAction(s, { type: 'login', accountId: id });

test('mentor proposals unlock authoring and paid enrollments record one royalty at the charged price', () => {
  const { act, reject, owner, mentor, admin, state } = trainingScenario();
  const id = 'record-keeping';
  const courseId = 'mentor-course-record-keeping';
  const edit = {
    type: 'course-module-save',
    id,
    moduleId: 'first',
    title: 'Record sales',
    body: 'Add a sales transaction to a simple ledger.',
    now,
  } as const;
  act(mentor, {
    type: 'course-propose',
    id,
    title: 'Record keeping for small shops',
    audience: 'Early-stage founders',
    description: 'Practise the record keeping skills needed to run a shop.',
    documents: [
      { name: 'outline.pdf', data: 'data:application/pdf;base64,JVBERi0xLjQK' },
      { name: 'outcomes.pdf', data: 'data:application/pdf;base64,JVBERi0xLjQK' },
    ],
    now,
  });
  reject(mentor, edit, /approved mentor/);
  act(admin, {
    type: 'course-proposal-review',
    id,
    decision: 'approved',
    feedback: 'Approved the outline and intended audience.',
    royaltyPercent: 25,
    now,
  });
  reject(owner, edit, /approved mentor/);
  act(mentor, edit);
  act(mentor, { type: 'course-publish', id, price: 1000, now });
  act(admin, { type: 'course-price', id: courseId, price: 1000, discount: 250, now });
  const buy = { type: 'course-purchase', id: courseId, expectedPrice: 750, now } as const;
  reject(mentor, buy, /eligible learner/);
  reject(admin, buy, /eligible learner/);
  for (const actor of [mentor, admin])
    reject(
      actor,
      { type: 'venture-save', now, venture: state().platform.ventures[0]! },
      /permission/,
    );
  reject(owner, { ...buy, expectedPrice: 1000 }, /price changed/);
  act(owner, buy);
  act(owner, buy);
  assert.deepEqual(
    state().platform.courseCommerce?.purchases.map((row) => [row.amount, row.royaltyCents]),
    [[750, 18750]],
  );
  const completed = applyDemoAction(login(state(), owner), {
    type: 'progress',
    lessonId: courseId + '-first',
  });
  assert.deepEqual(completed.progress[owner], [courseId + '-first']);
  assert.throws(
    () =>
      applyDemoAction(login(completed, mentor), {
        type: 'progress',
        lessonId: courseId + '-first',
      }),
    /approved role/,
  );
});

test('school access uses a shared workspace and logs the acting staff identity', () => {
  const { act, reject, admin, state } = trainingScenario();
  const school = 'demo-high-school';
  const command = {
    type: 'institution-student',
    id: 'shared-student',
    name: 'Demo Learner',
    institutionContextId: school,
    now,
  } as const;
  const settings = {
    type: 'institution-settings',
    id: school,
    amount: 5000,
    contacts: [],
    contactIds: ['demo-guest'],
    staffIds: [admin],
    notes: 'Recorded application.',
    visit: '2026-11-10',
    terms: 'Agreement on file.',
    now,
  } as const;
  act(admin, {
    ...settings,
    contactIds: [...settings.contactIds],
    staffIds: [...settings.staffIds],
  });
  reject('demo-guest', command, /selected institution/);
  reject(admin, { ...command, institutionContextId: 'demo-university' }, /selected institution/);
  act(admin, command);
  assert.equal(state().platform.training.students.at(-1)?.institutionId, school);
  assert.equal(state().platform.audit[0]?.actorId, admin);
  assert.equal(state().platform.audit[0]?.institutionId, school);
});
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
  assert.throws(() => applyDemoAction(s, { type: 'progress', lessonId: 'one' }), /Enroll/);
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
    institutionId: 'demo-university',
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
test('CMS featured selections publish together, retain an audit and restore with their revision', () => {
  let s = login(seed(), 'demo-editor');
  const baseline = {
    catalog: catalog(),
    sessions: s.sessions,
    opportunities: s.platform.opportunities,
  };
  const snapshot = structuredClone(baseline);
  snapshot.opportunities[0]!.featured = false;
  snapshot.opportunities[1]!.featured = true;
  s = applyDemoAction(s, {
    type: 'cms-save',
    draft: {
      id: 'featured-selection',
      ownerId: 'demo-editor',
      title: 'Update featured opportunities',
      baseRevision: 0,
      snapshot,
      updatedAt: now,
    },
    baseline,
    now,
  });
  assert.deepEqual(s.platform.opportunities, baseline.opportunities);
  s = applyDemoAction(s, { type: 'cms-publish', id: 'featured-selection', now });
  assert.deepEqual(s.platform.opportunities, snapshot.opportunities);
  assert.deepEqual(s.platform.cmsReleases.at(-1)?.snapshot.opportunities, snapshot.opportunities);
  assert.equal(s.platform.audit[0]?.action, 'cms-publish');
  assert.equal(s.platform.audit[0]?.actorId, 'demo-editor');
  assert.equal(s.platform.audit[0]?.targetId, 'release-1');
  s = applyDemoAction(s, { type: 'cms-rollback', revision: 0, now });
  assert.deepEqual(s.platform.opportunities, baseline.opportunities);
  assert.equal(s.platform.audit[0]?.action, 'cms-rollback');
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
    (v: typeof snapshot) => (v.catalog.team!.members[0]!.linkedinUrl = 'javascript:alert(1)'),
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
  assert.throws(
    () => applyDemoAction(s, { type: 'enroll', courseId: course.id, operation: 'enroll', now }),
    /Pay for this course/,
  );
  s = applyDemoAction(s, { type: 'course-purchase', id: course.id, expectedPrice: 750, now });
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
test('a guest can complete a course, earn a certificate, and reserve and cancel an eligible event', () => {
  let s = login(seed(), 'demo-guest');
  const course = fixture('learning')[0];
  s = applyDemoAction(s, { type: 'course-purchase', id: course.id, expectedPrice: 750, now });
  const certificate = {
    type: 'certificate-issue',
    id: 'guest-certificate',
    accountId: 'demo-guest',
    courseId: course.id,
    now,
  } as const;
  assert.throws(() => applyDemoAction(s, certificate), /permission/);
  assert.throws(
    () => applyDemoAction(login(s, 'demo-admin'), certificate),
    /lessons must be completed/,
  );
  for (const lessonId of course.lessonIds.slice(0, -1))
    s = applyDemoAction(s, { type: 'progress', lessonId, now });
  assert.deepEqual(courseCertificateQueue(s), []);
  const lessonId = course.lessonIds.at(-1)!;
  s = applyDemoAction(s, { type: 'progress', lessonId, now });
  const completion = { accountId: 'demo-guest', courseId: course.id, completedAt: now };
  assert.deepEqual(courseCertificateQueue(s), [completion]);
  s = applyDemoAction(s, { type: 'enroll', courseId: course.id, operation: 'withdraw', now });
  const legacy = { ...s, platform: { ...s.platform, courseCompletions: undefined } };
  assert.deepEqual(courseCertificateQueue(legacy), [
    { accountId: 'demo-guest', courseId: course.id },
  ]);
  assert.deepEqual(courseCertificateQueue(s), [completion]);
  s = applyDemoAction(login(s, 'demo-admin'), certificate);
  assert.deepEqual(courseCertificateQueue(s), []);
  assert.deepEqual(courseCompletionRecords(s), [completion]);
  assert.throws(() => applyDemoAction(s, certificate), /already exists/);
  s = login(s, 'demo-guest');
  assert.equal(s.platform.certificates[0]?.accountId, 'demo-guest');
  const reservation = { type: 'registration', sessionId: 'demo-customer-discovery', now } as const;
  s = applyDemoAction(s, { ...reservation, operation: 'register' });
  assert.equal(s.registrations.find((r) => r.memberId === 'demo-guest')?.status, 'registered');
  s = applyDemoAction(s, { ...reservation, operation: 'cancel' });
  assert.equal(s.registrations.find((r) => r.memberId === 'demo-guest')?.status, 'cancelled');
  assert.ok(isDemoState(s, fixture('accounts')));
});

test('email sign-in requires the institution linked to the account', () => {
  const initial = seed();
  const emailLogin = (email: string, institutionId: string, state = initial) =>
    applyDemoAction(state, { type: 'email-sign-in', email, institutionId });

  assert.equal(
    emailLogin('  DEMO-FOUNDER@EXAMPLE.TEST ', 'demo-university').activeAccountId,
    'demo-founder',
  );
  assert.throws(
    () => emailLogin('demo-founder@example.test', 'demo-high-school'),
    /selected institution/,
  );
  assert.throws(() => emailLogin('demo-founder@example.test', 'yerh'), /selected institution/);
  assert.equal(
    emailLogin('demo-school@example.test', 'demo-high-school').activeAccountId,
    'demo-school',
  );
  assert.throws(
    () => emailLogin('demo-school@example.test', 'demo-university'),
    /selected institution/,
  );
  assert.throws(
    () => emailLogin('demo-university-staff@example.test', 'demo-high-school'),
    /selected institution/,
  );
  assert.equal(emailLogin('demo-admin@example.test', 'yerh').activeAccountId, 'demo-admin');
  assert.throws(
    () => emailLogin('demo-guest@example.test', 'demo-high-school'),
    /selected institution/,
  );
  assert.throws(() => emailLogin('demo-guest@example.test', ''), /active portal/);
  assert.throws(
    () => emailLogin('demo-guest@example.test', 'yerh', login(initial, 'demo-admin')),
    /sign out/i,
  );
  const deactivated = applyDemoAction(login(initial, 'demo-admin'), {
    type: 'institution-deactivate',
    id: 'demo-university',
    now,
  });
  assert.throws(
    () =>
      emailLogin('demo-founder@example.test', 'demo-university', {
        ...deactivated,
        activeAccountId: null,
      }),
    /active portal/,
  );
  const signup = {
    type: 'signup',
    id: 'guest-with-preference',
    name: 'Preview Guest',
    email: 'preferred@example.test',
    location: 'Nairobi',
    phone: '',
    ageRange: '',
    consent: true,
    institutionId: 'demo-university',
    now,
  } as const;
  const guest = applyDemoAction(initial, signup);
  assert.ok(isDemoState(guest, fixture('accounts')));
  assert.equal(guest.accounts.at(-1)?.preferredInstitutionId, 'demo-university');
  assert.equal(guest.platform.training.affiliations[signup.id], undefined);
  const signedOut = { ...guest, activeAccountId: null };
  assert.equal(emailLogin(signup.email, 'demo-university', signedOut).activeAccountId, signup.id);
  assert.equal(emailLogin(signup.email, 'yerh', signedOut).activeAccountId, signup.id);
  assert.throws(
    () => emailLogin(signup.email, 'demo-high-school', signedOut),
    /selected institution/,
  );
  assert.throws(
    () =>
      applyDemoAction(signedOut, { ...signup, id: 'duplicate', email: signup.email.toUpperCase() }),
    /already exists/,
  );
});

test('incubation applications need an active university or hub and record affiliation only on approval', () => {
  const { act, reject, state, admin } = trainingScenario();
  const guest = 'demo-guest';
  const request = {
    type: 'role-apply',
    id: 'affiliation-application',
    role: 'entrepreneur',
    motivation: 'I am affiliated with this institution and want to test a local venture.',
    organisation: '',
    expertise: '',
    now,
  } as const;
  reject(guest, request, /active university or hub/);
  reject(guest, { ...request, institutionId: 'demo-high-school' }, /active university or hub/);
  act(guest, { ...request, institutionId: 'demo-university' });
  assert.equal(state().platform.training.affiliations[guest], undefined);
  const review = {
    type: 'role-review',
    id: request.id,
    decision: 'rejected',
    reason: 'Please provide more detail about your affiliation.',
    now,
  } as const;
  act(admin, review);
  assert.equal(state().accounts.find((row) => row.id === guest)?.role, 'guest');
  act(guest, { ...request, institutionId: 'demo-university', id: 'resubmitted' });
  reject(
    admin,
    { type: 'account-admin', accountId: guest, role: 'entrepreneur', now },
    /approve an incubation application/i,
  );
  act(admin, { ...review, id: 'resubmitted', decision: 'approved' });
  assert.equal(state().accounts.find((row) => row.id === guest)?.role, 'entrepreneur');
  assert.equal(state().platform.training.affiliations[guest], 'demo-university');
});

test('hub invitations are scoped, single use, and can activate new or existing learner accounts', () => {
  const { act, reject, state, admin } = trainingScenario();
  const hubStaff = 'demo-editor';
  const hub = 'test-enterprise-hub';
  act(admin, {
    type: 'institution-create',
    id: hub,
    kind: 'hub',
    name: 'Test Enterprise Hub',
    adminId: '',
    amount: 18000,
    now,
  });
  assert.equal(state().platform.training.institutions.find((row) => row.id === hub)?.adminId, '');
  const invite = {
    type: 'institution-invite',
    id: 'membership-link',
    institutionId: hub,
    email: 'invited-learner@example.test',
    name: 'Invited Learner',
    now,
  } as const;
  reject(hubStaff, invite, /active university or hub/);
  act(admin, {
    type: 'institution-proof',
    id: hub,
    name: 'test-hub-agreement.pdf',
    data: 'data:application/pdf;base64,JVBERi0xLjQK',
    now,
  });
  reject(admin, { type: 'institution-activate', id: hub, now }, /administrator before activating/);
  const assign = { type: 'institution-assign-admin', id: hub, adminId: hubStaff, now } as const;
  reject(admin, assign, /available institutional administrator/);
  reject(admin, { ...assign, adminId: 'demo-school' }, /available institutional administrator/);
  reject(
    admin,
    { type: 'account-admin', accountId: hubStaff, role: 'school_admin', now },
    /guest account/,
  );
  act(admin, { type: 'account-admin', accountId: hubStaff, role: 'guest', now });
  act(admin, { type: 'account-admin', accountId: hubStaff, role: 'school_admin', now });
  reject(hubStaff, assign, /pending institution awaiting/);
  act(admin, assign);
  act(admin, { type: 'institution-activate', id: hub, now });
  reject(
    'demo-school',
    { ...invite, institutionId: 'demo-high-school' },
    /active university or hub/,
  );
  reject('demo-university-staff', invite, /authorized staff access/);
  const batch = {
    type: 'institution-invite-bulk',
    institutionId: hub,
    entries: [
      { id: invite.id, name: invite.name, email: invite.email },
      { id: 'another-hub-invitation', name: 'Second Learner', email: 'SECOND@example.test' },
    ],
    now,
  } as const;
  const bulk = { ...batch, entries: [...batch.entries] };
  reject('demo-university-staff', bulk, /authorized staff access/);
  reject(
    hubStaff,
    {
      ...bulk,
      entries: [batch.entries[0], { ...batch.entries[1], email: invite.email.toUpperCase() }],
    },
    /Entry 2.*more than once in the batch/,
  );
  reject(
    hubStaff,
    {
      ...bulk,
      entries: [batch.entries[0], { ...batch.entries[1], email: 'demo-founder@example.test' }],
    },
    /Entry 2.*already has an institution affiliation/,
  );
  assert.equal(state().platform.institutionInvitations?.length ?? 0, 0);
  act(hubStaff, bulk);
  assert.deepEqual(
    state().platform.institutionInvitations?.map(({ email }) => email),
    [invite.email, 'second@example.test'],
  );
  assert.equal(
    applyDemoAction(
      { ...state(), activeAccountId: null },
      {
        type: 'email-sign-in',
        email: 'demo-editor@example.test',
        institutionId: hub,
      },
    ).activeAccountId,
    hubStaff,
  );
  const claim = {
    type: 'institution-invite-accept',
    id: invite.id,
    accountId: 'new-invited-member',
    location: 'Nairobi',
    consent: true,
    now,
  } as const;
  reject('demo-guest', claim, /sign out/i);
  let accepted = applyDemoAction({ ...state(), activeAccountId: null }, claim);
  assert.ok(isDemoState(accepted, fixture('accounts')));
  assert.equal(accepted.activeAccountId, claim.accountId);
  assert.equal(accepted.accounts.find((row) => row.id === claim.accountId)?.role, 'entrepreneur');
  assert.equal(accepted.platform.training.affiliations[claim.accountId], hub);
  const reportFor = (viewer: string, institutionId: string) =>
    institutionProgramme(
      accepted.platform,
      accepted.accounts,
      institutionId,
      accepted.accounts.find((row) => row.id === viewer)!,
    );
  assert.deepEqual(
    reportFor(hubStaff, hub)?.members.map(({ id }) => id),
    [claim.accountId],
  );
  assert.equal(reportFor(hubStaff, hub)?.members[0]?.ventures.length, 0);
  assert.equal(reportFor('demo-university-staff', hub), null);
  assert.equal(reportFor(hubStaff, 'demo-university'), null);
  assert.equal(reportFor(claim.accountId, hub), null);
  assert.throws(() => applyDemoAction(accepted, claim), /no longer available/);

  const guest = state().accounts.find((row) => row.id === 'demo-guest')!;
  act(guest.id, { type: 'course-purchase', id: 'business-foundations', expectedPrice: 750, now });
  act(guest.id, {
    type: 'progress',
    lessonId: 'business-opportunities-mapping-and-idea-generation',
    now,
  });
  act(guest.id, {
    type: 'role-apply',
    id: 'earlier-request',
    role: 'entrepreneur',
    institutionId: 'demo-university',
    motivation: 'I want to test a venture after completing my first short course.',
    organisation: '',
    expertise: '',
    now,
  });
  act(admin, { ...invite, id: 'existing-link', email: guest.email, name: guest.name });
  assert.equal(
    applyDemoAction(
      { ...state(), activeAccountId: null },
      { type: 'email-sign-in', email: guest.email, institutionId: hub },
    ).activeAccountId,
    guest.id,
  );
  assert.throws(
    () =>
      applyDemoAction(
        { ...state(), activeAccountId: null },
        { type: 'email-sign-in', email: guest.email, institutionId: 'demo-university' },
      ),
    /selected institution/,
  );
  reject('demo-mentor', { ...claim, id: 'existing-link' }, /invited email/);
  act(guest.id, { ...claim, id: 'existing-link' });
  accepted = state();
  assert.equal(accepted.accounts.find((row) => row.id === guest.id)?.role, 'entrepreneur');
  assert.equal(accepted.accounts.length, fixture('accounts').length);
  assert.ok(accepted.platform.enrollments[guest.id]?.includes('business-foundations'));
  assert.ok(
    accepted.progress[guest.id]?.includes('business-opportunities-mapping-and-idea-generation'),
  );
  assert.equal(
    applyDemoAction(
      { ...accepted, activeAccountId: null },
      {
        type: 'email-sign-in',
        email: guest.email,
        institutionId: hub,
      },
    ).activeAccountId,
    guest.id,
  );
  assert.throws(
    () =>
      applyDemoAction(
        { ...accepted, activeAccountId: null },
        {
          type: 'email-sign-in',
          email: guest.email,
          institutionId: 'demo-university',
        },
      ),
    /selected institution/,
  );
  assert.equal(
    accepted.platform.applications.find((row) => row.id === 'earlier-request')?.status,
    'withdrawn',
  );
});

test('members request role changes independently of first applications and retain their role until review', () => {
  const request = {
    type: 'role-change-request',
    id: 'change-to-mentor',
    role: 'mentor',
    motivation: 'I want to mentor founders after developing my own business.',
    expertise: 'Customer discovery and business planning',
    organisation: '',
    now,
  } as const;
  assert.throws(() => applyDemoAction(login(seed(), 'demo-guest'), request), /first role/);
  let s = login(seed(), 'demo-founder');
  assert.throws(() => applyDemoAction(s, { ...request, type: 'role-apply' }), /My profile/);
  s = applyDemoAction(s, request);
  assert.equal(s.platform.applications[0]?.fromRole, 'entrepreneur');
  assert.equal(s.accounts.find((a) => a.id === 'demo-founder')?.role, 'entrepreneur');
  assert.throws(() => applyDemoAction(s, { ...request, id: 'duplicate' }), /pending/);
  s = applyDemoAction(login(s, 'demo-admin'), {
    type: 'role-review',
    id: request.id,
    decision: 'approved',
    reason: 'Approved to support other founders.',
    now,
  });
  assert.equal(s.accounts.find((a) => a.id === 'demo-founder')?.role, 'mentor');
  assert.ok(isDemoState(s, fixture('accounts')));
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
    /all three stage assessments/,
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
    /not assigned/,
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
  assert.throws(
    () => applyDemoAction(s, { type: 'incubation-complete', id: 'incubation', now }),
    /all three stage assessments/,
  );
});

function trainingScenario() {
  let state = seed();
  const act = (accountId: string, action: DemoAction) => {
    state = applyDemoAction(login(state, accountId), action);
    assert.ok(isDemoState(state, fixture('accounts')), action.type);
  };
  const reject = (accountId: string, action: DemoAction, message: RegExp) =>
    assert.throws(() => applyDemoAction(login(state, accountId), action), message);
  const owner = 'demo-founder';
  const mentor = 'demo-mentor';
  const admin = 'demo-admin';
  function launch(accountId: string, ventureId: string, productIds: string[] = []) {
    act(accountId, {
      type: 'incubation-apply',
      id: 'pathway',
      ventureId,
      productIds,
      now,
      goal: 'Test the offer and build a viable enterprise with customer evidence.',
    });
    if (accountId === 'demo-school') {
      assert.equal(state.platform.incubations.at(-1)?.status, 'active');
      assert.equal(state.platform.incubations.at(-1)?.mentorId, '');
    } else {
      act(admin, {
        type: 'incubation-assign',
        id: 'pathway',
        mentorId: mentor,
        decision: 'active',
        now,
      });
    }
  }
  function openStage(accountId: string, stage: StageId) {
    const key = { incubationId: 'pathway', stage, now };
    for (const step of state.platform.training.curriculum.find((row) => row.id === stage)!.steps) {
      act(accountId, {
        ...key,
        type: 'stage-evidence',
        stepId: step.id,
        evidence: 'Evidence from a completed classroom challenge and a real customer conversation.',
        requestFeedback: true,
      });
    }
    if (accountId === 'demo-school') {
      reject(admin, { ...key, type: 'school-stage-open' }, /access/);
      act(accountId, { ...key, type: 'school-stage-open' });
      reject(mentor, { ...key, type: 'stage-meeting', meetingAt: now }, /access/);
      assert.equal(
        state.platform.training.stages.find((row) => row.stage === stage)?.examOpenedAt,
        now,
      );
      return key;
    }
    act(mentor, {
      ...key,
      type: 'stage-feedback',
      stepId: state.platform.training.curriculum.find((row) => row.id === stage)!.steps[0]!.id,
      feedback: 'Give a concrete customer example.',
    });
    act(accountId, { ...key, type: 'stage-request' });
    act(mentor, { ...key, type: 'stage-meeting', meetingAt: now });
    reject(admin, { ...key, type: 'stage-open-exam', note: 'Ready for the stage exam.' }, /access/);
    act(mentor, {
      ...key,
      type: 'stage-open-exam',
      note: 'Reviewed evidence together and ready for the stage exam.',
    });
    return key;
  }
  function product(id: string, ventureId = 'demo-venture-green') {
    act(owner, {
      type: 'product-save',
      now,
      product: {
        id,
        ventureId,
        ownerId: owner,
        name: `Product ${id}`,
        description: 'A test product for the venture marketplace.',
        price: 200,
        status: 'pending',
      },
    });
    act(admin, { type: 'venture-review', entity: 'product', id, decision: 'approved', now });
  }
  const visible = (id: string) =>
    canPublishProduct(
      state.platform,
      state.platform.products.find((row) => row.id === id)!,
    );
  return {
    act,
    reject,
    owner,
    mentor,
    admin,
    launch,
    openStage,
    product,
    visible,
    state: () => state,
  };
}

test('graded stages complete in order independently of score and fees, with product-specific graduation and a free final credential', () => {
  const { act, reject, owner, mentor, admin, launch, openStage, product, visible, state } =
    trainingScenario();
  const report = (viewer = 'demo-university-staff') => {
    const { accounts, platform } = state();
    return institutionProgramme(
      platform,
      accounts,
      'demo-university',
      accounts.find(({ id }) => id === viewer)!,
    );
  };
  const programmeVenture = () => report()?.members.find(({ id }) => id === owner)?.ventures[0];
  assert.equal(programmeVenture()?.action, 'Launch pathway');
  product('original');
  launch(owner, 'demo-venture-green', ['original']);
  act(owner, {
    type: 'venture-save',
    venture: {
      ...state().platform.ventures[0]!,
      id: 'second-venture',
      name: 'Second programme venture',
    },
    now,
  });
  act(admin, {
    type: 'venture-review',
    entity: 'venture',
    id: 'second-venture',
    decision: 'approved',
    now,
  });
  act(owner, {
    type: 'incubation-apply',
    id: 'second-pathway',
    ventureId: 'second-venture',
    goal: 'Develop a separate offer for a different group of customers.',
    now,
  });
  assert.deepEqual(
    report()
      ?.members.find(({ id }) => id === owner)
      ?.ventures.map(({ action }) => action),
    ['Prepare stage work', 'Awaiting mentor assignment'],
  );
  act(owner, {
    type: 'product-evidence',
    productId: 'original',
    evidence: 'Described the offer and two completed customer trials.',
    now,
  });
  act(mentor, {
    type: 'product-evidence-review',
    productId: 'original',
    decision: 'approved',
    feedback: 'Product tested with prospective customers.',
    now,
  });
  assert.equal(visible('original'), false);
  const final = {
    type: 'training-credential-issue',
    id: 'final',
    incubationId: 'pathway',
    learnerId: owner,
    kind: 'venture',
    now,
  } as const;
  reject(admin, final, /all required stages/);
  const key = openStage(owner, 'getting-started');
  assert.equal(programmeVenture()?.action, 'Assessment open');
  assert.deepEqual(programmeVenture()?.certificates, []);
  const attempt = (id: string, score: number, stageKey = key) => {
    act(owner, {
      ...stageKey,
      type: 'stage-take-exam',
      attemptId: id,
      answer: 'I tested the offer and can explain the results and next steps.',
    });
    act(mentor, {
      ...stageKey,
      type: 'stage-grade',
      attemptId: id,
      score,
      note: 'Assessed the evidence and answers using the stage rubric.',
    });
  };
  assert.equal(
    stageUnlocked(state().platform, state().platform.incubations[0]!, 'advanced'),
    false,
  );
  attempt('first-assessment', 0);
  assert.equal(programmeVenture()?.stage?.id, 'advanced');
  assert.equal(programmeVenture()?.certificates[0]?.payment, 'due');
  assert.ok(programmeVenture()?.activity.some(({ title }) => title === 'Assessment graded'));
  assert.doesNotMatch(
    JSON.stringify(programmeVenture()),
    /I tested the offer|using the stage rubric/,
  );
  assert.equal(stageUnlocked(state().platform, state().platform.incubations[0]!, 'advanced'), true);
  const first = { ...final, id: 'first', kind: 'getting-started' } as const;
  reject(admin, first, /payment/);
  act(owner, {
    type: 'training-payment-request',
    id: 'stage-payment',
    purpose: 'getting-started',
    targetId: 'pathway',
    now,
  });
  assert.equal(programmeVenture()?.certificates[0]?.payment, 'pending');
  act(admin, { type: 'training-payment-review', id: 'stage-payment', decision: 'declined', now });
  assert.equal(programmeVenture()?.certificates[0]?.payment, 'declined');
  act(owner, {
    type: 'training-payment-request',
    id: 'stage-payment-retry',
    purpose: 'getting-started',
    targetId: 'pathway',
    now,
  });
  reject(admin, first, /payment/);
  act(admin, {
    type: 'training-payment-review',
    id: 'stage-payment-retry',
    decision: 'confirmed',
    now,
  });
  act(admin, first);
  assert.equal(programmeVenture()?.certificates[0]?.payment, 'confirmed');
  assert.equal(programmeVenture()?.certificates[0]?.issuedAt, now);
  act(admin, {
    type: 'institution-access',
    id: 'demo-university',
    accountId: 'demo-guest',
    access: 'view',
    now,
  });
  assert.equal(report('demo-guest')?.canViewPayments, false);
  assert.deepEqual(
    report('demo-guest')?.members.find(({ id }) => id === owner)?.ventures[0]?.certificates,
    [],
  );
  reject(admin, first, /already been issued/);
  attempt('stage-two', 45, openStage(owner, 'advanced'));
  attempt('stage-three', 25, openStage(owner, 'funding'));
  act(admin, final);
  assert.equal(programmeVenture()?.action, 'Pathway completed');
  assert.equal(
    programmeVenture()?.certificates.find(({ kind }) => kind === 'venture')?.payment,
    'free',
  );
  assert.equal(
    state().platform.training.credentials.find((record) => record.id === 'final')?.schoolScore,
    undefined,
  );
  assert.equal(state().platform.incubations[0]!.status, 'completed');
  assert.equal(visible('original'), true);
  product('later');
  assert.equal(visible('later'), false);
  act(owner, {
    type: 'product-evidence',
    productId: 'later',
    evidence: 'New service trial with two paying clients.',
    now,
  });
  act(mentor, {
    type: 'product-evidence-review',
    productId: 'later',
    decision: 'approved',
    feedback: 'Targeted product evidence approved.',
    now,
  });
  assert.equal(visible('later'), true);
  const later = state().platform.products.find((row) => row.id === 'later')!;
  act(owner, {
    type: 'product-save',
    now,
    product: { ...later, description: 'The new offer changes what the customer buys.' },
  });
  act(admin, { type: 'venture-review', id: 'later', entity: 'product', decision: 'approved', now });
  assert.equal(visible('later'), false);
});

test('paid listings need confirmed payment and moderation, with settings and amounts scoped by purpose', () => {
  const { act, reject, owner, admin, product, visible, state } = trainingScenario();
  product('paid');
  product('unpaid');
  const settings = {
    type: 'training-fees-save',
    fees: { 'getting-started': 600, advanced: 800, marketplace: 1500 },
    bypassEnabled: true,
    now,
  } as const;
  reject(owner, settings, /administrator/);
  act(admin, settings);
  const payment = {
    type: 'training-payment-request',
    id: 'listing-payment',
    purpose: 'marketplace',
    targetId: 'paid',
    now,
  } as const;
  act(owner, payment);
  const confirmed = {
    type: 'training-payment-review',
    id: payment.id,
    decision: 'confirmed',
    now,
  } as const;
  reject(owner, confirmed, /pending payment/);
  assert.equal(visible('paid'), false);
  act(admin, { ...settings, fees: { ...settings.fees, marketplace: 2000 }, bypassEnabled: false });
  assert.equal(state().platform.training.payments[0]!.amount, 1500);
  reject(owner, { ...payment, id: 'next-payment', targetId: 'unpaid' }, /ineligible/);
  act(admin, { type: 'venture-review', entity: 'product', id: 'paid', decision: 'pending', now });
  act(admin, confirmed);
  assert.equal(visible('paid'), false);
  act(admin, { type: 'venture-review', entity: 'product', id: 'paid', decision: 'approved', now });
  assert.equal(visible('paid'), true);
  assert.equal(visible('unpaid'), false);
});

test('school agreements gate activation and school ventures issue certificates with classifications for all completed assessments', () => {
  const { act, reject, admin, launch, openStage, state } = trainingScenario();
  const school = 'demo-school';
  const pupil = 'demo-student-a';
  const teammate = 'demo-student-b';
  act(admin, { type: 'account-admin', accountId: 'demo-guest', role: 'school_admin', now });
  act(admin, {
    type: 'institution-create',
    id: 'pending-school',
    adminId: 'demo-guest',
    name: 'Second Test School',
    kind: 'high-school',
    amount: 25000,
    now,
  });
  reject(admin, { type: 'institution-activate', id: 'pending-school', now }, /agreement/);
  reject(
    'demo-guest',
    { type: 'institution-student', id: 'new-student', name: 'Fictional Student', now },
    /active high school/,
  );
  act('demo-guest', {
    type: 'institution-proof',
    id: 'pending-school',
    name: 'agreement.pdf',
    data: 'data:application/pdf;base64,JVBERi0xLjQK',
    now,
  });
  act(admin, { type: 'institution-activate', id: 'pending-school', now });
  act(admin, { type: 'institution-deactivate', id: 'pending-school', now });
  assert.equal(
    state().platform.training.institutions.find((row) => row.id === 'pending-school')?.status,
    'inactive',
  );
  act(admin, { type: 'institution-activate', id: 'pending-school', now });
  act(admin, {
    type: 'institution-access',
    id: 'pending-school',
    accountId: admin,
    access: 'view',
    now,
  });
  act(admin, {
    type: 'institution-access',
    id: 'pending-school',
    accountId: admin,
    access: 'manage',
    now,
  });
  const access = state().platform.training.institutions.find((row) => row.id === 'pending-school')!;
  assert.deepEqual(access.contactIds, []);
  assert.deepEqual(access.staffIds, [admin]);
  act(admin, {
    type: 'institution-proof',
    id: 'pending-school',
    name: 'amendment.pdf',
    data: 'data:application/pdf;base64,JVBERi0xLjQK',
    now,
  });
  assert.deepEqual(
    state()
      .platform.training.institutions.find((row) => row.id === 'pending-school')
      ?.agreements?.map((row) => row.name),
    ['agreement.pdf', 'amendment.pdf'],
  );
  act(admin, {
    type: 'institution-story',
    id: 'pending-school',
    story: 'Test cohort ran enterprise challenges for the local community.',
    featured: true,
    now,
  });
  reject(
    'demo-guest',
    {
      type: 'institution-group',
      id: 'wrong-group',
      name: 'Other school',
      studentIds: [pupil, teammate],
      now,
    },
    /your high school/,
  );
  act(school, {
    type: 'institution-class',
    id: 'class',
    groupId: 'demo-school-group',
    date: '2026-11-10',
    challenge: 'Interview customers in the school community.',
    attendance: [pupil, teammate],
    now,
  });
  act(school, {
    type: 'institution-group',
    id: 'second-team',
    name: 'Second team',
    studentIds: [pupil, teammate],
    now,
  });
  const classRecord = {
    type: 'institution-class',
    id: 'all-teams-class',
    groupIds: ['demo-school-group', 'second-team'],
    date: '2026-11-11',
    challenge: 'Compare the customer interviews from both teams.',
    attendance: [pupil, teammate, pupil],
    now,
  } as const;
  reject(
    'demo-guest',
    {
      ...classRecord,
      groupIds: [...classRecord.groupIds],
      attendance: [...classRecord.attendance],
    },
    /teams from your high school/,
  );
  act(school, {
    ...classRecord,
    groupIds: [...classRecord.groupIds],
    attendance: [...classRecord.attendance],
  });
  assert.deepEqual(state().platform.training.classes.at(-1)?.attendance, [pupil, teammate]);
  assert.deepEqual(state().platform.training.classes.at(-1)?.groupIds, classRecord.groupIds);
  act(school, {
    type: 'institution-cohort',
    id: 'term-at-creation',
    name: 'Cohort at creation',
    startsOn: '',
    endsOn: '',
    incubationIds: [],
    now,
  });
  act(school, {
    type: 'venture-save',
    now,
    venture: {
      id: 'group-venture',
      ownerId: school,
      groupId: 'demo-school-group',
      cohortId: 'term-at-creation',
      name: 'School Venture',
      sector: 'Services',
      stage: 'Idea',
      description: 'A group venture testing an after-school service.',
      location: 'Nairobi',
      status: 'pending',
    },
  });
  reject(
    admin,
    {
      type: 'venture-review',
      entity: 'venture',
      id: 'group-venture',
      decision: 'rejected',
      now,
    },
    /managed by their institution/,
  );
  const created = state().platform.ventures.find((row) => row.id === 'group-venture')!;
  assert.equal(cohortForVenture(state().platform, created)?.id, 'term-at-creation');
  reject(
    'demo-guest',
    { type: 'venture-cohort', id: 'group-venture', cohortId: '', now },
    /venture from your institution/,
  );
  act(school, { type: 'venture-cohort', id: 'group-venture', cohortId: '', now });
  assert.equal(
    state().platform.ventures.find((row) => row.id === 'group-venture')?.status,
    'approved',
  );
  const product = {
    id: 'group-product',
    ownerId: school,
    ventureId: 'group-venture',
    name: 'Classroom toolkit',
    description: 'A toolkit developed during the school venture.',
    status: 'pending' as const,
    price: 500,
  };
  act(school, { type: 'product-save', product, now });
  reject(
    admin,
    { type: 'venture-review', entity: 'product', id: product.id, decision: 'approved', now },
    /marketplace product/i,
  );
  reject(
    school,
    {
      type: 'training-payment-request',
      id: 'school-payment',
      purpose: 'marketplace',
      targetId: product.id,
      now,
    },
    /ineligible/,
  );
  launch(school, 'group-venture', [product.id]);
  reject(
    school,
    { type: 'product-evidence', productId: product.id, evidence: 'School pilot results.', now },
    /product/,
  );
  const old = structuredClone(state().platform);
  old.products.find((row) => row.id === product.id)!.status = 'approved';
  old.training.payments.push({
    id: 'old-paid-school-listing',
    purpose: 'marketplace',
    accountId: school,
    targetId: product.id,
    amount: 1000,
    status: 'confirmed',
    submittedAt: now,
  });
  assert.equal(
    canPublishProduct(
      old,
      old.products.find((row) => row.id === product.id)!,
    ),
    false,
  );
  act(school, {
    type: 'institution-student',
    id: pupil,
    age: 16,
    gender: 'Female',
    form: 'Grade 10',
    admissionNumber: 'A-042',
    name: 'Updated student name',
    now,
  });
  assert.equal(
    state().platform.training.students.find((row) => row.id === pupil)?.form,
    'Grade 10',
  );
  reject(
    'demo-guest',
    {
      type: 'institution-cohort',
      id: 'external-term',
      name: 'Different term',
      startsOn: '',
      endsOn: '',
      incubationIds: ['pathway'],
      now,
    },
    /pathways from this institution/,
  );
  const record = (learnerId: string, score: number, key: ReturnType<typeof openStage>) => ({
    ...key,
    type: 'stage-offline-result' as const,
    learnerId,
    score,
    attemptId: `${learnerId}-${key.stage}`,
    note: 'Recorded the paper exam mark and archived the paper with the school.',
  });
  const first = openStage(school, 'getting-started');
  act(school, record(pupil, 80, first));
  const second = openStage(school, 'advanced');
  reject(school, record(teammate, 50, second), /earlier stages/);
  act(school, record(teammate, 0, first));
  act(school, record(teammate, 50, second));
  act(school, record(pupil, 80, second));
  act(school, record(pupil, 90, openStage(school, 'funding')));
  const final = {
    type: 'training-credential-issue',
    id: 'school-final',
    incubationId: 'pathway',
    learnerId: pupil,
    kind: 'venture',
    now,
  } as const;
  reject(admin, final, /request this certificate/);
  act(school, {
    type: 'institution-cohort',
    id: 'term-one',
    name: 'Term 1',
    startsOn: '2026-01-01',
    endsOn: '2026-04-01',
    incubationIds: ['pathway'],
    now,
  });
  const schoolRequest = {
    type: 'institution-certificates-request',
    entries: [
      { incubationId: 'pathway', learnerId: pupil, kind: 'venture' },
      { incubationId: 'pathway', learnerId: pupil, kind: 'getting-started' },
    ],
    now,
  } as const;
  reject(
    school,
    {
      ...schoolRequest,
      entries: [schoolRequest.entries[0], { ...schoolRequest.entries[0], learnerId: teammate }],
    },
    /every selected learner/i,
  );
  assert.equal(state().platform.training.certificateRequests?.length ?? 0, 0);
  act(school, { ...schoolRequest, entries: [...schoolRequest.entries] });
  act(school, { ...schoolRequest, entries: [...schoolRequest.entries] });
  assert.equal(state().platform.training.certificateRequests?.length, 2);
  act(admin, final);
  const issueStage = {
    type: 'school-credentials-issue',
    incubationId: 'pathway',
    kind: 'getting-started',
    recipients: [
      { id: 'school-stage-one', learnerId: pupil },
      { id: 'teammate-stage-one', learnerId: teammate },
    ],
    now,
  } as const;
  const issue = { ...issueStage, recipients: [...issueStage.recipients] };
  reject(school, issue, /only a platform administrator/i);
  assert.equal(state().platform.training.credentials.length, 1);
  reject(admin, issue, /request this certificate/);
  act(school, {
    ...schoolRequest,
    entries: [{ ...schoolRequest.entries[1], learnerId: teammate }],
  });
  act(admin, issue);
  assert.deepEqual(
    state()
      .platform.training.credentials.filter((row) => row.kind === 'getting-started')
      .map((row) => row.learnerId),
    [pupil, teammate],
  );
  assert.deepEqual(
    state().platform.training.credentials.map((record) => record.schoolScore),
    [250 / 3, 80, 0],
  );
  reject(admin, issue, /already been issued/);
  reject(admin, { ...final, id: 'teammate-final', learnerId: teammate }, /required stages/);
  assert.equal(state().platform.training.payments.length, 0);
});

test('legacy school approvals release on load while retaining recorded pathway data', () => {
  const { act, state } = trainingScenario();
  const school = 'demo-school';
  const platform = state().platform;
  const venture = {
    ...platform.ventures[0]!,
    id: 'legacy-school-venture',
    ownerId: school,
    groupId: 'demo-school-group',
    status: 'pending' as const,
  };
  platform.ventures.push(venture);
  platform.incubations.push({
    id: 'legacy-school-pathway',
    ventureId: venture.id,
    ownerId: school,
    mentorId: 'demo-mentor',
    status: 'pending',
    goal: 'Compare different offers and record student evidence.',
    milestones: [],
  });
  const definition = platform.training.curriculum[0]!;
  platform.training.stages.push({
    id: 'legacy-school-pathway:getting-started',
    incubationId: 'legacy-school-pathway',
    stage: definition.id,
    steps: definition.steps.map(({ id }) => ({
      id,
      evidence: 'Existing evidence from a prior classroom activity.',
      requested: false,
      feedback: '',
    })),
    reviewRequestedAt: now,
    meetingAt: '',
    meetingNote: '',
    examOpenedAt: '',
    attempts: [],
  });
  migrateSchoolPathways(platform);
  assert.equal(venture.status, 'approved');
  assert.equal(platform.incubations.at(-1)?.status, 'active');
  assert.equal(platform.incubations.at(-1)?.mentorId, '');
  act(school, {
    type: 'school-stage-open',
    stage: definition.id,
    incubationId: 'legacy-school-pathway',
    now,
  });
  assert.equal(state().platform.training.stages.at(-1)?.examOpenedAt, now);
  assert.equal(state().platform.training.stages.at(-1)?.steps.length, definition.steps.length);
});

test('school staff can correct a stage mark and request its certificate before the next stage', () => {
  const { act, reject, admin, launch, openStage, state } = trainingScenario();
  const school = 'demo-school';
  const learnerId = 'demo-student-a';
  const ventureId = 'school-marks';
  act(school, {
    type: 'venture-save',
    venture: {
      ...state().platform.ventures[0]!,
      id: ventureId,
      groupId: 'demo-school-group',
      name: 'Classroom enterprise',
    },
    now,
  });
  launch(school, ventureId);
  const first = openStage(school, 'getting-started');
  act(school, {
    ...first,
    type: 'stage-offline-result',
    learnerId,
    attemptId: 'school-paper',
    score: 48,
    note: 'Marks recorded from the classroom assessment.',
  });
  const correct = {
    ...first,
    type: 'stage-offline-score-edit',
    learnerId,
    attemptId: 'school-paper',
    expectedScore: 48,
    score: 74,
  } as const;
  reject(admin, correct, /access/);
  reject(school, { ...correct, score: 101 }, /whole-number score/);
  act(school, correct);
  reject(school, correct, /mark changed/);
  assert.ok(
    stageUnlocked(state().platform, state().platform.incubations[0]!, 'advanced', learnerId),
  );
  const mark = state().platform.training.stages[0]!.attempts[0]!;
  assert.equal(mark.score, 74);
  assert.equal(mark.corrections?.[0]?.previousScore, 48);
  assert.equal(state().platform.training.stages[0]!.attempts.length, 1);
  const entry = { incubationId: 'pathway', learnerId, kind: 'getting-started' } as const;
  const request = {
    type: 'institution-certificates-request',
    entries: [entry],
    now,
  } as const;
  act(school, { ...request, entries: [...request.entries] });
  assert.ok(incubationCertificateQueue(state().platform).some((row) => row.request && row.ready));
  act(school, { ...correct, expectedScore: 74, score: 48 });
  assert.ok(incubationCertificateQueue(state().platform).some((row) => row.request && row.ready));
  const decision = {
    type: 'school-certificates-reject',
    incubationId: 'pathway',
    kind: 'getting-started',
    learnerIds: [learnerId],
    reason: 'Please verify the evidence came from this cohort.',
    now,
  } as const;
  const rejectRequest = { ...decision, learnerIds: [...decision.learnerIds] };
  reject(school, rejectRequest, /only a platform administrator/i);
  reject(admin, { ...rejectRequest, reason: '' }, /between 5/);
  act(admin, rejectRequest);
  assert.equal(incubationCertificateQueue(state().platform).length, 0);
  assert.equal(
    state().platform.training.certificateRequests?.[0]?.rejections?.[0]?.reason,
    decision.reason,
  );
  const issue = {
    type: 'school-credentials-issue',
    incubationId: 'pathway',
    kind: 'getting-started',
    recipients: [{ learnerId, id: 'corrected-certificate' }],
    now,
  } as const;
  reject(admin, { ...issue, recipients: [...issue.recipients] }, /request this certificate/);
  act(school, { ...request, entries: [entry] });
  assert.equal(state().platform.training.certificateRequests?.length, 1);
  assert.equal(state().platform.training.certificateRequests?.[0]?.rejections?.length, 1);
  act(admin, { ...issue, recipients: [...issue.recipients] });
  reject(admin, rejectRequest, /awaiting review/);
  act(school, { ...correct, expectedScore: 48, score: 50 });
  assert.equal(state().platform.training.credentials[0]?.schoolScore, 48);
  assert.deepEqual([0, 49, 50, 59, 60, 69, 70, 100].map(schoolDivision), [
    'Completion',
    'Completion',
    'Second Class Lower',
    'Second Class Lower',
    'Second Class Upper',
    'Second Class Upper',
    'First Class',
    'First Class',
  ]);
});

test('administrators manage events and categories without dropping registrations or applying stale edits', () => {
  const { act, reject, admin, owner, state } = trainingScenario();
  const original = state().sessions.find(
    (row) => row.capacity !== null && row.status === 'upcoming',
  )!;
  const category = { id: 'field-work', label: 'Field visits', type: 'workshop' } as const;
  reject(owner, { type: 'event-category-save', category, now }, /permission/);
  act(admin, { type: 'event-category-save', category, now });
  const edit = {
    type: 'event-save',
    previous: JSON.stringify(original),
    now,
    session: {
      ...original,
      title: 'Community enterprise field visit',
      categoryId: category.id,
      type: category.type,
      status: 'completed',
    },
  } as const;
  const registrations = structuredClone(state().registrations);
  act(admin, edit);
  assert.deepEqual(state().registrations, registrations);
  const archived = state().sessions.find((row) => row.id === original.id)!;
  assert.equal(archived.status, 'completed');
  assert.equal(sessionCategory(archived, state().platform.eventCategories).label, 'Field visits');
  reject(admin, edit, /event changed/i);
  const reschedule = {
    ...edit,
    previous: JSON.stringify(archived),
    now: '2026-12-20T09:00:00Z',
    session: {
      ...archived,
      startsAt: '2027-01-14T09:00:00+03:00',
      endsAt: '2027-01-14T11:00:00+03:00',
      publication: 'draft' as const,
    },
  };
  act(admin, reschedule);
  const draft = state().sessions.find((row) => row.id === original.id)!;
  assert.equal(draft.status, 'upcoming');
  assert.equal(draft.registrationDeadline, null);
  assert.equal(draft.publication, 'draft');
  assert.deepEqual(state().registrations, registrations);
  assert.throws(
    () =>
      applyDemoAction(login(state(), owner), {
        type: 'registration',
        sessionId: draft.id,
        operation: 'register',
        now: reschedule.now,
      }),
    /draft/,
  );
  act(admin, {
    ...reschedule,
    previous: JSON.stringify(draft),
    session: { ...draft, publication: 'published' },
  });
  assert.equal(state().sessions.find((row) => row.id === original.id)?.publication, 'published');
  const unscheduled = {
    ...draft,
    id: 'planning-event',
    startsAt: null,
    endsAt: null,
    summary: '',
    venue: '',
  };
  act(admin, { ...reschedule, previous: 'null', session: unscheduled });
  reject(
    admin,
    {
      ...reschedule,
      previous: JSON.stringify(unscheduled),
      session: {
        ...unscheduled,
        summary: edit.session.summary,
        venue: original.venue,
        publication: 'published',
      },
    },
    /start and end/,
  );
  const newEvent = {
    ...edit,
    previous: 'null',
    session: { ...edit.session, id: 'new-field-visit', status: 'upcoming' as const },
  };
  act(admin, newEvent);
  assert.equal(state().sessions.at(-1)?.id, 'new-field-visit');
  const savedEvent = state().sessions.at(-1)!;
  const withPresenters = {
    ...newEvent,
    previous: JSON.stringify(savedEvent),
    session: {
      ...savedEvent,
      hostIds: [owner],
      presenters: [
        {
          id: 'linked-host',
          accountId: owner,
          role: 'host' as const,
          name: 'Demo host',
          profession: 'Venture founder',
        },
        {
          id: 'guest-facilitator',
          role: 'facilitator' as const,
          name: 'Guest facilitator',
          profession: 'Enterprise trainer',
        },
      ],
    },
  };
  act(admin, withPresenters);
  const updatedEvent = state().sessions.at(-1)!;
  assert.equal(updatedEvent.presenters?.[1]?.profession, 'Enterprise trainer');
  assert.deepEqual(updatedEvent.hostIds, [owner]);
  reject(
    admin,
    {
      ...withPresenters,
      previous: JSON.stringify(updatedEvent),
      session: {
        ...updatedEvent,
        presenters: [
          { ...withPresenters.session.presenters[1]!, photo: 'data:image/svg+xml;base64,PHN2Zz4=' },
        ],
        hostIds: [],
      },
    },
    /presenter names/,
  );
  reject(
    admin,
    {
      ...newEvent,
      previous: JSON.stringify(state().sessions.at(-1)),
      session: { ...newEvent.session, endsAt: newEvent.session.startsAt },
    },
    /start and end/,
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
