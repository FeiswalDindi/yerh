import type { PlatformState } from './platform';
import type { DemoAccount, DemoState } from './demo';
import { can } from './roles.ts';

export type CoursePrice = { price: number; discount: number };
export type CourseCompletion = {
  accountId: string;
  courseId: string;
  completedAt?: string;
};
export type Proposal = {
  id: string;
  mentorId: string;
  title: string;
  description: string;
  audience: string;
  documents: { name: string; data: string }[];
  status: 'pending' | 'approved' | 'rejected' | 'published';
  feedback: string;
  royaltyPercent: number;
  modules: { id: string; title: string; body: string }[];
};
export type CourseCommerce = {
  prices: Record<string, CoursePrice>;
  proposals: Proposal[];
  purchases: {
    courseId: string;
    accountId: string;
    amount: number;
    royaltyCents: number;
    paidAt: string;
  }[];
};
export type CourseCommand = (
  | {
      type: 'course-propose';
      id: string;
      title: string;
      description: string;
      audience: string;
      documents: Proposal['documents'];
    }
  | {
      type: 'course-proposal-review';
      id: string;
      decision: 'approved' | 'rejected';
      feedback: string;
      royaltyPercent: number;
    }
  | { type: 'course-module-save'; id: string; moduleId: string; title: string; body: string }
  | { type: 'course-publish'; id: string; price: number }
  | { type: 'course-price'; id: string; price: number; discount: number }
  | { type: 'course-purchase'; id: string; expectedPrice: number }
) & { now: string };
export const courseActions = [
  'course-propose',
  'course-proposal-review',
  'course-module-save',
  'course-publish',
  'course-price',
  'course-purchase',
] satisfies CourseCommand['type'][];

export function authoredCourseId(proposal: Proposal) {
  return 'mentor-course-' + proposal.id;
}
export function authoredLessonId(proposal: Proposal, module: Proposal['modules'][number]) {
  return authoredCourseId(proposal) + '-' + module.id;
}
export function coursePricing(p: PlatformState, courseId: string) {
  return p.courseCommerce?.prices[courseId] ?? { price: 0, discount: 0 };
}
export function courseCharge(p: PlatformState, courseId: string) {
  const { price, discount } = coursePricing(p, courseId);
  return price - discount;
}
export function coursePurchased(p: PlatformState, courseId: string, accountId: string) {
  return (
    p.courseCommerce?.purchases.some(
      (purchase) => purchase.courseId === courseId && purchase.accountId === accountId,
    ) ?? false
  );
}
export function courseLessonIds(p: PlatformState, courseId: string) {
  const proposal = p.courseCommerce?.proposals.find(
    (row) => row.status === 'published' && authoredCourseId(row) === courseId,
  );
  return proposal
    ? proposal.modules.map((module) => authoredLessonId(proposal, module))
    : Object.hasOwn(p.courseLessons, courseId)
      ? p.courseLessons[courseId]
      : undefined;
}
export function courseEntries(p: PlatformState) {
  return [
    ...Object.entries(p.courseLessons),
    ...(p.courseCommerce?.proposals ?? [])
      .filter((row) => row.status === 'published')
      .map(
        (row) =>
          [
            authoredCourseId(row),
            row.modules.map((module) => authoredLessonId(row, module)),
          ] as const,
      ),
  ];
}

export function courseCompletionKey({ accountId, courseId }: CourseCompletion) {
  return JSON.stringify([accountId, courseId]);
}

export function courseCompletionRecords(state: DemoState): CourseCompletion[] {
  const p = state.platform;
  const completed = new Map(
    (p.courseCompletions ?? []).map((record) => [courseCompletionKey(record), record]),
  );
  function recover(accountId: string, courseId: string) {
    const progress = state.progress[accountId];
    if (!progress?.length) return;
    const record = { accountId, courseId };
    const key = courseCompletionKey(record);
    if (completed.has(key)) return;
    const lessons = courseLessonIds(p, courseId);
    if (lessons?.length && lessons.every((id) => progress.includes(id))) {
      completed.set(key, record);
    }
  }
  for (const [accountId, courses] of Object.entries(p.enrollments))
    for (const courseId of courses) recover(accountId, courseId);
  // Older local records can have lesson progress and enrollment history after withdrawal.
  for (const event of p.audit)
    if (event.action === 'enroll' || event.action === 'course-purchase')
      recover(event.actorId, event.targetId);
  return [...completed.values()];
}

