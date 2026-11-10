import { useLocation } from 'react-router-dom';
import { useCatalog } from '../../app/useCatalog';
export function ManagedSections() {
  const { pathname } = useLocation();
  const { site } = useCatalog();
  const page = site.pages[pathname];
  if (!page?.sections.length) return null;
  return (
    <section className="container section managed-sections">
      {page.sections.map((s, index) => (
        <article className="profile-panel" key={index}>
          <h2>{s.title}</h2>
          <p>{s.body}</p>
        </article>
      ))}
    </section>
  );
}
