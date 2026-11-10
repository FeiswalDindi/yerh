import { Link, useParams } from 'react-router-dom';
import { useDemo } from '../../app/useDemo';
import { useCatalog } from '../../app/useCatalog';
import { communityFeed } from '../../domain/community';
import { PageIntro } from '../../shared/PageIntro';
import { usePageTitle } from '../../shared/usePageTitle';
import { DemoNotice } from '../demo/DemoNotice';
import { NotFoundPage } from '../info/NotFoundPage';
import { SessionCard } from './CommunityCards';
import { MemberRoster } from './MemberRoster';
import { ActivityTimeline } from './ActivityTimeline';
export function GroupPage() {
  const { groupId } = useParams();
  const { state, account } = useDemo();
  const { items } = useCatalog();
  const group = state.groups.find((g) => g.id === groupId);
  usePageTitle(group?.name ?? 'Group not found');
  if (!group) return <NotFoundPage />;
  const forums = state.forums.filter((f) => f.groupId === group.id);
  const sessions = state.sessions.filter((s) => s.groupId === group.id);
  const joined = !!account && group.memberIds.includes(account.id);
  return (
    <>
      <PageIntro eyebrow="YERH · Groups" title={group.name} description={group.description} />
      <section className="container section">
        <DemoNotice />
        <Link className="text-link" to="/network?tab=groups">
          ← All groups
        </Link>
        <div className="group-overview">
          <div className="profile-panel">
            <p className="eyebrow">{group.category}</p>
            <h2>About this circle</h2>
            <p>{group.description}</p>
            <p>
              {group.memberIds.length} members · {forums.length} linked{' '}
              {forums.length === 1 ? 'forum' : 'forums'} · {sessions.length}{' '}
              {sessions.length === 1 ? 'session' : 'sessions'}
            </p>
          </div>
          <div className="profile-panel">
            <h2>Group forums</h2>
            <p>Public conversations connected to this circle.</p>
            {forums.map((f) => (
              <Link className="profile-sidebar-link" key={f.id} to={`/forums?forum=${f.id}`}>
                {f.name}
                <small>{f.description}</small>
              </Link>
            ))}
            {!forums.length && <p>No linked forums yet.</p>}
          </div>
        </div>
        <MemberRoster scope="group" id={group.id} />
        <h2 className="community-section-title">Group activity</h2>
        {joined ? (
          <ActivityTimeline
            entries={communityFeed(state, items).filter((e) => e.groupId === group.id)}
          />
        ) : (
          <p className="member-roster-locked">Join this group to view its activity.</p>
        )}
        <h2 className="community-section-title">Workshops & webinars</h2>
        <div className="collection-grid">
          {sessions.map((s) => (
            <SessionCard key={s.id} session={s} />
          ))}
        </div>
        {!sessions.length && <p className="empty-state">No linked sessions yet.</p>}
      </section>
    </>
  );
}
