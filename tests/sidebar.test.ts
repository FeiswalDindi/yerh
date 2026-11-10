import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ContentItem } from '../src/domain/content.ts';
import type { DemoState, Thread } from '../src/domain/demo.ts';
import {
  calendarCells,
  discussionDayCounts,
  discussionsOnDay,
  isCalendarDay,
  nairobiDay,
  popularContent,
  readingRecommendations,
  recentComments,
  shiftCalendarMonth,
  type SidebarData,
} from '../src/domain/sidebar.ts';
const fixture = (name: string) =>
  JSON.parse(readFileSync(new URL(`../src/mocks/data/${name}.json`, import.meta.url), 'utf8'));
const items: ContentItem[] = [
  'blogs',
  'stories',
  'events',
  'reports',
  'businesses',
  'member-posts',
].flatMap(fixture);
const sidebar: SidebarData = fixture('sidebar');
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

test('sidebar fixtures resolve content, courses, member comments, images and internal promotions', () => {
  const ids = new Set(items.map((i) => i.id));
  const members = new Set(seed().accounts.map((a) => a.id));
  const courses = new Set(fixture('learning').map((c: { id: string }) => c.id));
  for (const id of sidebar.featuredIds) assert.ok(ids.has(id), id);
  for (const id of sidebar.featuredCourseIds) assert.ok(courses.has(id), id);
  assert.equal(new Set(sidebar.popularity.map((p) => p.contentId)).size, sidebar.popularity.length);
  for (const record of sidebar.popularity) {
    assert.ok(ids.has(record.contentId));
    assert.ok(Number.isInteger(record.likes) && record.likes >= 0);
  }
  assert.match(sidebar.popularitySource, /Historical/);
  for (const comment of sidebar.comments) {
    assert.ok(ids.has(comment.contentId));
    assert.ok(members.has(comment.authorId));
    assert.ok(Number.isFinite(Date.parse(comment.createdAt)));
    assert.equal(items.find((i) => i.id === comment.contentId)?.source.path, 'mock-member');
  }
  for (const ad of sidebar.advertisements) {
    assert.match(ad.href, /^\/(?!\/)/);
    if (ad.image) assert.ok(existsSync(resolve('public', `.${ad.image}`)));
  }
});
test('reading recommendations exclude the current record, prefer relevant content, and popularity sorts by actual counts', () => {
  const current = items.find((i) => i.id === 'demo-blog-customer-learning')!;
  const recommendations = readingRecommendations(items, current.id);
  assert.ok(!recommendations.some((i) => i.id === current.id));
  assert.equal(recommendations[0]?.id, 'demo-blog-first-plan');
  assert.ok(
    recommendations.every((i) => ['article', 'story', 'publication', 'resource'].includes(i.kind)),
  );
  const popular = popularContent(items, sidebar);
  assert.deepEqual(
    popular.map((p) => p.likes),
    [189, 91, 32],
  );
  assert.ok(
    !popularContent(items, sidebar, popular[0]!.item.id).some(
      (p) => p.item.id === popular[0]!.item.id,
    ),
  );
  assert.deepEqual(readingRecommendations([]), []);
});
test('calendar days are strict and month navigation handles leap years and year boundaries', () => {
  for (const day of ['2024-02-29', '2026-11-01', '2026-12-31']) assert.ok(isCalendarDay(day));
  for (const day of ['2026-02-29', '2026-11-31', '2026-13-01', '2026-1-1', 'nonsense'])
    assert.equal(isCalendarDay(day), false);
  const february = calendarCells('2024-02');
  assert.equal(february.filter(Boolean).length, 29);
  assert.equal(february[3], '2024-02-01');
  assert.equal(february.length % 7, 0);
  assert.equal(calendarCells('2026-11')[6], '2026-11-01');
  assert.equal(shiftCalendarMonth('2026-12', 1), '2027-01');
  assert.equal(shiftCalendarMonth('2026-01', -1), '2025-12');
  assert.deepEqual(calendarCells('invalid'), []);
});
test('calendar filters topic and reply activity in Nairobi time, counts each discussion once, and excludes hidden topics', () => {
  const thread: Thread = {
    ...seed().threads[0]!,
    createdAt: '2026-11-01T22:30:00Z',
    replies: [
      { id: 'a', authorId: 'demo-mentor', body: 'One reply', createdAt: '2026-11-03T21:30:00Z' },
      {
        id: 'b',
        authorId: 'demo-founder',
        body: 'Another reply',
        createdAt: '2026-11-04T05:00:00Z',
      },
    ],
  };
  assert.equal(nairobiDay(thread.createdAt), '2026-11-02');
  assert.equal(discussionsOnDay([thread], '2026-11-01').length, 0);
  assert.equal(discussionsOnDay([thread], '2026-11-02').length, 1);
  assert.equal(discussionsOnDay([thread], '2026-11-04').length, 1);
  assert.deepEqual(discussionDayCounts([thread]), { '2026-11-02': 1, '2026-11-04': 1 });
  assert.deepEqual(discussionDayCounts([{ ...thread, hidden: true }]), {});
  assert.equal(discussionsOnDay([{ ...thread, hidden: true }], '').length, 0);
  assert.equal(discussionsOnDay([thread], 'bad-date').length, 1);
});
test('sidebar comments are chronological, link to source anchors, and remove hidden discussion replies', () => {
  const state = seed();
  const comments = recentComments(items, sidebar, state);
  assert.ok(comments.some((c) => c.context === 'article' && c.href.includes('#comment-')));
  assert.ok(comments.some((c) => c.context === 'forum' && c.href.includes('#reply-')));
  for (let i = 1; i < comments.length; i++)
    assert.ok(Date.parse(comments[i - 1]!.createdAt) >= Date.parse(comments[i]!.createdAt));
  state.threads[0]!.hidden = true;
  assert.ok(
    !recentComments(items, sidebar, state).some((c) => c.href.includes('/forums/demo-topic-1')),
  );
  assert.ok(
    !recentComments(
      items.filter((i) => i.id !== sidebar.comments[0]!.contentId),
      sidebar,
      state,
    ).some((c) => c.id === sidebar.comments[0]!.id),
  );
});
