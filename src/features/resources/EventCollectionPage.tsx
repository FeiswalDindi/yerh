import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useDemo } from '../../app/useDemo';
import { PageIntro } from '../../shared/PageIntro';
import { usePageTitle } from '../../shared/usePageTitle';
import { DemoNotice } from '../demo/DemoNotice';
import { SessionCard } from '../community/CommunityCards';
export function EventCollectionPage({ type }: { type: 'workshops' | 'webinars' }) {
  const { state } = useDemo();
  const [status, setStatus] = useState('all');
  const title = type === 'workshops' ? 'Workshops' : 'Webinars';
  usePageTitle(title);
  const sessions = state.sessions.filter(
    (s) =>
      s.type === (type === 'workshops' ? 'workshop' : 'webinar') &&
      (status === 'all' || s.status === status),
  );
  return (
    <>
      <PageIntro
        eyebrow={title}
        title={
          type === 'workshops'
            ? 'Learn by doing, together.'
            : 'Ideas and learning, wherever you are.'
        }
        description="Explore sessions, meet their hosts, and continue the discussion with your community. Original resources remain available in the archive."
      />
      <section className="container section">
        <DemoNotice />
        <div className="community-toolbar">
          <nav className="section-tabs" aria-label="Events">
            <Link to="/workshops" aria-current={type === 'workshops' ? 'page' : undefined}>
              Workshops
            </Link>
            <Link to="/webinars" aria-current={type === 'webinars' ? 'page' : undefined}>
              Webinars
            </Link>
            <Link to="/events">Original event resources</Link>
          </nav>
          <label className="community-filter">
            Status
            <select
              aria-label="Session status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="all">All sessions</option>
              <option value="upcoming">Upcoming</option>
              <option value="completed">Archive</option>
              <option value="postponed">Postponed</option>
            </select>
          </label>
        </div>
        <div className="collection-grid">
          {sessions.map((session) => (
            <SessionCard key={session.id} session={session} />
          ))}
        </div>
        {!sessions.length && <p className="empty-state">No sessions match this status.</p>}
      </section>
    </>
  );
}
