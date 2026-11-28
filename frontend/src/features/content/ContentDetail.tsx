import { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowUpRight,
  Bookmark,
  Check,
  ExternalLink,
  Heart,
  Linkedin,
  Play,
  Share2,
} from 'lucide-react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { laravelModeEnabled } from '../../config/laravel';
import { useCatalog } from '../../app/useCatalog';
import { useDemo } from '../../app/useDemo';
import { useLaravelSession } from '../../app/useLaravelSession';
import { sessionPath } from '../../domain/community';
import {
  businessSectorPath,
  contentPath,
  kindPaths,
  type ContentBlock,
} from '../../domain/content';
import { isPublishedSession } from '../../domain/events';
import {
  communityRepository,
  type ArticleEngagementPayload,
} from '../../services/laravel-community-repository';
import { SmartImage } from '../../shared/SmartImage';
import { usePageTitle } from '../../shared/usePageTitle';
import { useSavedItems } from '../../shared/useSavedItems';
import { MemberLink } from '../community/CommunityCards';
import { dashboardCataloguePaths } from '../dashboard/catalogue-paths';
import { ArticleComments } from '../discovery/ArticleComments';
import { DiscoverySidebar } from '../discovery/DiscoverySidebar';
import { NotFoundPage } from '../info/NotFoundPage';
import { ContentCard } from './ContentCard';

function ArticleBody({ blocks }: { blocks: ContentBlock[] }) {
  const groups: { list: boolean; blocks: ContentBlock[] }[] = [];
  for (const block of blocks) {
    const last = groups.at(-1);
    if (block.type === 'list-item' && last?.list) last.blocks.push(block);
    else groups.push({ list: block.type === 'list-item', blocks: [block] });
  }
  return (
    <>
      {groups.map((group, i) =>
        group.list ? (
          <ul key={i}>
            {group.blocks.map((b, n) => (
              <li key={n}>{b.text}</li>
            ))}
          </ul>
        ) : (
          group.blocks.map((b, j) =>
            b.type === 'heading' ? <h2 key={`${i}-${j}`}>{b.text}</h2> : <p key={`${i}-${j}`}>{b.text}</p>,
          )
        ),
      )}
    </>
  );
}

