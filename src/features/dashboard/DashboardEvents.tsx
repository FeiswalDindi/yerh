import { CalendarDays, ChevronDown } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useDemo } from '../../app/useDemo';
import type { CommunitySession, EventRegistration } from '../../domain/community';
import { isCalendarDay } from '../../domain/sidebar';
import { usePageTitle } from '../../shared/usePageTitle';
import { EventCalendar } from '../benefits/EventCalendar';
import { isPastSession, sessionOccursOnDay } from '../benefits/event-filters';
import { DashboardCatalogueCards, type CatalogueEntry } from './DashboardCatalogueCards';
import { DashboardCatalogueSearch } from './DashboardCatalogueSearch';
import { DashboardCategoryRail } from './DashboardCategoryRail';
import { dashboardCataloguePaths } from './catalogue-paths';
import { useCatalogueFilters } from './useCatalogueFilters';

const eventTypes: Record<CommunitySession['type'], string> = {
  workshop: 'Workshops',
  webinar: 'Webinars',
  bootcamp: 'Bootcamps',
  masterclass: 'Masterclasses',
  summit: 'Summits',
  exhibition: 'Exhibitions',
};

const bookingLabels: Record<EventRegistration['status'], string> = {
  registered: 'Booked',
  attended: 'Attended',
  cancelled: 'Booking cancelled',
};

type EventEntry = CatalogueEntry & {
  session: CommunitySession;
  past: boolean;
  booking?: EventRegistration['status'];
};

function EventSection({
  title,
  entries,
  empty,
}: {
  title: string;
  entries: EventEntry[];
  empty: string;
}) {
  return (
    <section className="dashboard-event-section">
      <h2>
        {title} <span>{entries.length}</span>
      </h2>
      {entries.length ? (
        <DashboardCatalogueCards items={entries} kind="events" icon={CalendarDays} />
      ) : (
        <p className="dashboard-event-empty">{empty}</p>
      )}
    </section>
  );
}

export function DashboardEvents() {
  const { account, state } = useDemo();
  const { params, category, matches, update, clear, searchProps } = useCatalogueFilters();
  usePageTitle('Events');
  if (!account) return null;

  const now = Date.now();
  const bookings = new Map(
    state.registrations
      .filter((record) => record.memberId === account.id)
      .map((record) => [record.sessionId, record.status]),
  );
  const entries: EventEntry[] = state.sessions.map((session) => {
    const booking = bookings.get(session.id);
    const past = isPastSession(session, now);
    const date =
      session.startsAt &&
      new Date(session.startsAt).toLocaleString('en-KE', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: session.timezone,
      });
    return {
      id: session.id,
      title: session.title,
      summary: session.summary,
      category: eventTypes[session.type],
      details: date ? `${date} · ${session.venue}` : session.venue,
      status: booking
        ? bookingLabels[booking]
        : session.status === 'postponed'
          ? 'Postponed'
          : undefined,
      session,
      past,
      booking,
    };
  });
  const view = params.get('view');
  const mine = view === 'mine';
  const date = params.get('date') ?? '';
  const selectedDay = isCalendarDay(date) ? date : '';
  const matchesSearch = entries.filter(matches);
  const filtered = matchesSearch.filter(
    ({ session }) => !selectedDay || sessionOccursOnDay(session, selectedDay),
  );
  const upcoming = filtered.filter((entry) => !entry.past);
  const past = filtered.filter((entry) => entry.past);
  const archiveOpen =
    view === 'past' || (!view && !!selectedDay && !upcoming.length && !!past.length);
  const activeBookings = entries.filter((entry) => entry.booking === 'registered' && !entry.past);
  const pastBookings = entries.filter(
    (entry) => entry.booking === 'attended' || (entry.booking === 'registered' && entry.past),
  );
  const cancelled = entries.filter((entry) => entry.booking === 'cancelled');
  const cataloguePath = dashboardCataloguePaths.events;

  return (
    <section className="container section dashboard-catalogue dashboard-events" aria-label="Events">
      <nav className="dashboard-event-tabs" aria-label="Events views">
        <Link to={cataloguePath} aria-current={!mine ? 'page' : undefined}>
          Event catalogue
        </Link>
        <Link to={`${cataloguePath}?view=mine`} aria-current={mine ? 'page' : undefined}>
          My Events
        </Link>
      </nav>
      {mine ? (
        <div className="dashboard-event-sections">
          <EventSection
            title="Upcoming & ongoing"
            entries={activeBookings}
            empty="You have no upcoming bookings."
          />
          <EventSection
            title="Past events"
            entries={pastBookings}
            empty="You have no past bookings yet."
          />
          {!!cancelled.length && (
            <EventSection title="Cancelled bookings" entries={cancelled} empty="" />
          )}
        </div>
      ) : (
        <>
          <div className="dashboard-catalogue-toolbar">
            <DashboardCatalogueSearch label="Search events" {...searchProps} />
            {(category || searchProps.query || selectedDay) && (
              <button type="button" className="button button-outline" onClick={clear}>
                Clear filters
              </button>
            )}
          </div>
          <DashboardCategoryRail
            entries={entries}
            category={category}
            icon={CalendarDays}
            onChange={(value) => update({ category: value })}
          />
          <div className="dashboard-event-layout">
            <div className="dashboard-event-sections">
              <EventSection
                title="Upcoming & active events"
                entries={upcoming}
                empty={
                  category || searchProps.query || selectedDay
                    ? 'No upcoming events match your filters.'
                    : 'No upcoming events are scheduled.'
                }
              />
              <section
                className="dashboard-event-section"
                aria-labelledby="dashboard-event-archive-title"
              >
                <h2 id="dashboard-event-archive-title">
                  <button
                    type="button"
                    className="dashboard-event-archive"
                    aria-expanded={archiveOpen}
                    aria-controls="dashboard-event-archive"
                    onClick={() => update({ view: archiveOpen ? 'upcoming' : 'past' })}
                  >
                    Past events archive <span>{past.length}</span>
                    <ChevronDown size={20} aria-hidden="true" />
                  </button>
                </h2>
                <div id="dashboard-event-archive" hidden={!archiveOpen}>
                  {archiveOpen &&
                    (past.length ? (
                      <DashboardCatalogueCards items={past} kind="events" icon={CalendarDays} />
                    ) : (
                      <p className="dashboard-event-empty">No past events match your filters.</p>
                    ))}
                </div>
              </section>
            </div>
            <section className="dashboard-event-date" aria-labelledby="dashboard-event-date-title">
              <h2 id="dashboard-event-date-title">Filter by date</h2>
              <EventCalendar
                sessions={matchesSearch.map((entry) => entry.session)}
                selectedDay={selectedDay}
                onSelect={(day) => update({ date: day, view: '' })}
              />
            </section>
          </div>
        </>
      )}
    </section>
  );
}
