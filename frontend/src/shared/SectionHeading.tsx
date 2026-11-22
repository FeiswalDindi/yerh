import { ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
export function SectionHeading({
  eyebrow,
  title,
  link,
  label = 'View all',
}: {
  eyebrow?: string;
  title: string;
  link?: string;
  label?: string;
}) {
  return (
    <div className="section-heading">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h2>{title}</h2>
      </div>
      {link && (
        <Link className="text-link" to={link}>
          {label}
          <ArrowUpRight size={17} />
        </Link>
      )}
    </div>
  );
}
