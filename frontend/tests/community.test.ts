import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { applyDemoAction, type DemoState } from '../src/domain/demo.ts';
import { communityFeed, friendIds, leaderboard } from '../src/domain/community.ts';
import { isDemoState, migrateDemoState } from '../src/domain/demo-validation.ts';
import { publishedSubmissions } from '../src/services/submission-mapper.ts';
import type { ContentItem } from '../src/domain/content.ts';
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
const now = '2026-11-10T09:00:00Z';
const posts: ContentItem[] = fixture('member-posts');

test('friendships require consent, reject reverse duplicates, and resolve symmetrically', () => {
  let s = login(seed(), 'demo-founder');
  assert.ok(friendIds(s, 'demo-founder').includes('demo-mentor'));
  assert.ok(friendIds(s, 'demo-mentor').includes('demo-founder'));
  for (const memberId of ['demo-founder', 'missing', 'demo-mentor', 'demo-mentee'])
    assert.throws(() => applyDemoAction(s, { type: 'connection', memberId, operation: 'request' }));
  s = applyDemoAction(s, { type: 'connection', memberId: 'demo-editor', operation: 'request' });
  assert.throws(
    () => applyDemoAction(s, { type: 'connection', memberId: 'demo-editor', operation: 'accept' }),
    /recipient/,
  );
  s = login(s, 'demo-editor');
  assert.throws(
    () =>
      applyDemoAction(s, { type: 'connection', memberId: 'demo-founder', operation: 'request' }),
    /already/,
  );
  assert.throws(
    () => applyDemoAction(s, { type: 'connection', memberId: 'demo-founder', operation: 'cancel' }),
    /requester/,
  );
  s = applyDemoAction(s, { type: 'connection', memberId: 'demo-founder', operation: 'accept' });
  assert.ok(friendIds(s, 'demo-founder').includes('demo-editor'));
  assert.ok(friendIds(s, 'demo-editor').includes('demo-founder'));
  s = applyDemoAction(s, { type: 'connection', memberId: 'demo-founder', operation: 'remove' });
  assert.ok(!friendIds(s, 'demo-founder').includes('demo-editor'));
  assert.ok(isDemoState(s, s.accounts));
});

test('event reservations enforce capacity, deadlines, history and per-account cancellation', () => {
  let s = login(seed(), 'demo-founder');
  const sessionId = 'demo-customer-discovery';
  s.sessions = s.sessions.map((e) => (e.id === sessionId ? { ...e, capacity: 2 } : e));
  s = applyDemoAction(s, { type: 'registration', sessionId, operation: 'register', now });
  assert.throws(
    () => applyDemoAction(s, { type: 'registration', sessionId, operation: 'register', now }),
    /already/,
  );
  s = login(s, 'demo-partner');
  assert.throws(
    () => applyDemoAction(s, { type: 'registration', sessionId, operation: 'register', now }),
    /full/,
  );
  assert.throws(
    () => applyDemoAction(s, { type: 'registration', sessionId, operation: 'cancel', now }),
    /No active/,
  );
  s = login(s, 'demo-founder');
  s = applyDemoAction(s, { type: 'registration', sessionId, operation: 'cancel', now });
  assert.equal(s.registrations.find((r) => r.memberId === 'demo-mentee')?.status, 'registered');
  s = login(s, 'demo-partner');
  s = applyDemoAction(s, { type: 'registration', sessionId, operation: 'register', now });
  assert.ok(isDemoState(s, s.accounts));
  for (const date of ['2026-12-03T09:00:00Z', 'invalid'])
    assert.throws(() =>
      applyDemoAction(login(seed(), 'demo-founder'), {
        type: 'registration',
        sessionId,
        operation: 'register',
        now: date,
      }),
    );
  assert.throws(
    () =>
      applyDemoAction(login(seed(), 'demo-founder'), {
        type: 'registration',
        sessionId,
        operation: 'register',
        now: '2026-12-02T15:00:00Z',
      }),
    /deadline/,
  );
  assert.throws(
    () =>
      applyDemoAction(s, {
        type: 'registration',
        sessionId: s.sessions.find((e) => e.status === 'completed')!.id,
        operation: 'register',
        now,
      }),
    /closed/,
  );
});

test('moderation removes source topics and replies from feeds and rankings', () => {
  let s = seed();
  const before = leaderboard(s, posts);
  assert.ok(communityFeed(s, posts).some((e) => e.href.includes('demo-topic-1')));
  s = applyDemoAction(login(s, 'demo-admin'), { type: 'moderate', threadId: 'demo-topic-1' });
  assert.ok(!communityFeed(s, posts).some((e) => e.href.includes('demo-topic-1')));
  for (const id of ['demo-founder', 'demo-mentor'])
    assert.ok(
      leaderboard(s, posts).find((r) => r.member.id === id)!.points <
        before.find((r) => r.member.id === id)!.points,
    );
  s = applyDemoAction(s, { type: 'moderate', threadId: 'demo-topic-1' });
  assert.deepEqual(leaderboard(s, posts), before);
});

