import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useContext, useEffect } from 'react';
import {
  BreadcrumbPageContext,
  BreadcrumbRegistrationContext,
  type BreadcrumbLink,
} from './BreadcrumbProvider';

export function Breadcrumb({ current, parents }: { current: string; parents?: BreadcrumbLink[] }) {
  const register = useContext(BreadcrumbRegistrationContext);
  useEffect(() => register?.({ label: current, parents }), [register, current, parents]);
  return register ? null : <BreadcrumbTrail current={current} parents={parents} />;
}

export function BreadcrumbBar() {
  const page = useContext(BreadcrumbPageContext);
  const current = page?.details?.label ?? page?.title;
  if (!page || !current || page.pathname === '/') return null;
  return (
    <BreadcrumbTrail
      current={current}
      parents={page.previous ? [page.previous] : page.details?.parents}
    />
  );
}

function BreadcrumbTrail({
  current,
  parents = [],
}: {
  current: string;
  parents?: BreadcrumbLink[];
}) {
  return (
    <nav className="breadcrumb" aria-label="Breadcrumb">
      <ol className="container">
        <li>
          <Link to="/">Home</Link>
        </li>
        {parents.map(({ label, to }) => (
          <li key={to}>
            <ChevronRight size={14} aria-hidden="true" />
            <Link to={to} title={label}>
              <span className="breadcrumb-label">{label}</span>
            </Link>
          </li>
        ))}
        <li>
          <ChevronRight size={14} aria-hidden="true" />
          <span className="breadcrumb-label" aria-current="page" title={current}>
            {current}
          </span>
        </li>
      </ol>
    </nav>
  );
}
