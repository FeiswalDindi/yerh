import type { ContentItem } from './content';
import type { DemoAccount, DemoState } from './demo';

export interface Connection {
  requesterId: string;
  recipientId: string;
  status: 'pending' | 'accepted';
}
export interface CommunitySession {
  id: string;
  title: string;
  summary: string;
  type: 'workshop' | 'webinar' | 'bootcamp' | 'masterclass' | 'summit' | 'exhibition';
  status: 'upcoming' | 'completed' | 'postponed';
  startsAt: string | null;
  endsAt: string | null;
  timezone: string;
  venue: string;
  hostIds: string[];
  groupId: string | null;
  forumId: string | null;
  contentId: string | null;
  capacity: number | null;
  registrationDeadline: string | null;
  fictional: boolean;
}
export interface EventRegistration {
  sessionId: string;
  memberId: string;
  status: 'registered' | 'cancelled' | 'attended';
}
export interface PointRules {
  topic: number;
  reply: number;
  blog: number;
  lesson: number;
  attendance: number;
}
export type CommunityAction =
  | {
      type: 'connection';
      memberId: string;
      operation: 'request' | 'accept' | 'decline' | 'cancel' | 'remove';
    }
  | { type: 'registration'; sessionId: string; operation: 'register' | 'cancel'; now: string };

