import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { MapPin, CalendarDays, Trophy, Users } from 'lucide-react';
import { useDemo } from '../../app/useDemo';
import { useCatalog } from '../../app/useCatalog';
import {
  communityFeed,
  friendIds,
  leaderboard,
  memberPath,
  type FeedEntry,
} from '../../domain/community';
import { usePageTitle } from '../../shared/usePageTitle';
import { DemoNotice } from '../demo/DemoNotice';
import { NotFoundPage } from '../info/NotFoundPage';
import { ContentCard } from '../content/ContentCard';
import { ActivityTimeline } from './ActivityTimeline';
import { roleLabels } from '../../domain/roles';
import {
  FeedList,
  FriendshipActions,
  GroupCard,
  Leaderboard,
  MemberAvatar,
  MemberCard,
  MemberLink,
  SessionCard,
} from './CommunityCards';

export function MemberProfilePage() {
  const { memberId } = useParams();
  const { state, account } = useDemo();
  const { items } = useCatalog();
  const [params, setParams] = useSearchParams();
  const [scope, setScope] = useState('personal');
  const [kind, setKind] = useState('all');
  const member = state.accounts.find((a) => a.id === memberId);
  usePageTitle(member ? `${member.name} · Members` : 'Member not found');
  if (!member) return <NotFoundPage />;
  const own = account?.id === member.id;
  const friends = friendIds(state, member.id);
  const groups = state.groups.filter((g) => g.memberIds.includes(member.id));
  const groupIds = new Set(groups.map((g) => g.id));
  const posts = items.filter((i) => i.authorId === member.id && i.kind === 'article');
  const feed = communityFeed(state, items);
  const personal = feed.filter((e) => e.actorId === member.id);
  const forumEntries = personal.filter((e) => e.kind === 'topic' || e.kind === 'reply');
  const sessions = state.sessions.filter(
    (s) =>
      s.hostIds.includes(member.id) ||
      (own &&
        state.registrations.some(
          (r) => r.sessionId === s.id && r.memberId === member.id && r.status !== 'cancelled',
        )),
  );
  const rank = leaderboard(state, items).find((r) => r.member.id === member.id)!;
  const tabs = [
    { id: 'activity', label: 'Activity', count: personal.length },
    { id: 'blog', label: 'Blog', count: posts.length },
    { id: 'profile', label: 'Profile' },
    { id: 'friends', label: 'Friends', count: friends.length },
    { id: 'groups', label: 'Groups', count: groups.length },
    { id: 'forums', label: 'Forums', count: forumEntries.length },
    { id: 'events', label: 'Events', count: sessions.length },
  ];
  const tab = tabs.some((t) => t.id === params.get('tab')) ? params.get('tab')! : 'activity';
  const incoming = own
    ? state.connections.filter((c) => c.recipientId === member.id && c.status === 'pending')
    : [];
  const outgoing = own
    ? state.connections.filter((c) => c.requesterId === member.id && c.status === 'pending')
    : [];
  const activeFeed = feed.filter(
    (e) =>
      (scope === 'personal'
        ? e.actorId === member.id
        : scope === 'friends'
          ? friends.includes(e.actorId)
          : !!e.groupId && groupIds.has(e.groupId)) &&
      (kind === 'all' || e.kind === kind),
  );
  return (
    <section className="container section member-profile">
      <nav className="profile-breadcrumb" aria-label="Breadcrumb">
        <Link to="/">Home</Link>
        <span>/</span>
        <Link to="/network?tab=members">Members</Link>
        <span>/</span>
        <span>{member.name}</span>
      </nav>
      <DemoNotice />
      <header className="member-cover">
        <div className="member-cover-decoration" aria-hidden="true">
          <Users size={140} strokeWidth={0.7} />
        </div>
        <div className="member-identity">
          <MemberAvatar member={member} large />
          <div>
            <p className="eyebrow">YERH COMMUNITY · {roleLabels[member.role]}</p>
            <h1>{member.name}</h1>
            <p>
              @{member.handle} · {member.headline}
            </p>
            <div className="member-facts">
              <span>
                <MapPin size={15} />
                {member.location}
              </span>
              <span>
                <Trophy size={15} />
                {rank.points} points · Rank {rank.rank}
              </span>
            </div>
          </div>
        </div>
        <div className="member-cover-actions">
          <FriendshipActions memberId={member.id} />
          {member.role === 'mentor' && (
            <Link className="button button-gold" to="/yem/mentors">
              Explore mentorship
            </Link>
          )}
        </div>
      </header>
      <nav className="section-tabs profile-tabs" aria-label="Member sections">
        {tabs.map((t) => (
          <button key={t.id} aria-pressed={tab === t.id} onClick={() => setParams({ tab: t.id })}>
            {t.label}
            {t.count !== undefined && <span className="tab-count">{t.count}</span>}
          </button>
        ))}
      </nav>
      <div className="member-profile-layout">
        <div className="member-profile-main">
          {tab === 'activity' && (
            <>
              <div className="community-toolbar">
                <h2>Community activity</h2>
                <label className="community-filter">
                  Show
                  <select
                    aria-label="Activity type"
                    value={kind}
                    onChange={(e) => setKind(e.target.value)}
                  >
                    <option value="all">Everything</option>
                    {(['topic', 'reply', 'blog', 'group'] as FeedEntry['kind'][]).map((k) => (
                      <option key={k} value={k}>
                        {k === 'topic'
                          ? 'Discussions'
                          : k === 'reply'
                            ? 'Replies'
                            : k === 'blog'
                              ? 'Blogs'
                              : 'Group memberships'}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <nav className="section-tabs" aria-label="Activity scope">
                {['personal', 'friends', 'groups'].map((s) => (
                  <button key={s} aria-pressed={s === scope} onClick={() => setScope(s)}>
                    {s[0]!.toUpperCase() + s.slice(1)}
                  </button>
                ))}
              </nav>
              {scope === 'groups' ? (
                <ActivityTimeline entries={activeFeed} />
              ) : (
                <FeedList entries={activeFeed} />
              )}
            </>
          )}
          {tab === 'profile' && (
            <article className="profile-card">
              <h2>About {member.name.split(' ')[0]}</h2>
              <p>{member.bio}</p>
              <h3>Skills & interests</h3>
              <div className="tag-list">
                {member.skills.map((s) => (
                  <span key={s}>{s}</span>
                ))}
              </div>
            </article>
          )}
          {tab === 'blog' && (
            <>
              <div className="community-toolbar">
                <h2>Published blogs</h2>
                {own && (
                  <Link className="text-link" to="/dashboard/content">
                    Write a contribution →
                  </Link>
                )}
              </div>
              {posts.length ? (
                <div className="profile-card-grid">
                  {posts.map((p) => (
                    <ContentCard item={p} key={p.id} />
                  ))}
                </div>
              ) : (
                <p className="empty-state">No published blogs yet.</p>
              )}
            </>
          )}
          {tab === 'friends' && (
            <>
              {own && (
                <div className="profile-card">
                  <h2>Friend requests</h2>
                  {!incoming.length && !outgoing.length && <p>No pending requests.</p>}
                  {[...incoming, ...outgoing].map((c) => {
                    const id = c.requesterId === member.id ? c.recipientId : c.requesterId;
                    return (
                      <div className="friend-request" key={id}>
                        <MemberLink id={id} />
                        <FriendshipActions memberId={id} />
                      </div>
                    );
                  })}
                </div>
              )}
              <h2>Friends · {friends.length}</h2>
              {friends.length ? (
                <div className="profile-card-grid">
                  {state.accounts
                    .filter((a) => friends.includes(a.id))
                    .map((a) => (
                      <MemberCard key={a.id} member={a} />
                    ))}
                </div>
              ) : (
                <p className="empty-state">No accepted friendships yet.</p>
              )}
            </>
          )}
          {tab === 'groups' && (
            <>
              <h2>Groups · {groups.length}</h2>
              {groups.length ? (
                <div className="profile-card-grid">
                  {groups.map((g) => (
                    <GroupCard group={g} key={g.id} />
                  ))}
                </div>
              ) : (
                <p className="empty-state">No groups joined yet.</p>
              )}
            </>
          )}
          {tab === 'forums' && (
            <>
              <div className="community-toolbar">
                <h2>Discussions & replies</h2>
                <Link className="text-link" to="/forums">
                  Explore forums →
                </Link>
              </div>
              <FeedList entries={forumEntries} />
            </>
          )}
          {tab === 'events' && (
            <>
              <h2>{own ? 'My sessions & registrations' : 'Hosted sessions'}</h2>
              <p>Registrations are visible only to the member who made them.</p>
              {sessions.length ? (
                <div className="profile-card-grid">
                  {sessions.map((s) => (
                    <SessionCard session={s} key={s.id} />
                  ))}
                </div>
              ) : (
                <p className="empty-state">No sessions to show yet.</p>
              )}
            </>
          )}
        </div>
        <aside className="member-profile-aside">
          <section className="profile-panel">
            <h2>Profile info</h2>
            <p className="session-meta">
              <CalendarDays size={16} />
              Joined{' '}
              {new Date(`${member.joinedAt}T12:00:00Z`).toLocaleDateString('en-KE', {
                month: 'long',
                year: 'numeric',
                timeZone: 'Africa/Nairobi',
              })}
            </p>
            <p>{member.bio}</p>
            <Link className="text-link" to={`${memberPath(member.id)}?tab=profile`}>
              View full profile →
            </Link>
          </section>
          <section className="profile-panel">
            <h2>Leaderboard</h2>
            <Leaderboard compact highlightId={member.id} />
          </section>
          <section className="profile-panel">
            <h2>Groups</h2>
            {groups.length ? (
              groups.map((g) => (
                <Link className="profile-sidebar-link" key={g.id} to={`/network/groups/${g.id}`}>
                  {g.name}
                  <small>{g.memberIds.length} members</small>
                </Link>
              ))
            ) : (
              <p>No groups joined yet.</p>
            )}
          </section>
        </aside>
      </div>
    </section>
  );
}