test('publication retains its author and only published submissions enter a member feed', () => {
  let s = login(seed(), 'demo-founder');
  s = applyDemoAction(s, {
    type: 'submission',
    id: 'new-blog',
    kind: 'article',
    title: 'A new community perspective',
    category: 'Community',
    body: 'A fictional example of a member sharing a useful business learning experience.',
  });
  assert.equal(publishedSubmissions(s.submissions).length, 0);
  s = applyDemoAction(s, { type: 'submission-status', id: 'new-blog', status: 'review' });
  s = applyDemoAction(login(s, 'demo-editor'), {
    type: 'submission-status',
    id: 'new-blog',
    status: 'published',
  });
  const mapped = publishedSubmissions(s.submissions);
  assert.equal(mapped[0]?.authorId, 'demo-founder');
  assert.equal(
    communityFeed(s, mapped).find((e) => e.id === 'blog:new-blog')?.actorId,
    'demo-founder',
  );
  s = applyDemoAction(s, { type: 'submission-status', id: 'new-blog', status: 'draft' });
  assert.ok(
    !communityFeed(s, publishedSubmissions(s.submissions)).some((e) => e.id === 'blog:new-blog'),
  );
});

test('saved v1 data migrates without losing profile edits, topics, progress or drafts', () => {
  const original = seed();
  original.accounts[0]!.name = 'Edited member name';
  original.progress['demo-founder'] = ['lesson-1'];
  const { connections: _c, registrations: _r, sessions: _s, pointRules: _p, ...legacy } = original;
  void _c;
  void _r;
  void _s;
  void _p;
  const migrated = migrateDemoState(
    {
      ...legacy,
      version: 1,
      accounts: legacy.accounts.map(({ handle: _h, joinedAt: _j, ...a }) => {
        void _h;
        void _j;
        return a;
      }),
    },
    seed(),
  );
  assert.ok(isDemoState(migrated, original.accounts));
  assert.equal(migrated.accounts[0]?.name, 'Edited member name');
  assert.deepEqual(migrated.threads, original.threads);
  assert.deepEqual(migrated.progress, original.progress);
  assert.deepEqual(migrated.submissions, original.submissions);
});

test('storage rejects orphaned references, duplicate pairs, malformed dates and altered relationships', () => {
  const s = seed();
  for (const bad of [
    {
      ...s,
      connections: [
        ...s.connections,
        { requesterId: 'demo-mentor', recipientId: 'demo-founder', status: 'accepted' },
      ],
    },
    {
      ...s,
      connections: [{ requesterId: 'missing', recipientId: 'demo-founder', status: 'pending' }],
    },
    { ...s, groups: [{ ...s.groups[0], memberIds: ['missing'] }] },
    {
      ...s,
      registrations: [{ sessionId: 'missing', memberId: 'demo-founder', status: 'registered' }],
    },
    { ...s, registrations: [...s.registrations, s.registrations[0]] },
    { ...s, sessions: [{ ...s.sessions[0], startsAt: 'invalid' }] },
    { ...s, activity: [{ ...s.activity[0], groupId: {} }] },
    { ...s, pointRules: { ...s.pointRules, topic: -1 } },
  ])
    assert.equal(isDemoState(bad, s.accounts), false);
});

test('every community record connects to real fixture IDs and imported content is never misattributed', () => {
  const s = seed();
  const items: ContentItem[] = [
    'blogs',
    'stories',
    'events',
    'reports',
    'businesses',
    'member-posts',
  ].flatMap(fixture);
  assert.ok(isDemoState(s, s.accounts));
  assert.equal(new Set(items.map((i) => i.id)).size, items.length);
  for (const session of s.sessions) {
    if (session.contentId) assert.ok(items.some((i) => i.id === session.contentId));
    if (!session.fictional) {
      assert.equal(session.status, 'completed');
      assert.deepEqual(session.hostIds, []);
    }
  }
  for (const item of items.filter((i) => i.authorId)) {
    assert.ok(s.accounts.some((a) => a.id === item.authorId));
    assert.ok(item.source.path === 'local-demo' || item.source.path === 'mock-member');
  }
  for (const member of s.accounts) {
    assert.ok(leaderboard(s, items).some((row) => row.member.id === member.id));
    assert.ok(
      communityFeed(s, items)
        .filter((e) => e.actorId === member.id)
        .every((e) => e.href.startsWith('/')),
    );
  }
});
