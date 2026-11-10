import { useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useDemo } from '../../app/useDemo';
import { useCatalog } from '../../app/useCatalog';
import { communityFeed } from '../../domain/community';
import { PageIntro } from '../../shared/PageIntro';
import { DemoNotice } from '../demo/DemoNotice';
import { usePageTitle } from '../../shared/usePageTitle';
import { FeedList, GroupCard, Leaderboard, MemberCard } from './CommunityCards';

export function NetworkPage() {
  const { state, account } = useDemo();
  const { items } = useCatalog();
  const [params, setParams] = useSearchParams();
  const tabs = ['groups', 'members', 'activity', 'leaderboard'];
  const tab = tabs.includes(params.get('tab') ?? '') ? params.get('tab')! : 'groups';
  const [query, setQuery] = useState('');
  usePageTitle('YERH Network');
  const members = state.accounts.filter((a) =>
    `${a.name} ${a.headline} ${a.skills.join(' ')}`.toLowerCase().includes(query.toLowerCase()),
  );
  const groups = state.groups.filter((g) =>
    `${g.name} ${g.category}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <>
      <PageIntro
        eyebrow="YERH · Network"
        title="Find your people. Grow your possibilities."
        description="Meet entrepreneurs, exchange ideas, and grow through a connected community."
      />
      <section className="container section">
        <DemoNotice />
        <nav className="section-tabs" aria-label="Network sections">
          {tabs.map((t) => (
            <button key={t} aria-pressed={t === tab} onClick={() => setParams({ tab: t })}>
              {t[0]!.toUpperCase() + t.slice(1)}
            </button>
          ))}
        </nav>
        {account && (
          <Link className="text-link" to={`/network/members/${account.id}?tab=friends`}>
            My friends & requests →
          </Link>
        )}
        {(tab === 'members' || tab === 'groups') && (
          <label className="search-input network-search">
            <input
              type="search"
              aria-label={`Search ${tab}`}
              placeholder={`Search ${tab}…`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
        )}
        {tab === 'groups' ? (
          <div className="collection-grid">
            {groups.map((group) => (
              <GroupCard key={group.id} group={group} />
            ))}
          </div>
        ) : tab === 'members' ? (
          <div className="collection-grid">
            {members.map((member) => (
              <MemberCard key={member.id} member={member} />
            ))}
          </div>
        ) : tab === 'activity' ? (
          <FeedList entries={communityFeed(state, items)} />
        ) : (
          <Leaderboard />
        )}
        {((tab === 'members' && !members.length) || (tab === 'groups' && !groups.length)) && (
          <p className="empty-state">No matches. Try another search.</p>
        )}
      </section>
    </>
  );
}