export function ContentDetail({ dashboard = false }: { dashboard?: boolean }) {
  const { slug } = useParams();
  const { search } = useLocation();
  const { items, media } = useCatalog();
  const { state } = useDemo();
  const session = useLaravelSession();
  const item = items.find((i) => i.slug === slug && (!dashboard || i.kind === 'business'));
  const { ids, toggle } = useSavedItems();
  const [message, setMessage] = useState('');
  const [engagement, setEngagement] = useState<ArticleEngagementPayload | null>(null);
  const [liking, setLiking] = useState(false);

  const loadEngagement = useCallback(
    async (contentId: string, signal?: AbortSignal) => {
      if (!laravelModeEnabled || dashboard) return;
      try {
        const res = await communityRepository.articleEngagement(contentId, false, signal);
        if (!signal?.aborted) setEngagement(res);
      } catch {
        // Ignore transient failure
      }
    },
    [dashboard],
  );

  useEffect(() => {
    if (!item || !laravelModeEnabled || dashboard) return;
    const controller = new AbortController();
    void loadEngagement(item.id, controller.signal);
    return () => controller.abort();
  }, [item, dashboard, loadEngagement]);

  usePageTitle(item?.title || 'Page not found');
  if (!item) return <NotFoundPage />;

  const saved = ids.includes(item.id);
  const related = dashboard
    ? []
    : items.filter((i) => i.kind === item.kind && i.id !== item.id).slice(0, 3);
  const publicPath = dashboard ? contentPath(item) : undefined;
  const collectionPath =
    item.kind === 'business' ? businessSectorPath(item.category) : kindPaths[item.kind];

  async function share() {
    try {
      await navigator.clipboard.writeText(
        publicPath ? new URL(publicPath, window.location.origin).href : window.location.href,
      );
      setMessage('Link copied.');
    } catch {
      setMessage('Copy the address from your browser to share this page.');
    }
  }

  async function toggleLike() {
    if (!item || !laravelModeEnabled) return;
    if (!session?.profile) {
      setMessage('Sign in to like articles.');
      return;
    }
    if (!session.profile.email_verified) {
      setMessage('Verify your email to like articles.');
      return;
    }
    setLiking(true);
    try {
      const res = await communityRepository.toggleArticleLike(item.id);
      setEngagement((current) =>
        current
          ? { ...current, liked: res.liked, likes_count: res.likes_count }
          : {
              liked: res.liked,
              likes_count: res.likes_count,
              comments: [],
              can_moderate: false,
            },
      );
    } catch {
      setMessage('Could not update like right now.');
    } finally {
      setLiking(false);
    }
  }

  return (
    <>
      <div className={`container article-header${dashboard ? '' : ' article-header-with-sidebar'}`}>
        <Link
          className="text-link"
          to={dashboard ? `${dashboardCataloguePaths.marketplace}${search}` : collectionPath}
        >
          <ArrowLeft size={16} />
          Back to{' '}
          {dashboard
            ? 'Marketplace'
            : item.kind === 'article'
              ? 'blogs'
              : item.kind === 'story'
                ? 'stories'
                : item.kind === 'business'
                  ? item.category
                  : `${item.kind}s`}
        </Link>
        <h1>{item.title}</h1>
        <p className="article-deck">{item.excerpt}</p>
        <div className="article-tools">
          <span>
            {item.category}
            {item.kind === 'event' ? ' · Past event' : ''}
            {' · '}
            {!laravelModeEnabled && item.authorId ? (
              <MemberLink id={item.authorId} />
            ) : (
              'YERH Editorial'
            )}
            {item.publishedAt
              ? ` · ${new Date(item.publishedAt.includes('T') ? item.publishedAt : `${item.publishedAt}T12:00:00`).toLocaleDateString('en-KE', { dateStyle: 'long' })}`
              : item.source.path === 'local-demo'
                ? ' · Browser-only preview'
                : ' · From the YERH collection'}
          </span>
          <div>
            {laravelModeEnabled && !dashboard && (
              <button
                type="button"
                className="text-link"
                onClick={() => void toggleLike()}
                disabled={liking}
                aria-pressed={engagement?.liked ?? false}
              >
                <Heart
                  size={17}
                  fill={engagement?.liked ? 'currentColor' : 'none'}
                  aria-hidden="true"
                />
                {engagement ? `${engagement.likes_count} ` : ''}
                {engagement?.liked ? 'Liked' : 'Like'}
              </button>
            )}
            <button className="text-link" onClick={() => toggle(item.id)} aria-pressed={saved}>
              {saved ? <Check size={17} /> : <Bookmark size={17} />}
              {saved ? 'Saved' : 'Save'}
            </button>
            <button className="text-link" onClick={share}>
              <Share2 size={17} />
              Share
            </button>
          </div>
        </div>
        <p className="share-message" role="status">
          {message}
        </p>
      </div>
      <div
        className={`container article-layout ${dashboard ? 'dashboard-listing-detail' : 'content-with-sidebar'}`}
      >
        <div>
          <SmartImage
            className="article-image"
            src={item.image || media.team}
            alt={item.image ? item.imageAlt : 'Young people working together'}
            priority
            targetWidth={1200}
            sizes="(max-width: 900px) 100vw, 820px"
          />
          <div className="article-body">
            <ArticleBody blocks={item.blocks} />
            {item.videos.map((href, i) => (
              <a className="video-link" key={href} href={href} target="_blank" rel="noreferrer">
                <Play size={23} />
                <span>
                  Watch {item.kind === 'story' ? 'the full story' : 'the video'}
                  {item.videos.length > 1 ? ` ${i + 1}` : ''}
                  <small>Opens on YouTube</small>
                </span>
                <ArrowUpRight size={20} />
              </a>
            ))}
            {item.linkedinUrl && (
              <a
                className="download-link"
                href={item.linkedinUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Linkedin size={19} />
                Connect on LinkedIn
                <small>Opens LinkedIn in a new tab</small>
              </a>
            )}
            {item.downloads.map((download, i) => (
              <a
                className="download-link"
                key={i}
                href={download.href}
                target="_blank"
                rel="noreferrer"
              >
                <ExternalLink size={19} />
                {download.label}
                <small>{download.availableLocally ? 'Local document' : 'External document'}</small>
              </a>
            ))}
            {!item.blocks.length && !item.videos.length && (
              <p>Published in the Youth Entrepreneurship Resource Hub collection.</p>
            )}
            <div className="source-note">
              {!laravelModeEnabled && item.source.path === 'mock-member'
                ? 'Fictional member contribution from the development fixtures.'
                : !laravelModeEnabled && item.source.path === 'local-demo'
                  ? 'Created in the local development demo. This contribution exists only in this browser.'
                  : 'Published in the Youth Entrepreneurship Resource Hub collection.'}
            </div>
            {!dashboard && (
              <ArticleComments
                contentId={item.id}
                engagement={engagement}
                onEngagementChange={setEngagement}
              />
            )}
          </div>
          {!!related.length && (
            <section className="article-related" aria-label="Related reading">
              <div className="section-heading">
                <h2>Keep exploring</h2>
              </div>
              <div className="content-grid">
                {related.map((i) => (
                  <ContentCard key={i.id} item={i} />
                ))}
              </div>
            </section>
          )}
        </div>
        {!dashboard && (
          <DiscoverySidebar currentId={item.id} kind={item.kind}>
            {!laravelModeEnabled && item.authorId && (
              <div className="profile-panel">
                <h2>Meet the author</h2>
                <MemberLink id={item.authorId} />
                <p>Explore their blogs, discussions, groups, and community profile.</p>
              </div>
            )}
            {!laravelModeEnabled &&
              state.sessions
                .filter((s) => isPublishedSession(s) && s.contentId === item.id)
                .map((s) => (
                  <Link className="profile-sidebar-link" key={s.id} to={sessionPath(s.id)}>
                    View {s.type} details →
                  </Link>
                ))}
            <section className="discovery-community-callout">
              <p className="eyebrow">KEEP MOVING FORWARD</p>
              <h2>Your idea deserves a next step.</h2>
              <p>
                Build your confidence with practical resources and a community that understands the
                journey.
              </p>
              <Link className="button button-gold" to="/resources">
                Explore resources
                <ArrowUpRight size={16} />
              </Link>
              <Link className="text-link" to="/forums">
                Explore the forums
                <ArrowUpRight size={16} />
              </Link>
            </section>
          </DiscoverySidebar>
        )}
      </div>
    </>
  );
}
