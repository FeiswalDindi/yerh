import { useDemo } from '../../app/useDemo';
import { Link } from 'react-router-dom';
import { sessionPath } from '../../domain/community';
import { isPublishedSession } from '../../domain/events';
import { SectionHeading } from '../../shared/SectionHeading';

export function UpcomingEventsSection() {
  const { state } = useDemo();
  const now = Date.now();
  const events = state.sessions
    .filter(
      (event) =>
        isPublishedSession(event) &&
        event.status === 'upcoming' &&
        event.startsAt &&
        Date.parse(event.startsAt) > now,
    )
    .sort((first, second) => Date.parse(first.startsAt!) - Date.parse(second.startsAt!))
    .slice(0, 3);
  if (!events.length) return null;
  return (
    <section className="home-section" aria-label="Upcoming events">
      <SectionHeading title="Upcoming events" link="/events" label="View all events" />
      <div className="updates-card-grid">
        {events.map((event) => (
          <article key={event.id} className="update-item-card">
            <time className="update-date" dateTime={event.startsAt!}>
              {new Date(event.startsAt!).toLocaleString('en-KE', {
                dateStyle: 'medium',
                timeStyle: 'short',
                timeZone: event.timezone,
              })}
            </time>
            <h3 className="update-title">
              <Link to={sessionPath(event.id)}>{event.title}</Link>
            </h3>
            <p>{event.venue}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
