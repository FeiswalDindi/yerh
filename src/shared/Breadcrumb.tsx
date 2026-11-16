import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export function Breadcrumb({
  current,
  parents = [],
}: {
  current: string;
  parents?: { label: string; to: string }[];
}) {
  return (
    <nav className="breadcrumb" aria-label="Breadcrumb">
      <ol>
        <li>
          <Link to="/">Home</Link>
        </li>
        {parents.map(({ label, to }) => (
          <li key={to}>
            <ChevronRight size={14} aria-hidden="true" />
            <Link to={to}>{label}</Link>
          </li>
        ))}
        <li>
          <ChevronRight size={14} aria-hidden="true" />
          <span aria-current="page">{current}</span>
        </li>
      </ol>
    </nav>
  );
}
