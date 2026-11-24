import { useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useCatalog } from '../app/useCatalog';
import { lookupManagedPage } from '../features/platform/server/cms/cms-page-registry';
import { Breadcrumb } from './Breadcrumb';
import { SmartImage } from './SmartImage';
export function PageIntro({
  eyebrow,
  title,
  description,
  className,
  media,
}: {
  eyebrow: string;
  title: string;
  description: string;
  className?: string;
  media?: ReactNode;
}) {
  const { site } = useCatalog();
  const { pathname } = useLocation();
  const override = lookupManagedPage(site.pages, pathname);
  title = override?.title ?? title;
  description = override?.description ?? description;
  const heroImage = override?.heroImage?.trim() || '';
  const heroImageAlt = override?.heroImageAlt?.trim() || '';
  const heroOverlay = override?.heroOverlay ?? 'navy';
  const classes = [
    'page-intro',
    className,
    heroImage ? `has-hero-image hero-overlay-${heroOverlay}` : '',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <header className={classes}>
      {heroImage ? (
        <div className="page-intro-media" aria-hidden="true">
          <SmartImage
            src={heroImage}
            alt={heroImageAlt}
            priority
            targetWidth={1600}
            sizes="100vw"
          />
          <div className="page-intro-scrim" />
        </div>
      ) : (
        media
      )}
      <div className="container">
        <Breadcrumb current={override?.eyebrow ?? eyebrow} />
        <h1>{title}</h1>
        <p className="intro-description">{description}</p>
      </div>
    </header>
  );
}
