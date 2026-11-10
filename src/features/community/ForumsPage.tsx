import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { MessageSquare, Plus } from 'lucide-react';
import { useDemo } from '../../app/useDemo';
import { PageIntro } from '../../shared/PageIntro';
import { DemoNotice } from '../demo/DemoNotice';
import { usePageTitle } from '../../shared/usePageTitle';
import { MemberLink } from './CommunityCards';
import { DiscoverySidebar } from '../discovery/DiscoverySidebar';
import { ForumCalendar } from '../discovery/ForumCalendar';
import { discussionsOnDay, isCalendarDay } from '../../domain/sidebar';
import { forumMemberIds } from '../../domain/community';
import { MemberRoster } from './MemberRoster';
import { can } from '../../domain/roles';
export function ForumsPage() {
  const { state, account, execute, enabled } = useDemo();
  const [params, setParams] = useSearchParams();
  const forum = params.get('forum') ?? 'all';
  const query = params.get('q') ?? '';
  const date = params.get('date') ?? '';
  const selectedDay = isCalendarDay(date) ? date : '';
  const [compose, setCompose] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [selected, setSelected] = useState(state.forums[0]?.id ?? '');
  usePageTitle('Forums');
  const calendarThreads = state.threads.filter(
    (t) =>
      !t.hidden &&
      (forum === 'all' || t.forumId === forum) &&
      `${t.title} ${t.body}`.toLowerCase().includes(query.toLowerCase()),
  );
  const threads = discussionsOnDay(calendarThreads, selectedDay);
  function updateFilter(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value && !(key === 'forum' && value === 'all')) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: key === 'q' });
  }
  function submit(e: FormEvent) {
    e.preventDefault();
    if (
      execute({
        type: 'topic',
        id: crypto.randomUUID(),
        forumId: selected,
        title,
        body,
        now: new Date().toISOString(),
      })
    ) {
      setTitle('');
      setBody('');
      setCompose(false);
      setParams({ forum: selected });
    }
  }
  return (
    <>
      <PageIntro
        eyebrow="Forums"
        title="Ask. Share. Build together."
        description="The original entrepreneurship, startup, and technology forums, rebuilt as a local discussion demo."
      />
      <section className="container section">
        <div className="content-with-sidebar forum-with-sidebar">
          <div className="discovery-main">
            <DemoNotice />
            <div className="forum-overview">
              {state.forums.map((f) => {
                const topics = state.threads.filter((t) => t.forumId === f.id && !t.hidden);
                const group = state.groups.find((g) => g.id === f.groupId);
                return (
                  <article className="profile-panel" key={f.id}>
                    <h2>
                      <Link
                        to={`/forums?${new URLSearchParams({ ...Object.fromEntries(params), forum: f.id })}`}
                      >
                        {f.name}
                      </Link>
                    </h2>
                    <p>{f.description}</p>
                    <small>
                      {forumMemberIds(state, f.id).length} members · {topics.length} topics ·{' '}
                      {topics.reduce((count, t) => count + t.replies.length, 0)} replies
                    </small>
                    {group && (
                      <Link className="profile-sidebar-link" to={`/network/groups/${group.id}`}>
                        {group.name} →
                      </Link>
                    )}
                  </article>
                );
              })}
            </div>
            {state.forums.some((f) => f.id === forum) && <MemberRoster scope="forum" id={forum} />}
            <div className="community-toolbar">
              <label className="search-input">
                <input
                  type="search"
                  aria-label="Search discussions"
                  placeholder="Search discussions…"
                  value={query}
                  onChange={(e) => updateFilter('q', e.target.value)}
                />
              </label>
              {account && enabled && can(account, 'community') ? (
                <button
                  className="button"
                  onClick={() => {
                    setSelected(
                      state.forums.some((f) => f.id === forum)
                        ? forum
                        : (state.forums[0]?.id ?? ''),
                    );
                    setCompose((v) => !v);
                  }}
                >
                  <Plus size={16} />
                  {compose ? 'Close composer' : 'Start a discussion'}
                </button>
              ) : (
                <Link className="button" to={account ? '/apply' : '/login'}>
                  {account ? 'Apply for community access' : 'Login to participate'}
                </Link>
              )}
            </div>
            <nav className="section-tabs" aria-label="Forum categories">
              {[{ id: 'all', name: 'All discussions' }, ...state.forums].map((f) => (
                <button
                  key={f.id}
                  aria-pressed={forum === f.id}
                  onClick={() => updateFilter('forum', f.id)}
                >
                  {f.name}
                </button>
              ))}
            </nav>
            {selectedDay && (
              <div className="discussion-date-filter" role="status">
                <span>
                  {threads.length} {threads.length === 1 ? 'discussion' : 'discussions'} active on{' '}
                  {new Date(`${selectedDay}T12:00:00Z`).toLocaleDateString('en-KE', {
                    dateStyle: 'long',
                    timeZone: 'Africa/Nairobi',
                  })}
                </span>
                <button
                  type="button"
                  className="text-link"
                  onClick={() => updateFilter('date', '')}
                >
                  Show all dates
                </button>
              </div>
            )}
            {compose && (
              <form className="workspace-form" onSubmit={submit}>
                <h2>Start a demo discussion</h2>
                <label>
                  Forum
                  <select value={selected} onChange={(e) => setSelected(e.target.value)}>
                    {state.forums.map((f) => (
                      <option value={f.id} key={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Discussion title
                  <input
                    required
                    minLength={5}
                    maxLength={140}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </label>
                <label>
                  Your question
                  <textarea
                    required
                    minLength={10}
                    maxLength={3000}
                    rows={5}
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                  />
                </label>
                <button className="button">Post locally</button>
              </form>
            )}
            <div className="discussion-list">
              {threads.map((t) => (
                <article className="discussion-row" key={t.id}>
                  <MessageSquare size={25} />
                  <div>
                    <span className="eyebrow">
                      {state.forums.find((f) => f.id === t.forumId)?.name}
                    </span>
                    <h2>
                      <Link to={`/forums/${t.id}`}>{t.title}</Link>
                    </h2>
                    <p>
                      <MemberLink id={t.authorId} /> · {t.replies.length} replies
                    </p>
                    <small>
                      {t.replies.length ? (
                        <>
                          Latest reply by <MemberLink id={t.replies.at(-1)!.authorId} />
                        </>
                      ) : (
                        'Be the first to reply'
                      )}
                    </small>
                  </div>
                  <Link className="text-link" to={`/forums/${t.id}`}>
                    Read →
                  </Link>
                </article>
              ))}
            </div>
            {!threads.length && (
              <div className="empty-state">
                <h2>No discussions match.</h2>
                <p>Try another search, change the date, or start a conversation.</p>
              </div>
            )}
          </div>
          <DiscoverySidebar
            variant="forum"
            calendar={
              <ForumCalendar
                threads={calendarThreads}
                selectedDay={selectedDay}
                onSelect={(day) => updateFilter('date', day)}
              />
            }
          />
        </div>
      </section>
    </>
  );
}
