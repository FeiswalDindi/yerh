import { ArrowRight, type LucideIcon } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { dashboardCatalogueItemPath, type DashboardCatalogueKind } from './catalogue-paths';
import { amount } from '../platform/incubation/TrainingForms';
import { CourseEntryLink } from '../resources/CourseEntryLink';

export type CatalogueEntry = {
  id: string;
  title: string;
  summary: string;
  category: string;
  image?: string | null;
  details?: string;
  price?: { price: number; discount: number };
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
      {items.map((item) => {
        const to = dashboardCatalogueItemPath(kind, item.id, search);
        const content = (
          <>
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
              {item.price && (
                <p className="dashboard-course-price">
                  {item.price.discount > 0 && (
                    <del aria-label="Original price">{amount(item.price.price)}</del>
                  )}{' '}
                  {item.price.price === item.price.discount
                    ? 'Free'
                    : amount(item.price.price - item.price.discount)}
                </p>
              )}
              {item.progress && (
                <progress
                  aria-label={`Progress in ${item.title}`}
                  value={item.progress.done}
                  max={item.progress.total}
                />
              )}
            </div>
            <ArrowRight size={16} className="dashboard-entry-arrow" aria-hidden="true" />
          </>
        );
        return kind === 'learning' ? (
          <CourseEntryLink
            key={item.id}
            courseId={item.id}
            courseName={item.title}
            className="dashboard-entry-card"
            to={to}
          >
            {content}
          </CourseEntryLink>
        ) : (
          <Link className="dashboard-entry-card" key={item.id} to={to}>
            {content}
          </Link>
        );
      })}
    </div>
  );
}
