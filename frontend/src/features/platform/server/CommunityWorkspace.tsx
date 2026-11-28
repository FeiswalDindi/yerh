import { useCallback, useState, type FormEvent } from 'react';
import {
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
  MessageSquare,
  Pin,
  Plus,
  ThumbsUp,
  Trophy,
  Unlock,
  Users,
} from 'lucide-react';
import { displayRoleLabel as roleLabel } from '../../../domain/roles';
import {
  communityRepository,
  type CommunityGroupRecord,
  type CommunityModerationPayload,
  type ForumsFeedPayload,
  type LeaderboardPayload,
  type ThreadDetailPayload,
} from '../../../services/laravel-community-repository';
import { StatusIndicator } from '../../../shared/StatusIndicator';
import { WhatsAppIcon } from '../../../shared/WhatsAppIcon';
import { CommunityMemberLink } from '../../community/CommunityMemberLink';
import { WorkspaceTable, WorkspaceTabs } from '../workspace/WorkspaceControls';
import {
  fieldValue,
  RecordsFeedback,
  useWorkspaceRecords,
  WorkspaceAction,
} from './WorkspaceActions';

function GroupsDirectory({ canManage }: { canManage: boolean }) {
  const load = useCallback((signal: AbortSignal) => communityRepository.groups(false, signal), []);
  const { records: groups, error, reload } = useWorkspaceRecords(load);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [detail, setDetail] = useState<{
    group: CommunityGroupRecord;
    threads: Awaited<ReturnType<typeof communityRepository.group>>['threads'];
  } | null>(null);
  const [threadDetail, setThreadDetail] = useState<ThreadDetailPayload | null>(null);
  const [loadingGroup, setLoadingGroup] = useState(false);
  const [groupError, setGroupError] = useState('');
  const [compose, setCompose] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [replyBody, setReplyBody] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);

  async function openGroup(slug: string) {
    setSelectedSlug(slug);
    setThreadDetail(null);
    setLoadingGroup(true);
    setGroupError('');
    try {
      const res = await communityRepository.group(slug);
      setDetail(res);
    } catch (cause) {
      setGroupError(cause instanceof Error ? cause.message : 'Could not load group.');
    } finally {
      setLoadingGroup(false);
    }
  }

  async function toggleMembership(group: CommunityGroupRecord) {
    setBusyId(group.id);
    setGroupError('');
    try {
      await communityRepository.toggleGroupMembership(group.slug);
      reload();
      if (selectedSlug === group.slug) {
        await openGroup(group.slug);
      }
    } catch (cause) {
      setGroupError(cause instanceof Error ? cause.message : 'Could not update group membership.');
    } finally {
      setBusyId(null);
    }
  }

  async function openThread(threadId: number) {
    setGroupError('');
    try {
      const res = await communityRepository.thread(threadId);
      setThreadDetail(res);
    } catch (cause) {
      setGroupError(cause instanceof Error ? cause.message : 'Could not load group discussion.');
    }
  }

  async function submitGroupThread(e: FormEvent) {
    e.preventDefault();
    if (!detail) return;
    setGroupError('');
    try {
      await communityRepository.createThread({
        group_id: detail.group.id,
        title: title.trim(),
        body: body.trim(),
      });
      setTitle('');
      setBody('');
      setCompose(false);
      await openGroup(detail.group.slug);
    } catch (cause) {
      setGroupError(cause instanceof Error ? cause.message : 'Could not post discussion.');
    }
  }

  async function submitGroupReply(e: FormEvent) {
    e.preventDefault();
    if (!threadDetail) return;
    setGroupError('');
    try {
      await communityRepository.createReply(threadDetail.thread.id, replyBody.trim());
      setReplyBody('');
      await openThread(threadDetail.thread.id);
    } catch (cause) {
      setGroupError(cause instanceof Error ? cause.message : 'Could not post reply.');
    }
  }

  if (threadDetail) {
    return (
      <div className="community-panel-stack">
        <button
          type="button"
          className="text-link"
          onClick={() => setThreadDetail(null)}
        >
          ← Back to {detail?.group.name ?? 'group'}
        </button>
        {groupError && (
          <p className="form-error" role="alert">
            {groupError}
          </p>
        )}
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
        </article>
        <h3>{threadDetail.replies.length} replies</h3>
        {threadDetail.replies.map((r) => (
          <article className="discussion-post" key={r.id}>
            <span className="eyebrow">
              <CommunityMemberLink
                userId={r.author_id}
                name={r.author_name}
                role={r.author_role}
                showRoleBadge
              />
            </span>
            <p>{r.body}</p>
          </article>
        ))}
        {threadDetail.can_reply && !threadDetail.thread.locked && (
          <form className="workspace-form" onSubmit={(e) => void submitGroupReply(e)}>
            <label>
              Reply to group discussion
              <textarea
                required
                minLength={2}
                maxLength={3000}
                rows={3}
                value={replyBody}
                onChange={(e) => setReplyBody(e.target.value)}
              />
            </label>
            <button className="button">Post reply</button>
          </form>
        )}
      </div>
    );
  }

  if (selectedSlug && detail) {
    const g = detail.group;
    return (
      <div className="community-panel-stack">
        <button
          type="button"
          className="text-link"
          onClick={() => {
            setSelectedSlug(null);
            setDetail(null);
          }}
        >
          ← All circles &amp; groups
        </button>
        {groupError && (
          <p className="form-error" role="alert">
            {groupError}
          </p>
        )}
        <article className="profile-panel">
          <p className="eyebrow">
            {g.category} · {g.member_count} {g.member_count === 1 ? 'member' : 'members'}
          </p>
          <h2>{g.name}</h2>
          <p>{g.description}</p>
          <div className="workspace-row-actions">
            <button
              type="button"
              className="button button-outline"
              disabled={busyId === g.id}
              onClick={() => void toggleMembership(g)}
            >
              {g.joined ? 'Leave group' : 'Join group'}
            </button>
            {g.joined && g.whatsapp_url && (
              <a
                className="button button-whatsapp"
                href={g.whatsapp_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <WhatsAppIcon size={17} /> Join WhatsApp group
              </a>
            )}
            {!g.joined && g.has_whatsapp && (
              <span className="source-note">
                Join this group to unlock its official WhatsApp group link and discussions.
              </span>
            )}
          </div>
        </article>

        {g.joined || canManage ? (
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
              <form className="workspace-form" onSubmit={(e) => void submitGroupThread(e)}>
                <label>
                  Title
                  <input
                    required
                    minLength={5}
                    maxLength={160}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
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
                <button className="button">Post to group</button>
              </form>
            )}
            {detail.threads.length ? (
              <div className="discussion-list">
                {detail.threads.map((t) => (
                  <article className="discussion-row" key={t.id}>
                    <MessageSquare size={22} aria-hidden="true" />
                    <div>
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
              <p className="empty-state">No discussions in this circle yet. Start the first one!</p>
            )}
          </>
        ) : (
          <p className="empty-state">Join this circle to view and post in group discussions.</p>
        )}
      </div>
    );
  }

  return (
    <div className="community-panel-stack">
      <RecordsFeedback error={error || groupError} loading={groups === null || loadingGroup} />
      {groups && (
        <div className="community-groups-grid">
          {groups.map((g) => (
            <article className="profile-panel community-group-card" key={g.id}>
              <p className="eyebrow">
                <Users size={14} style={{ display: 'inline', verticalAlign: 'middle' }} />{' '}
                {g.category} · {g.member_count} {g.member_count === 1 ? 'member' : 'members'}
              </p>
              <h3>{g.name}</h3>
              <p>{g.description}</p>
              <div className="workspace-row-actions">
                <button
                  type="button"
                  className={g.joined ? 'button button-outline button-small' : 'button button-small'}
                  disabled={busyId === g.id}
                  onClick={() => void toggleMembership(g)}
                >
                  {g.joined ? 'Joined (Leave)' : 'Join group'}
                </button>
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
                <button
                  type="button"
                  className="text-link"
                  onClick={() => void openGroup(g.slug)}
                >
                  Open circle →
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function DashboardForumsTab() {
  const [forumFilter, setForumFilter] = useState('all');
  const [filter, setFilter] = useState<'all' | 'unanswered' | 'solved'>('all');
  const [query, setQuery] = useState('');
  const load = useCallback(
    (signal: AbortSignal) => communityRepository.forums({ forum: forumFilter, filter, q: query }, signal),
    [forumFilter, filter, query],
  );
  const { records: data, error, reload } = useWorkspaceRecords<ForumsFeedPayload>(load);
  const [selectedThread, setSelectedThread] = useState<ThreadDetailPayload | null>(null);
  const [compose, setCompose] = useState(false);
  const [forumId, setForumId] = useState<number>(0);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [replyBody, setReplyBody] = useState('');
  const [actionError, setActionError] = useState('');

  async function openThread(id: number) {
    setActionError('');
    try {
      const res = await communityRepository.thread(id);
      setSelectedThread(res);
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'Could not open thread.');
    }
  }

  async function handleCreateThread(e: FormEvent) {
    e.preventDefault();
    const targetForumId = forumId || data?.forums[0]?.id;
    if (!targetForumId) return;
    setActionError('');
    try {
      await communityRepository.createThread({
        forum_id: targetForumId,
        title: title.trim(),
        body: body.trim(),
      });
      setTitle('');
      setBody('');
      setCompose(false);
      reload();
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'Could not create discussion.');
    }
  }

  async function handleReply(e: FormEvent) {
    e.preventDefault();
    if (!selectedThread) return;
    setActionError('');
    try {
      await communityRepository.createReply(selectedThread.thread.id, replyBody.trim());
      setReplyBody('');
      await openThread(selectedThread.thread.id);
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'Could not post reply.');
    }
  }

  if (selectedThread) {
    const t = selectedThread.thread;
    return (
      <div className="community-panel-stack">
        <button
          type="button"
          className="text-link"
          onClick={() => {
            setSelectedThread(null);
            reload();
          }}
        >
          ← Back to all discussions
        </button>
        {actionError && (
          <p className="form-error" role="alert">
            {actionError}
          </p>
        )}
        <article className="discussion-post">
          <span className="eyebrow">
            {t.forum_name} ·{' '}
            <CommunityMemberLink
              userId={t.author_id}
              name={t.author_name}
              role={t.author_role}
              showRoleBadge
            />
          </span>
          <h2>{t.title}</h2>
          <p>{t.body}</p>
        </article>
        <h3>{selectedThread.replies.length} replies</h3>
        {selectedThread.replies.map((reply) => {
          const isSol = t.accepted_reply_id === reply.id;
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
              <div className="workspace-row-actions">
                <button
                  type="button"
                  className="button button-outline button-small"
                  onClick={async () => {
                    const res = await communityRepository.toggleVote(reply.id);
                    setSelectedThread((cur) =>
                      cur
                        ? {
                            ...cur,
                            replies: cur.replies.map((r) =>
                              r.id === reply.id
                                ? { ...r, voted_by_me: res.voted, votes_count: res.votes_count }
                                : r,
                            ),
                          }
                        : cur,
                    );
                  }}
                >
                  <ThumbsUp size={13} /> Helpful ({reply.votes_count})
                </button>
                {selectedThread.can_mark_solution && (
                  <button
                    type="button"
                    className="button button-outline button-small"
                    onClick={async () => {
                      const res = await communityRepository.markSolution(
                        t.id,
                        isSol ? null : reply.id,
                      );
                      setSelectedThread((cur) =>
                        cur
                          ? { ...cur, thread: { ...cur.thread, accepted_reply_id: res.accepted_reply_id } }
                          : cur,
                      );
                    }}
                  >
                    <CheckCircle2 size={13} /> {isSol ? 'Unmark solution' : 'Mark solution'}
                  </button>
                )}
              </div>
            </article>
          );
        })}
        {selectedThread.can_reply && !t.locked && (
          <form className="workspace-form" onSubmit={(e) => void handleReply(e)}>
            <label>
              Your reply
              <textarea
                required
                minLength={2}
                maxLength={3000}
                rows={4}
                value={replyBody}
                onChange={(e) => setReplyBody(e.target.value)}
              />
            </label>
            <button className="button">Post reply</button>
          </form>
        )}
      </div>
    );
  }

  return (
    <div className="community-panel-stack">
      <RecordsFeedback error={error || actionError} loading={data === null} />
      {data && (
        <>
          <div className="community-toolbar">
            <label className="search-input">
              <input
                type="search"
                placeholder="Search forum questions…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <button
              type="button"
              className="button"
              onClick={() => {
                if (!forumId && data.forums[0]) setForumId(data.forums[0].id);
                setCompose((v) => !v);
              }}
            >
              <Plus size={16} />
              {compose ? 'Close composer' : 'Start a discussion'}
            </button>
          </div>
          <nav className="section-tabs" aria-label="Forum categories">
            {[{ slug: 'all', name: 'All' }, ...data.forums].map((f) => (
              <button
                key={f.slug}
                type="button"
                aria-pressed={forumFilter === f.slug}
                onClick={() => setForumFilter(f.slug)}
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
                onClick={() => setFilter(item.id as 'all' | 'unanswered' | 'solved')}
              >
                {item.label}
              </button>
            ))}
          </nav>

          {compose && (
            <form className="workspace-form" onSubmit={(e) => void handleCreateThread(e)}>
              <label>
                Forum category
                <select
                  value={forumId || (data.forums[0]?.id ?? 0)}
                  onChange={(e) => setForumId(Number(e.target.value))}
                >
                  {data.forums.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Title
                <input
                  required
                  minLength={5}
                  maxLength={160}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </label>
              <label>
                Question or insight
                <textarea
                  required
                  minLength={10}
                  maxLength={5000}
                  rows={4}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                />
              </label>
              <button className="button">Post discussion</button>
            </form>
          )}

          {data.threads.length ? (
            <div className="discussion-list">
              {data.threads.map((t) => (
                <article className="discussion-row" key={t.id}>
                  <MessageSquare size={22} aria-hidden="true" />
                  <div>
                    <span className="eyebrow">
                      {t.forum_name}
                      {t.accepted_reply_id ? ' · Solved' : ''}
                      {t.pinned ? ' · Pinned' : ''}
                    </span>
                    <h3>{t.title}</h3>
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
            <p className="empty-state">No discussions match this filter.</p>
          )}
        </>
      )}
    </div>
  );
}

function LeaderboardTab() {
  const [period, setPeriod] = useState<'month' | 'all'>('month');
  const load = useCallback(
    (signal: AbortSignal) => communityRepository.leaderboard(period, signal),
    [period],
  );
  const { records: board, error } = useWorkspaceRecords<LeaderboardPayload>(load);

  return (
    <div className="community-panel-stack">
      <div className="community-toolbar">
        <nav className="section-tabs" aria-label="Leaderboard timeframe">
          <button
            type="button"
            aria-pressed={period === 'month'}
            onClick={() => setPeriod('month')}
          >
            This month
          </button>
          <button
            type="button"
            aria-pressed={period === 'all'}
            onClick={() => setPeriod('all')}
          >
            All time
          </button>
        </nav>
      </div>
      <RecordsFeedback error={error} loading={board === null} />
      {board && (
        <>
          {board.me && (
            <div className="profile-panel community-my-rank">
              <p className="eyebrow">
                <Trophy size={15} style={{ display: 'inline', verticalAlign: 'middle' }} /> Your
                standing ({period === 'month' ? 'This month' : 'All time'})
              </p>
              <h2>
                Rank #{board.me.rank} · {board.me.points} points
              </h2>
              <p className="source-note">
                Courses: {board.me.breakdown.courses} · Incubation stages:{' '}
                {board.me.breakdown.stages} · Solutions: {board.me.breakdown.solutions} · Events:{' '}
                {board.me.breakdown.events} · Discussions: {board.me.breakdown.topics}
              </p>
            </div>
          )}

          <WorkspaceTable
            label="community leaderboard"
            columns={['Rank', 'Member', 'Role', 'Points', 'Breakdown']}
            empty="No activity recorded yet."
            rows={board.top.map((row) => ({
              id: String(row.user_id),
              search: [row.name, roleLabel(row.role)].join(' '),
              cells: [
                <strong>#{row.rank}</strong>,
                <CommunityMemberLink userId={row.user_id} name={row.name} />,
                <span className="users-badge">{roleLabel(row.role)}</span>,
                <strong>{row.points} pts</strong>,
                <span className="workspace-detail-copy">
                  {row.breakdown.courses} courses · {row.breakdown.stages} stages ·{' '}
                  {row.breakdown.solutions} solutions · {row.breakdown.events} events ·{' '}
                  {row.breakdown.topics} topics
                </span>,
              ],
            }))}
          />

          <p className="source-note">
            Points reflect verified activity: Completed course ({board.rules.course}), Passed
            incubation stage ({board.rules.stage}), Accepted forum solution ({board.rules.solution}
            ), Event registration ({board.rules.event}), Forum topic ({board.rules.topic}), Helpful
            vote received ({board.rules.helpful_vote}), Forum reply ({board.rules.reply}).
          </p>
        </>
      )}
    </div>
  );
}

function CommunityManagementTab() {
  const loadGroups = useCallback(
    (signal: AbortSignal) => communityRepository.groups(true, signal),
    [],
  );
  const loadModeration = useCallback(
    (signal: AbortSignal) => communityRepository.moderation(signal),
    [],
  );
  const groupsState = useWorkspaceRecords<CommunityGroupRecord[]>(loadGroups);
  const modState = useWorkspaceRecords<CommunityModerationPayload>(loadModeration);

  return (
    <div className="community-panel-stack">
      <RecordsFeedback
        error={groupsState.error || modState.error}
        loading={groupsState.records === null || modState.records === null}
      />
      {groupsState.records && modState.records && (
        <WorkspaceTabs
          label="Community administration"
          param="subtab"
          views={[
            {
              id: 'groups',
              label: 'Groups & WhatsApp',
              count: groupsState.records.length,
              content: (
                <WorkspaceTable
                  label="community groups"
                  columns={['Group', 'Category', 'WhatsApp group', 'Members', 'Status', 'Action']}
                  actions={
                    <WorkspaceAction
                      action="Create group"
                      create
                      title="Create community group"
                      submit="Save group"
                      save={async (form) => {
                        await communityRepository.saveGroup({
                          name: fieldValue(form, 'name'),
                          category: fieldValue(form, 'category'),
                          description: fieldValue(form, 'description'),
                          whatsapp_url: fieldValue(form, 'whatsapp_url') || null,
                          is_active: form.get('is_active') === 'on',
                        });
                        groupsState.reload();
                      }}
                    >
                      <label>
                        Group name
                        <input name="name" minLength={3} maxLength={120} required />
                      </label>
                      <label>
                        Category
                        <input
                          name="category"
                          minLength={2}
                          maxLength={80}
                          placeholder="e.g. Agribusiness, Technology, Startups"
                          required
                        />
                      </label>
                      <label>
                        Description
                        <textarea name="description" minLength={5} maxLength={1000} required />
                      </label>
                      <label>
                        WhatsApp invite link (optional, revealed once members join)
                        <input
                          name="whatsapp_url"
                          type="url"
                          maxLength={500}
                          placeholder="https://chat.whatsapp.com/..."
                        />
                      </label>
                      <label className="inline-checkbox">
                        <input type="checkbox" name="is_active" defaultChecked /> Active group
                      </label>
                    </WorkspaceAction>
                  }
                  rows={groupsState.records.map((g) => ({
                    id: String(g.id),
                    search: [g.name, g.category, g.description].join(' '),
                    cells: [
                      <>
                        <strong>{g.name}</strong>
                        <div className="workspace-detail-copy">{g.description}</div>
                      </>,
                      g.category,
                      g.whatsapp_url ? (
                        <a href={g.whatsapp_url} target="_blank" rel="noopener noreferrer">
                          WhatsApp link configured
                        </a>
                      ) : (
                        '—'
                      ),
                      g.member_count,
                      <StatusIndicator status={g.is_active ? 'active' : 'inactive'} />,
                      <WorkspaceAction
                        action="Edit"
                        title={g.name}
                        submit="Update group"
                        save={async (form) => {
                          await communityRepository.saveGroup(
                            {
                              name: fieldValue(form, 'name'),
                              category: fieldValue(form, 'category'),
                              description: fieldValue(form, 'description'),
                              whatsapp_url: fieldValue(form, 'whatsapp_url') || null,
                              is_active: form.get('is_active') === 'on',
                            },
                            g.id,
                          );
                          groupsState.reload();
                        }}
                      >
                        <label>
                          Group name
                          <input
                            name="name"
                            minLength={3}
                            maxLength={120}
                            defaultValue={g.name}
                            required
                          />
                        </label>
                        <label>
                          Category
                          <input
                            name="category"
                            minLength={2}
                            maxLength={80}
                            defaultValue={g.category}
                            required
                          />
                        </label>
                        <label>
                          Description
                          <textarea
                            name="description"
                            minLength={5}
                            maxLength={1000}
                            defaultValue={g.description}
                            required
                          />
                        </label>
                        <label>
                          WhatsApp invite link (optional)
                          <input
                            name="whatsapp_url"
                            type="url"
                            maxLength={500}
                            defaultValue={g.whatsapp_url ?? ''}
                            placeholder="https://chat.whatsapp.com/..."
                          />
                        </label>
                        <label className="inline-checkbox">
                          <input type="checkbox" name="is_active" defaultChecked={g.is_active} />{' '}
                          Active group
                        </label>
                      </WorkspaceAction>,
                    ],
                  }))}
                />
              ),
            },
            {
              id: 'forums-admin',
              label: 'Forum categories',
              count: modState.records.forums.length,
              content: (
                <WorkspaceTable
                  label="forum categories"
                  columns={['Category', 'Order', 'Status', 'Action']}
                  actions={
                    <WorkspaceAction
                      action="Add forum category"
                      create
                      submit="Save category"
                      save={async (form) => {
                        await communityRepository.saveForum({
                          name: fieldValue(form, 'name'),
                          description: fieldValue(form, 'description'),
                          position: Number(fieldValue(form, 'position') || 0),
                          is_active: form.get('is_active') === 'on',
                        });
                        modState.reload();
                      }}
                    >
                      <label>
                        Name
                        <input name="name" minLength={3} maxLength={120} required />
                      </label>
                      <label>
                        Description
                        <textarea name="description" minLength={5} maxLength={500} required />
                      </label>
                      <label>
                        Display order
                        <input name="position" type="number" min={0} max={1000} defaultValue={1} />
                      </label>
                      <label className="inline-checkbox">
                        <input type="checkbox" name="is_active" defaultChecked /> Active
                      </label>
                    </WorkspaceAction>
                  }
                  rows={modState.records.forums.map((f) => ({
                    id: String(f.id),
                    search: [f.name, f.description].join(' '),
                    cells: [
                      <>
                        <strong>{f.name}</strong>
                        <div className="workspace-detail-copy">{f.description}</div>
                      </>,
                      f.position,
                      <StatusIndicator status={f.is_active ? 'active' : 'inactive'} />,
                      <WorkspaceAction
                        action="Edit"
                        title={f.name}
                        submit="Update category"
                        save={async (form) => {
                          await communityRepository.saveForum(
                            {
                              name: fieldValue(form, 'name'),
                              description: fieldValue(form, 'description'),
                              position: Number(fieldValue(form, 'position') || 0),
                              is_active: form.get('is_active') === 'on',
                            },
                            f.id,
                          );
                          modState.reload();
                        }}
                      >
                        <label>
                          Name
                          <input
                            name="name"
                            minLength={3}
                            maxLength={120}
                            defaultValue={f.name}
                            required
                          />
                        </label>
                        <label>
                          Description
                          <textarea
                            name="description"
                            minLength={5}
                            maxLength={500}
                            defaultValue={f.description}
                            required
                          />
                        </label>
                        <label>
                          Display order
                          <input
                            name="position"
                            type="number"
                            min={0}
                            max={1000}
                            defaultValue={f.position}
                          />
                        </label>
                        <label className="inline-checkbox">
                          <input type="checkbox" name="is_active" defaultChecked={f.is_active} />{' '}
                          Active
                        </label>
                      </WorkspaceAction>,
                    ],
                  }))}
                />
              ),
            },
            {
              id: 'threads-mod',
              label: 'Threads moderation',
              count: modState.records.threads.length,
              content: (
                <WorkspaceTable
                  label="forum threads"
                  columns={['Discussion', 'Context', 'Author', 'State', 'Actions']}
                  rows={modState.records.threads.map((t) => ({
                    id: String(t.id),
                    search: [t.title, t.body, t.author_name, t.context].join(' '),
                    cells: [
                      <>
                        <strong>{t.title}</strong>
                        <div className="workspace-detail-copy">{t.body}</div>
                      </>,
                      t.context,
                      `${t.author_name} (${roleLabel(t.author_role)})`,
                      <StatusIndicator status={t.hidden ? 'inactive' : 'active'} />,
                      <div className="workspace-row-actions">
                        <button
                          type="button"
                          className="button button-outline button-small"
                          onClick={async () => {
                            await communityRepository.moderateThread(t.id, { pinned: !t.pinned });
                            modState.reload();
                          }}
                        >
                          <Pin size={13} /> {t.pinned ? 'Unpin' : 'Pin'}
                        </button>
                        <button
                          type="button"
                          className="button button-outline button-small"
                          onClick={async () => {
                            await communityRepository.moderateThread(t.id, { locked: !t.locked });
                            modState.reload();
                          }}
                        >
                          {t.locked ? <Unlock size={13} /> : <Lock size={13} />}{' '}
                          {t.locked ? 'Unlock' : 'Lock'}
                        </button>
                        <button
                          type="button"
                          className="button button-outline button-small"
                          onClick={async () => {
                            await communityRepository.moderateThread(t.id, { hidden: !t.hidden });
                            modState.reload();
                          }}
                        >
                          {t.hidden ? <Eye size={13} /> : <EyeOff size={13} />}{' '}
                          {t.hidden ? 'Restore' : 'Hide'}
                        </button>
                      </div>,
                    ],
                  }))}
                />
              ),
            },
            {
              id: 'comments-mod',
              label: 'Article comments',
              count: modState.records.comments.length,
              content: (
                <WorkspaceTable
                  label="article comments"
                  columns={['Article', 'Comment', 'Author', 'State', 'Action']}
                  rows={modState.records.comments.map((c) => ({
                    id: String(c.id),
                    search: [c.article_title, c.body, c.author_name].join(' '),
                    cells: [
                      c.article_title,
                      c.body,
                      `${c.author_name} (${roleLabel(c.author_role)})`,
                      <StatusIndicator status={c.hidden ? 'inactive' : 'active'} />,
                      <button
                        type="button"
                        className="button button-outline button-small"
                        onClick={async () => {
                          await communityRepository.moderateComment(c.id, !c.hidden);
                          modState.reload();
                        }}
                      >
                        {c.hidden ? 'Restore' : 'Hide'}
                      </button>,
                    ],
                  }))}
                />
              ),
            },
          ]}
        />
      )}
    </div>
  );
}

export function CommunityWorkspace({ canModerate }: { canModerate: boolean }) {
  return (
    <WorkspaceTabs
      label="Community"
      views={[
        { id: 'groups', label: 'Groups & Circles', content: <GroupsDirectory canManage={canModerate} /> },
        { id: 'forums', label: 'Forums', content: <DashboardForumsTab /> },
        { id: 'leaderboard', label: 'Leaderboard', content: <LeaderboardTab /> },
        ...(canModerate
          ? [
              {
                id: 'manage',
                label: 'Manage & moderate',
                content: <CommunityManagementTab />,
              },
            ]
          : []),
      ]}
    />
  );
}
