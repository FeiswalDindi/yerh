import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { applyDemoAction, type DemoState } from '../src/domain/demo.ts';
import { forumMemberIds } from '../src/domain/community.ts';
import { isDemoState } from '../src/domain/demo-validation.ts';
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

test('forum membership requires an account, changes only that account, and remains independent of group membership', () => {
  let state = seed();
  const forumId = 'entrepreneurship';
  assert.throws(
    () => applyDemoAction(state, { type: 'forum-membership', forumId }),
    /Choose a demo/,
  );
  state = applyDemoAction(state, { type: 'login', accountId: 'demo-editor' });
  const groupMembers = structuredClone(state.groups[0]!.memberIds);
  const initial = forumMemberIds(state, forumId);
  assert.ok(!initial.includes('demo-editor'));
  state = applyDemoAction(state, { type: 'forum-membership', forumId });
  assert.deepEqual(forumMemberIds(state, forumId), [...initial, 'demo-editor']);
  assert.deepEqual(state.groups[0]!.memberIds, groupMembers);
  assert.ok(isDemoState(state, state.accounts));
  state = applyDemoAction(state, { type: 'forum-membership', forumId });
  assert.deepEqual(forumMemberIds(state, forumId), initial);
  assert.throws(
    () => applyDemoAction(state, { type: 'forum-membership', forumId: 'missing' }),
    /not found/,
  );
});
test('legacy forum records inherit linked membership until the first explicit membership change', () => {
  let state = seed();
  delete state.forums[0]!.memberIds;
  assert.ok(isDemoState(state, state.accounts));
  assert.deepEqual(forumMemberIds(state, 'entrepreneurship'), state.groups[0]!.memberIds);
  state = applyDemoAction(state, { type: 'login', accountId: 'demo-founder' });
  state = applyDemoAction(state, { type: 'forum-membership', forumId: 'entrepreneurship' });
  assert.ok(!forumMemberIds(state, 'entrepreneurship').includes('demo-founder'));
  assert.ok(state.groups[0]!.memberIds.includes('demo-founder'));
});
test('persisted forum rosters reject duplicate, unknown, or malformed member references', () => {
  for (const ids of [['missing'], ['demo-founder', 'demo-founder'], 'demo-founder', [null]]) {
    const state = seed();
    const bad: unknown = {
      ...state,
      forums: [{ ...state.forums[0], memberIds: ids }, ...state.forums.slice(1)],
    };
    assert.equal(isDemoState(bad, state.accounts), false);
  }
});
test('imported Feiso terms retain all sections, effective date and shared popup summary data', () => {
  const terms = fixture('terms');
  assert.equal(terms.effectiveDate, '2026-08-19');
  assert.equal(terms.sections.length, 10);
  assert.deepEqual(
    terms.sections.map((s: { title: string }) => s.title),
    [
      'Who this is for',
      'Applying for a role',
      'What you post and publish',
      'Marketplace, mentorship and opportunities',
      'Certificates',
      'Suspension and termination',
      'No warranty, limitation of liability',
      'Changes to these terms',
      'Governing law',
      'Contact',
    ],
  );
  assert.ok(terms.summary.length > 0 && terms.summary.every((s: string) => s.length > 0));
  assert.equal(terms.contactEmail, 'yerhdev@gmail.com');
});
