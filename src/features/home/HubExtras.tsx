import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { useCatalog } from '../../app/useCatalog';
export function HubExtras() {
  const { homepage } = useCatalog();
  return (
    <section className="container hub-extras">
      <div>
        <p className="eyebrow">IMPORTANT LINKS</p>
        <h2>A wider world of support.</h2>
      </div>
      <div>
        {homepage.importantLinks.map((link) => (
          <a key={link.href} href={link.href} target="_blank" rel="noreferrer">
            {link.label}
            <ArrowUpRight size={15} />
          </a>
        ))}
      </div>
      <Link className="hub-network-link" to="/network">
        Meet the YERH network →
      </Link>
    </section>
  );
}
