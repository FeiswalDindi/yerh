import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { CommunitySession } from '../../domain/community';
import { calendarCells, isCalendarDay, nairobiDay, shiftCalendarMonth } from '../../domain/sidebar';

export function EventCalendar({
  sessions,
  selectedDay,
  onSelect,
}: {
  sessions: CommunitySession[];
  selectedDay: string;
  onSelect: (day: string) => void;
}) {
  const today = nairobiDay(new Date().toISOString());
  const selected = isCalendarDay(selectedDay) ? selectedDay : '';
  const [month, setMonth] = useState((selected || today).slice(0, 7));
  useEffect(() => {
    if (selected) setMonth(selected.slice(0, 7));
  }, [selected]);
  const label = new Date(`${month}-01T12:00:00Z`).toLocaleDateString('en-KE', {
    month: 'long',
    year: 'numeric',
    timeZone: 'Africa/Nairobi',
  });
  const cells = calendarCells(month);
  const count = (day: string) =>
    sessions.filter(
      (s) =>
        s.startsAt && nairobiDay(s.startsAt) <= day && nairobiDay(s.endsAt ?? s.startsAt) >= day,
    ).length;
  return (
    <div className="forum-calendar event-calendar">
      <div className="calendar-month-nav">
        <button
          type="button"
          aria-label="Previous month"
          disabled={month === '1900-01'}
          onClick={() => setMonth(shiftCalendarMonth(month, -1))}
        >
          <ChevronLeft size={18} />
        </button>
        <p aria-live="polite">{label}</p>
        <button
          type="button"
          aria-label="Next month"
          disabled={month === '9999-12'}
          onClick={() => setMonth(shiftCalendarMonth(month, 1))}
        >
          <ChevronRight size={18} />
        </button>
      </div>
      <table>
        <caption className="sr-only">Filter events by date in {label}</caption>
        <thead>
          <tr>
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
              <th key={d} scope="col">
                {d.slice(0, 2)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: cells.length / 7 }, (_, row) => (
            <tr key={row}>
              {cells.slice(row * 7, row * 7 + 7).map((day, col) => (
                <td key={day ?? col}>
                  {day && (
                    <button
                      type="button"
                      aria-label={`${day}: ${count(day)} events`}
                      aria-pressed={selected === day}
                      aria-current={day === today ? 'date' : undefined}
                      className={count(day) ? 'has-activity' : undefined}
                      onClick={() => onSelect(selected === day ? '' : day)}
                    >
                      {Number(day.slice(8))}
                      {!!count(day) && <span className="calendar-dot" aria-hidden="true" />}
                    </button>
                  )}
                </td>
              ))}
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
