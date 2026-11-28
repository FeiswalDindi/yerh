import { isPublishedSession } from '../../domain/events';
import { useCallback, useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  Building2,
  CalendarDays,
  CheckCircle2,
  MapPin,
  MessageSquare,
  ThumbsUp,
  Trophy,
  Users,
} from 'lucide-react';
import { laravelModeEnabled } from '../../config/laravel';
import { useDemo } from '../../app/useDemo';
import { useCatalog } from '../../app/useCatalog';
import { useLaravelSession } from '../../app/useLaravelSession';
import {
  communityFeed,
  friendIds,
  leaderboard,
  memberPath,
  type FeedEntry,
} from '../../domain/community';
import { usePageTitle } from '../../shared/usePageTitle';
import { Breadcrumb } from '../../shared/Breadcrumb';
import { DemoNotice } from '../demo/DemoNotice';
import { NotFoundPage } from '../info/NotFoundPage';
import { ContentCard } from '../content/ContentCard';
import { ActivityTimeline } from './ActivityTimeline';
import { displayRoleLabel, roleLabels } from '../../domain/roles';
import {
  communityRepository,
  type CommunityMemberProfilePayload,
} from '../../services/laravel-community-repository';
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

const memberBreadcrumbParents = [{ label: 'Members', to: '/network?tab=members' }];
const liveBreadcrumbParents = [{ label: 'Forums', to: '/forums' }];

function memberInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'Y';
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

