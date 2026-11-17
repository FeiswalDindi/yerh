import { ArrowRight, type LucideIcon } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { dashboardCatalogueItemPath, type DashboardCatalogueKind } from './catalogue-paths';

export type CatalogueEntry = {
  id: string;
  title: string;
  summary: string;
  category: string;
  image?: string | null;
  details?: string;
  status?: string;
  progress?: { done: number; total: number };
};

export function DashboardCatalogueCards({
  items,
  kind,
  icon: Icon,
}: {
  items: CatalogueEntry[];
  kind: DashboardCatalogueKind;
  icon: LucideIcon;
}) {
  const { search } = useLocation();
  const Heading = kind === 'events' ? 'h3' : 'h2';
  return (
    <div className="dashboard-entry-grid">
      {items.map((item) => (
        <Link
          className="dashboard-entry-card"
          key={item.id}
          to={dashboardCatalogueItemPath(kind, item.id, search)}
        >
          {item.image ? (
            <img src={item.image} alt="" loading="lazy" />
          ) : (
            <Icon size={22} className="dashboard-entry-icon" aria-hidden="true" />
          )}
          <div>
            <p className="dashboard-entry-category">{item.category}</p>
            <Heading>{item.title}</Heading>
            <p className="dashboard-entry-summary">{item.summary}</p>
            {item.details && <small>{item.details}</small>}
            {item.progress && (
              <progress
                aria-label={`Progress in ${item.title}`}
                value={item.progress.done}
                max={item.progress.total}
              />
            )}
            {item.status && <span className="status-pill">{item.status}</span>}
          </div>
          <ArrowRight size={16} className="dashboard-entry-arrow" aria-hidden="true" />
        </Link>
      ))}
    </div>
  );
}
