import { ArrowUpRight, Megaphone } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useCatalog } from '../../app/useCatalog';
import { SmartImage } from '../../shared/SmartImage';

export function AdvertisementsWidget() {
  const { sidebar } = useCatalog();
  if (!sidebar.advertisements.length) return null;

  return (
    <section className="discovery-widget" aria-label="Advertisements">
      <h2>
        <span aria-hidden="true">
          <Megaphone size={18} />
        </span>
        Advertisements
      </h2>
      {sidebar.advertisements.map((ad) => (
        <div className="discovery-ad" key={ad.id}>
          {ad.image && (
            <SmartImage src={ad.image} alt={ad.imageAlt} targetWidth={320} sizes="120px" />
          )}
          <div>
            <span className="discovery-category">Hub promotion</span>
            <h3>{ad.title}</h3>
            <p>{ad.text}</p>
            <Link className="button button-gold" to={ad.href}>
              {ad.action}
              <ArrowUpRight size={15} aria-hidden="true" />
            </Link>
          </div>
        </div>
      ))}
    </section>
  );
}
