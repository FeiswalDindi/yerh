import { ChevronRight } from 'lucide-react';
import { useCatalog } from '../../../app/useCatalog';
export function LinksWidget() {
  const { homepage } = useCatalog();
  return (
    <>
      {/* 2. Important Links */}
      <section className="sidebar-widget widget-important-links">
        <h3 className="sidebar-heading">Important Links</h3>
        <ul className="important-links-list">
          {homepage.importantLinks.map((link) => (
            <li key={link.href}>
              <a href={link.href} target="_blank" rel="noreferrer" className="important-link-item">
                <span>{link.label}</span>
                <ChevronRight size={16} className="link-arrow" />
              </a>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
