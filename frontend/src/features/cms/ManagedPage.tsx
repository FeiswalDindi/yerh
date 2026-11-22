import { useLocation } from 'react-router-dom';
import { useCatalog } from '../../app/useCatalog';
import { PageIntro } from '../../shared/PageIntro';
import { NotFoundPage } from '../info/NotFoundPage';
import { usePageTitle } from '../../shared/usePageTitle';
export function ManagedPage() {
  const { pathname } = useLocation();
  const { site } = useCatalog();
  const page = site.pages[pathname];
  usePageTitle(page?.title ?? 'Page not found');
  return page ? (
    <PageIntro title={page.title} description={page.description} eyebrow={page.eyebrow} />
  ) : (
    <NotFoundPage />
  );
}
