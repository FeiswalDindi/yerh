import { useCallback, useEffect, useState } from 'react';
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  MapPin,
} from 'lucide-react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useLaravelSession } from '../../../app/useLaravelSession';
import {
  engagementRepository,
  type EventRecord,
} from '../../../services/laravel-engagement-repository';
import {
  calendarCells,
  isCalendarDay,
  nairobiDay,
  shiftCalendarMonth,
} from '../../../domain/sidebar';
import { PageIntro } from '../../../shared/PageIntro';
import { AccountLink } from '../../accounts/AccountLink';
import { EventPresenterAvatar } from '../../resources/EventPresenters';
import { WorkspaceTable, WorkspaceTabs } from '../workspace/WorkspaceControls';
import { RecordsFeedback, useWorkspaceRecords, WorkspaceAction } from './WorkspaceActions';

const eventPath = (slug: string) => '/sessions/' + encodeURIComponent(slug);
const eventTime = (value: string) => value.replace('T', ' ') + ' EAT';

function EventDetails({ slug }: { slug: string }) {
  const session = useLaravelSession();
  const profile = session?.profile;
  const load = useCallback(
    (signal: AbortSignal) => engagementRepository.event(slug, signal),
    [slug],
  );
  const { records: event, error, reload } = useWorkspaceRecords(load);
  const canBook = profile?.email_verified && ['guest', 'entrepreneur'].includes(profile.role);
  const bookingClosed =
    event && Date.parse((event.deadline ?? event.starts_at) + '+03:00') <= Date.now();
  return (
    <>
      <PageIntro
        eyebrow="Events"
        title={event?.title ?? 'Event'}
        description={event?.summary ?? ''}
      />
      <section className="container section">
        <Link to="/events">All events</Link>
        <RecordsFeedback loading={event === null} error={error} />
        {event && (
          <>
            <p>
              {event.category} · {event.venue}
            </p>
            <p>
              {eventTime(event.starts_at)} to {eventTime(event.ends_at)}
            </p>
            {event.presenters.length > 0 && (
              <div className="workspace-row-actions">
                {event.presenters.map((presenter, index) => (
                  <div key={index}>
                    <EventPresenterAvatar
                      presenter={{ name: presenter.name, photo: presenter.photo || '' }}
                    />
                    <strong>{presenter.name}</strong>
                    <div>
                      {presenter.profession} · {presenter.role === 'host' ? 'Host' : 'Facilitator'}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {event.booked && <p role="status">Your place is reserved.</p>}
            {bookingClosed && <p>Registration is closed.</p>}
            {!bookingClosed && event.capacity !== null && (
              <p>{Math.max(0, event.capacity - event.bookings)} places available.</p>
            )}
            {!session?.loading && !profile && !bookingClosed && (
              <AccountLink className="button">Sign in to reserve</AccountLink>
            )}
            {canBook &&
              (event.booked ||
                (!bookingClosed &&
                  (event.capacity === null || event.bookings < event.capacity))) && (
                <WorkspaceAction
                  action={event.booked ? 'Cancel booking' : 'Reserve place'}
                  submit={event.booked ? 'Cancel booking' : 'Reserve place'}
                  save={async () => {
                    await engagementRepository.reserve(event.slug, event.booked);
                    reload();
                  }}
                >
                  <p>
                    {event.title} · {eventTime(event.starts_at)}
                  </p>
                </WorkspaceAction>
              )}
          </>
        )}
      </section>
    </>
  );
}

function PublicEventCalendar({
  events,
  day,
  selectDay,
}: {
  events: EventRecord[];
  day: string;
  selectDay: (value: string) => void;
}) {
  const today = nairobiDay(new Date().toISOString());
  const [month, setMonth] = useState((day || today).slice(0, 7));
  useEffect(() => {
    if (day) setMonth(day.slice(0, 7));
  }, [day]);
  const label = new Date(month + '-01T12:00:00Z').toLocaleDateString('en-KE', {
    month: 'long',
    year: 'numeric',
    timeZone: 'Africa/Nairobi',
  });
  const cells = calendarCells(month);
  return (
    <div className="forum-calendar event-calendar">
      <div className="calendar-month-nav">
        <button
          type="button"
          aria-label="Previous month"
          disabled={month === '1900-01'}
          onClick={() => setMonth(shiftCalendarMonth(month, -1))}
        >
          <ChevronLeft size={18} aria-hidden="true" />
        </button>
        <p aria-live="polite">{label}</p>
        <button
          type="button"
          aria-label="Next month"
          disabled={month === '9999-12'}
          onClick={() => setMonth(shiftCalendarMonth(month, 1))}
        >
          <ChevronRight size={18} aria-hidden="true" />
        </button>
      </div>
      <table>
        <caption className="sr-only">Filter events by date in {label}</caption>
        <thead>
          <tr>
            {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((label) => (
              <th key={label} scope="col">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: cells.length / 7 }, (_, row) => (
            <tr key={row}>
              {cells.slice(row * 7, row * 7 + 7).map((cell, column) => {
                const count = cell
                  ? events.filter(
                      (entry) =>
                        entry.starts_at.slice(0, 10) <= cell && entry.ends_at.slice(0, 10) >= cell,
                    ).length
                  : 0;
                return (
                  <td key={cell ?? column}>
                    {cell && (
                      <button
                        type="button"
                        aria-label={cell + ': ' + count + ' events'}
                        aria-pressed={day === cell}
                        aria-current={cell === today ? 'date' : undefined}
                        className={count ? 'has-activity' : undefined}
                        onClick={() => selectDay(day === cell ? '' : cell)}
                      >
                        {Number(cell.slice(8))}
                        {!!count && <span className="calendar-dot" aria-hidden="true" />}
                      </button>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="calendar-legend">
        <span className="calendar-dot" />
        Event dates · EAT
      </p>
    </div>
  );
}

function PublicEventCatalogue({ categoryName }: { categoryName?: string }) {
  const { records, error } = useWorkspaceRecords(engagementRepository.events);
  const [params, setParams] = useSearchParams();
  const [expanded, setExpanded] = useState<number | null>(null);
  const [limit, setLimit] = useState(2);
  const [past, setPast] = useState(false);
  const category = params.get('type') ?? '';
  const rawDay = params.get('date') ?? '';
  const day = isCalendarDay(rawDay) ? rawDay : '';
  const update = (key: string, value: string) => {
    setLimit(2);
    setExpanded(null);
    setParams((current) => {
      const next = new URLSearchParams(current);
      if (value) next.set(key, value);
      else next.delete(key);
      return next;
    });
  };
  const filtered = (records?.events ?? []).filter(
    (entry) =>
      (!categoryName || entry.category.toLowerCase() === categoryName.toLowerCase()) &&
      (!category ||
        category === 'all' ||
        entry.category.toLowerCase() === category.toLowerCase() ||
        String(entry.category_id) === category),
  );
  const matches = filtered.filter(
    (entry) => !day || (entry.starts_at.slice(0, 10) <= day && entry.ends_at.slice(0, 10) >= day),
  );
  const upcoming = matches.filter((entry) => !entry.archived);
  const historical = matches.filter((entry) => entry.archived);
  return (
    <>
      <PageIntro
        eyebrow="Benefits · Events"
        title={categoryName ?? 'Connect. Learn. Put ideas into action.'}
        description="Explore workshops and webinars, find your next session and continue learning with the community."
      />
      <section className="container section">
        <RecordsFeedback error={error} loading={records === null} />
        {records && (
          <div className="benefit-detail">
            <div>
              <div className="community-toolbar">
                <h2>Upcoming events</h2>
                <span>{upcoming.length} sessions</span>
              </div>
              {upcoming.slice(0, limit).map((entry) => {
                const date = new Date(entry.starts_at + '+03:00');
                return (
                  <article className="event-listing" key={entry.id}>
                    <div className="event-date-tile">
                      <CalendarDays size={24} aria-hidden="true" />
                      <strong>
                        {date.toLocaleDateString('en-KE', {
                          day: '2-digit',
                          timeZone: 'Africa/Nairobi',
                        })}
                      </strong>
                      <span>
                        {date.toLocaleDateString('en-KE', {
                          month: 'short',
                          year: 'numeric',
                          timeZone: 'Africa/Nairobi',
                        })}
                      </span>
                    </div>
                    <div>
                      <p className="eyebrow">{entry.category}</p>
                      <h2>
                        <Link to={eventPath(entry.slug)}>{entry.title}</Link>
                      </h2>
                      <p className="session-meta">
                        <MapPin size={15} aria-hidden="true" />
                        {entry.venue}
                      </p>
                      <p>{entry.summary}</p>
                      <div className="form-actions">
                        <Link className="button" to={eventPath(entry.slug)}>
                          View event &amp; registration
                        </Link>
                        <button
                          className="text-link"
                          aria-expanded={expanded === entry.id}
                          onClick={() => setExpanded(expanded === entry.id ? null : entry.id)}
                        >
                          Details
                        </button>
                      </div>
                      {expanded === entry.id && (
                        <div className="event-expanded">
                          <p>
                            {eventTime(entry.starts_at)} to {eventTime(entry.ends_at)}
                          </p>
                          <p>
                            {entry.capacity === null
                              ? 'Open capacity'
                              : Math.max(0, entry.capacity - entry.bookings) + ' places available'}
                          </p>
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
              {!upcoming.length && (
                <p className="empty-state">No upcoming sessions match this date or type.</p>
              )}
              {upcoming.length > limit && (
                <button className="button button-outline" onClick={() => setLimit(limit + 2)}>
                  Load more events
                </button>
              )}
              <button
                className="past-events-toggle"
                aria-expanded={past}
                onClick={() => setPast(!past)}
              >
                Past events · {historical.length}{' '}
                {past ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </button>
              {past &&
                (historical.length ? (
                  historical.map((entry) => (
                    <Link
                      className="profile-sidebar-link"
                      key={entry.id}
                      to={eventPath(entry.slug)}
                    >
                      {entry.title}
                      <small>Historical session · registration closed</small>
                    </Link>
                  ))
                ) : (
                  <p className="empty-state">No past events match these filters.</p>
                ))}
            </div>
            <aside className="profile-panel event-filters">
              <h2>Find an event</h2>
              <PublicEventCalendar
                events={filtered}
                day={day}
                selectDay={(value) => update('date', value)}
              />
              {!categoryName && (
                <label>
                  Category{' '}
                  <select value={category} onChange={(event) => update('type', event.target.value)}>
                    <option value="">All categories</option>
                    {records.categories.map((entry) => (
                      <option key={entry.id} value={entry.name.toLowerCase()}>
                        {entry.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label>
                Date{' '}
                <input
                  type="date"
                  value={day}
                  onChange={(event) => update('date', event.target.value)}
                />
              </label>
              {(category || day) && (
                <button
                  className="text-link"
                  onClick={() => {
                    setLimit(2);
                    setExpanded(null);
                    setParams({});
                  }}
                >
                  Clear filters
                </button>
              )}
            </aside>
          </div>
        )}
      </section>
    </>
  );
}

function EmbeddedEventCatalogue({ categoryName }: { categoryName?: string }) {
  const { records, error } = useWorkspaceRecords(engagementRepository.events);
  const [category, setCategory] = useState('');
  const [day, setDay] = useState('');
  const renderTable = (archived: boolean) =>
    records && (
      <WorkspaceTable
        label={archived ? 'past events' : 'upcoming events'}
        columns={['Event', 'Category', 'Starts (EAT)', 'Venue', 'Action']}
        rows={records.events
          .filter(
            (entry) =>
              entry.archived === archived &&
              (!categoryName || entry.category.toLowerCase() === categoryName.toLowerCase()) &&
              (!category || String(entry.category_id) === category) &&
              (!day || (entry.starts_at.slice(0, 10) <= day && entry.ends_at.slice(0, 10) >= day)),
          )
          .map((entry: EventRecord) => ({
            id: String(entry.id),
            search: [entry.title, entry.summary, entry.category, entry.venue].join(' '),
            cells: [
              <>
                <strong>{entry.title}</strong>
                <div>{entry.summary}</div>
              </>,
              entry.category,
              entry.starts_at.replace('T', ' '),
              entry.venue,
              <Link to={eventPath(entry.slug)} aria-label={'View ' + entry.title}>
                View
              </Link>,
            ],
          }))}
      />
    );
  const content = (
    <>
      <RecordsFeedback error={error} loading={records === null} />
      {records && (
        <>
          <div className="workspace-row-actions">
            {!categoryName && (
              <label>
                Category{' '}
                <select value={category} onChange={(event) => setCategory(event.target.value)}>
                  <option value="">All categories</option>
                  {records.categories.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label>
              Date{' '}
              <input type="date" value={day} onChange={(event) => setDay(event.target.value)} />
            </label>
          </div>
          <WorkspaceTabs
            label="Event listings"
            param="events"
            views={[
              { id: 'upcoming', label: 'Upcoming', content: renderTable(false) },
              { id: 'past', label: 'Past events', content: renderTable(true) },
            ]}
          />
        </>
      )}
    </>
  );
  return content;
}

export function EventCatalogue({
  embedded = false,
  categoryName,
}: {
  embedded?: boolean;
  categoryName?: string;
}) {
  return embedded ? (
    <EmbeddedEventCatalogue categoryName={categoryName} />
  ) : (
    <PublicEventCatalogue categoryName={categoryName} />
  );
}

export function LaravelEventPage() {
  const { sessionId = '' } = useParams();
  const session = useLaravelSession();
  return (
    <EventDetails key={sessionId + ':' + (session?.profile?.id ?? 'anonymous')} slug={sessionId} />
  );
}
