import { useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useCatalog } from '../app/useCatalog';
import { Breadcrumb } from './Breadcrumb';
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
  const override = site.pages[pathname];
  title = override?.title ?? title;
  description = override?.description ?? description;
  return (
    <header className={className ? `page-intro ${className}` : 'page-intro'}>
      {media}
      <div className="container">
        <Breadcrumb current={override?.eyebrow ?? eyebrow} />
        <h1>{title}</h1>
        <p className="intro-description">{description}</p>
      </div>
    </header>
  );
}
