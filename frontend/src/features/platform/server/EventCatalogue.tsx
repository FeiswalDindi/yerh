import { useCallback, useEffect, useState } from 'react';
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ExternalLink,
  MapPin,
  Video,
} from 'lucide-react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';
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
import { StatusIndicator } from '../../../shared/StatusIndicator';
import { AccountLink } from '../../accounts/AccountLink';
import {
  DashboardCatalogueCards,
  type CatalogueEntry,
} from '../../dashboard/DashboardCatalogueCards';
import { DashboardCatalogueSearch } from '../../dashboard/DashboardCatalogueSearch';
import { DashboardCategoryRail } from '../../dashboard/DashboardCategoryRail';
import { EventPresenters } from '../../resources/EventPresenters';
import '../../dashboard/dashboard.css';
import '../../resources/event-presenters.css';
import { RecordsFeedback, useWorkspaceRecords, WorkspaceAction } from './WorkspaceActions';

const eventPath = (slug: string) => '/sessions/' + encodeURIComponent(slug);
const eventTime = (value: string) => value.replace('T', ' ') + ' EAT';

function formatEventStart(value: string) {
  const parsed = new Date(value + '+03:00');
  if (Number.isNaN(parsed.getTime())) return eventTime(value);
  return parsed.toLocaleString('en-KE', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Africa/Nairobi',
  });
}