export function courseCertificateQueue(state: DemoState) {
  const issued = new Set(state.platform.certificates.map(courseCompletionKey));
  return courseCompletionRecords(state).filter(
    (record) => !issued.has(courseCompletionKey(record)),
  );
}
const validAmount = (n: number) => Number.isSafeInteger(n) && n >= 0 && n <= 1_000_000;
const validPercent = (n: number) => Number.isInteger(n) && n >= 0 && n <= 100;
const clean = (value: string, min: number, max: number) => {
  const text = value.trim();
  if (text.length < min || text.length > max)
    throw new Error(`Enter between ${min} and ${max} characters.`);
  return text;
};
export const validCourseDocument = (data: string) =>
  data.length <= 350000 && /^data:application\/pdf;base64,JVBERi0[A-Za-z0-9+/=]*$/.test(data);
export const validCourseDocuments = (documents: Proposal['documents']) =>
  documents.length > 0 &&
  documents.every((document) => validCourseDocument(document.data)) &&
  documents.reduce((size, document) => size + document.data.length, 0) <= 350000;

export function applyCourseAction(
  p: PlatformState,
  actor: DemoAccount,
  action: CourseCommand,
): string {
  const commerce = (p.courseCommerce ??= { prices: {}, proposals: [], purchases: [] });
  if (action.type === 'course-propose') {
    if (
      !can(actor, 'mentor') ||
      !/^[\w-]{1,100}$/.test(action.id) ||
      commerce.proposals.some((row) => row.id === action.id)
    )
      throw new Error('An active mentor is required to submit a new proposal.');
    if (!validCourseDocuments(action.documents))
      throw new Error('Attach PDF documents up to 250 KB combined.');
    commerce.proposals.push({
      id: action.id,
      mentorId: actor.id,
      title: clean(action.title, 3, 120),
      description: clean(action.description, 20, 3000),
      audience: clean(action.audience, 3, 300),
      documents: action.documents.map((document) => ({
        name: clean(document.name, 5, 140),
        data: document.data,
      })),
      feedback: '',
      royaltyPercent: 0,
      status: 'pending',
      modules: [],
    });
  } else if (action.type === 'course-price') {
    if (!can(actor, 'admin') || !courseLessonIds(p, action.id))
      throw new Error('Choose a course to price.');
    if (
      !validAmount(action.price) ||
      !validAmount(action.discount) ||
      action.discount > action.price
    )
      throw new Error('Enter a valid price and a discount no larger than the price.');
    commerce.prices[action.id] = { price: action.price, discount: action.discount };
  } else if (action.type === 'course-purchase') {
    if (!can(actor, 'learn') || !courseLessonIds(p, action.id)?.length)
      throw new Error('An eligible learner and an available course are required.');
    const prior = coursePurchased(p, action.id, actor.id);
    const amount = courseCharge(p, action.id);
    if (!prior && (amount <= 0 || action.expectedPrice !== amount))
      throw new Error('The price changed. Review the current course price.');
    if (!prior && !p.enrollments[actor.id]?.includes(action.id)) {
      const course = commerce.proposals.find(
        (row) => row.status === 'published' && authoredCourseId(row) === action.id,
      );
      commerce.purchases.push({
        courseId: action.id,
        accountId: actor.id,
        amount,
        royaltyCents: amount * (course?.royaltyPercent ?? 0),
        paidAt: action.now,
      });
    }
    p.enrollments[actor.id] = [...new Set([...(p.enrollments[actor.id] ?? []), action.id])];
  } else {
    const proposal = commerce.proposals.find((row) => row.id === action.id);
    if (!proposal) throw new Error('Course proposal unavailable.');
    if (action.type === 'course-proposal-review') {
      if (
        !can(actor, 'admin') ||
        proposal.status !== 'pending' ||
        !['approved', 'rejected'].includes(action.decision) ||
        !validPercent(action.royaltyPercent)
      )
        throw new Error('Choose a pending proposal and a valid royalty percentage.');
      proposal.feedback = clean(action.feedback, 5, 3000);
      proposal.status = action.decision;
      proposal.royaltyPercent = action.decision === 'approved' ? action.royaltyPercent : 0;
    } else {
      if (!can(actor, 'mentor') || proposal.mentorId !== actor.id || proposal.status !== 'approved')
        throw new Error('Only the approved mentor can build this course.');
      if (action.type === 'course-module-save') {
        if (!/^[\w-]{1,100}$/.test(action.moduleId)) throw new Error('Invalid module identifier.');
        const module = {
          id: action.moduleId,
          title: clean(action.title, 3, 120),
          body: clean(action.body, 20, 5000),
        };
        const index = proposal.modules.findIndex((row) => row.id === module.id);
        if (index < 0) proposal.modules.push(module);
        else proposal.modules[index] = module;
      } else {
        if (!proposal.modules.length || !validAmount(action.price) || action.price < 1)
          throw new Error('Add a module and enter a positive course price before publishing.');
        if (Object.hasOwn(p.courseLessons, authoredCourseId(proposal)))
          throw new Error('The course identifier is already in use.');
        commerce.prices[authoredCourseId(proposal)] = { price: action.price, discount: 0 };
        proposal.status = 'published';
      }
    }
  }
  return action.id;
}
