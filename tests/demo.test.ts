import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { applyDemoAction, type DemoState } from '../src/domain/demo.ts';
import { isDemoState } from '../src/domain/demo-validation.ts';
import { navigation } from '../src/config/navigation.ts';
const fixture = (name: string) =>
  JSON.parse(readFileSync(new URL(`../src/mocks/data/${name}.json`, import.meta.url), 'utf8'));
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
const login = (s: DemoState, id: string) => applyDemoAction(s, { type: 'login', accountId: id });
test('navigation preserves the requested hierarchy without standalone news or story tabs', () => {
  assert.deepEqual(
    navigation.map((n) => n.label),
    ['Home', 'Resources', 'Benefits', 'Publications', 'Contact Us'],
  );
  assert.deepEqual(
    navigation[0]!.children?.map((n) => n.label),
    ['About Us', 'FAQ'],
  );
  assert.ok(navigation[3]!.children?.some((n) => n.href === '/publications/blogs'));
  assert.ok(navigation[3]!.children?.some((n) => n.href === '/publications/stories'));
  assert.equal(navigation[1]!.children?.length, 8);
});
test('anonymous writes and invalid identities are rejected', () => {
  assert.throws(
    () => applyDemoAction(seed(), { type: 'progress', lessonId: 'a' }),
    /Choose a demo/,
  );
  assert.throws(() => login(seed(), 'unknown'), /Unknown/);
});
test('learning and group membership persist independently per account', () => {
  let s = login(seed(), 'demo-founder');
  const groupId = s.groups[0]!.id;
  const original = s.groups[0]!.memberIds.includes('demo-founder');
  s = applyDemoAction(s, { type: 'membership', groupId });
  assert.equal(s.groups[0]!.memberIds.includes('demo-founder'), !original);
  const course = fixture('learning')[0];
  s = applyDemoAction(s, {
    type: 'enroll',
    courseId: course.id,
    operation: 'enroll',
    now: '2026-11-10T09:00:00Z',
  });
  s = applyDemoAction(s, { type: 'progress', lessonId: course.lessonIds[0] });
  s = login(s, 'demo-mentor');
  assert.deepEqual(s.progress['demo-founder'], [course.lessonIds[0]]);
  assert.equal(s.progress['demo-mentor'], undefined);
});
test('mentorship response belongs to the assigned mentor or admin', () => {
  let s = login(seed(), 'demo-founder');
  s = applyDemoAction(s, {
    type: 'request',
    id: 'new-request',
    mentorId: 'demo-mentor',
    goal: 'Improve a small business marketing plan.',
  });
  assert.throws(
    () =>
      applyDemoAction(s, { type: 'request-status', requestId: 'new-request', status: 'accepted' }),
    /not assigned/,
  );
  assert.throws(
    () =>
      applyDemoAction(s, {
        type: 'request',
        id: 'duplicate',
        mentorId: 'demo-mentor',
        goal: 'Improve a small business marketing plan.',
      }),
    /already/,
  );
  s = login(s, 'demo-mentor');
  s = applyDemoAction(s, { type: 'request-status', requestId: 'new-request', status: 'accepted' });
  assert.equal(s.requests.find((r) => r.id === 'new-request')?.status, 'accepted');
});
test('authors submit drafts and content managers can review every editorial content kind', () => {
  let s = login(seed(), 'demo-founder');
  s = applyDemoAction(s, {
    type: 'submission',
    id: 'draft',
    kind: 'business',
    title: 'Demo venture',
    category: 'Technology',
    body: 'This fictional venture is used to test the publishing workflow.',
  });
  s = applyDemoAction(s, {
    type: 'edit-submission',
    id: 'draft',
    title: 'Updated venture',
    category: 'Technology',
    body: 'This revised fictional venture is used to test the publishing workflow.',
  });
  assert.equal(s.submissions[0]!.title, 'Updated venture');
  assert.throws(
    () => applyDemoAction(s, { type: 'submission-status', id: 'draft', status: 'published' }),
    /editor or administrator/,
  );
  s = applyDemoAction(s, { type: 'submission-status', id: 'draft', status: 'review' });
  assert.throws(
    () =>
      applyDemoAction(s, {
        type: 'edit-submission',
        id: 'draft',
        title: 'Updated venture',
        category: 'Technology',
        body: 'Some content that is long enough for validation.',
      }),
    /Only drafts/,
  );
  s = login(s, 'demo-editor');
  s = applyDemoAction(s, { type: 'submission-status', id: 'draft', status: 'draft' });
  s = applyDemoAction(s, { type: 'submission-status', id: 'draft', status: 'review' });
  s = applyDemoAction(s, { type: 'submission-status', id: 'draft', status: 'published' });
  s = applyDemoAction(s, { type: 'submission-status', id: 'draft', status: 'review' });
  s = login(s, 'demo-admin');
  s = applyDemoAction(s, { type: 'submission-status', id: 'draft', status: 'published' });
  assert.equal(s.submissions[0]!.status, 'published');
});
test('moderated discussions reject replies and only admins may moderate', () => {
  let s = login(seed(), 'demo-founder');
  const threadId = s.threads[0]!.id;
  assert.throws(() => applyDemoAction(s, { type: 'moderate', threadId }));
  s = login(s, 'demo-admin');
  s = applyDemoAction(s, { type: 'moderate', threadId });
  assert.equal(s.threads[0]!.hidden, true);
  assert.throws(
    () =>
      applyDemoAction(s, {
        type: 'reply',
        threadId,
        id: 'r',
        body: 'A reply',
        now: new Date().toISOString(),
      }),
    /not available/,
  );
});
test('storage validation rejects broken nested records and altered fixture roles', () => {
  const s = seed();
  assert.ok(isDemoState(s, s.accounts));
  for (const bad of [
    { ...s, submissions: [{}] },
    { ...s, threads: [{ ...s.threads[0]!, replies: [null] }] },
    { ...s, progress: [] },
    { ...s, accounts: [...s.accounts.slice(1), s.accounts[1]] },
    { ...s, activeAccountId: 'unknown' },
  ])
    assert.equal(isDemoState(bad, s.accounts), false);
  const tampered = structuredClone(s);
  tampered.accounts[0]!.role = 'admin';
  assert.equal(isDemoState(tampered, s.accounts), false);
});
test('all learning paths and featured references resolve to mock records', () => {
  const lessons = fixture('lessons');
  const ids = new Set(lessons.map((l: { id: string }) => l.id));
  for (const course of fixture('learning'))
    for (const id of course.lessonIds) assert.ok(ids.has(id), id);
  const items = ['blogs', 'stories', 'businesses', 'events', 'reports'].flatMap(fixture);
  const contentIds = new Set(items.map((i) => i.id));
  const home = fixture('homepage');
  for (const key of ['featuredStories', 'featuredBlogs', 'featuredBusinesses', 'featuredGuides'])
    for (const id of home[key]) assert.ok(contentIds.has(id), id);
});
