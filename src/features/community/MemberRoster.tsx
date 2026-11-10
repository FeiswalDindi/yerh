import { useState } from 'react';
import { Link } from 'react-router-dom';
import { LockKeyhole, Users } from 'lucide-react';
import { useDemo } from '../../app/useDemo';
import { forumMemberIds, memberPath } from '../../domain/community';
import { can } from '../../domain/roles';

export function MemberRoster({ scope, id }: { scope: 'group' | 'forum'; id: string }) {
  const { state, account, enabled, execute } = useDemo();
  const [expanded, setExpanded] = useState(false);
  const ids =
    scope === 'group'
      ? (state.groups.find((g) => g.id === id)?.memberIds ?? [])
      : forumMemberIds(state, id);
  const joined = !!account && ids.includes(account.id);
  const members = joined ? state.accounts.filter((a) => ids.includes(a.id)) : [];
  function toggle() {
    execute(
      scope === 'group'
        ? { type: 'membership', groupId: id, now: new Date().toISOString() }
        : { type: 'forum-membership', forumId: id },
    );
  }
  return (
    <section
      className="member-roster"
      aria-label={`${scope === 'group' ? 'Group' : 'Forum'} members`}
    >
      <div className="member-roster-header">
        <div>
          <Users size={18} aria-hidden="true" />
          <h2>
            Members <span>{ids.length}</span>
          </h2>
        </div>
        {account && enabled && can(account, 'community') ? (
          <button
            type="button"
            className="button button-outline"
            aria-pressed={joined}
            onClick={toggle}
          >
            {joined ? `Leave ${scope}` : `Join ${scope}`}
          </button>
        ) : (
          <Link className="text-link" to={account ? '/apply' : '/login'}>
            {account ? 'Apply for community access' : 'Login'} to join {scope} →
          </Link>
        )}
      </div>
      {joined ? (
        <>
          <ul className="member-name-list">
            {(expanded ? members : members.slice(0, 12)).map((member) => (
              <li key={member.id}>
                <Link to={memberPath(member.id)}>
                  {member.name}
                  {member.id === account.id && <span> (you)</span>}
                </Link>
              </li>
            ))}
          </ul>
          {members.length > 12 && (
            <button
              type="button"
              className="text-link"
              aria-expanded={expanded}
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? 'Show fewer names' : `Show all ${members.length} names`}
            </button>
          )}
        </>
      ) : (
        <p className="member-roster-locked">
          <LockKeyhole size={15} aria-hidden="true" />
          Join this {scope} to see member names.
        </p>
      )}
    </section>
  );
}