export function memberPath(id: string) {
  return `/network/members/${encodeURIComponent(id)}`;
}
/** Legacy browser records inherit their linked group's membership until explicitly changed. */
export function forumMemberIds(state: DemoState, forumId: string): string[] {
  const forum = state.forums.find((f) => f.id === forumId);
  return forum?.memberIds ?? state.groups.find((g) => g.id === forum?.groupId)?.memberIds ?? [];
}
export function sessionPath(id: string) {
  return `/sessions/${encodeURIComponent(id)}`;
}
export function connectionBetween(state: DemoState, a: string, b: string) {
  return state.connections.find(
    (c) =>
      (c.requesterId === a && c.recipientId === b) || (c.requesterId === b && c.recipientId === a),
  );
}
export function friendIds(state: DemoState, id: string): string[] {
  return state.connections
    .filter((c) => c.status === 'accepted' && (c.requesterId === id || c.recipientId === id))
    .map((c) => (c.requesterId === id ? c.recipientId : c.requesterId));
}
export function registrationProblem(
  state: DemoState,
  session: CommunitySession,
  now: string,
): string | null {
  const time = Date.parse(now);
  if (!Number.isFinite(time)) return 'Invalid registration time.';
  if (session.status !== 'upcoming' || !session.startsAt || Date.parse(session.startsAt) <= time)
    return 'Registration is closed for this session.';
  if (session.registrationDeadline && Date.parse(session.registrationDeadline) <= time)
    return 'The registration deadline has passed.';
  const count = state.registrations.filter(
    (r) => r.sessionId === session.id && r.status !== 'cancelled',
  ).length;
  return session.capacity !== null && count >= session.capacity ? 'This session is full.' : null;
}
export function applyCommunityAction(
  state: DemoState,
  action: CommunityAction,
  actor: DemoAccount,
): DemoState {
  if (action.type === 'connection') {
    if (action.memberId === actor.id || !state.accounts.some((a) => a.id === action.memberId))
      throw new Error('Choose another community member.');
    const existing = connectionBetween(state, actor.id, action.memberId);
    if (action.operation === 'request') {
      if (existing) throw new Error('A connection already exists with this member.');
      return {
        ...state,
        connections: [
          ...state.connections,
          { requesterId: actor.id, recipientId: action.memberId, status: 'pending' },
        ],
      };
    }
    if (!existing) throw new Error('Connection not found.');
    const incoming = existing.recipientId === actor.id && existing.status === 'pending';
    if ((action.operation === 'accept' || action.operation === 'decline') && !incoming)
      throw new Error('Only the recipient can respond to a pending request.');
    if (
      action.operation === 'cancel' &&
      !(existing.requesterId === actor.id && existing.status === 'pending')
    )
      throw new Error('Only the requester can cancel a pending request.');
    if (action.operation === 'remove' && existing.status !== 'accepted')
      throw new Error('This friendship has not been accepted.');
    return {
      ...state,
      connections:
        action.operation === 'accept'
          ? state.connections.map((c) => (c === existing ? { ...c, status: 'accepted' } : c))
          : state.connections.filter((c) => c !== existing),
    };
  }
  const session = state.sessions.find((s) => s.id === action.sessionId);
  if (!session) throw new Error('Session not found.');
  const existing = state.registrations.find(
    (r) => r.sessionId === session.id && r.memberId === actor.id,
  );
  if (action.operation === 'register') {
    if (existing && existing.status !== 'cancelled')
      throw new Error('You already have a place at this session.');
    const problem = registrationProblem(state, session, action.now);
    if (problem) throw new Error(problem);
  } else {
    if (!existing || existing.status !== 'registered')
      throw new Error('No active registration to cancel.');
    if (
      session.status === 'completed' ||
      (session.startsAt && Date.parse(session.startsAt) <= Date.parse(action.now))
    )
      throw new Error('This session has already started.');
    if (!Number.isFinite(Date.parse(action.now))) throw new Error('Invalid registration time.');
  }
  const registration: EventRegistration = {
    sessionId: session.id,
    memberId: actor.id,
    status: action.operation === 'register' ? 'registered' : 'cancelled',
  };
  return {
    ...state,
    registrations: [...state.registrations.filter((r) => r !== existing), registration],
  };
}
export interface FeedEntry {
  id: string;
  actorId: string;
  text: string;
  createdAt: string;
  href: string;
  kind: 'topic' | 'reply' | 'blog' | 'group';
  groupId?: string;
}
/** Public activity follows visibility of its source, including moderation and unpublishing. */
export function communityFeed(state: DemoState, items: ContentItem[]): FeedEntry[] {
  const entries: FeedEntry[] = [];
  for (const thread of state.threads.filter((t) => !t.hidden)) {
    const groupId = state.forums.find((f) => f.id === thread.forumId)?.groupId;
    const href = `/forums/${encodeURIComponent(thread.id)}`;
    entries.push({
      id: `topic:${thread.id}`,
      actorId: thread.authorId,
      text: thread.title,
      createdAt: thread.createdAt,
      href,
      kind: 'topic',
      groupId,
    });
    for (const reply of thread.replies)
      entries.push({
        id: `reply:${reply.id}`,
        actorId: reply.authorId,
        text: `Replied to ${thread.title}`,
        createdAt: reply.createdAt,
        href: `${href}#reply-${encodeURIComponent(reply.id)}`,
        kind: 'reply',
        groupId,
      });
  }
  for (const item of items.filter((i) => i.kind === 'article' && i.authorId))
    entries.push({
      id: `blog:${item.id}`,
      actorId: item.authorId!,
      text: item.title,
      createdAt: item.publishedAt ? `${item.publishedAt}T12:00:00Z` : '',
      href: `/publications/blogs/${encodeURIComponent(item.slug)}`,
      kind: 'blog',
    });
  for (const activity of state.activity.filter(
    (a) => a.groupId && state.groups.some((g) => g.id === a.groupId),
  ))
    entries.push({
      ...activity,
      kind: 'group',
      href: `/network/groups/${encodeURIComponent(activity.groupId!)}`,
    });
  return entries.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id));
}
export function leaderboard(state: DemoState, items: ContentItem[]) {
  const rules = state.pointRules;
  return state.accounts
    .map((member) => {
      const topics = state.threads.filter((t) => !t.hidden && t.authorId === member.id).length;
      const replies = state.threads
        .filter((t) => !t.hidden)
        .flatMap((t) => t.replies)
        .filter((r) => r.authorId === member.id).length;
      const blogs = items.filter((i) => i.kind === 'article' && i.authorId === member.id).length;
      const lessons = new Set(state.progress[member.id] ?? []).size;
      const attendance = state.registrations.filter(
        (r) => r.memberId === member.id && r.status === 'attended',
      ).length;
      return {
        member,
        points:
          topics * rules.topic +
          replies * rules.reply +
          blogs * rules.blog +
          lessons * rules.lesson +
          attendance * rules.attendance,
      };
    })
    .sort(
      (a, b) =>
        b.points - a.points ||
        a.member.name.localeCompare(b.member.name) ||
        a.member.id.localeCompare(b.member.id),
    )
    .map((row, index, rows) => ({
      ...row,
      rank: rows.findIndex((r) => r.points === row.points) + 1,
      position: index + 1,
    }));
}
