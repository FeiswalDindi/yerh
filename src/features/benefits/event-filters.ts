import type { CommunitySession } from '../../domain/community';
import { nairobiDay } from '../../domain/sidebar';
export { isPastSession } from '../../domain/events';

export function sessionOccursOnDay(session: CommunitySession, day: string) {
  return Boolean(
    session.startsAt &&
    nairobiDay(session.startsAt) <= day &&
    nairobiDay(session.endsAt ?? session.startsAt) >= day,
  );
}