function EventDetails({ slug, dashboard = false }: { slug: string; dashboard?: boolean }) {
  const session = useLaravelSession();
  const { search } = useLocation();
  const profile = session?.profile;
  const load = useCallback(
    (signal: AbortSignal) => engagementRepository.event(slug, signal),
    [slug],
  );
  const { records: event, error, reload } = useWorkspaceRecords(load);
  const preview = dashboard && new URLSearchParams(search).get('eventView') === 'preview';
  const canBook = Boolean(profile?.email_verified && !preview);
  const bookingClosed =
    event && Date.parse((event.deadline ?? event.starts_at) + '+03:00') <= Date.now();
  const isStaff = Boolean(profile && ['admin', 'content_manager'].includes(profile.role));

  return (
    <>
      {!dashboard && (
        <PageIntro
          eyebrow={event ? `Events · ${event.category}` : 'Events'}
          title={event?.title ?? 'Event'}
          description={event?.summary ?? ''}
        />
      )}
      <section className={dashboard ? 'section' : 'container section'}>
        {dashboard && event && (
          <>
            <h1 className="workspace-heading">{event.title}</h1>
            <p>{event.summary}</p>
          </>
        )}
        <Link className="text-link" to={dashboard ? '/dashboard/events' : '/events'}>
          {dashboard ? '← Back to events' : '← All events'}
        </Link>
        <RecordsFeedback loading={event === null} error={error} />
        {event && (
          <div className="session-layout">
            <div>
              <article className="profile-panel">
                <h2>Session details</h2>
                <dl className="session-details">
                  <dt>Category</dt>
                  <dd>{event.category}</dd>
                  <dt>Starts</dt>
                  <dd>{eventTime(event.starts_at)}</dd>
                  <dt>Ends</dt>
                  <dd>{eventTime(event.ends_at)}</dd>
                  <dt>Format</dt>
                  <dd>
                    {event.venue_type === 'virtual' ? 'Virtual (online session)' : 'In-person'}
                  </dd>
                  <dt>{event.venue_type === 'virtual' ? 'Platform' : 'Venue'}</dt>
                  <dd>{event.venue}</dd>
                  {event.venue_type === 'virtual' && (
                    <>
                      <dt>Meeting link</dt>
                      <dd>
                        {event.meeting_link ? (
                          <a
                            href={event.meeting_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                          >
                            {event.meeting_link} <ExternalLink size={14} aria-hidden="true" />
                          </a>
                        ) : (
                          <span>Shared immediately after you reserve your spot.</span>
                        )}
                      </dd>
                    </>
                  )}
                  {event.deadline && (
                    <>
                      <dt>Registration closes</dt>
                      <dd>{eventTime(event.deadline)}</dd>
                    </>
                  )}
                </dl>
              </article>

              <h2 className="community-section-title">Hosts &amp; facilitators</h2>
              {event.presenters.length > 0 ? (
                <EventPresenters
                  presenters={event.presenters.map((presenter, index) => ({
                    id: `${event.id}-${index}`,
                    name: presenter.name,
                    profession: presenter.profession,
                    role: presenter.role,
                    photo: presenter.photo || '',
                  }))}
                />
              ) : (
                <p className="empty-state">
                  Host and facilitator details will appear here when added.
                </p>
              )}
            </div>

            <aside>
              <section className="profile-panel">
                <h2>Your place</h2>
                <p>
                  {event.capacity === null
                    ? 'Open capacity · no seat limit'
                    : `${Math.max(0, event.capacity - event.bookings)} of ${event.capacity} places available`}
                </p>
                {event.booked && (
                  <p role="status">
                    <StatusIndicator status="approved" label="Spot reserved" />
                  </p>
                )}
                {event.booked && event.venue_type === 'virtual' && event.meeting_link && (
                  <a
                    href={event.meeting_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="button"
                    style={{ marginBottom: '0.75rem', width: '100%', justifyContent: 'center' }}
                  >
                    <Video size={16} aria-hidden="true" /> Join virtual session
                  </a>
                )}
                {!event.booked &&
                  isStaff &&
                  event.venue_type === 'virtual' &&
                  event.meeting_link && (
                    <a
                      href={event.meeting_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="button button-outline"
                      style={{ marginBottom: '0.75rem', width: '100%', justifyContent: 'center' }}
                    >
                      <Video size={16} aria-hidden="true" /> Preview meeting link
                    </a>
                  )}
                {bookingClosed && !event.booked && <p>Registration is closed.</p>}
                {!session?.loading && !profile && !bookingClosed && (
                  <AccountLink className="button">Sign in to reserve</AccountLink>
                )}
                {profile && !profile.email_verified && !bookingClosed && (
                  <Link className="button" to="/account">
                    Verify email to reserve
                  </Link>
                )}
                {canBook &&
                  (event.booked ||
                    (!bookingClosed &&
                      (event.capacity === null || event.bookings < event.capacity))) && (
                    <WorkspaceAction
                      action={event.booked ? 'Cancel reservation' : 'Reserve spot'}
                      create={!event.booked}
                      title={event.title}
                      submit={event.booked ? 'Cancel reservation' : 'Confirm reservation'}
                      save={async () => {
                        await engagementRepository.reserve(event.slug, event.booked);
                        reload();
                      }}
                    >
                      <p>
                        {event.title} · {eventTime(event.starts_at)}
                      </p>
                      <p>
                        {event.venue_type === 'virtual'
                          ? 'You will receive the virtual meeting link by email and on this page.'
                          : `Venue: ${event.venue}`}
                      </p>
                    </WorkspaceAction>
                  )}
                {profile?.email_verified && !dashboard && (
                  <Link className="profile-sidebar-link" to="/dashboard/events">
                    Manage in dashboard events →
                  </Link>
                )}
              </section>
            </aside>
          </div>
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
  const [limit, setLimit] = useState(4);
  const [past, setPast] = useState(false);
  const category = params.get('type') ?? '';
  const rawDay = params.get('date') ?? '';
  const day = isCalendarDay(rawDay) ? rawDay : '';
  const update = (key: string, value: string) => {
    setLimit(4);
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
        description="Explore upcoming sessions, meet their hosts, and reserve your place."
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
                      <p className="eyebrow">
                        {entry.category}
                        {entry.booked ? ' · Reserved' : ''}
                      </p>
                      <h2>
                        <Link to={eventPath(entry.slug)}>{entry.title}</Link>
                      </h2>
                      <p className="session-meta">
                        {entry.venue_type === 'virtual' ? (
                          <Video size={15} aria-hidden="true" />
                        ) : (
                          <MapPin size={15} aria-hidden="true" />
                        )}{' '}
                        {entry.venue_type === 'virtual' ? `Virtual · ${entry.venue}` : entry.venue}
                      </p>
                      <p>{entry.summary}</p>
                      <div className="form-actions">
                        <Link className="button" to={eventPath(entry.slug)}>
                          {entry.booked ? 'View reservation' : 'Reserve spot & details'}
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
                <button className="button button-outline" onClick={() => setLimit(limit + 4)}>
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
                    setLimit(4);
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

function toCatalogueEntry(entry: EventRecord): CatalogueEntry & { event: EventRecord } {
  const venueLabel = entry.venue_type === 'virtual' ? `Virtual · ${entry.venue}` : entry.venue;
  const spotsLabel = entry.booked
    ? ' · Reserved'
    : entry.capacity === null
      ? ' · Open'
      : ` · ${Math.max(0, entry.capacity - entry.bookings)} spots left`;

  return {
    id: entry.slug,
    title: entry.title,
    summary: entry.summary,
    category: entry.category,
    image: entry.presenters.find((p) => p.photo)?.photo ?? null,
    details: `${formatEventStart(entry.starts_at)} · ${venueLabel}${spotsLabel}`,
    event: entry,
  };
}

function EmbeddedEventCatalogue({ categoryName }: { categoryName?: string }) {
  const { records, error } = useWorkspaceRecords(engagementRepository.events);
  const [tab, setTab] = useState<'catalogue' | 'mine'>('catalogue');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [day, setDay] = useState('');
  const [archiveOpen, setArchiveOpen] = useState(false);

  const rawEvents = (records?.events ?? []).filter(
    (entry) => !categoryName || entry.category.toLowerCase() === categoryName.toLowerCase(),
  );
  const allEntries = rawEvents.map(toCatalogueEntry);

  const normalizedQuery = query.trim().toLowerCase();
  const matchesSearchAndCategory = allEntries.filter(({ event }) => {
    if (category && event.category.toLowerCase() !== category.toLowerCase()) return false;
    if (!normalizedQuery) return true;
    return [event.title, event.summary, event.category, event.venue, event.venue_type]
      .join(' ')
      .toLowerCase()
      .includes(normalizedQuery);
  });

  const filteredByDate = matchesSearchAndCategory.filter(
    ({ event }) =>
      !day || (event.starts_at.slice(0, 10) <= day && event.ends_at.slice(0, 10) >= day),
  );

  const upcoming = filteredByDate.filter(({ event }) => !event.archived);
  const past = filteredByDate.filter(({ event }) => event.archived);
  const myUpcoming = allEntries.filter(({ event }) => event.booked && !event.archived);
  const myPast = allEntries.filter(({ event }) => event.booked && event.archived);
  const effectiveArchiveOpen = archiveOpen || (!!day && !upcoming.length && !!past.length);

  return (
    <section className="dashboard-catalogue dashboard-events" aria-label="Events">
      <RecordsFeedback error={error} loading={records === null} />
      {records && (
        <>
          <nav className="dashboard-event-tabs" aria-label="Events views">
            <button
              type="button"
              aria-current={tab === 'catalogue' ? 'page' : undefined}
              onClick={() => setTab('catalogue')}
            >
              Event catalogue
            </button>
            <button
              type="button"
              aria-current={tab === 'mine' ? 'page' : undefined}
              onClick={() => setTab('mine')}
            >
              My Events ({myUpcoming.length + myPast.length})
            </button>
          </nav>

          {tab === 'mine' ? (
            <div className="dashboard-event-sections">
              <section className="dashboard-event-section">
                <h2>
                  Upcoming &amp; ongoing <span>{myUpcoming.length}</span>
                </h2>
                {myUpcoming.length ? (
                  <DashboardCatalogueCards items={myUpcoming} kind="events" icon={CalendarDays} />
                ) : (
                  <p className="dashboard-event-empty">You have no upcoming bookings.</p>
                )}
              </section>
              <section className="dashboard-event-section">
                <h2>
                  Past events <span>{myPast.length}</span>
                </h2>
                {myPast.length ? (
                  <DashboardCatalogueCards items={myPast} kind="events" icon={CalendarDays} />
                ) : (
                  <p className="dashboard-event-empty">You have no past bookings yet.</p>
                )}
              </section>
            </div>
          ) : (
            <>
              <div className="dashboard-catalogue-toolbar">
                <DashboardCatalogueSearch label="Search events" query={query} onChange={setQuery} />
                {(category || query || day) && (
                  <button
                    type="button"
                    className="button button-outline"
                    onClick={() => {
                      setCategory('');
                      setQuery('');
                      setDay('');
                    }}
                  >
                    Clear filters
                  </button>
                )}
              </div>

              <DashboardCategoryRail
                entries={allEntries}
                category={category}
                icon={CalendarDays}
                onChange={setCategory}
              />

              <div className="dashboard-event-layout">
                <div className="dashboard-event-sections">
                  <section className="dashboard-event-section">
                    <h2>
                      Upcoming &amp; active events <span>{upcoming.length}</span>
                    </h2>
                    {upcoming.length ? (
                      <DashboardCatalogueCards items={upcoming} kind="events" icon={CalendarDays} />
                    ) : (
                      <p className="dashboard-event-empty">
                        {category || query || day
                          ? 'No upcoming events match your filters.'
                          : 'No upcoming events are scheduled.'}
                      </p>
                    )}
                  </section>

                  <section
                    className="dashboard-event-section"
                    aria-labelledby="dashboard-event-archive-title"
                  >
                    <h2 id="dashboard-event-archive-title">
                      <button
                        type="button"
                        className="dashboard-event-archive"
                        aria-expanded={effectiveArchiveOpen}
                        aria-controls="dashboard-event-archive"
                        onClick={() => setArchiveOpen((open) => !open)}
                      >
                        Past events archive <span>{past.length}</span>
                        <ChevronDown size={20} aria-hidden="true" />
                      </button>
                    </h2>
                    <div id="dashboard-event-archive" hidden={!effectiveArchiveOpen}>
                      {effectiveArchiveOpen &&
                        (past.length ? (
                          <DashboardCatalogueCards items={past} kind="events" icon={CalendarDays} />
                        ) : (
                          <p className="dashboard-event-empty">
                            No past events match your filters.
                          </p>
                        ))}
                    </div>
                  </section>
                </div>

                <section
                  className="dashboard-event-date"
                  aria-labelledby="dashboard-event-date-title"
                >
                  <h2 id="dashboard-event-date-title">Filter by date</h2>
                  <PublicEventCalendar
                    events={matchesSearchAndCategory.map((item) => item.event)}
                    day={day}
                    selectDay={setDay}
                  />
                </section>
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
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

export function LaravelEventPage({
  dashboard = false,
  slugOverride,
}: {
  dashboard?: boolean;
  slugOverride?: string;
}) {
  const { sessionId = '' } = useParams();
  const slug = slugOverride ?? sessionId;
  const session = useLaravelSession();
  return (
    <EventDetails
      key={slug + ':' + (session?.profile?.id ?? 'anonymous')}
      slug={slug}
      dashboard={dashboard}
    />
  );
}