function LaravelMemberProfilePage() {
  const { memberId = '' } = useParams();
  const session = useLaravelSession();
  const profile = session?.profile;
  const [params, setParams] = useSearchParams();

  const [data, setData] = useState<CommunityMemberProfilePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState('');
  const [avatarFailed, setAvatarFailed] = useState(false);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError('');
      setNotFound(false);
      setAvatarFailed(false);
      try {
        const res = await communityRepository.memberProfile(memberId, signal);
        if (!signal?.aborted) setData(res);
      } catch (cause) {
        if (signal?.aborted) return;
        const msg = cause instanceof Error ? cause.message : 'Member profile not found.';
        if (/not found|404/i.test(msg)) setNotFound(true);
        else setError(msg);
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [memberId],
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  usePageTitle(data ? `${data.member.name} · Community` : notFound ? 'Member not found' : 'Member');

  if (notFound) return <NotFoundPage />;

  if (loading && !data) {
    return (
      <section className="container section member-profile">
        <p className="source-note">Loading community profile…</p>
      </section>
    );
  }

  if (error || !data) {
    return (
      <section className="container section member-profile">
        <p className="form-error" role="alert">
          {error || 'Could not load this member profile.'}
        </p>
        <Link className="text-link" to="/forums">
          ← Back to forums
        </Link>
      </section>
    );
  }

  const { member, stats, leaderboard: lb, groups, threads, replies, comments, ventures, activity } =
    data;
  const isOwn = Boolean(profile && profile.id === member.id);
  const editProfileHref =
    profile?.role === 'guest' && !profile.staff.length ? '/account' : '/dashboard/profile';
  const tabs = [
    { id: 'activity', label: 'Activity', count: activity.length },
    { id: 'forums', label: 'Forums', count: stats.threads_count + stats.replies_count },
    { id: 'groups', label: 'Groups', count: stats.groups_count },
    { id: 'comments', label: 'Comments', count: stats.comments_count },
    { id: 'profile', label: 'Profile' },
  ];
  const tab = tabs.some((t) => t.id === params.get('tab')) ? params.get('tab')! : 'activity';
  const allPoints = lb.all?.points ?? 0;
  const allRank = lb.all?.rank;

  return (
    <section className="container section member-profile">
      <Breadcrumb current={member.name} parents={liveBreadcrumbParents} />

      <header className="member-cover">
        <div className="member-cover-decoration" aria-hidden="true">
          <Users size={140} strokeWidth={0.7} />
        </div>
        <div className="member-identity">
          <span className="member-avatar member-avatar-large" aria-hidden="true">
            {member.avatar && !avatarFailed ? (
              <img
                src={member.avatar}
                alt=""
                referrerPolicy="no-referrer"
                onError={() => setAvatarFailed(true)}
              />
            ) : (
              memberInitials(member.name)
            )}
          </span>
          <div>
            <p className="eyebrow">{displayRoleLabel(member.role)}</p>
            <h1>{member.name}</h1>
            {(member.headline || member.institution?.name) && (
              <p>
                {member.headline || member.institution?.name}
                {member.headline && member.institution?.name ? ` · ${member.institution.name}` : ''}
              </p>
            )}
            <div className="member-facts">
              {member.location && (
                <span>
                  <MapPin size={15} aria-hidden="true" />
                  {member.location}
                </span>
              )}
              {member.institution && (
                <span>
                  <Building2 size={15} aria-hidden="true" />
                  {member.institution.name}
                </span>
              )}
              <span>
                <Trophy size={15} aria-hidden="true" />
                {allRank
                  ? `${allPoints} points · Rank #${allRank}`
                  : `${stats.threads_count + stats.replies_count + stats.comments_count} public contributions`}
              </span>
            </div>
          </div>
        </div>
        {isOwn && (
          <div className="member-cover-actions">
            <Link className="button button-gold" to={editProfileHref}>
              Edit my profile
            </Link>
          </div>
        )}
      </header>

      <nav className="section-tabs profile-tabs" aria-label="Member sections">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            aria-pressed={tab === t.id}
            onClick={() => setParams({ tab: t.id })}
          >
            {t.label}
            {t.count !== undefined && <span className="tab-count">{t.count}</span>}
          </button>
        ))}
      </nav>

      <div className="member-profile-layout">
        <div className="member-profile-main">
          {tab === 'activity' && (
            <>
              <h2>Recent community activity</h2>
              {activity.length > 0 ? (
                <div className="discussion-list">
                  {activity.map((item) => (
                    <article className="discussion-row" key={item.id}>
                      <MessageSquare size={22} aria-hidden="true" />
                      <div>
                        <span className="eyebrow">
                          {item.kind === 'thread'
                            ? 'Forum topic'
                            : item.kind === 'reply'
                              ? 'Forum reply'
                              : item.kind === 'comment'
                                ? 'Article comment'
                                : 'Group circle'}
                        </span>
                        <h3>
                          <Link to={item.href}>{item.title}</Link>
                        </h3>
                        <p>{item.summary}</p>
                        <time dateTime={item.created_at}>
                          {new Date(item.created_at).toLocaleDateString('en-KE', {
                            dateStyle: 'medium',
                            timeZone: 'Africa/Nairobi',
                          })}
                        </time>
                      </div>
                      <Link className="text-link" to={item.href}>
                        Open →
                      </Link>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="empty-state">No public community activity recorded yet.</p>
              )}
            </>
          )}

          {tab === 'forums' && (
            <div className="community-panel-stack">
              <div className="community-toolbar">
                <h2>Forum topics · {threads.length}</h2>
                <Link className="text-link" to="/forums">
                  Explore forums →
                </Link>
              </div>
              {threads.length > 0 ? (
                <div className="discussion-list">
                  {threads.map((t) => (
                    <article className="discussion-row" key={t.id}>
                      <MessageSquare size={22} aria-hidden="true" />
                      <div>
                        <span className="eyebrow">
                          {t.forum_name}
                          {t.accepted_reply_id ? ' · Solved' : ''}
                        </span>
                        <h3>
                          <Link to={`/forums/${t.id}`}>{t.title}</Link>
                        </h3>
                        <p>
                          {t.reply_count} {t.reply_count === 1 ? 'reply' : 'replies'}
                        </p>
                      </div>
                      <Link className="text-link" to={`/forums/${t.id}`}>
                        Read →
                      </Link>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="empty-state">No forum discussions started yet.</p>
              )}

              <h2>Forum replies · {replies.length}</h2>
              {replies.length > 0 ? (
                <div className="community-panel-stack">
                  {replies.map((r) => (
                    <article
                      className={`discussion-post${r.is_solution ? ' is-solution' : ''}`}
                      key={r.id}
                    >
                      <span className="eyebrow">
                        {r.forum_name}
                        {r.is_solution && (
                          <>
                            {' · '}
                            <CheckCircle2
                              size={12}
                              style={{ display: 'inline', verticalAlign: 'middle' }}
                            />{' '}
                            Accepted solution
                          </>
                        )}{' '}
                        · <ThumbsUp size={12} style={{ display: 'inline', verticalAlign: 'middle' }} />{' '}
                        {r.votes_count} helpful
                      </span>
                      <h3>
                        <Link to={`/forums/${r.thread_id}#reply-${r.id}`}>{r.thread_title}</Link>
                      </h3>
                      <p>{r.body}</p>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="empty-state">No forum replies yet.</p>
              )}
            </div>
          )}

          {tab === 'groups' && (
            <>
              <div className="community-toolbar">
                <h2>Groups joined · {groups.length}</h2>
                <Link className="text-link" to="/groups">
                  Browse all groups →
                </Link>
              </div>
              {groups.length > 0 ? (
                <div className="community-groups-grid">
                  {groups.map((g) => (
                    <article className="profile-panel community-group-card" key={g.id}>
                      <p className="eyebrow">
                        {g.category} · {g.member_count}{' '}
                        {g.member_count === 1 ? 'member' : 'members'}
                      </p>
                      <h3>
                        <Link to={`/groups/${encodeURIComponent(g.slug)}`}>{g.name}</Link>
                      </h3>
                      <Link className="text-link" to={`/groups/${encodeURIComponent(g.slug)}`}>
                        Open circle →
                      </Link>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="empty-state">No community groups joined yet.</p>
              )}
            </>
          )}

          {tab === 'comments' && (
            <>
              <h2>Article &amp; story comments · {comments.length}</h2>
              {comments.length > 0 ? (
                <div className="community-panel-stack">
                  {comments.map((c) => (
                    <article className="discussion-post" key={c.id}>
                      <span className="eyebrow">
                        <Link to={c.href}>{c.article_title}</Link>
                      </span>
                      <p>{c.body}</p>
                      <time dateTime={c.created_at}>
                        {new Date(c.created_at).toLocaleDateString('en-KE', {
                          dateStyle: 'medium',
                          timeZone: 'Africa/Nairobi',
                        })}
                      </time>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="empty-state">No article comments yet.</p>
              )}
            </>
          )}

          {tab === 'profile' && (
            <div className="community-panel-stack">
              <article className="profile-card">
                <h2>About {member.name.split(' ')[0]}</h2>
                <p>{member.bio || 'No bio added yet.'}</p>
                {member.institution && (
                  <p className="source-note">
                    Affiliated institution: <strong>{member.institution.name}</strong>
                  </p>
                )}
              </article>

              {ventures.length > 0 && (
                <article className="profile-card">
                  <h2>Approved ventures · {ventures.length}</h2>
                  <div className="discussion-list">
                    {ventures.map((v) => (
                      <div className="discussion-row" key={v.id}>
                        <Building2 size={20} aria-hidden="true" />
                        <div>
                          <h3>{v.name}</h3>
                          <p>
                            {v.sector} · {v.location}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </article>
              )}
            </div>
          )}
        </div>

        <aside className="member-profile-aside">
          <section className="profile-panel">
            <h2>Profile info</h2>
            <p className="session-meta">
              <CalendarDays size={16} aria-hidden="true" />
              Joined{' '}
              {new Date(member.joined_at).toLocaleDateString('en-KE', {
                month: 'long',
                year: 'numeric',
                timeZone: 'Africa/Nairobi',
              })}
            </p>
            <p>{member.bio || `${member.name} is a ${displayRoleLabel(member.role)} on YERH.`}</p>
            <Link className="text-link" to={`/members/${member.id}?tab=profile`}>
              View full profile →
            </Link>
          </section>

          <section className="profile-panel">
            <h2>Community standing</h2>
            {lb.month || lb.all ? (
              <div className="community-panel-stack">
                {lb.month && (
                  <p>
                    <strong>This month:</strong> Rank #{lb.month.rank} · {lb.month.points} pts
                  </p>
                )}
                {lb.all && (
                  <p>
                    <strong>All time:</strong> Rank #{lb.all.rank} · {lb.all.points} pts
                  </p>
                )}
                <p className="source-note">
                  {stats.solutions_count} accepted solutions · {stats.helpful_votes_received}{' '}
                  helpful votes
                </p>
              </div>
            ) : (
              <p className="source-note">
                {stats.threads_count} forum topics · {stats.replies_count} replies ·{' '}
                {stats.comments_count} article comments
              </p>
            )}
          </section>

          <section className="profile-panel">
            <h2>Groups · {groups.length}</h2>
            {groups.length > 0 ? (
              groups.map((g) => (
                <Link
                  className="profile-sidebar-link"
                  key={g.id}
                  to={`/groups/${encodeURIComponent(g.slug)}`}
                >
                  {g.name}
                  <small>{g.member_count} members</small>
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

function DemoMemberProfilePage() {
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
  const sessions = state.sessions
    .filter(isPublishedSession)
    .filter(
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
      <Breadcrumb current={member.name} parents={memberBreadcrumbParents} />
      <DemoNotice />
      <header className="member-cover">
        <div className="member-cover-decoration" aria-hidden="true">
          <Users size={140} strokeWidth={0.7} />
        </div>
        <div className="member-identity">
          <MemberAvatar member={member} large />
          <div>
            <h1>{member.name}</h1>
            <p>
              @{member.handle} · {roleLabels[member.role]} · {member.headline}
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

export function MemberProfilePage() {
  return laravelModeEnabled ? <LaravelMemberProfilePage /> : <DemoMemberProfilePage />;
}
