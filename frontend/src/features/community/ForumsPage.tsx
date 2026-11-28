import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { CheckCircle2, Lock, MessageSquare, Pin, Plus } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { laravelModeEnabled } from '../../config/laravel';
import { useDemo } from '../../app/useDemo';
import { useLaravelSession } from '../../app/useLaravelSession';
import { forumMemberIds } from '../../domain/community';
import { can } from '../../domain/roles';
import { discussionsOnDay, isCalendarDay } from '../../domain/sidebar';
import {
  communityRepository,
  type ForumsFeedPayload,
} from '../../services/laravel-community-repository';
import { PageIntro } from '../../shared/PageIntro';
import { usePageTitle } from '../../shared/usePageTitle';
import { AccountLink } from '../accounts/AccountLink';
import { DemoNotice } from '../demo/DemoNotice';
import { DiscoverySidebar } from '../discovery/DiscoverySidebar';
import { ForumCalendar } from '../discovery/ForumCalendar';
import { MemberLink } from './CommunityCards';
import { CommunityMemberLink } from './CommunityMemberLink';
import { MemberRoster } from './MemberRoster';

function LaravelForumsPage() {
  const session = useLaravelSession();
  const profile = session?.profile;
  const [params, setParams] = useSearchParams();
  const forum = params.get('forum') ?? 'all';
  const query = params.get('q') ?? '';
  const filter = (params.get('filter') ?? 'all') as 'all' | 'unanswered' | 'solved';
  const date = params.get('date') ?? '';
  const selectedDay = isCalendarDay(date) ? date : '';

  const [data, setData] = useState<ForumsFeedPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [compose, setCompose] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [selectedForumId, setSelectedForumId] = useState<number>(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  usePageTitle('Forums');

  const load = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError('');
      try {
        const res = await communityRepository.forums(
          { forum, q: query, filter, date: selectedDay },
          signal,
        );
        if (!signal?.aborted) {
          setData(res);
          if (res.forums.length > 0) {
            const matched = res.forums.find((f) => f.slug === forum || String(f.id) === forum);
            setSelectedForumId((prev) =>
              matched ? matched.id : prev || res.forums[0]!.id,
            );
          }
        }
      } catch (cause) {
        if (!signal?.aborted) {
          setError(cause instanceof Error ? cause.message : 'Could not load forums.');
        }
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [forum, query, filter, selectedDay],
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  function updateFilter(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value && value !== 'all') next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: key === 'q' });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!selectedForumId) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      await communityRepository.createThread({
        forum_id: selectedForumId,
        title: title.trim(),
        body: body.trim(),
      });
      setTitle('');
      setBody('');
      setCompose(false);
      const targetSlug = data?.forums.find((f) => f.id === selectedForumId)?.slug;
      if (targetSlug) {
        setParams({ forum: targetSlug });
      } else {
        await load();
      }
    } catch (cause) {
      setSubmitError(cause instanceof Error ? cause.message : 'Could not post discussion.');
    } finally {
      setSubmitting(false);
    }
  }

  const verifiedUser = Boolean(profile && profile.email_verified);
  const forums = data?.forums ?? [];
  const threads = data?.threads ?? [];

  return (
    <>
      <PageIntro
        eyebrow="Forums"
        title="Ask. Share. Build together."
        description="Ask practical business questions, compare experiences, and learn from fellow founders and verified mentors across Kenya."
      />
      <section className="container section">
        <div className="content-with-sidebar forum-with-sidebar">
          <div className="discovery-main">
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}

            <div className="forum-overview">
              {forums.map((f) => (
                <article className="profile-panel" key={f.id}>
                  <h2>
                    <Link
                      to={`/forums?${new URLSearchParams({
                        ...Object.fromEntries(params),
                        forum: f.slug,
                      })}`}
                    >
                      {f.name}
                    </Link>
                  </h2>
                  <p>{f.description}</p>
                  <small>
                    {f.thread_count ?? 0} {(f.thread_count ?? 0) === 1 ? 'topic' : 'topics'} ·{' '}
                    {f.reply_count ?? 0} {(f.reply_count ?? 0) === 1 ? 'reply' : 'replies'}
                  </small>
                </article>
              ))}
            </div>

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

              {verifiedUser ? (
                <button
                  type="button"
                  className="button"
                  onClick={() => {
                    const matched = forums.find(
                      (f) => f.slug === forum || String(f.id) === forum,
                    );
                    if (matched) setSelectedForumId(matched.id);
                    else if (forums[0]) setSelectedForumId(forums[0].id);
                    setCompose((v) => !v);
                  }}
                >
                  <Plus size={16} />
                  {compose ? 'Close composer' : 'Start a discussion'}
                </button>
              ) : profile ? (
                <Link className="button" to="/account">
                  Verify email to post
                </Link>
              ) : (
                <AccountLink className="button">Login to participate</AccountLink>
              )}
            </div>

            <nav className="section-tabs" aria-label="Forum categories">
              {[{ id: 0, slug: 'all', name: 'All discussions' }, ...forums].map((f) => (
                <button
                  key={f.slug}
                  type="button"
                  aria-pressed={forum === f.slug}
                  onClick={() => updateFilter('forum', f.slug)}
                >
                  {f.name}
                </button>
              ))}
            </nav>

            <nav className="section-tabs" aria-label="Filter discussions">
              {[
                { id: 'all', label: 'All questions' },
                { id: 'unanswered', label: 'Unanswered' },
                { id: 'solved', label: 'Solved' },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={filter === item.id}
                  onClick={() => updateFilter('filter', item.id)}
                >
                  {item.label}
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
              <form className="workspace-form" onSubmit={(e) => void handleSubmit(e)}>
                <h2>Start a discussion</h2>
                {submitError && (
                  <p className="form-error" role="alert">
                    {submitError}
                  </p>
                )}
                <label>
                  Forum
                  <select
                    value={selectedForumId}
                    onChange={(e) => setSelectedForumId(Number(e.target.value))}
                  >
                    {forums.map((f) => (
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
                    maxLength={160}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. How should I register my food brand with KEBS?"
                  />
                </label>
                <label>
                  Your question or experience
                  <textarea
                    required
                    minLength={10}
                    maxLength={5000}
                    rows={5}
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                  />
                </label>
                <button className="button" disabled={submitting}>
                  {submitting ? 'Posting…' : 'Post discussion'}
                </button>
              </form>
            )}

            {loading && !data ? (
              <p className="source-note">Loading discussions…</p>
            ) : (
              <div className="discussion-list">
                {threads.map((t) => (
                  <article className="discussion-row" key={t.id}>
                    <MessageSquare size={25} aria-hidden="true" />
                    <div>
                      <span className="eyebrow">
                        {t.forum_name}
                        {t.pinned && (
                          <>
                            {' · '}
                            <Pin size={12} style={{ display: 'inline', verticalAlign: 'middle' }} />{' '}
                            Pinned
                          </>
                        )}
                        {t.accepted_reply_id && (
                          <>
                            {' · '}
                            <CheckCircle2
                              size={12}
                              style={{ display: 'inline', verticalAlign: 'middle' }}
                            />{' '}
                            Solved
                          </>
                        )}
                        {t.locked && (
                          <>
                            {' · '}
                            <Lock
                              size={12}
                              style={{ display: 'inline', verticalAlign: 'middle' }}
                            />{' '}
                            Locked
                          </>
                        )}
                      </span>
                      <h2>
                        <Link to={`/forums/${t.id}`}>{t.title}</Link>
                      </h2>
                      <p>
                        <CommunityMemberLink
                          userId={t.author_id}
                          name={t.author_name}
                          role={t.author_role}
                          showRoleBadge
                        />{' '}
                        · {t.reply_count} {t.reply_count === 1 ? 'reply' : 'replies'}
                      </p>
                      <small>
                        {t.reply_count && t.latest_reply_author
                          ? `Latest reply by ${t.latest_reply_author}`
                          : 'Be the first to reply'}
                      </small>
                    </div>
                    <Link className="text-link" to={`/forums/${t.id}`}>
                      Read →
                    </Link>
                  </article>
                ))}
              </div>
            )}

            {!loading && !threads.length && (
              <div className="empty-state">
                <h2>No discussions match.</h2>
                <p>Try another search, change the filter, or start a conversation.</p>
              </div>
            )}
          </div>

          <DiscoverySidebar
            variant="forum"
            calendar={
              <ForumCalendar
                activityDays={data?.activity_days ?? {}}
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

function DemoForumsPage() {
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
                <AccountLink className="button" to={account ? '/apply' : undefined}>
                  {account ? 'Apply for community access' : 'Login to participate'}
                </AccountLink>
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

export function ForumsPage() {
  return laravelModeEnabled ? <LaravelForumsPage /> : <DemoForumsPage />;
}
