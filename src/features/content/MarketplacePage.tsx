import { useEffect, useRef } from 'react';
import { ArrowLeft, ArrowRight, Search, Store } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { useCatalog } from '../../app/useCatalog';
import {
  businessSectorPath,
  filterContent,
  kindPaths,
  type ContentItem,
} from '../../domain/content';
import { Breadcrumb } from '../../shared/Breadcrumb';
import { PageIntro } from '../../shared/PageIntro';
import { usePageTitle } from '../../shared/usePageTitle';
import { AdvertisementsWidget } from '../discovery/AdvertisementsWidget';
import { ContentCard } from './ContentCard';

const marketplacePath = kindPaths.business;

function listingCount(count: number) {
  return `${count} ${count === 1 ? 'listing' : 'listings'}`;
}

export function MarketplacePage() {
  const { items, sidebar } = useCatalog();
  const [params, setParams] = useSearchParams();
  const groups = new Map<string, ContentItem[]>();
  const businesses = items.filter((item) => item.kind === 'business');
  for (const item of businesses) {
    const group = groups.get(item.category);
    if (group) group.push(item);
    else groups.set(item.category, [item]);
  }

  const requestedSector = params.get('category') ?? '';
  const sector = groups.has(requestedSector) ? requestedSector : '';
  const query = params.get('q') ?? '';
  const showListings = Boolean(sector) || params.has('q');
  const results = showListings ? filterContent(groups.get(sector) ?? businesses, query) : [];
  const sectors = [...groups].sort(([first], [second]) => first.localeCompare(second));
  const otherSectors = sectors.filter(([name]) => name !== sector);
  const hasAds = sidebar.advertisements.length > 0;
  const heading = useRef<HTMLHeadingElement>(null);
  const sectorGrid = useRef<HTMLUListElement>(null);
  const view = sector || (showListings ? 'search' : '');
  const previousView = useRef(view);
  usePageTitle(sector ? `${sector} · Business directory` : 'Business directory');

  useEffect(() => {
    if (previousView.current === view) return;
    previousView.current = view;
    window.scrollTo({ top: 0, behavior: 'instant' });
    (heading.current ?? sectorGrid.current)?.focus({ preventScroll: true });
  }, [view]);

  return (
    <>
      {!showListings && (
        <PageIntro
          title="Built with purpose. Made in Kenya."
          eyebrow="Business directory"
          description="Discover youth enterprises across industries and the people building them."
        />
      )}
      <section className={`container directory-section${hasAds ? ' content-with-sidebar' : ''}`}>
        <div className="discovery-main">
          {showListings ? (
            <>
              <Link className="text-link marketplace-back" to={marketplacePath}>
                <ArrowLeft size={16} aria-hidden="true" /> All sectors
              </Link>
              <h1 className="marketplace-sector-title" ref={heading} tabIndex={-1}>
                {sector || 'Search Marketplace'}
              </h1>
              <Breadcrumb current={sector || 'Business directory'} />
              <label className="search-input">
                <Search size={20} aria-hidden="true" />
                <span className="sr-only">
                  {sector ? `Search ${sector} listings` : 'Search listings'}
                </span>
                <input
                  type="search"
                  placeholder={sector ? `Search ${sector} listings` : 'Search listings'}
                  value={query}
                  onChange={(event) => {
                    const next = new URLSearchParams(params);
                    next.set('q', event.target.value);
                    setParams(next, { replace: true });
                  }}
                />
              </label>
              <p className="result-count" role="status">
                {listingCount(results.length)}
              </p>
              {results.length ? (
                <div className="content-grid">
                  {results.map((item) => (
                    <ContentCard key={item.id} item={item} />
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <h2>No matching listings</h2>
                  <p>Try a different search or explore another sector.</p>
                </div>
              )}
              {!!otherSectors.length && (
                <nav className="marketplace-other-sectors" aria-labelledby="other-sectors-title">
                  <h2 id="other-sectors-title">Explore other sectors</h2>
                  <ul className="marketplace-sector-links">
                    {otherSectors.map(([name, listings]) => (
                      <li key={name}>
                        <Link to={businessSectorPath(name)}>
                          <span>
                            <strong>{name}</strong>
                            <small>{listingCount(listings.length)}</small>
                          </span>
                          <ArrowRight size={16} aria-hidden="true" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </nav>
              )}
            </>
          ) : sectors.length ? (
            <ul
              className="marketplace-sector-grid"
              aria-label="Marketplace sectors"
              ref={sectorGrid}
              tabIndex={-1}
            >
              {sectors.map(([name, listings]) => {
                const image = listings.find((item) => item.image)?.image;
                return (
                  <li key={name}>
                    <Link className="marketplace-sector-card" to={businessSectorPath(name)}>
                      <span className="marketplace-sector-image" aria-hidden="true">
                        {image ? <img src={image} alt="" loading="lazy" /> : <Store size={36} />}
                      </span>
                      <span className="marketplace-sector-copy">
                        <span>
                          <strong>{name}</strong>
                          <small>{listingCount(listings.length)}</small>
                        </span>
                        <ArrowRight size={19} aria-hidden="true" />
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="empty-state">
              Marketplace listings will appear here when they are published.
            </p>
          )}
        </div>
        {hasAds && (
          <aside className="discovery-sidebar" aria-label="Marketplace sidebar">
            <AdvertisementsWidget />
          </aside>
        )}
      </section>
    </>
  );
}
