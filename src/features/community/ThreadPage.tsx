import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useDemo } from '../../app/useDemo';
import { PageIntro } from '../../shared/PageIntro';
import { DemoNotice } from '../demo/DemoNotice';
import { NotFoundPage } from '../info/NotFoundPage';
import { usePageTitle } from '../../shared/usePageTitle';
import { sessionPath } from '../../domain/community';
import { DiscoverySidebar } from '../discovery/DiscoverySidebar';
import { ForumCalendar } from '../discovery/ForumCalendar';
import { MemberRoster } from './MemberRoster';
import { can } from '../../domain/roles';
export function ThreadPage() {
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
                <Link className="button" to={account ? '/apply' : '/login'}>
                  {account ? 'Apply for community access' : 'Login to reply'}
                </Link>
              )
            )}
            {state.sessions.some((s) => s.forumId === thread.forumId) && (
              <section className="profile-panel">
                <h2>Related sessions</h2>
                {state.sessions
                  .filter((s) => s.forumId === thread.forumId)
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
