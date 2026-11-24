import type { Ref } from 'react';
import { ArrowRight, Store } from 'lucide-react';
import { Link } from 'react-router-dom';
import { businessSectorPath } from '../../domain/content';
import { SmartImage } from '../../shared/SmartImage';

export function MarketplaceSectorGrid({
  sectors,
  gridRef,
}: {
  sectors: { name: string; image?: string | null; count: number }[];
  gridRef?: Ref<HTMLUListElement>;
}) {
  return (
    <ul
      className="marketplace-sector-grid"
      aria-label="Marketplace sectors"
      ref={gridRef}
      tabIndex={-1}
    >
      {sectors.map(({ name, image, count }) => (
        <li key={name}>
          <Link className="marketplace-sector-card" to={businessSectorPath(name)}>
            <span className="marketplace-sector-image" aria-hidden="true">
              {image ? (
                <SmartImage
                  src={image}
                  alt=""
                  targetWidth={480}
                  sizes="(max-width: 900px) 50vw, 260px"
                />
              ) : (
                <Store size={36} />
              )}
            </span>
            <span className="marketplace-sector-copy">
              <span>
                <strong>{name}</strong>
                <small>
                  {count} {count === 1 ? 'listing' : 'listings'}
                </small>
              </span>
              <ArrowRight size={19} aria-hidden="true" />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
