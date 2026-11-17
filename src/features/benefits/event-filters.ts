import type { CommunitySession } from '../../domain/community';
import { nairobiDay } from '../../domain/sidebar';

export function sessionOccursOnDay(session: CommunitySession, day: string) {
  return Boolean(
    session.startsAt &&
    nairobiDay(session.startsAt) <= day &&
    nairobiDay(session.endsAt ?? session.startsAt) >= day,
  );
}

export function isPastSession(session: CommunitySession, now: number) {
  return session.status === 'completed' || (!!session.endsAt && Date.parse(session.endsAt) <= now);
}
