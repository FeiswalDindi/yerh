import { useEffect, useState, type ReactNode } from 'react';
import {
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  Heart,
  MessageCircle,
  MessagesSquare,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { laravelModeEnabled } from '../../config/laravel';
import { useCatalog } from '../../app/useCatalog';
import { useDemo } from '../../app/useDemo';
import { contentPath, type ContentItem, type ContentKind } from '../../domain/content';
import { popularContent, readingRecommendations, recentComments } from '../../domain/sidebar';
import {
  communityRepository,
  type CommunitySidebarPayload,
} from '../../services/laravel-community-repository';
import { SmartImage } from '../../shared/SmartImage';
import { MemberAvatar, MemberLink } from '../community/CommunityCards';
import { CommunityMemberLink } from '../community/CommunityMemberLink';
import { CourseEntryLink } from '../resources/CourseEntryLink';
import { AdvertisementsWidget } from './AdvertisementsWidget';

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
              <SmartImage src={item.image} alt="" targetWidth={320} sizes="120px" />
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
                    {new Date(
                      item.publishedAt.includes('T')
                        ? item.publishedAt
                        : `${item.publishedAt}T12:00:00Z`,
                    ).toLocaleDateString('en-KE', {
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
                    {likes.get(item.id)} {likes.get(item.id) === 1 ? 'like' : 'likes'}
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

function LiveCommentsWidget({ data }: { data: CommunitySidebarPayload | null }) {
  const comments = data?.comments.slice(0, 3) ?? [];
  return (
    <Widget title="Comments" icon={<MessageCircle size={18} />}>
      {comments.length ? (
        <ul className="discovery-list">
          {comments.map((comment) => (
            <li key={comment.id} className="discovery-comment">
              <div>
                <CommunityMemberLink userId={comment.author_id} name={comment.author_name} />
                <Link className="discovery-comment-link" to={comment.href}>
                  <p>“{comment.body}”</p>
                  <small>
                    {comment.context === 'forum' ? 'Reply in' : 'Comment on'} {comment.title}
                  </small>
                </Link>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="discovery-empty">No public comments yet. Join a discussion to get started.</p>
      )}
    </Widget>
  );
}

function DemoCommentsWidget() {
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

function LiveForumActivityWidget({ data }: { data: CommunitySidebarPayload | null }) {
  const threads = data?.threads ?? [];
  return (
    <Widget title="On the forums" icon={<MessagesSquare size={18} />}>
      {threads.length ? (
        <ul className="discovery-list">
          {threads.map((thread) => (
            <li className="discovery-forum-row" key={thread.id}>
              <Link to={`/forums/${thread.id}`}>
                <strong>{thread.title}</strong>
              </Link>
              <p>
                <CommunityMemberLink userId={thread.author_id} name={thread.author_name} /> · {thread.reply_count}{' '}
                {thread.reply_count === 1 ? 'reply' : 'replies'}
              </p>
              <Link
                className="discovery-category"
                to={`/forums?forum=${encodeURIComponent(thread.forum_slug)}`}
              >
                {thread.forum_name}
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

function DemoForumActivityWidget() {
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
  const [liveData, setLiveData] = useState<CommunitySidebarPayload | null>(null);

  useEffect(() => {
    if (!laravelModeEnabled) return;
    const controller = new AbortController();
    void communityRepository
      .sidebar(controller.signal)
      .then((res) => {
        if (!controller.signal.aborted) setLiveData(res);
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  const featured = sidebar.featuredIds.flatMap((id) =>
    items.filter((i) => i.id === id && i.id !== currentId),
  );

  const likes = laravelModeEnabled
    ? new Map((liveData?.popularity ?? []).map((p) => [p.content_id, p.likes]))
    : new Map(sidebar.popularity.map((p) => [p.contentId, p.likes]));

  const popularItems: ContentItem[] = laravelModeEnabled
    ? (liveData?.popularity ?? []).flatMap((p) => {
        const match = items.find((i) => i.id === p.content_id && i.id !== currentId);
        return match ? [match] : [];
      })
    : popularContent(items, sidebar, currentId).map((p) => p.item);

  return (
    <aside
      className="discovery-sidebar"
      aria-label={variant === 'forum' ? 'Forum sidebar' : 'Reading sidebar'}
    >
      {kind === 'business' && <AdvertisementsWidget />}
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
              {laravelModeEnabled
                ? (liveData?.featuredCourses ?? []).map((course, index) => (
                    <li key={course.id}>
                      <CourseEntryLink
                        className="discovery-course"
                        courseId={course.slug}
                        courseName={course.title}
                        to={`/learn/${encodeURIComponent(course.slug)}`}
                      >
                        <span className="discovery-course-number">0{index + 1}</span>
                        <span>
                          <span className="discovery-category">{course.level}</span>
                          <strong>{course.title}</strong>
                          <small>
                            {course.is_moodle
                              ? 'Self-paced Moodle classroom'
                              : `${course.lesson_count} lessons · Learn at your pace`}
                          </small>
                        </span>
                        <ArrowUpRight size={16} />
                      </CourseEntryLink>
                    </li>
                  ))
                : sidebar.featuredCourseIds
                    .flatMap((id) => courses.filter((c) => c.id === id))
                    .map((course, index) => (
                      <li key={course.id}>
                        <CourseEntryLink
                          className="discovery-course"
                          courseId={course.id}
                          courseName={course.title}
                          to={`/learn/${encodeURIComponent(course.id)}`}
                        >
                          <span className="discovery-course-number">0{index + 1}</span>
                          <span>
                            <span className="discovery-category">{course.level}</span>
                            <strong>{course.title}</strong>
                            <small>{course.lessonIds.length} lessons · Learn at your pace</small>
                          </span>
                          <ArrowUpRight size={16} />
                        </CourseEntryLink>
                      </li>
                    ))}
            </ul>
            <Link className="discovery-footer-link" to="/learn">
              All learning pathways <ArrowUpRight size={15} />
            </Link>
          </Widget>
          <AdvertisementsWidget />
        </>
      )}
      <Widget title="Featured" icon={<Sparkles size={18} />}>
        <ContentRows items={featured} likes={likes} />
      </Widget>
      {laravelModeEnabled ? <LiveCommentsWidget data={liveData} /> : <DemoCommentsWidget />}
      {variant === 'reading' ? (
        <>
          <Widget title="Most liked" icon={<Heart size={18} />}>
            <ContentRows items={popularItems} likes={likes} />
            {!laravelModeEnabled && <p className="discovery-note">{sidebar.popularitySource}</p>}
          </Widget>
          {laravelModeEnabled ? (
            <LiveForumActivityWidget data={liveData} />
          ) : (
            <DemoForumActivityWidget />
          )}
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
