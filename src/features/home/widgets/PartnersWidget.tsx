import { useCatalog } from '../../../app/useCatalog';
export function PartnersWidget() {
  const { media } = useCatalog();
  const partners = media.partners;
  return (
    <>
      {/* 3. Our Partners - Infinite Marquee */}
      <section className="sidebar-widget widget-our-partners" aria-label="Our Partners">
        <h3 className="sidebar-heading">Our Partners</h3>
        <div className="partner-marquee-container">
          <div className="partner-marquee-track">
            {/* First set of partners */}
            {partners.map((p, idx) => (
              <a
                key={`p1-${p.name}-${idx}`}
                href={p.url}
                target="_blank"
                rel="noreferrer"
                className="partner-card"
                title={p.name}
              >
                <img src={p.image} alt={p.name} loading="lazy" />
              </a>
            ))}
            {/* Duplicate set for seamless continuous marquee loop */}
            {partners.map((p, idx) => (
              <a
                key={`p2-${p.name}-${idx}`}
                aria-hidden="true"
                tabIndex={-1}
                href={p.url}
                target="_blank"
                rel="noreferrer"
                className="partner-card"
                title={p.name}
              >
                <img src={p.image} alt={p.name} loading="lazy" />
              </a>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
