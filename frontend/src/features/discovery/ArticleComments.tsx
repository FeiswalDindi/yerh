import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { laravelModeEnabled } from '../../config/laravel';
import { useCatalog } from '../../app/useCatalog';
import { useLaravelSession } from '../../app/useLaravelSession';
import {
  communityRepository,
  type ArticleEngagementPayload,
} from '../../services/laravel-community-repository';
import { AccountLink } from '../accounts/AccountLink';
import { MemberLink } from '../community/CommunityCards';
import { CommunityMemberLink } from '../community/CommunityMemberLink';

function LaravelArticleComments({
  contentId,
  initialEngagement,
  onEngagementChange,
}: {
  contentId: string;
  initialEngagement?: ArticleEngagementPayload | null;
  onEngagementChange?: (next: ArticleEngagementPayload) => void;
}) {
  const session = useLaravelSession();
  const profile = session?.profile;
  const [engagement, setEngagement] = useState<ArticleEngagementPayload | null>(
    initialEngagement ?? null,
  );
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (initialEngagement) {
      setEngagement(initialEngagement);
    }
  }, [initialEngagement]);

  const reload = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const res = await communityRepository.articleEngagement(contentId, false, signal);
        if (!signal?.aborted) {
          setEngagement(res);
          onEngagementChange?.(res);
        }
      } catch {
        // Ignore transient load error
      }
    },
    [contentId, onEngagementChange],
  );

  useEffect(() => {
    if (initialEngagement !== undefined) return;
    const controller = new AbortController();
    void reload(controller.signal);
    return () => controller.abort();
  }, [initialEngagement, reload]);

  async function submitComment(e: FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    setError('');
    try {
      await communityRepository.commentOnArticle(contentId, body.trim());
      setBody('');
      await reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not post comment.');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(commentId: number) {
    setError('');
    try {
      await communityRepository.deleteArticleComment(commentId);
      await reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not delete comment.');
    }
  }

  async function handleHide(commentId: number, hidden: boolean) {
    setError('');
    try {
      await communityRepository.moderateComment(commentId, hidden);
      await reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not moderate comment.');
    }
  }

  const comments = engagement?.comments ?? [];

  return (
    <section className="article-comments" aria-label="Article comments">
      <h2>Comments · {comments.length}</h2>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      {profile?.email_verified ? (
        <form className="workspace-form" onSubmit={(e) => void submitComment(e)}>
          <label>
            Add a comment
            <textarea
              rows={3}
              required
              minLength={2}
              maxLength={2000}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Share your thoughts or questions on this article…"
            />
          </label>
          <button className="button" disabled={busy}>
            {busy ? 'Posting…' : 'Post comment'}
          </button>
        </form>
      ) : profile ? (
        <p className="source-note">
          <Link to="/account">Verify your email</Link> to post comments and like articles.
        </p>
      ) : (
        <p className="source-note">
          <AccountLink className="text-link">Sign in</AccountLink> to leave a comment or like this
          article.
        </p>
      )}

      {comments.length > 0 ? (
        comments.map((comment) => (
          <article className="discussion-post" id={`comment-${comment.id}`} key={comment.id}>
            <span className="eyebrow">
              <CommunityMemberLink
                userId={comment.user_id}
                name={comment.author_name}
                role={comment.author_role}
                showRoleBadge
              />
            </span>
            <p>{comment.body}</p>
            <div className="community-reply-footer">
              <time dateTime={comment.created_at}>
                {new Date(comment.created_at).toLocaleDateString('en-KE', {
                  dateStyle: 'medium',
                  timeZone: 'Africa/Nairobi',
                })}
              </time>
              <div className="workspace-row-actions">
                {engagement?.can_moderate && (
                  <button
                    type="button"
                    className="button button-outline button-small"
                    onClick={() => void handleHide(comment.id, !comment.hidden)}
                  >
                    {comment.hidden ? 'Restore' : 'Hide'}
                  </button>
                )}
                {comment.can_delete && (
                  <button
                    type="button"
                    className="button button-outline button-small"
                    onClick={() => void handleDelete(comment.id)}
                  >
                    <Trash2 size={13} /> Delete
                  </button>
                )}
              </div>
            </div>
          </article>
        ))
      ) : (
        <p className="source-note">No comments yet. Be the first to share your thoughts.</p>
      )}
    </section>
  );
}

function DemoArticleComments({ contentId }: { contentId: string }) {
  const { sidebar } = useCatalog();
  const comments = sidebar.comments.filter((c) => c.contentId === contentId);
  if (!comments.length) return null;
  return (
    <section className="article-comments" aria-label="Article comments">
      <h2>Comments · {comments.length}</h2>
      <p className="source-note">Fictional member comments from the development fixtures.</p>
      {comments.map((comment) => (
        <article className="discussion-post" id={`comment-${comment.id}`} key={comment.id}>
          <MemberLink id={comment.authorId} />
          <p>{comment.body}</p>
          <time dateTime={comment.createdAt}>
            {new Date(comment.createdAt).toLocaleDateString('en-KE', {
              dateStyle: 'medium',
              timeZone: 'Africa/Nairobi',
            })}
          </time>
        </article>
      ))}
    </section>
  );
}

export function ArticleComments({
  contentId,
  engagement,
  onEngagementChange,
}: {
  contentId: string;
  engagement?: ArticleEngagementPayload | null;
  onEngagementChange?: (next: ArticleEngagementPayload) => void;
}) {
  return laravelModeEnabled ? (
    <LaravelArticleComments
      contentId={contentId}
      initialEngagement={engagement}
      onEngagementChange={onEngagementChange}
    />
  ) : (
    <DemoArticleComments contentId={contentId} />
  );
}
