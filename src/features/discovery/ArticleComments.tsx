import { useCatalog } from '../../app/useCatalog';
import { MemberLink } from '../community/CommunityCards';
export function ArticleComments({ contentId }: { contentId: string }) {
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
