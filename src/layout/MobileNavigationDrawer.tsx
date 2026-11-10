import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import { Link, NavLink, useLocation } from 'react-router-dom';
import {
  Bookmark,
  ChevronDown,
  LayoutDashboard,
  LogOut,
  Mail,
  Phone,
  UserCircle,
  X,
} from 'lucide-react';
import { WhatsAppIcon } from '../shared/WhatsAppIcon';
import { useCatalog } from '../app/useCatalog';
import { roleLabels } from '../domain/roles';
import { useDemo } from '../app/useDemo';
export function MobileNavigationDrawer({
  open,
  setOpen,
  toggle,
}: {
  open: boolean;
  setOpen: Dispatch<SetStateAction<boolean>>;
  toggle: RefObject<HTMLButtonElement | null>;
}) {
  const { account, execute } = useDemo();
  const { site } = useCatalog();
  const navigation = site.navigation;
  const socialLinks = Object.fromEntries(site.socials.map((s) => [s.label.toLowerCase(), s.href]));
  const drawer = useRef<HTMLElement>(null);
  const [expandedMobileMenu, setExpandedMobileMenu] = useState<string | null>(null);
  const location = useLocation();
  useEffect(() => {
    setExpandedMobileMenu(null);
  }, [location.pathname, location.search]);
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const previousFocus = document.activeElement as HTMLElement | null;
    drawer.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        return;
      }
      if (event.key !== 'Tab') return;
      const nodes = Array.from(
        drawer.current?.querySelectorAll<HTMLElement>(
          'a[href],button:not([disabled]),input,[tabindex="0"]',
        ) ?? [],
      ).filter((node) => node.getClientRects().length > 0);
      const first = nodes[0],
        last = nodes.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener('keydown', keydown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', keydown);
      previousFocus?.focus();
    };
  }, [open]);

  const toggleSubmenu = (title: string) => {
    setExpandedMobileMenu((curr) => (curr === title ? null : title));
  };

  return (
    <>
      {/* Feiso-style Mobile Navigation Drawer rendered in portal to prevent any clipping */}
      {typeof document !== 'undefined' &&
        createPortal(
          <>
            {open && (
              <div
                className="feiso-drawer-backdrop"
                onClick={() => setOpen(false)}
                aria-hidden="true"
              />
            )}
            <aside
              ref={drawer}
              inert={!open}
              aria-hidden={!open}
              id="feiso-mobile-drawer"
              className={`feiso-mobile-drawer ${open ? 'open' : ''}`}
              role="dialog"
              aria-label="Mobile navigation"
              aria-modal={open ? true : undefined}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setOpen(false);
                  toggle.current?.focus();
                }
              }}
            >
              <div className="feiso-drawer-inner">
                {/* Drawer Top Header with Close (No YERH NAVIGATION text) */}
                <div className="feiso-drawer-header">
                  <button
                    type="button"
                    className="feiso-drawer-close-btn"
                    aria-label="Close menu"
                    onClick={() => setOpen(false)}
                  >
                    <X size={26} />
                  </button>
                </div>

                {/* Feiso Account Identity Card */}
                <div className="feiso-account-card">
                  {account ? (
                    <>
                      <div className="feiso-account-profile">
                        <div className="feiso-account-avatar">
                          {account.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="feiso-account-details">
                          <p className="feiso-account-name">{account.name}</p>
                          <p className="feiso-account-email">{account.headline}</p>
                        </div>
                      </div>
                      <div className="feiso-account-role-badge">{roleLabels[account.role]}</div>
                      <div className="feiso-account-actions">
                        <Link
                          to="/dashboard"
                          onClick={() => setOpen(false)}
                          className="button button-gold feiso-dashboard-btn"
                        >
                          <LayoutDashboard size={16} />
                          My Workspace
                        </Link>
                        <div className="feiso-account-row-btns">
                          <Link
                            to="/profile"
                            onClick={() => setOpen(false)}
                            className="feiso-sub-btn"
                          >
                            <UserCircle size={15} />
                            Profile
                          </Link>
                          <button
                            type="button"
                            onClick={() => {
                              execute({ type: 'logout' });
                              setOpen(false);
                            }}
                            className="feiso-sub-btn feiso-signout-btn"
                          >
                            <LogOut size={15} />
                            Sign Out
                          </button>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="feiso-guest-card">
                      <p className="feiso-guest-msg">
                        Sign in to reach your workspace, manage your drafts, and track learning
                        progress.
                      </p>
                      <div className="feiso-guest-btns">
                        <Link
                          to="/login"
                          onClick={() => setOpen(false)}
                          className="feiso-signin-btn"
                        >
                          <UserCircle size={16} />
                          Sign In
                        </Link>
                        <Link
                          to="/register"
                          onClick={() => setOpen(false)}
                          className="button button-gold feiso-join-btn"
                        >
                          Join Today
                        </Link>
                      </div>
                    </div>
                  )}
                </div>

                {/* Navigation Menu Accordions (Feiso style) */}
                <div className="feiso-menu-list">
                  {navigation.map((item) => {
                    const hasChildren = Boolean(item.children && item.children.length > 0);
                    const isExpanded = expandedMobileMenu === item.id;

                    if (!hasChildren) {
                      return (
                        <div key={item.id} className="feiso-menu-item">
                          <NavLink
                            to={item.href}
                            onClick={() => setOpen(false)}
                            className="feiso-menu-link"
                          >
                            {item.label}
                          </NavLink>
                        </div>
                      );
                    }

                    return (
                      <div key={item.id} className="feiso-menu-item">
                        <button
                          type="button"
                          className="feiso-accordion-trigger"
                          onClick={() => toggleSubmenu(item.id)}
                          aria-expanded={isExpanded}
                        >
                          <span>{item.label}</span>
                          <ChevronDown
                            size={18}
                            className={`feiso-chevron ${isExpanded ? 'rotated' : ''}`}
                          />
                        </button>
                        {isExpanded && (
                          <div className="feiso-accordion-panel">
                            <NavLink
                              to={item.href}
                              end={item.href === '/'}
                              onClick={() => setOpen(false)}
                              className="feiso-sublink feiso-parent-link"
                            >
                              Overview: {item.label}
                            </NavLink>
                            {item.children?.map((child) => (
                              <div key={child.id} className="feiso-subitem-group">
                                <NavLink
                                  to={child.href}
                                  onClick={() => setOpen(false)}
                                  className="feiso-sublink"
                                >
                                  {child.label}
                                </NavLink>
                                {child.children && (
                                  <div className="feiso-nested-children">
                                    {child.children.map((nested) => (
                                      <NavLink
                                        key={nested.id}
                                        to={nested.href}
                                        onClick={() => setOpen(false)}
                                        className="feiso-nested-link"
                                      >
                                        {nested.label}
                                      </NavLink>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  <div className="feiso-menu-item">
                    <Link
                      to="/saved"
                      onClick={() => setOpen(false)}
                      className="feiso-menu-link feiso-saved-link"
                    >
                      <Bookmark size={18} />
                      Saved Resources
                    </Link>
                  </div>
                </div>

                {/* Quick Action Button */}
                <div className="feiso-cta-wrapper">
                  <Link
                    to="/register"
                    onClick={() => setOpen(false)}
                    className="button button-gold feiso-cta-button"
                  >
                    Apply for Access
                  </Link>
                </div>

                {/* Bottom Quick Contact Icons (WhatsApp Support) */}
                <div className="feiso-drawer-footer">
                  <a
                    href={socialLinks.whatsapp}
                    target="_blank"
                    rel="noreferrer"
                    className="feiso-wa-pill"
                    title="Chat with YERH on WhatsApp"
                  >
                    <div className="feiso-wa-icon-box">
                      <WhatsAppIcon size={20} />
                    </div>
                    <div className="feiso-wa-text">
                      <span className="feiso-wa-label">WhatsApp Support</span>
                      <span className="feiso-wa-number">+254 768 980 297</span>
                    </div>
                  </a>

                  <div className="feiso-contact-quick-links">
                    <a href={`tel:${site.contact.phone}`} className="feiso-contact-item">
                      <Phone size={15} />
                      <span>Call Us</span>
                    </a>
                    <a href={`mailto:${site.contact.email}`} className="feiso-contact-item">
                      <Mail size={15} />
                      <span>Email</span>
                    </a>
                  </div>
                </div>
              </div>
            </aside>
          </>,
          document.body,
        )}
    </>
  );
}
