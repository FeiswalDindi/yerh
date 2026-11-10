import {
  applyCommunityAction,
  type CommunityAction,
  type CommunitySession,
  type Connection,
  type EventRegistration,
  type PointRules,
} from './community.ts';
import { can, type Role } from './roles.ts';
import { applyPlatformAction, isPlatformAction } from './platform-actions.ts';
import type { PlatformAction, PlatformState } from './platform';
export type DemoRole = Role;
export interface DemoAccount {
  id: string;
  email: string;
  suspended?: boolean;
  phone?: string;
  ageRange?: string;
  name: string;
  role: DemoRole;
  headline: string;
  location: string;
  bio: string;
  skills: string[];
  handle: string;
  joinedAt: string;
}
export interface Forum {
  id: string;
  name: string;
  description: string;
  groupId?: string;
  memberIds?: string[];
}
export interface Reply {
  id: string;
  authorId: string;
  body: string;
  createdAt: string;
}
export interface Thread extends Reply {
  forumId: string;
  title: string;
  hidden: boolean;
  replies: Reply[];
}
export interface Group {
  id: string;
  name: string;
  category: string;
  description: string;
  memberIds: string[];
}
export interface MentorshipRequest {
  id: string;
  menteeId: string;
  mentorId: string;
  goal: string;
  status: 'pending' | 'accepted' | 'declined';
}
export interface Activity {
  id: string;
  actorId: string;
  text: string;
  createdAt: string;
  groupId?: string;
}
export interface Submission {
  id: string;
  ownerId: string;
  kind: 'article' | 'story' | 'business';
  title: string;
  category: string;
  body: string;
  status: 'draft' | 'review' | 'published';
}
export interface DemoState {
  platform: PlatformState;
  version: 2;
  connections: Connection[];
  sessions: CommunitySession[];
  registrations: EventRegistration[];
  pointRules: PointRules;
  activeAccountId: string | null;
  accounts: DemoAccount[];
  forums: Forum[];
  threads: Thread[];
  groups: Group[];
  requests: MentorshipRequest[];
  activity: Activity[];
  progress: Record<string, string[]>;
  interests: Record<string, string[]>;
  submissions: Submission[];
}
export type DemoAction =
  | PlatformAction
  | CommunityAction
  | { type: 'login'; accountId: string }
  | { type: 'logout' }
  | { type: 'profile'; name: string; headline: string; bio: string; location: string }
  | { type: 'topic'; id: string; forumId: string; title: string; body: string; now: string }
  | { type: 'reply'; id: string; threadId: string; body: string; now: string }
  | { type: 'moderate'; threadId: string }
  | { type: 'membership'; groupId: string; now?: string }
  | { type: 'forum-membership'; forumId: string }
  | { type: 'progress'; lessonId: string }
  | { type: 'interest'; eventId: string }
  | { type: 'request'; id: string; mentorId: string; goal: string }
  | { type: 'request-status'; requestId: string; status: 'accepted' | 'declined' }
  | {
      type: 'submission';
      id: string;
      kind: Submission['kind'];
      title: string;
      category: string;
      body: string;
    }
  | { type: 'edit-submission'; id: string; title: string; category: string; body: string }
  | { type: 'submission-status'; id: string; status: Submission['status'] };
