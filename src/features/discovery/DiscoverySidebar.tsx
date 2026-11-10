import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  Heart,
  MessageCircle,
  MessagesSquare,
  Megaphone,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { useCatalog } from '../../app/useCatalog';
import { useDemo } from '../../app/useDemo';
import { contentPath, type ContentItem, type ContentKind } from '../../domain/content';
import { popularContent, readingRecommendations, recentComments } from '../../domain/sidebar';
import { MemberAvatar, MemberLink } from '../community/CommunityCards';

function Widget({
  title,
  icon,
  children,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="discovery-widget" aria-label={title}>
      <h2>
        <span aria-hidden="true">{icon}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}
function ContentRows({ items, likes }: { items: ContentItem[]; likes?: Map<string, number> }) {
  return items.length ? (
    <ul className="discovery-list">
      {items.map((item) => (
        <li key={item.id}>
          <Link className="discovery-content-row" to={contentPath(item)}>
            {item.image ? (
              <img src={item.image} alt="" loading="lazy" />
            ) : (
              <span className="discovery-thumbnail" aria-hidden="true">
                <BookOpen size={24} />
              </span>
            )}
            <span className="discovery-row-copy">
              <span className="discovery-category">{item.category}</span>
              <strong>{item.title}</strong>
              <span className="discovery-meta">
                {item.publishedAt && (
                  <time dateTime={item.publishedAt}>
                    {new Date(`${item.publishedAt}T12:00:00Z`).toLocaleDateString('en-KE', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      timeZone: 'Africa/Nairobi',
                    })}
                  </time>
                )}
                {likes?.has(item.id) && (
                  <span>
                    <Heart size={12} aria-hidden="true" />
                    {likes.get(item.id)} likes
                  </span>
                )}
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  ) : (
    <p className="discovery-empty">More reading will appear here soon.</p>
  );
}
function CommentsWidget() {
  const { items, sidebar } = useCatalog();
  const { state } = useDemo();
  const comments = recentComments(items, sidebar, state).slice(0, 3);
  return (
    <Widget title="Comments" icon={<MessageCircle size={18} />}>
      {comments.length ? (
        <ul className="discovery-list">
          {comments.map((comment) => {
            const author = state.accounts.find((a) => a.id === comment.authorId);
            return (
              <li key={`${comment.context}:${comment.id}`} className="discovery-comment">
                {author && <MemberAvatar member={author} />}
                <div>
                  <MemberLink id={comment.authorId} />
                  <Link className="discovery-comment-link" to={comment.href}>
                    <p>“{comment.body}”</p>
                    <small>
                      {comment.context === 'forum' ? 'Reply in' : 'Comment on'} {comment.title}
                    </small>
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="discovery-empty">No public comments yet. Join a discussion to get started.</p>
      )}
    </Widget>
  );
}
function ForumActivityWidget() {
  const { state } = useDemo();
  const threads = state.threads
    .filter((t) => !t.hidden)
    .sort(
      (a, b) =>
        Math.max(Date.parse(b.createdAt), ...b.replies.map((r) => Date.parse(r.createdAt))) -
        Math.max(Date.parse(a.createdAt), ...a.replies.map((r) => Date.parse(r.createdAt))),
    )
    .slice(0, 3);
  return (
    <Widget title="On the forums" icon={<MessagesSquare size={18} />}>
      {threads.length ? (
        <ul className="discovery-list">
          {threads.map((thread) => (
            <li className="discovery-forum-row" key={thread.id}>
              <Link to={`/forums/${encodeURIComponent(thread.id)}`}>
                <strong>{thread.title}</strong>
              </Link>
              <p>
                <MemberLink id={thread.authorId} /> · {thread.replies.length}{' '}
                {thread.replies.length === 1 ? 'reply' : 'replies'}
              </p>
              <Link
                className="discovery-category"
                to={`/forums?forum=${encodeURIComponent(thread.forumId)}`}
              >
                {state.forums.find((f) => f.id === thread.forumId)?.name}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="discovery-empty">No public discussions yet.</p>
      )}
      <Link className="discovery-footer-link" to="/forums">
        Explore the forums <ArrowUpRight size={15} />
      </Link>
    </Widget>
  );
}
export function DiscoverySidebar({
  variant = 'reading',
  currentId,
  kind,
  calendar,
  children,
}: {
  variant?: 'reading' | 'forum';
  currentId?: string;
  kind?: ContentKind;
  calendar?: ReactNode;
  children?: ReactNode;
}) {
  const { items, courses, sidebar } = useCatalog();
  const featured = sidebar.featuredIds.flatMap((id) =>
    items.filter((i) => i.id === id && i.id !== currentId),
  );
  const popular = popularContent(items, sidebar, currentId);
  const likes = new Map(sidebar.popularity.map((p) => [p.contentId, p.likes]));
  return (
    <aside
      className="discovery-sidebar"
      aria-label={variant === 'forum' ? 'Forum sidebar' : 'Reading sidebar'}
    >
      {variant === 'reading' ? (
        <Widget title="Keep reading" icon={<TrendingUp size={18} />}>
          <ContentRows items={readingRecommendations(items, currentId, kind)} />
          <Link className="discovery-footer-link" to="/publications">
            Explore publications <ArrowUpRight size={15} />
          </Link>
        </Widget>
      ) : (
        <>
          <Widget title="Featured courses" icon={<BookOpen size={18} />}>
            <ul className="discovery-list">
              {sidebar.featuredCourseIds
                .flatMap((id) => courses.filter((c) => c.id === id))
                .map((course, index) => (
                  <li key={course.id}>
                    <Link
                      className="discovery-course"
                      to={`/learn/${encodeURIComponent(course.id)}`}
                    >
                      <span className="discovery-course-number">0{index + 1}</span>
                      <span>
                        <span className="discovery-category">{course.level}</span>
                        <strong>{course.title}</strong>
                        <small>{course.lessonIds.length} lessons · Learn at your pace</small>
                      </span>
                      <ArrowUpRight size={16} />
                    </Link>
                  </li>
                ))}
            </ul>
            <Link className="discovery-footer-link" to="/learn">
              All learning pathways <ArrowUpRight size={15} />
            </Link>
          </Widget>
          <Widget title="Advertisements" icon={<Megaphone size={18} />}>
            {sidebar.advertisements.map((ad) => (
              <div className="discovery-ad" key={ad.id}>
                {ad.image && <img src={ad.image} alt={ad.imageAlt} loading="lazy" />}
                <div>
                  <span className="discovery-category">Hub promotion</span>
                  <h3>{ad.title}</h3>
                  <p>{ad.text}</p>
                  <Link className="button button-gold" to={ad.href}>
                    {ad.action}
                    <ArrowUpRight size={15} />
                  </Link>
                </div>
              </div>
            ))}
          </Widget>
        </>
      )}
      <Widget title="Featured" icon={<Sparkles size={18} />}>
        <ContentRows items={featured} likes={likes} />
      </Widget>
      <CommentsWidget />
      {variant === 'reading' ? (
        <>
          <Widget title="Most liked" icon={<Heart size={18} />}>
            <ContentRows items={popular.map((p) => p.item)} likes={likes} />
            <p className="discovery-note">{sidebar.popularitySource}</p>
          </Widget>
          <ForumActivityWidget />
        </>
      ) : (
        calendar && (
          <Widget title="Calendar" icon={<CalendarDays size={18} />}>
            {calendar}
          </Widget>
        )
      )}
      {children}
    </aside>
  );
}
