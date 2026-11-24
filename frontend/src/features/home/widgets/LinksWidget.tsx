import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useCatalog } from '../../../app/useCatalog';
import { resolveImportantLinkMode } from '../../../domain/hub';

export function LinksWidget() {
  const { homepage } = useCatalog();
  return (
    <>
      {/* 2. Important Links */}
      <section className="sidebar-widget widget-important-links">
        <h3 className="sidebar-heading">Important Links</h3>
        <ul className="important-links-list">
          {homepage.importantLinks.map((link, index) => {
            const mode = resolveImportantLinkMode(link);
            return (
              <li key={`${link.href}-${index}`}>
                {mode === 'same-page-internal' ? (
                  <Link to={link.href} className="important-link-item">
                    <span>{link.label}</span>
                    <ChevronRight size={16} className="link-arrow" />
                  </Link>
                ) : mode === 'same-page-external' ? (
                  <a href={link.href} className="important-link-item">
                    <span>{link.label}</span>
                    <ChevronRight size={16} className="link-arrow" />
                  </a>
                ) : (
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="important-link-item"
                  >
                    <span>{link.label}</span>
                    <ChevronRight size={16} className="link-arrow" />
                  </a>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}
