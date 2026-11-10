import { Link } from 'react-router-dom';
import { ArrowUpRight, CalendarDays, MapPin, Users } from 'lucide-react';
import { useDemo } from '../../app/useDemo';
import { useCatalog } from '../../app/useCatalog';
import {
  connectionBetween,
  leaderboard,
  memberPath,
  sessionPath,
  type CommunitySession,
  type FeedEntry,
} from '../../domain/community';
import type { DemoAccount, Group } from '../../domain/demo';
import { can, roleLabels } from '../../domain/roles';

export function MemberAvatar({ member, large = false }: { member: DemoAccount; large?: boolean }) {
  return (
    <span aria-hidden="true" className={`avatar-initials ${large ? 'member-avatar-large' : ''}`}>
      {member.name
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')}
    </span>
  );
}
export function MemberLink({ id }: { id: string }) {
  const { state } = useDemo();
  const member = state.accounts.find((a) => a.id === id);
  return member ? (
    <Link className="member-link" to={memberPath(id)}>
      {member.name}
    </Link>
  ) : (
    <span>Member unavailable</span>
  );
}
export function MemberCard({ member }: { member: DemoAccount }) {
  return (
    <article className="collection-card member-card">
      <MemberAvatar member={member} />
      <span className="eyebrow">
        {roleLabels[member.role]} · {member.location}
      </span>
      <h2>
        <Link to={memberPath(member.id)}>{member.name}</Link>
      </h2>
      <p>{member.headline}</p>
      <Link className="text-link" to={memberPath(member.id)}>
        View profile <ArrowUpRight size={16} />
      </Link>
    </article>
  );
}
export function FriendshipActions({ memberId }: { memberId: string }) {
  const { state, account, enabled, execute } = useDemo();
  if (account?.id === memberId)
    return (
      <Link className="button" to="/profile">
        Edit profile
      </Link>
    );
  if (!account || !enabled || !can(account, 'community'))
    return (
      <Link className="button" to={account ? '/apply' : '/login'}>
        {account ? 'Apply for community access' : 'Login to connect'}
      </Link>
    );
  const connection = connectionBetween(state, account.id, memberId);
  function act(operation: 'request' | 'accept' | 'decline' | 'cancel' | 'remove') {
    execute({ type: 'connection', memberId, operation });
  }
  return (
    <div className="connection-actions">
      {!connection ? (
        <button className="button" onClick={() => act('request')}>
          Add friend
        </button>
      ) : connection.status === 'accepted' ? (
        <>
          <span>Friends</span>
          <button className="button button-outline" onClick={() => act('remove')}>
            Remove friend
          </button>
        </>
      ) : connection.requesterId === account.id ? (
        <>
          <span>Request pending</span>
          <button className="button button-outline" onClick={() => act('cancel')}>
            Cancel request
          </button>
        </>
      ) : (
        <>
          <button className="button" onClick={() => act('accept')}>
            Accept request
          </button>
          <button className="button button-outline" onClick={() => act('decline')}>
            Decline request
          </button>
        </>
      )}
    </div>
  );
}
export function GroupCard({ group }: { group: Group }) {
  const { account, enabled, execute } = useDemo();
  const joined = !!account && group.memberIds.includes(account.id);
  return (
    <article className="collection-card">
      <Users size={26} aria-hidden="true" />
      <p className="eyebrow">
        {group.category} · {group.memberIds.length} members
      </p>
      <h2>
        <Link to={`/network/groups/${encodeURIComponent(group.id)}`}>{group.name}</Link>
      </h2>
      <p>{group.description}</p>
      <div className="community-card-actions">
        <Link className="text-link" to={`/network/groups/${encodeURIComponent(group.id)}`}>
          Explore group →
        </Link>
        {account && enabled && can(account, 'community') ? (
          <button
            className="button button-outline"
            aria-pressed={joined}
            onClick={() =>
              execute({ type: 'membership', groupId: group.id, now: new Date().toISOString() })
            }
          >
            {joined ? 'Leave group' : 'Join group'}
          </button>
        ) : (
          <Link to="/login">Login to join</Link>
        )}
      </div>
    </article>
  );
}
export function FeedList({ entries }: { entries: FeedEntry[] }) {
  return entries.length ? (
    <div className="activity-list community-feed">
      {entries.map((entry) => (
        <article key={entry.id}>
          <span className="eyebrow">
            {entry.kind === 'topic'
              ? 'Discussion'
              : entry.kind === 'reply'
                ? 'Reply'
                : entry.kind === 'blog'
                  ? 'Blog'
                  : 'Group membership'}
          </span>
          <p>
            <MemberLink id={entry.actorId} />
          </p>
          <h3>
            <Link to={entry.href}>{entry.text}</Link>
          </h3>
          {entry.createdAt && (
            <time dateTime={entry.createdAt}>
              {new Date(entry.createdAt).toLocaleDateString('en-KE', {
                dateStyle: 'medium',
                timeZone: 'Africa/Nairobi',
              })}
            </time>
          )}
        </article>
      ))}
    </div>
  ) : (
    <p className="empty-state">No activity to show here yet.</p>
  );
}
export function Leaderboard({
  compact = false,
  highlightId,
}: {
  compact?: boolean;
  highlightId?: string;
}) {
  const { state } = useDemo();
  const { items } = useCatalog();
  const rows = leaderboard(state, items);
  return (
    <div className="community-leaderboard">
      <ol>
        {(compact ? rows.slice(0, 5) : rows).map((row) => (
          <li
            key={row.member.id}
            className={row.member.id === highlightId ? 'is-highlighted' : undefined}
          >
            <span className="leaderboard-rank">{row.rank}</span>
            <MemberAvatar member={row.member} />
            <div>
              <Link to={memberPath(row.member.id)}>{row.member.name}</Link>
              <small>{row.points} points</small>
            </div>
          </li>
        ))}
      </ol>
      {compact ? (
        <Link className="text-link" to="/network?tab=leaderboard">
          Full leaderboard →
        </Link>
      ) : (
        <p className="source-note">
          Points reflect current contributions: discussion {state.pointRules.topic}, reply{' '}
          {state.pointRules.reply}, published blog {state.pointRules.blog}, completed lesson{' '}
          {state.pointRules.lesson}, attended session {state.pointRules.attendance}. Ties share a
          rank. Joining groups, requesting friends, and reserving a place do not earn points.
        </p>
      )}
    </div>
  );
}
export function SessionCard({ session }: { session: CommunitySession }) {
  return (
    <article className="collection-card session-card">
      <span className="eyebrow">
        {session.type} · {session.status}
        {session.fictional ? ' · Fictional demo' : ' · Archive'}
      </span>
      <h2>
        <Link to={sessionPath(session.id)}>{session.title}</Link>
      </h2>
      <p>{session.summary}</p>
      <p className="session-meta">
        <CalendarDays size={17} aria-hidden="true" />
        {session.startsAt
          ? new Date(session.startsAt).toLocaleString('en-KE', {
              dateStyle: 'medium',
              timeStyle: 'short',
              timeZone: session.timezone,
            }) + ' EAT'
          : 'Historical session · date not recorded'}
      </p>
      <p className="session-meta">
        <MapPin size={17} aria-hidden="true" />
        {session.venue}
      </p>
      {session.hostIds.length > 0 && (
        <p>
          Hosted by{' '}
          {session.hostIds.map((id, i) => (
            <span key={id}>
              {i > 0 && ', '}
              <MemberLink id={id} />
            </span>
          ))}
        </p>
      )}
      <Link className="text-link" to={sessionPath(session.id)}>
        View {session.type} <ArrowUpRight size={16} />
      </Link>
    </article>
  );
}
