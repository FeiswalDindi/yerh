import { Link, useLocation } from 'react-router-dom';
import { useCatalog } from '../app/useCatalog';
export function PageIntro({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  const { site } = useCatalog();
  const { pathname } = useLocation();
  const override = site.pages[pathname];
  eyebrow = override?.eyebrow ?? eyebrow;
  title = override?.title ?? title;
  description = override?.description ?? description;
  return (
    <header className="page-intro">
      <div className="container">
        <div className="breadcrumb">
          <Link to="/">Home</Link>
          <span>/</span>
          <span>{eyebrow}</span>
        </div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="intro-description">{description}</p>
      </div>
    </header>
  );
}
