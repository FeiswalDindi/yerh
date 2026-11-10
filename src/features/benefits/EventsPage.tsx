import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CalendarDays, ChevronDown, ChevronUp, MapPin } from 'lucide-react';
import { useDemo } from '../../app/useDemo';
import { PageIntro } from '../../shared/PageIntro';
import { usePageTitle } from '../../shared/usePageTitle';
import { DemoNotice } from '../demo/DemoNotice';
import { sessionPath } from '../../domain/community';
import { isCalendarDay, nairobiDay } from '../../domain/sidebar';
import { EventCalendar } from './EventCalendar';
export function EventsPage() {
  const { state } = useDemo();
  const [params, setParams] = useSearchParams();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [limit, setLimit] = useState(2);
  const [past, setPast] = useState(false);
  usePageTitle('Events');
  const date = params.get('date') ?? '';
  const type = params.get('type') ?? 'all';
  const filtered = state.sessions.filter(
    (s) =>
      (type === 'all' || s.type === type) &&
      (!isCalendarDay(date) ||
        (!!s.startsAt &&
          nairobiDay(s.startsAt) <= date &&
          nairobiDay(s.endsAt ?? s.startsAt) >= date)),
  );
  const upcoming = filtered.filter(
    (s) => s.status !== 'completed' && (!s.endsAt || Date.parse(s.endsAt) > Date.now()),
  );
  const historical = filtered.filter((s) => !upcoming.includes(s));
  return (
    <>
      <PageIntro
        eyebrow="Benefits · Events"
        title="Connect. Learn. Put ideas into action."
        description="Explore workshops and webinars, find your next session and continue learning with the community."
      />
      <section className="container section">
        <DemoNotice />
        <div className="benefit-detail">
          <div>
            <div className="community-toolbar">
              <h2>Upcoming events</h2>
              <span>{upcoming.length} sessions</span>
            </div>
            {upcoming.slice(0, limit).map((s) => (
              <article className="event-listing" key={s.id}>
                <div className="event-date-tile">
                  <CalendarDays size={24} />
                  {s.startsAt ? (
                    <>
                      <strong>
                        {new Date(s.startsAt).toLocaleDateString('en-KE', {
                          day: '2-digit',
                          timeZone: s.timezone,
                        })}
                      </strong>
                      <span>
                        {new Date(s.startsAt).toLocaleDateString('en-KE', {
                          month: 'short',
                          year: 'numeric',
                          timeZone: s.timezone,
                        })}
                      </span>
                    </>
                  ) : (
                    'Date to be confirmed'
                  )}
                </div>
                <div>
                  <p className="eyebrow">
                    {s.type} · {s.status}
                  </p>
                  <h2>
                    <Link to={sessionPath(s.id)}>{s.title}</Link>
                  </h2>
                  <p className="session-meta">
                    <MapPin size={15} />
                    {s.venue}
                  </p>
                  <p>{s.summary}</p>
                  <div className="form-actions">
                    <Link className="button" to={sessionPath(s.id)}>
                      View event & registration
                    </Link>
                    <button
                      className="text-link"
                      aria-expanded={expanded === s.id}
                      onClick={() => setExpanded(expanded === s.id ? null : s.id)}
                    >
                      {expanded === s.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      Details
                    </button>
                  </div>
                  {expanded === s.id && (
                    <div className="event-expanded">
                      <p>
                        {s.startsAt &&
                          new Date(s.startsAt).toLocaleString('en-KE', {
                            timeZone: s.timezone,
                          })}{' '}
                        · EAT
                      </p>
                      <p>
                        {s.capacity === null
                          ? 'Open capacity'
                          : `${Math.max(0, s.capacity - state.registrations.filter((r) => r.sessionId === s.id && r.status !== 'cancelled').length)} places available`}
                      </p>
                      <Link to={sessionPath(s.id)}>Meet the hosts and reserve your place →</Link>
                    </div>
                  )}
                </div>
              </article>
            ))}
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
              historical.map((s) => (
                <Link className="profile-sidebar-link" key={s.id} to={sessionPath(s.id)}>
                  {s.title}
                  <small>Historical session · registration closed</small>
                </Link>
              ))}
          </div>
          <aside className="profile-panel event-filters">
            <h2>Find an event</h2>
            <EventCalendar
              sessions={state.sessions.filter((s) => type === 'all' || s.type === type)}
              selectedDay={date}
              onSelect={(day) => {
                const next = new URLSearchParams(params);
                if (day) next.set('date', day);
                else next.delete('date');
                setParams(next);
                setLimit(2);
              }}
            />
            <label>
              Date
              <input
                type="date"
                value={date}
                onChange={(e) => {
                  const next = new URLSearchParams(params);
                  if (e.target.value) next.set('date', e.target.value);
                  else next.delete('date');
                  setParams(next);
                }}
              />
            </label>
            <label>
              Type
              <select
                value={type}
                onChange={(e) => {
                  const next = new URLSearchParams(params);
                  next.set('type', e.target.value);
                  setParams(next);
                }}
              >
                <option value="all">All events</option>
                <option value="workshop">Workshops</option>
                <option value="webinar">Webinars</option>
                <option value="bootcamp">Bootcamps</option>
                <option value="masterclass">Masterclasses</option>
                <option value="summit">Summits</option>
                <option value="exhibition">Exhibitions</option>
              </select>
            </label>
            <button className="text-link" onClick={() => setParams({})}>
              Clear filters
            </button>
            <h3>Keep learning</h3>
            <Link className="profile-sidebar-link" to="/learn">
              Explore courses →
            </Link>
            <Link className="profile-sidebar-link" to="/opportunities">
              Explore opportunities →
            </Link>
          </aside>
        </div>
      </section>
    </>
  );
}
