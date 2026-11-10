import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Thread } from '../../domain/demo';
import {
  calendarCells,
  discussionDayCounts,
  isCalendarDay,
  nairobiDay,
  shiftCalendarMonth,
} from '../../domain/sidebar';

export function ForumCalendar({
  threads,
  selectedDay = '',
  onSelect,
}: {
  threads: Thread[];
  selectedDay?: string;
  onSelect: (day: string) => void;
}) {
  const today = nairobiDay(new Date().toISOString());
  const selected = isCalendarDay(selectedDay) ? selectedDay : '';
  const [month, setMonth] = useState(() => (selected || today).slice(0, 7));
  useEffect(() => {
    if (selected) setMonth(selected.slice(0, 7));
  }, [selected]);
  const counts = discussionDayCounts(threads);
  const cells = calendarCells(month);
  const label = new Date(`${month}-01T12:00:00Z`).toLocaleDateString('en-KE', {
    month: 'long',
    year: 'numeric',
    timeZone: 'Africa/Nairobi',
  });
  const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  function dayLabel(day: string) {
    return new Date(`${day}T12:00:00Z`).toLocaleDateString('en-KE', {
      dateStyle: 'long',
      timeZone: 'Africa/Nairobi',
    });
  }
  return (
    <div className="forum-calendar">
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
        <caption className="sr-only">Filter discussions by activity date in {label}</caption>
        <thead>
          <tr>
            {weekdays.map((day) => (
              <th key={day} scope="col">
                <abbr title={day}>{day.slice(0, 2)}</abbr>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: cells.length / 7 }, (_, row) => (
            <tr key={row}>
              {cells.slice(row * 7, row * 7 + 7).map((day, col) => (
                <td key={day ?? `empty-${col}`}>
                  {day && (
                    <button
                      type="button"
                      aria-pressed={selected === day}
                      aria-current={day === today ? 'date' : undefined}
                      aria-label={`${dayLabel(day)} · ${counts[day] ?? 0} ${(counts[day] ?? 0) === 1 ? 'discussion' : 'discussions'}`}
                      className={counts[day] ? 'has-activity' : undefined}
                      onClick={() => onSelect(selected === day ? '' : day)}
                    >
                      {Number(day.slice(8))}
                      {!!counts[day] && <span className="calendar-dot" aria-hidden="true" />}
                    </button>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="calendar-legend">
        <span className="calendar-dot" aria-hidden="true" />
        Discussion or reply activity · EAT
      </p>
      {selected && (
        <p className="calendar-selected">
          Selected: {dayLabel(selected)}
          <button className="text-link" type="button" onClick={() => onSelect('')}>
            Clear date filter
          </button>
        </p>
      )}
    </div>
  );
}
