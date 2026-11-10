import { useState } from 'react';
import { ArrowLeft, ArrowUpRight, Bookmark, Check, ExternalLink, Play, Share2 } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { useCatalog } from '../../app/useCatalog';
import { kindPaths, type ContentBlock } from '../../domain/content';
import { useSavedItems } from '../../shared/useSavedItems';
import { usePageTitle } from '../../shared/usePageTitle';
import { ContentCard } from './ContentCard';
import { NotFoundPage } from '../info/NotFoundPage';
import { useDemo } from '../../app/useDemo';
import { MemberLink } from '../community/CommunityCards';
import { sessionPath } from '../../domain/community';
import { DiscoverySidebar } from '../discovery/DiscoverySidebar';
import { ArticleComments } from '../discovery/ArticleComments';
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
          group.blocks.map((b) =>
            b.type === 'heading' ? <h2 key={i}>{b.text}</h2> : <p key={i}>{b.text}</p>,
          )
        ),
      )}
    </>
  );
}
export function ContentDetail() {
  const { slug } = useParams();
  const { items, media } = useCatalog();
  const { state } = useDemo();
  const item = items.find((i) => i.slug === slug);
  const { ids, toggle } = useSavedItems();
  const [message, setMessage] = useState('');
  usePageTitle(item?.title || 'Page not found');
  if (!item) return <NotFoundPage />;
  const saved = ids.includes(item.id);
  const related = items.filter((i) => i.kind === item.kind && i.id !== item.id).slice(0, 3);
  async function share() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setMessage('Link copied.');
    } catch {
      setMessage('Copy the address from your browser to share this page.');
    }
  }
  return (
    <>
      <div className="container article-header article-header-with-sidebar">
        <Link className="text-link" to={kindPaths[item.kind]}>
          <ArrowLeft size={16} />
          Back to{' '}
          {item.kind === 'article'
            ? 'blogs'
            : item.kind === 'story'
              ? 'stories'
              : item.kind === 'business'
                ? 'businesses'
                : `${item.kind}s`}
        </Link>
        <p className="eyebrow">
          {item.category}
          {item.kind === 'event' ? ' · PAST EVENT' : ''}
        </p>
        <h1>{item.title}</h1>
        <p className="article-deck">{item.excerpt}</p>
        <div className="article-tools">
          <span>
            {item.authorId ? <MemberLink id={item.authorId} /> : 'YERH Editorial'}
            {item.publishedAt
              ? ` · ${new Date(`${item.publishedAt}T12:00:00`).toLocaleDateString('en-KE', { dateStyle: 'long' })}`
              : item.source.path === 'local-demo'
                ? ' · Browser-only preview'
                : ' · From the YERH collection'}
          </span>
          <div>
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
      <div className="container article-layout content-with-sidebar">
        <div>
          <img
            className="article-image"
            src={item.image || media.team}
            alt={item.image ? item.imageAlt : 'Young people working together'}
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
                <small>{download.availableLocally ? 'Local document' : 'Original website'}</small>
              </a>
            ))}
            {!item.blocks.length && !item.videos.length && (
              <p>
                This item is part of the original YERH collection. Follow the original source below
                to explore the full resource.
              </p>
            )}
            <div className="source-note">
              {item.source.url ? (
                <>
                  From the YERH collection.{' '}
                  <a href={item.source.url} target="_blank" rel="noreferrer">
                    View original source <ExternalLink size={12} />
                  </a>
                </>
              ) : item.source.path === 'mock-member' ? (
                'Fictional member contribution from the development fixtures.'
              ) : (
                'Created in the local development demo. This contribution exists only in this browser.'
              )}
            </div>
            <ArticleComments contentId={item.id} />
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
        <DiscoverySidebar currentId={item.id}>
          {item.authorId && (
            <div className="profile-panel">
              <h2>Meet the author</h2>
              <MemberLink id={item.authorId} />
              <p>Explore their blogs, discussions, groups, and community profile.</p>
            </div>
          )}
          {state.sessions
            .filter((s) => s.contentId === item.id)
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
            <Link className="text-link" to="/community">
              Find your community
              <ArrowUpRight size={16} />
            </Link>
          </section>
        </DiscoverySidebar>
      </div>
    </>
  );
}