export function currentAccount(state: DemoState) {
  return state.accounts.find((a) => a.id === state.activeAccountId) ?? null;
}
function text(value: string, min: number, max: number) {
  const clean = value.trim();
  if (clean.length < min || clean.length > max)
    throw new Error(`Please enter between ${min} and ${max} characters.`);
  return clean;
}
function timestamp(value: string) {
  if (!Number.isFinite(Date.parse(value))) throw new Error('Invalid activity time.');
}
/** All simulated permissions and mutations live in one testable boundary. This is not real auth. */
export function applyDemoAction(state: DemoState, action: DemoAction): DemoState {
  if (isPlatformAction(action)) return applyPlatformAction(state, action);
  if (action.type === 'logout') return { ...state, activeAccountId: null };
  if (action.type === 'login') {
    if (!state.accounts.some((a) => a.id === action.accountId))
      throw new Error('Unknown demo account');
    if (state.accounts.find((a) => a.id === action.accountId)?.suspended)
      throw new Error('This account is suspended.');
    return { ...state, activeAccountId: action.accountId };
  }
  const actor = currentAccount(state);
  if (!actor) throw new Error('Choose a demo account to try this action.');
  if (actor.suspended) throw new Error('This account is suspended.');
  if (actor.role === 'guest' && action.type !== 'profile')
    throw new Error('Apply for an approved role to access this feature.');
  const capability = ['topic', 'reply', 'connection', 'membership', 'forum-membership'].includes(
    action.type,
  )
    ? 'community'
    : action.type === 'progress'
      ? 'learn'
      : action.type === 'request'
        ? 'apply'
        : action.type === 'registration'
          ? 'attend'
          : null;
  if (capability && !can(actor, capability))
    throw new Error('Apply for an approved role to access this feature.');
  const admin = actor.role === 'admin';
  if (action.type === 'connection' || action.type === 'registration')
    return applyCommunityAction(state, action, actor);
  switch (action.type) {
    case 'forum-membership': {
      const forum = state.forums.find((f) => f.id === action.forumId);
      if (!forum) throw new Error('Forum not found');
      const ids =
        forum.memberIds ?? state.groups.find((g) => g.id === forum.groupId)?.memberIds ?? [];
      return {
        ...state,
        forums: state.forums.map((f) =>
          f.id === forum.id
            ? {
                ...f,
                memberIds: ids.includes(actor.id)
                  ? ids.filter((id) => id !== actor.id)
                  : [...ids, actor.id],
              }
            : f,
        ),
      };
    }
    case 'profile':
      return {
        ...state,
        accounts: state.accounts.map((a) =>
          a.id === actor.id
            ? {
                ...a,
                name: text(action.name, 2, 80),
                headline: text(action.headline, 3, 120),
                bio: text(action.bio, 10, 600),
                location: text(action.location, 2, 80),
              }
            : a,
        ),
      };
    case 'topic': {
      if (!state.forums.some((f) => f.id === action.forumId)) throw new Error('Forum not found');
      timestamp(action.now);
      if (!action.id || state.threads.some((t) => t.id === action.id))
        throw new Error('Discussion ID already exists.');
      const thread: Thread = {
        id: action.id,
        forumId: action.forumId,
        authorId: actor.id,
        title: text(action.title, 5, 140),
        body: text(action.body, 10, 3000),
        createdAt: action.now,
        hidden: false,
        replies: [],
      };
      return {
        ...state,
        threads: [thread, ...state.threads],
        activity: [
          {
            id: action.id,
            actorId: actor.id,
            text: `Started a discussion: ${thread.title}`,
            createdAt: action.now,
          },
          ...state.activity,
        ].slice(0, 100),
      };
    }
    case 'reply': {
      const thread = state.threads.find((t) => t.id === action.threadId && !t.hidden);
      if (!thread) throw new Error('Discussion not available');
      timestamp(action.now);
      if (!action.id || state.threads.some((t) => t.replies.some((r) => r.id === action.id)))
        throw new Error('Reply ID already exists.');
      return {
        ...state,
        threads: state.threads.map((t) =>
          t.id === thread.id
            ? {
                ...t,
                replies: [
                  ...t.replies,
                  {
                    id: action.id,
                    authorId: actor.id,
                    body: text(action.body, 2, 2000),
                    createdAt: action.now,
                  },
                ],
              }
            : t,
        ),
      };
    }
    case 'moderate':
      if (!can(actor, 'cms')) throw new Error('Content management access required');
      return {
        ...state,
        threads: state.threads.map((t) =>
          t.id === action.threadId ? { ...t, hidden: !t.hidden } : t,
        ),
      };
    case 'membership':
      if (!state.groups.some((g) => g.id === action.groupId)) throw new Error('Group not found');
      if (action.now) timestamp(action.now);
      return {
        ...state,
        activity: action.now
          ? [
              {
                id: `membership:${actor.id}:${action.groupId}:${action.now}`,
                actorId: actor.id,
                text: `${state.groups.find((g) => g.id === action.groupId)!.memberIds.includes(actor.id) ? 'Left' : 'Joined'} ${state.groups.find((g) => g.id === action.groupId)!.name}`,
                createdAt: action.now,
                groupId: action.groupId,
              },
              ...state.activity,
            ].slice(0, 100)
          : state.activity,
        groups: state.groups.map((g) =>
          g.id === action.groupId
            ? {
                ...g,
                memberIds: g.memberIds.includes(actor.id)
                  ? g.memberIds.filter((id) => id !== actor.id)
                  : [...g.memberIds, actor.id],
              }
            : g,
        ),
      };
    case 'progress': {
      if (
        !Object.entries(state.platform.courseLessons).some(
          ([courseId, lessonIds]) =>
            lessonIds.includes(action.lessonId) &&
            (state.platform.enrollments[actor.id] ?? []).includes(courseId),
        )
      )
        throw new Error('Enroll in this course before updating progress.');
      const ids = state.progress[actor.id] ?? [];
      return {
        ...state,
        progress: {
          ...state.progress,
          [actor.id]: ids.includes(action.lessonId)
            ? ids.filter((id) => id !== action.lessonId)
            : [...ids, action.lessonId],
        },
      };
    }
    case 'interest': {
      const ids = state.interests[actor.id] ?? [];
      return {
        ...state,
        interests: {
          ...state.interests,
          [actor.id]: ids.includes(action.eventId)
            ? ids.filter((id) => id !== action.eventId)
            : [...ids, action.eventId],
        },
      };
    }
    case 'request': {
      if (!can(actor, 'apply'))
        throw new Error('Use the entrepreneur or mentee demo to request guidance.');
      if (
        !state.accounts.some((a) => a.id === action.mentorId && a.role === 'mentor' && !a.suspended)
      )
        throw new Error('Mentor not found');
      if (
        state.requests.some(
          (r) =>
            r.menteeId === actor.id && r.mentorId === action.mentorId && r.status !== 'declined',
        )
      )
        throw new Error('You already have an active request with this mentor.');
      return {
        ...state,
        requests: [
          ...state.requests,
          {
            id: action.id,
            menteeId: actor.id,
            mentorId: action.mentorId,
            goal: text(action.goal, 10, 800),
            status: 'pending',
          },
        ],
      };
    }
    case 'request-status': {
      const request = state.requests.find((r) => r.id === action.requestId);
      if (!request || request.status !== 'pending' || (!admin && request.mentorId !== actor.id))
        throw new Error('This request is not assigned to you.');
      return {
        ...state,
        requests: state.requests.map((r) =>
          r.id === request.id ? { ...r, status: action.status } : r,
        ),
      };
    }
    case 'submission': {
      if (!action.id || state.submissions.some((s) => s.id === action.id))
        throw new Error('Contribution ID already exists.');
      if (action.kind === 'business' && !['entrepreneur', 'admin'].includes(actor.role))
        throw new Error('Use the entrepreneur demo to create a business.');
      const entry: Submission = {
        id: action.id,
        ownerId: actor.id,
        kind: action.kind,
        title: text(action.title, 5, 140),
        category: text(action.category, 2, 60),
        body: text(action.body, 30, 5000),
        status: 'draft',
      };
      return { ...state, submissions: [...state.submissions, entry] };
    }
    case 'edit-submission': {
      const entry = state.submissions.find((s) => s.id === action.id);
      if (!entry || entry.status !== 'draft') throw new Error('Only drafts can be edited.');
      if (entry.ownerId !== actor.id && !admin && !(actor.role === 'content_manager'))
        throw new Error('This draft belongs to another account.');
      return {
        ...state,
        submissions: state.submissions.map((s) =>
          s.id === entry.id
            ? {
                ...s,
                title: text(action.title, 5, 140),
                category: text(action.category, 2, 60),
                body: text(action.body, 30, 5000),
              }
            : s,
        ),
      };
    }
    case 'submission-status': {
      const entry = state.submissions.find((s) => s.id === action.id);
      if (!entry) throw new Error('Draft not found');
      if (action.status === 'published' && !admin && !(actor.role === 'content_manager'))
        throw new Error('An editor or administrator must publish this draft.');
      if (
        action.status !== 'published' &&
        entry.ownerId !== actor.id &&
        !admin &&
        !(actor.role === 'content_manager')
      )
        throw new Error('This draft belongs to another account.');
      if (action.status === 'published' && entry.status !== 'review')
        throw new Error('Submit the draft for review before publishing.');
      if (entry.status === 'published' && !admin && actor.role !== 'content_manager')
        throw new Error('An editor or administrator must unpublish this entry.');
      return {
        ...state,
        submissions: state.submissions.map((s) =>
          s.id === entry.id ? { ...s, status: action.status } : s,
        ),
      };
    }
  }
}
