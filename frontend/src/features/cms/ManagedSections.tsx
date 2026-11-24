import { useLocation } from 'react-router-dom';
import { useCatalog } from '../../app/useCatalog';
import { lookupManagedPage } from '../platform/server/cms/cms-page-registry';
export function ManagedSections() {
  const { pathname } = useLocation();
  const { site } = useCatalog();
  const page = lookupManagedPage(site.pages, pathname);
  if (!page?.sections.length) return null;
  return (
    <section className="container section managed-sections">
      {page.sections.map((s, index) => (
        <article className="profile-panel" key={index}>
          <h2>{s.title}</h2>
          <p style={{ whiteSpace: 'pre-line' }}>{s.body}</p>
        </article>
      ))}
    </section>
  );
}
