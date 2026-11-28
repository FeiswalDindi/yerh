import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { CheckCircle2, Lock, Pin, ThumbsUp } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { laravelModeEnabled } from '../../config/laravel';
import { useDemo } from '../../app/useDemo';
import { useLaravelSession } from '../../app/useLaravelSession';
import { sessionPath } from '../../domain/community';
import { isPublishedSession } from '../../domain/events';
import { can } from '../../domain/roles';
import {
  communityRepository,
  type ThreadDetailPayload,
} from '../../services/laravel-community-repository';
import { PageIntro } from '../../shared/PageIntro';
import { usePageTitle } from '../../shared/usePageTitle';
import { AccountLink } from '../accounts/AccountLink';
import { DemoNotice } from '../demo/DemoNotice';
import { DiscoverySidebar } from '../discovery/DiscoverySidebar';
import { ForumCalendar } from '../discovery/ForumCalendar';
import { NotFoundPage } from '../info/NotFoundPage';
import { CommunityMemberLink } from './CommunityMemberLink';
import { MemberRoster } from './MemberRoster';

function LaravelThreadPage() {
  const { threadId = '' } = useParams();
  const navigate = useNavigate();
  const session = useLaravelSession();
  const profile = session?.profile;

  const [detail, setDetail] = useState<ThreadDetailPayload | null>(null);
  const [activityDays, setActivityDays] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError('');
      setNotFound(false);
      try {
        const res = await communityRepository.thread(threadId, signal);
        if (!signal?.aborted) {
          setDetail(res);
          if (res.thread.forum_slug) {
            void communityRepository
              .forums({ forum: res.thread.forum_slug }, signal)
              .then((feed) => {
                if (!signal?.aborted) setActivityDays(feed.activity_days);
              })
              .catch(() => {});
          }
        }
      } catch (cause) {
        if (signal?.aborted) return;
        const msg = cause instanceof Error ? cause.message : 'Discussion not found.';
        if (/not found|404/i.test(msg)) setNotFound(true);
        else setError(msg);
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [threadId],
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  usePageTitle(detail?.thread.title ?? (notFound ? 'Discussion not found' : 'Forum discussion'));

  if (notFound) return <NotFoundPage />;

  async function submitReply(e: FormEvent) {
    e.preventDefault();
    if (!detail) return;
    setBusy(true);
    setError('');
    try {
      await communityRepository.createReply(detail.thread.id, body.trim());
      setBody('');
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not post reply.');
    } finally {
      setBusy(false);
    }
  }

  async function toggleVote(replyId: number) {
    if (!profile?.email_verified) return;
    try {
      const res = await communityRepository.toggleVote(replyId);
      setDetail((current) =>
        current
          ? {
              ...current,
              replies: current.replies.map((r) =>
                r.id === replyId
                  ? { ...r, voted_by_me: res.voted, votes_count: res.votes_count }
                  : r,
              ),
            }
          : current,
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update vote.');
    }
  }

  async function toggleSolution(replyId: number) {
    if (!detail) return;
    const nextReplyId = detail.thread.accepted_reply_id === replyId ? null : replyId;
    try {
      const res = await communityRepository.markSolution(detail.thread.id, nextReplyId);
      setDetail((current) =>
        current
          ? {
              ...current,
              thread: { ...current.thread, accepted_reply_id: res.accepted_reply_id },
            }
          : current,
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update accepted solution.');
    }
  }

  async function toggleModeration(patch: { hidden?: boolean; pinned?: boolean; locked?: boolean }) {
    if (!detail) return;
    try {
      await communityRepository.moderateThread(detail.thread.id, patch);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update moderation flags.');
    }
  }

  const thread = detail?.thread;
  const acceptedReply = detail?.replies.find((r) => r.id === thread?.accepted_reply_id);
  const forumBackHref = thread?.forum_slug ? `/forums?forum=${encodeURIComponent(thread.forum_slug)}` : '/forums';

  return (
    <>
      <PageIntro
        eyebrow="Forum discussion"
        title={thread?.title ?? 'Loading discussion…'}
        description={thread?.forum_name ?? 'Community discussion'}
      />
      <section className="container section">
        <div className="content-with-sidebar forum-with-sidebar">
          <div className="discovery-main">
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            {loading && !detail ? (
              <p className="source-note">Loading discussion…</p>
            ) : (
              thread &&
              detail && (
                <>
                  <Link className="text-link" to={forumBackHref}>
                    ← Back to {thread.forum_name ?? 'forums'}
                  </Link>

                  <div className="community-thread-meta-bar">
                    {thread.pinned && (
                      <span className="users-badge">
                        <Pin size={12} /> Pinned
                      </span>
                    )}
                    {thread.locked && (
                      <span className="users-badge">
                        <Lock size={12} /> Locked
                      </span>
                    )}
                    {thread.hidden && <span className="users-badge users-badge--warn">Hidden</span>}
                    {detail.can_moderate && (
                      <div className="workspace-row-actions">
                        <button
                          type="button"
                          className="button button-outline button-small"
                          onClick={() => void toggleModeration({ pinned: !thread.pinned })}
                        >
                          {thread.pinned ? 'Unpin' : 'Pin'}
                        </button>
                        <button
                          type="button"
                          className="button button-outline button-small"
                          onClick={() => void toggleModeration({ locked: !thread.locked })}
                        >
                          {thread.locked ? 'Unlock' : 'Lock'}
                        </button>
                        <button
                          type="button"
                          className="button button-outline button-small"
                          onClick={() => void toggleModeration({ hidden: !thread.hidden })}
                        >
                          {thread.hidden ? 'Restore' : 'Hide'}
                        </button>
                      </div>
                    )}
                  </div>

                  <article className="discussion-post">
                    <span className="eyebrow">
                      <CommunityMemberLink
                        userId={thread.author_id}
                        name={thread.author_name}
                        role={thread.author_role}
                        showRoleBadge
                      />
                    </span>
                    <p>{thread.body}</p>
                    <time dateTime={thread.created_at}>
                      {new Date(thread.created_at).toLocaleString('en-KE', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                        timeZone: 'Africa/Nairobi',
                      })}{' '}
                      EAT
                    </time>
                  </article>

                  {acceptedReply && (
                    <section
                      className="profile-panel community-solution-box"
                      aria-label="Accepted solution"
                    >
                      <p className="eyebrow">
                        <CheckCircle2
                          size={14}
                          style={{ display: 'inline', verticalAlign: 'middle' }}
                        />{' '}
                        Accepted solution ·{' '}
                        <CommunityMemberLink
                          userId={acceptedReply.author_id}
                          name={acceptedReply.author_name}
                          role={acceptedReply.author_role}
                          showRoleBadge
                        />
                      </p>
                      <p>{acceptedReply.body}</p>
                    </section>
                  )}

                  <h2>
                    {detail.replies.length}{' '}
                    {detail.replies.length === 1 ? 'reply' : 'replies'}
                  </h2>

                  {detail.replies.map((reply) => {
                    const isSolution = thread.accepted_reply_id === reply.id;
                    return (
                      <article
                        className={`discussion-post${isSolution ? ' is-solution' : ''}`}
                        id={`reply-${reply.id}`}
                        key={reply.id}
                      >
                        <span className="eyebrow">
                          <CommunityMemberLink
                            userId={reply.author_id}
                            name={reply.author_name}
                            role={reply.author_role}
                            showRoleBadge
                          />
                          {isSolution ? ' · Accepted solution' : ''}
                        </span>
                        <p>{reply.body}</p>
                        <div className="community-reply-footer">
                          <time dateTime={reply.created_at}>
                            {new Date(reply.created_at).toLocaleString('en-KE', {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                              timeZone: 'Africa/Nairobi',
                            })}{' '}
                            EAT
                          </time>
                          <div className="workspace-row-actions">
                            <button
                              type="button"
                              className="button button-outline button-small"
                              disabled={!profile?.email_verified}
                              aria-pressed={reply.voted_by_me}
                              onClick={() => void toggleVote(reply.id)}
                            >
                              <ThumbsUp size={13} /> Helpful ({reply.votes_count})
                            </button>
                            {detail.can_mark_solution && (
                              <button
                                type="button"
                                className="button button-outline button-small"
                                onClick={() => void toggleSolution(reply.id)}
                              >
                                <CheckCircle2 size={13} />{' '}
                                {isSolution ? 'Unmark solution' : 'Mark solution'}
                              </button>
                            )}
                          </div>
                        </div>
                      </article>
                    );
                  })}

                  {thread.locked ? (
                    <p className="source-note">
                      This discussion has been locked by moderation and is no longer accepting
                      replies.
                    </p>
                  ) : detail.can_reply ? (
                    <form className="workspace-form" onSubmit={(e) => void submitReply(e)}>
                      <label>
                        Your reply
                        <textarea
                          rows={4}
                          required
                          minLength={2}
                          maxLength={3000}
                          value={body}
                          onChange={(e) => setBody(e.target.value)}
                          placeholder="Share a practical answer or experience…"
                        />
                      </label>
                      <button className="button" disabled={busy}>
                        {busy ? 'Posting…' : 'Post reply'}
                      </button>
                    </form>
                  ) : profile ? (
                    <Link className="button" to="/account">
                      Verify your email to reply
                    </Link>
                  ) : (
                    <AccountLink className="button">Login to reply</AccountLink>
                  )}
                </>
              )
            )}
          </div>

          <DiscoverySidebar
            variant="forum"
            calendar={
              <ForumCalendar
                activityDays={activityDays}
                onSelect={(day) =>
                  navigate(
                    `/forums?${new URLSearchParams({
                      ...(thread?.forum_slug ? { forum: thread.forum_slug } : {}),
                      ...(day ? { date: day } : {}),
                    })}`,
                  )
                }
              />
            }
          />
        </div>
      </section>
    </>
  );
}

function DemoThreadPage() {
  const { threadId } = useParams();
  const navigate = useNavigate();
  const { state, account, execute, enabled } = useDemo();
  const [body, setBody] = useState('');
  const thread = state.threads.find(
    (t) => t.id === threadId && (!t.hidden || account?.role === 'admin'),
  );
  usePageTitle(thread?.title ?? 'Discussion not found');
  if (!thread) return <NotFoundPage />;
  function submit(e: FormEvent) {
    e.preventDefault();
    if (
      execute({
        type: 'reply',
        threadId: thread!.id,
        id: crypto.randomUUID(),
        body,
        now: new Date().toISOString(),
      })
    )
      setBody('');
  }
  return (
    <>
      <PageIntro
        eyebrow="Forum discussion"
        title={thread.title}
        description={
          state.forums.find((f) => f.id === thread.forumId)?.name ?? 'Community discussion'
        }
      />
      <section className="container section">
        <div className="content-with-sidebar forum-with-sidebar">
          <div className="discovery-main">
            <DemoNotice />
            <MemberRoster scope="forum" id={thread.forumId} />
            <Link className="text-link" to={`/forums?forum=${thread.forumId}`}>
              ← Back to this forum
            </Link>
            {state.forums.find((f) => f.id === thread.forumId)?.groupId && (
              <p className="source-note">
                Public discussion in{' '}
                <Link
                  className="text-link"
                  to={`/network/groups/${state.forums.find((f) => f.id === thread.forumId)!.groupId}`}
                >
                  the connected group →
                </Link>
              </p>
            )}
            {thread.hidden && (
              <p className="form-error">This discussion is hidden from other accounts.</p>
            )}
            <article className="discussion-post">
              <Link className="eyebrow" to={`/network/members/${thread.authorId}`}>
                {state.accounts.find((a) => a.id === thread.authorId)?.name}
              </Link>
              <p>{thread.body}</p>
              <time dateTime={thread.createdAt}>
                {new Date(thread.createdAt).toLocaleString('en-KE', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                  timeZone: 'Africa/Nairobi',
                })}{' '}
                EAT
              </time>
            </article>
            <h2>{thread.replies.length} replies</h2>
            {thread.replies.map((reply) => (
              <article className="discussion-post" id={`reply-${reply.id}`} key={reply.id}>
                <Link className="eyebrow" to={`/network/members/${reply.authorId}`}>
                  {state.accounts.find((a) => a.id === reply.authorId)?.name}
                </Link>
                <p>{reply.body}</p>
                <time dateTime={reply.createdAt}>
                  {new Date(reply.createdAt).toLocaleString('en-KE', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                    timeZone: 'Africa/Nairobi',
                  })}{' '}
                  EAT
                </time>
              </article>
            ))}
            {account && enabled && can(account, 'community') && !thread.hidden ? (
              <form className="workspace-form" onSubmit={submit}>
                <label>
                  Your reply
                  <textarea
                    rows={4}
                    required
                    minLength={2}
                    maxLength={2000}
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                  />
                </label>
                <button className="button">Post reply locally</button>
              </form>
            ) : (
              !thread.hidden && (
                <AccountLink className="button" to={account ? '/apply' : undefined}>
                  {account ? 'Apply for community access' : 'Login to reply'}
                </AccountLink>
              )
            )}
            {state.sessions.some((s) => isPublishedSession(s) && s.forumId === thread.forumId) && (
              <section className="profile-panel">
                <h2>Related sessions</h2>
                {state.sessions
                  .filter((s) => isPublishedSession(s) && s.forumId === thread.forumId)
                  .map((s) => (
                    <Link key={s.id} className="profile-sidebar-link" to={sessionPath(s.id)}>
                      {s.title}
                      <small>
                        {s.type} · {s.status}
                      </small>
                    </Link>
                  ))}
              </section>
            )}
          </div>
          <DiscoverySidebar
            variant="forum"
            calendar={
              <ForumCalendar
                threads={state.threads.filter((t) => t.forumId === thread.forumId)}
                onSelect={(day) =>
                  navigate(
                    `/forums?${new URLSearchParams({ forum: thread.forumId, ...(day ? { date: day } : {}) })}`,
                  )
                }
              />
            }
          />
        </div>
      </section>
    </>
  );
}

export function ThreadPage() {
  return laravelModeEnabled ? <LaravelThreadPage /> : <DemoThreadPage />;
}
