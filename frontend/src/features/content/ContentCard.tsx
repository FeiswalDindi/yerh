import { ArrowUpRight, Bookmark, Check } from 'lucide-react';
import { Link } from 'react-router-dom';
import { contentPath, type ContentItem } from '../../domain/content';
import { useCatalog } from '../../app/useCatalog';
import { SmartImage } from '../../shared/SmartImage';
import { useSavedItems } from '../../shared/useSavedItems';
import { MemberLink } from '../community/CommunityCards';

export function ContentCard({ item, portrait = false }: { item: ContentItem; portrait?: boolean }) {
  const { media } = useCatalog();
  const { ids, toggle } = useSavedItems();
  const saved = ids.includes(item.id);
  return (
    <article className={`content-card ${portrait ? 'portrait-card' : ''}`}>
      <div className="card-media">
        <Link to={contentPath(item)} tabIndex={-1} aria-hidden="true">
          <SmartImage
            src={item.image || media.team}
            alt=""
            targetWidth={640}
            sizes="(max-width: 600px) 100vw, (max-width: 1000px) 50vw, 380px"
          />
        </Link>
        <span className="image-tag">{item.category}</span>
        <button
          className="save-button"
          aria-label={`${saved ? 'Unsave' : 'Save'} ${item.title}`}
          aria-pressed={saved}
          onClick={() => toggle(item.id)}
        >
          {saved ? <Check size={17} /> : <Bookmark size={17} />}
        </button>
      </div>
      <div className="card-copy">
        <h3>
          <Link to={contentPath(item)}>
            {item.title}
            <ArrowUpRight size={19} />
          </Link>
        </h3>
        <p>{item.excerpt}</p>
        {item.authorId && (
          <p className="content-author">
            By <MemberLink id={item.authorId} />
          </p>
        )}
        <Link className="card-read" to={contentPath(item)}>
          {item.kind === 'story'
            ? 'Read their story'
            : item.kind === 'business'
              ? 'Meet the business'
              : 'Explore more'}
          <ArrowUpRight size={14} />
        </Link>
      </div>
    </article>
  );
}
