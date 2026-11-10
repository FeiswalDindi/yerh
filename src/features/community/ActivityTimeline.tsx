import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, MessageCircle, MessageSquare, Users } from 'lucide-react';
import type { FeedEntry } from '../../domain/community';
import { MemberLink } from './CommunityCards';

const activityTypes = {
  topic: { label: 'Discussion', icon: MessageSquare },
  reply: { label: 'Reply', icon: MessageCircle },
  blog: { label: 'Blog', icon: BookOpen },
  group: { label: 'Membership', icon: Users },
};
export function ActivityTimeline({ entries }: { entries: FeedEntry[] }) {
  const [filter, setFilter] = useState('all');
  const [limit, setLimit] = useState(10);
  const filtered = entries.filter((e) => filter === 'all' || e.kind === filter);
  return (
    <section className="activity-timeline" aria-label="Group activity">
      <div className="activity-timeline-toolbar">
        <p>
          {filtered.length} {filtered.length === 1 ? 'update' : 'updates'}
        </p>
        <label className="community-filter">
          Show
          <select
            aria-label="Group activity type"
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value);
              setLimit(10);
            }}
          >
            <option value="all">All activity</option>
            {Object.entries(activityTypes).map(([key, type]) => (
              <option key={key} value={key}>
                {type.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {filtered.length ? (
        <ol>
          {filtered.slice(0, limit).map((entry) => {
            const type = activityTypes[entry.kind];
            const Icon = type.icon;
            return (
              <li key={entry.id}>
                <span className="activity-timeline-icon" aria-hidden="true">
                  <Icon size={16} />
                </span>
                <div className="activity-timeline-copy">
                  <Link to={entry.href}>{entry.text}</Link>
                  <p>
                    <MemberLink id={entry.actorId} />
                    {entry.createdAt && (
                      <>
                        {' '}
                        ·{' '}
                        <time dateTime={entry.createdAt}>
                          {new Date(entry.createdAt).toLocaleString('en-KE', {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                            timeZone: 'Africa/Nairobi',
                          })}{' '}
                          EAT
                        </time>
                      </>
                    )}
                  </p>
                </div>
                <span className="activity-timeline-kind">{type.label}</span>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="activity-timeline-empty">No activity in this category yet.</p>
      )}
      {filtered.length > limit && (
        <button type="button" className="text-link" onClick={() => setLimit(limit + 10)}>
          Show more activity
        </button>
      )}
    </section>
  );
}
