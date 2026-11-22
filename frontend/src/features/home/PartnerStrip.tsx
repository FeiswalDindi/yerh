import { useCatalog } from '../../app/useCatalog';
export function PartnerStrip() {
  const { media } = useCatalog();
  return (
    <section className="partner-strip container" aria-label="Our partners">
      <div>
        <span className="eyebrow">STRONGER TOGETHER</span>
        <p>Powered by partnership.</p>
      </div>
      <div className="partner-logos">
        {media.partners.map((partner) => (
          <a key={partner.name} href={partner.url} target="_blank" rel="noreferrer">
            <img src={partner.image} alt={partner.name} loading="lazy" />
          </a>
        ))}
      </div>
    </section>
  );
}
