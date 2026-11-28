import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { CheckCircle2, Lock, MessageSquare, Pin, Plus, ThumbsUp, Users } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { useLaravelSession } from '../../app/useLaravelSession';
import { laravelModeEnabled } from '../../config/laravel';
import {
  communityRepository,
  type CommunityGroupRecord,
  type CommunityThreadSummary,
  type ThreadDetailPayload,
} from '../../services/laravel-community-repository';
import { PageIntro } from '../../shared/PageIntro';
import { usePageTitle } from '../../shared/usePageTitle';
import { WhatsAppIcon } from '../../shared/WhatsAppIcon';
import { AccountLink } from '../accounts/AccountLink';
import { NotFoundPage } from '../info/NotFoundPage';
import { CommunityMemberLink } from './CommunityMemberLink';
import { GroupPage } from './GroupPage';
import { NetworkPage } from './NetworkPage';

function LaravelGroupDetail({ slug }: { slug: string }) {
  const session = useLaravelSession();
  const profile = session?.profile;
  const verifiedUser = Boolean(profile?.email_verified);
  const isModerator = Boolean(
    verifiedUser && (profile?.role === 'admin' || profile?.role === 'content_manager'),
  );

  const [detail, setDetail] = useState<{
    group: CommunityGroupRecord;
    threads: CommunityThreadSummary[];
  } | null>(null);
  const [threadDetail, setThreadDetail] = useState<ThreadDetailPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [compose, setCompose] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [replyBody, setReplyBody] = useState('');

  const loadGroup = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError('');
      setNotFound(false);
      try {
        const res = await communityRepository.group(slug, signal);
        if (!signal?.aborted) setDetail(res);
      } catch (cause) {
        if (signal?.aborted) return;
        const msg = cause instanceof Error ? cause.message : 'Group not found.';
        if (/not found|404/i.test(msg)) setNotFound(true);
        else setError(msg);
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [slug],
  );

  useEffect(() => {
    const controller = new AbortController();
    setThreadDetail(null);
    void loadGroup(controller.signal);
    return () => controller.abort();
  }, [loadGroup, profile?.id, profile?.email_verified]);

  usePageTitle(detail?.group.name ?? (notFound ? 'Group not found' : 'Community group'));

  if (notFound) return <NotFoundPage />;

  async function handleToggleMembership() {
    if (!detail || !verifiedUser) return;
    setBusy(true);
    setError('');
    try {
      await communityRepository.toggleGroupMembership(detail.group.slug);
      setThreadDetail(null);
      await loadGroup();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update group membership.');
    } finally {
      setBusy(false);
    }
  }

  async function openThread(threadId: number) {
    setError('');
    try {
      const res = await communityRepository.thread(threadId);
      setThreadDetail(res);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load group discussion.');
    }
  }

  async function handleCreateThread(e: FormEvent) {
    e.preventDefault();
    if (!detail) return;
    setBusy(true);
    setError('');
    try {
      await communityRepository.createThread({
        group_id: detail.group.id,
        title: title.trim(),
        body: body.trim(),
      });
      setTitle('');
      setBody('');
      setCompose(false);
      await loadGroup();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not post discussion.');
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateReply(e: FormEvent) {
    e.preventDefault();
    if (!threadDetail) return;
    setBusy(true);
    setError('');
    try {
      await communityRepository.createReply(threadDetail.thread.id, replyBody.trim());
      setReplyBody('');
      await openThread(threadDetail.thread.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not post reply.');
    } finally {
      setBusy(false);
    }
  }

  async function handleVote(replyId: number) {
    if (!verifiedUser) return;
    try {
      const res = await communityRepository.toggleVote(replyId);
      setThreadDetail((cur) =>
        cur
          ? {
              ...cur,
              replies: cur.replies.map((r) =>
                r.id === replyId
                  ? { ...r, voted_by_me: res.voted, votes_count: res.votes_count }
                  : r,
              ),
            }
          : cur,
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update vote.');
    }
  }

  async function handleSolution(replyId: number) {
    if (!threadDetail) return;
    const next = threadDetail.thread.accepted_reply_id === replyId ? null : replyId;
    try {
      const res = await communityRepository.markSolution(threadDetail.thread.id, next);
      setThreadDetail((cur) =>
        cur
          ? { ...cur, thread: { ...cur.thread, accepted_reply_id: res.accepted_reply_id } }
          : cur,
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update accepted solution.');
    }
  }

  const group = detail?.group;

  return (
    <>
      <PageIntro
        eyebrow={group ? `Group · ${group.category}` : 'Community group'}
        title={group?.name ?? 'Loading group…'}
        description={
          group?.description ??
          'Connect with peers, share practical updates, and join the official WhatsApp circle.'
        }
      />
      <section className="container section">
        <div className="community-panel-stack">
          <Link className="text-link" to="/groups">
            ← All groups
          </Link>

          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}

          {loading && !detail ? (
            <p className="source-note">Loading group…</p>
          ) : (
            group && (
              <>
                <article className="profile-panel">
                  <p className="eyebrow">
                    <Users size={14} style={{ display: 'inline', verticalAlign: 'middle' }} />{' '}
                    {group.category} · {group.member_count}{' '}
                    {group.member_count === 1 ? 'member' : 'members'}
                  </p>
                  <h2>{group.name}</h2>
                  <p>{group.description}</p>
                  <div className="workspace-row-actions">
                    {verifiedUser ? (
                      <button
                        type="button"
                        className={group.joined ? 'button button-outline' : 'button'}
                        disabled={busy}
                        onClick={() => void handleToggleMembership()}
                      >
                        {group.joined ? 'Leave group' : 'Join group'}
                      </button>
                    ) : profile ? (
                      <Link className="button" to="/account">
                        Verify email to join
                      </Link>
                    ) : (
                      <AccountLink className="button">Login to join group</AccountLink>
                    )}

                    {group.joined && group.whatsapp_url && (
                      <a
                        className="button button-whatsapp"
                        href={group.whatsapp_url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <WhatsAppIcon size={17} /> Join WhatsApp group
                      </a>
                    )}
                    {!group.joined && group.has_whatsapp && (
                      <span className="source-note">
                        Join this group with a verified account to unlock its official WhatsApp
                        group link and discussions.
                      </span>
                    )}
                  </div>
                </article>

                {threadDetail ? (
                  <div className="community-panel-stack">
                    <button
                      type="button"
                      className="text-link"
                      onClick={() => {
                        setThreadDetail(null);
                        void loadGroup();
                      }}
                    >
                      ← Back to {group.name} discussions
                    </button>
                    <article className="discussion-post">
                      <span className="eyebrow">
                        <CommunityMemberLink
                          userId={threadDetail.thread.author_id}
                          name={threadDetail.thread.author_name}
                          role={threadDetail.thread.author_role}
                          showRoleBadge
                        />
                      </span>
                      <h2>{threadDetail.thread.title}</h2>
                      <p>{threadDetail.thread.body}</p>
                      <time dateTime={threadDetail.thread.created_at}>
                        {new Date(threadDetail.thread.created_at).toLocaleString('en-KE', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                          timeZone: 'Africa/Nairobi',
                        })}{' '}
                        EAT
                      </time>
                    </article>
                    <h3>
                      {threadDetail.replies.length}{' '}
                      {threadDetail.replies.length === 1 ? 'reply' : 'replies'}
                    </h3>
                    {threadDetail.replies.map((reply) => {
                      const isSol = threadDetail.thread.accepted_reply_id === reply.id;
                      return (
                        <article
                          key={reply.id}
                          className={`discussion-post${isSol ? ' is-solution' : ''}`}
                        >
                          <span className="eyebrow">
                            <CommunityMemberLink
                              userId={reply.author_id}
                              name={reply.author_name}
                              role={reply.author_role}
                              showRoleBadge
                            />
                            {isSol ? ' · Accepted solution' : ''}
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
                                disabled={!verifiedUser}
                                aria-pressed={reply.voted_by_me}
                                onClick={() => void handleVote(reply.id)}
                              >
                                <ThumbsUp size={13} /> Helpful ({reply.votes_count})
                              </button>
                              {threadDetail.can_mark_solution && (
                                <button
                                  type="button"
                                  className="button button-outline button-small"
                                  onClick={() => void handleSolution(reply.id)}
                                >
                                  <CheckCircle2 size={13} />{' '}
                                  {isSol ? 'Unmark solution' : 'Mark solution'}
                                </button>
                              )}
                            </div>
                          </div>
                        </article>
                      );
                    })}
                    {threadDetail.thread.locked ? (
                      <p className="source-note">
                        This discussion has been locked and is no longer accepting replies.
                      </p>
                    ) : (
                      threadDetail.can_reply && (
                        <form className="workspace-form" onSubmit={(e) => void handleCreateReply(e)}>
                          <label>
                            Reply to group discussion
                            <textarea
                              required
                              minLength={2}
                              maxLength={3000}
                              rows={3}
                              value={replyBody}
                              onChange={(e) => setReplyBody(e.target.value)}
                              placeholder="Share your thoughts or answer…"
                            />
                          </label>
                          <button className="button" disabled={busy}>
                            {busy ? 'Posting…' : 'Post reply'}
                          </button>
                        </form>
                      )
                    )}
                  </div>
                ) : group.joined || isModerator ? (
                  <>
                    <div className="community-toolbar">
                      <h3>Group discussions</h3>
                      <button
                        type="button"
                        className="button"
                        onClick={() => setCompose((v) => !v)}
                      >
                        <Plus size={16} />
                        {compose ? 'Close composer' : 'Start group discussion'}
                      </button>
                    </div>

                    {compose && (
                      <form className="workspace-form" onSubmit={(e) => void handleCreateThread(e)}>
                        <label>
                          Title
                          <input
                            required
                            minLength={5}
                            maxLength={160}
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="What would you like to discuss with this group?"
                          />
                        </label>
                        <label>
                          Message
                          <textarea
                            required
                            minLength={10}
                            maxLength={5000}
                            rows={4}
                            value={body}
                            onChange={(e) => setBody(e.target.value)}
                          />
                        </label>
                        <button className="button" disabled={busy}>
                          {busy ? 'Posting…' : 'Post to group'}
                        </button>
                      </form>
                    )}

                    {detail.threads.length > 0 ? (
                      <div className="discussion-list">
                        {detail.threads.map((t) => (
                          <article className="discussion-row" key={t.id}>
                            <MessageSquare size={22} aria-hidden="true" />
                            <div>
                              <span className="eyebrow">
                                {t.pinned && (
                                  <>
                                    <Pin
                                      size={12}
                                      style={{ display: 'inline', verticalAlign: 'middle' }}
                                    />{' '}
                                    Pinned ·{' '}
                                  </>
                                )}
                                {t.accepted_reply_id && (
                                  <>
                                    <CheckCircle2
                                      size={12}
                                      style={{ display: 'inline', verticalAlign: 'middle' }}
                                    />{' '}
                                    Solved ·{' '}
                                  </>
                                )}
                                {t.locked && (
                                  <>
                                    <Lock
                                      size={12}
                                      style={{ display: 'inline', verticalAlign: 'middle' }}
                                    />{' '}
                                    Locked ·{' '}
                                  </>
                                )}
                                Group discussion
                              </span>
                              <h4>{t.title}</h4>
                              <p>
                                <CommunityMemberLink
                                  userId={t.author_id}
                                  name={t.author_name}
                                  role={t.author_role}
                                  showRoleBadge
                                />{' '}
                                · {t.reply_count} {t.reply_count === 1 ? 'reply' : 'replies'}
                              </p>
                            </div>
                            <button
                              type="button"
                              className="text-link"
                              onClick={() => void openThread(t.id)}
                            >
                              Open →
                            </button>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <p className="empty-state">
                        No discussions in this circle yet. Start the first conversation!
                      </p>
                    )}
                  </>
                ) : (
                  <div className="empty-state">
                    <h3>Members-only group discussions</h3>
                    <p>
                      {verifiedUser
                        ? 'Join this group above to participate in discussions and unlock its official WhatsApp group link.'
                        : profile
                          ? 'Verify your email address first, then join this group to participate in discussions and access its WhatsApp link.'
                          : 'Sign in with a verified account and join this group to participate in discussions and access its WhatsApp link.'}
                    </p>
                  </div>
                )}
              </>
            )
          )}
        </div>
      </section>
    </>
  );
}

function LaravelGroupsDirectory() {
  const session = useLaravelSession();
  const profile = session?.profile;
  const verifiedUser = Boolean(profile?.email_verified);

  const [groups, setGroups] = useState<CommunityGroupRecord[] | null>(null);
  const [category, setCategory] = useState('all');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);

  usePageTitle('Groups');

  const loadGroups = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError('');
    try {
      const res = await communityRepository.groups(false, signal);
      if (!signal?.aborted) setGroups(res);
    } catch (cause) {
      if (!signal?.aborted) {
        setError(cause instanceof Error ? cause.message : 'Could not load community groups.');
      }
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void loadGroups(controller.signal);
    return () => controller.abort();
  }, [loadGroups, profile?.id, profile?.email_verified]);

  async function handleToggle(group: CommunityGroupRecord) {
    if (!verifiedUser) return;
    setBusyId(group.id);
    setError('');
    try {
      const res = await communityRepository.toggleGroupMembership(group.slug);
      setGroups((current) =>
        current
          ? current.map((item) =>
              item.id === group.id
                ? {
                    ...item,
                    joined: res.joined,
                    member_count: res.member_count,
                    has_whatsapp: res.has_whatsapp,
                    whatsapp_url: res.whatsapp_url,
                  }
                : item,
            )
          : current,
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update group membership.');
    } finally {
      setBusyId(null);
    }
  }

  const allGroups = groups ?? [];
  const categories = [...new Set(allGroups.map((g) => g.category).filter(Boolean))];
  const normalizedQuery = query.trim().toLowerCase();
  const visible = allGroups.filter((g) => {
    if (category !== 'all' && g.category !== category) return false;
    if (
      normalizedQuery &&
      !`${g.name} ${g.category} ${g.description}`.toLowerCase().includes(normalizedQuery)
    ) {
      return false;
    }
    return true;
  });

  return (
    <>
      <PageIntro
        eyebrow="Community Groups"
        title="Find your peer circle."
        description="Join official YERH circles managed by the YERH Team. Anyone with a verified account can join a group, take part in discussions, and unlock its official WhatsApp group."
      />
      <section className="container section">
        <div className="community-panel-stack">
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}

          <div className="community-toolbar">
            <label className="search-input">
              <input
                type="search"
                aria-label="Search groups"
                placeholder="Search groups and peer circles…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            {!verifiedUser &&
              (profile ? (
                <Link className="button" to="/account">
                  Verify email to join groups
                </Link>
              ) : (
                <AccountLink className="button">Login to join groups</AccountLink>
              ))}
          </div>

          {categories.length > 1 && (
            <nav className="section-tabs" aria-label="Group categories">
              {['all', ...categories].map((cat) => (
                <button
                  key={cat}
                  type="button"
                  aria-pressed={category === cat}
                  onClick={() => setCategory(cat)}
                >
                  {cat === 'all' ? 'All groups' : cat}
                </button>
              ))}
            </nav>
          )}

          {loading && !groups ? (
            <p className="source-note">Loading community groups…</p>
          ) : visible.length > 0 ? (
            <div className="community-groups-grid">
              {visible.map((g) => (
                <article className="profile-panel community-group-card" key={g.id}>
                  <p className="eyebrow">
                    <Users size={14} style={{ display: 'inline', verticalAlign: 'middle' }} />{' '}
                    {g.category} · {g.member_count} {g.member_count === 1 ? 'member' : 'members'}
                  </p>
                  <h2>
                    <Link to={`/groups/${encodeURIComponent(g.slug)}`}>{g.name}</Link>
                  </h2>
                  <p>{g.description}</p>
                  {!g.joined && g.has_whatsapp && (
                    <small className="source-note">
                      Official WhatsApp group link unlocks once you join.
                    </small>
                  )}
                  <div className="workspace-row-actions">
                    {verifiedUser ? (
                      <button
                        type="button"
                        className={
                          g.joined ? 'button button-outline button-small' : 'button button-small'
                        }
                        disabled={busyId === g.id}
                        onClick={() => void handleToggle(g)}
                      >
                        {g.joined ? 'Joined (Leave)' : 'Join group'}
                      </button>
                    ) : profile ? (
                      <Link className="button button-small" to="/account">
                        Verify to join
                      </Link>
                    ) : (
                      <AccountLink className="button button-small">Login to join</AccountLink>
                    )}

                    {g.joined && g.whatsapp_url && (
                      <a
                        className="button button-whatsapp button-small"
                        href={g.whatsapp_url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <WhatsAppIcon size={15} /> WhatsApp
                      </a>
                    )}

                    <Link className="text-link" to={`/groups/${encodeURIComponent(g.slug)}`}>
                      Open circle →
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <h2>No groups match.</h2>
              <p>Try clearing your search or checking back soon for new circles.</p>
            </div>
          )}
        </div>
      </section>
    </>
  );
}

export function GroupsPage() {
  const { groupId } = useParams();
  if (!laravelModeEnabled) {
    return groupId ? <GroupPage /> : <NetworkPage />;
  }
  return groupId ? <LaravelGroupDetail slug={groupId} /> : <LaravelGroupsDirectory />;
}
