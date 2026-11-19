import type { CommunitySession } from './community';
import type { DemoAccount, DemoState } from './demo';

export const eventTypes = {
  workshop: 'Workshops',
  webinar: 'Webinars',
  bootcamp: 'Bootcamps',
  masterclass: 'Masterclasses',
  summit: 'Summits',
  exhibition: 'Exhibitions',
} satisfies Record<CommunitySession['type'], string>;

export type EventCategory = { id: string; label: string; type: CommunitySession['type'] };
export type EventPresenter = {
  id: string;
  role: 'host' | 'facilitator';
  name: string;
  profession: string;
  photo?: string;
  accountId?: string;
};
export const maxEventPresenters = 12;
export const maxPresenterPhotoLength = 88_000;

function validPresenter(value: unknown): value is EventPresenter {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.id === 'string' &&
    row.id.length > 0 &&
    row.id.length <= 160 &&
    (row.role === 'host' || row.role === 'facilitator') &&
    typeof row.name === 'string' &&
    row.name.trim().length >= 2 &&
    row.name.length <= 120 &&
    typeof row.profession === 'string' &&
    row.profession.trim().length >= 2 &&
    row.profession.length <= 160 &&
    (row.accountId === undefined ||
      (typeof row.accountId === 'string' && row.accountId.length > 0)) &&
    (row.photo === undefined ||
      (typeof row.photo === 'string' &&
        row.photo.length <= maxPresenterPhotoLength &&
        /^data:image\/(?:webp|jpeg|png);base64,[A-Za-z0-9+/]+={0,2}$/.test(row.photo)))
  );
}

export function validEventPresenters(value: unknown, hostIds: string[]) {
  if (value === undefined) return true;
  if (!Array.isArray(value) || value.length > maxEventPresenters || !value.every(validPresenter))
    return false;
  const profiles = value.flatMap((row) => (row.accountId ? [row.accountId] : []));
  return (
    new Set(value.map((row) => row.id)).size === value.length &&
    new Set(profiles).size === profiles.length &&
    profiles.length === hostIds.length &&
    profiles.every((id) => hostIds.includes(id))
  );
}

export function sessionPresenters(
  session: CommunitySession | undefined,
  accounts: DemoAccount[],
): EventPresenter[] {
  if (!session) return [];
  if (session.presenters) return session.presenters;
  return session.hostIds.flatMap((accountId) => {
    const account = accounts.find((row) => row.id === accountId);
    return account
      ? [
          {
            id: accountId,
            accountId,
            name: account.name,
            profession: account.headline.trim().slice(0, 160) || 'YERH member',
            role: 'host',
          },
        ]
      : [];
  });
}
export type EventCommand =
  | { type: 'event-save'; session: CommunitySession; previous: string; now: string }
  | { type: 'event-category-save'; category: EventCategory; now: string };

export function isPublishedSession(session: CommunitySession) {
  return session.publication !== 'draft';
}

export function isPastSession(session: CommunitySession, now: number) {
  return session.status === 'completed' || (!!session.endsAt && Date.parse(session.endsAt) <= now);
}

export function updateSessionSchedule(
  event: CommunitySession,
  previous: CommunitySession | undefined,
  now: number,
): CommunitySession {
  if (
    !previous ||
    !isPastSession(previous, now) ||
    !event.startsAt ||
    !event.endsAt ||
    Date.parse(event.startsAt) <= now ||
    Date.parse(event.endsAt) <= Date.parse(event.startsAt) ||
    (Date.parse(event.startsAt) === Date.parse(previous.startsAt ?? '') &&
      Date.parse(event.endsAt) === Date.parse(previous.endsAt ?? ''))
  )
    return event;
  const oldDeadline = previous.registrationDeadline;
  const deadlineUnchanged =
    oldDeadline &&
    event.registrationDeadline &&
    Date.parse(oldDeadline) === Date.parse(event.registrationDeadline);
  return {
    ...event,
    status: event.status === 'postponed' ? 'postponed' : 'upcoming',
    registrationDeadline:
      deadlineUnchanged && Date.parse(oldDeadline) <= now ? null : event.registrationDeadline,
  };
}

export function isSessionType(type: unknown): type is CommunitySession['type'] {
  return typeof type === 'string' && Object.hasOwn(eventTypes, type);
}

export function eventCategories(saved: EventCategory[] = []) {
  const categories = new Map<string, EventCategory>();
  for (const [type, label] of Object.entries(eventTypes))
    if (isSessionType(type)) categories.set(type, { id: type, label, type });
  for (const category of saved) categories.set(category.id, category);
  return [...categories.values()];
}

export function sessionCategory(session: CommunitySession, saved: EventCategory[] = []) {
  return (
    eventCategories(saved).find(
      (category) => category.id === (session.categoryId ?? session.type),
    ) ?? { id: session.type, label: eventTypes[session.type], type: session.type }
  );
}

export function assertSession(session: CommunitySession, state?: DemoState) {
  const dates = [session.startsAt, session.endsAt, session.registrationDeadline];
  if (
    !session.id ||
    !isSessionType(session.type) ||
    !['upcoming', 'completed', 'postponed'].includes(session.status) ||
    (session.publication !== undefined && !['draft', 'published'].includes(session.publication)) ||
    dates.some(
      (date) => date !== null && (typeof date !== 'string' || !Number.isFinite(Date.parse(date))),
    )
  )
    throw new Error('Enter valid event details and dates.');
  new Intl.DateTimeFormat('en', { timeZone: session.timezone });
  if (
    (session.status === 'upcoming' &&
      isPublishedSession(session) &&
      (!session.startsAt || !session.endsAt)) ||
    (session.startsAt &&
      session.endsAt &&
      Date.parse(session.endsAt) <= Date.parse(session.startsAt))
  )
    throw new Error('Choose a valid event start and end time.');
  if (
    session.registrationDeadline &&
    session.startsAt &&
    Date.parse(session.registrationDeadline) > Date.parse(session.startsAt)
  )
    throw new Error('The registration deadline must be at or before the start time.');
  if (session.capacity !== null && (!Number.isInteger(session.capacity) || session.capacity <= 0))
    throw new Error('Enter a positive capacity or leave it blank.');
  if (!Array.isArray(session.hostIds) || !validEventPresenters(session.presenters, session.hostIds))
    throw new Error('Check presenter names, professions, photos and duplicate account selections.');
  if (!state) return;
  if (
    session.categoryId &&
    !eventCategories(state.platform.eventCategories).some(
      (category) => category.id === session.categoryId && category.type === session.type,
    )
  )
    throw new Error('Choose a valid event category.');
  if (
    !Array.isArray(session.hostIds) ||
    new Set(session.hostIds).size !== session.hostIds.length ||
    session.hostIds.some((id) => !state.accounts.some((account) => account.id === id))
  )
    throw new Error('Choose existing accounts as hosts.');
  if (
    (session.groupId && !state.groups.some((group) => group.id === session.groupId)) ||
    (session.forumId && !state.forums.some((forum) => forum.id === session.forumId))
  )
    throw new Error('The linked event group or forum is unavailable.');
  const seats = state.registrations.filter(
    (row) => row.sessionId === session.id && row.status !== 'cancelled',
  ).length;
  if (session.capacity !== null && session.capacity < seats)
    throw new Error('Capacity cannot fall below existing reservations.');
}
