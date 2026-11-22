import {
  useEffect,
  useId,
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
} from 'lucide-react';
import { WhatsAppIcon } from '../shared/WhatsAppIcon';
import { CloseButton } from '../shared/CloseButton';
import { useCatalog } from '../app/useCatalog';
import { roleLabels } from '../domain/roles';
import type { SiteNavigation } from '../domain/site';
import { useDemo } from '../app/useDemo';
import { AccountLink } from '../features/accounts/AccountLink';

function MobileNavigationList({
  items,
  onNavigate,
  parent,
}: {
  items: SiteNavigation[];
  onNavigate: () => void;
  parent?: SiteNavigation;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const listId = useId();
  const showOverview =
    parent &&
    !['resources', 'benefits'].includes(parent.id) &&
    !items.some((item) => item.href === parent.href);

  return (
    <ul className={`feiso-menu-entries ${parent ? '' : 'feiso-menu-root'}`}>
      {showOverview && (
        <li>
          <NavLink
            to={parent.href}
            end={parent.href === '/'}
            onClick={onNavigate}
            className="feiso-menu-link feiso-parent-link"
          >
            Overview: {parent.label}
          </NavLink>
        </li>
      )}
      {items.map((item) => {
        const isExpanded = expandedId === item.id;
        const panelId = `${listId}-${item.id}`;
        return (
          <li key={item.id}>
            {item.children?.length ? (
              <>
                <button
                  type="button"
                  className="feiso-accordion-trigger"
                  onClick={() => setExpandedId(isExpanded ? null : item.id)}
                  aria-expanded={isExpanded}
                  aria-controls={panelId}
                >
                  <span>{item.label}</span>
                  <ChevronDown size={18} className="feiso-chevron" aria-hidden="true" />
                </button>
                <div className="feiso-accordion-panel" id={panelId} hidden={!isExpanded}>
                  {isExpanded && (
                    <MobileNavigationList
                      items={item.children}
                      onNavigate={onNavigate}
                      parent={item}
                    />
                  )}
                </div>
              </>
            ) : (
              <NavLink to={item.href} onClick={onNavigate} className="feiso-menu-link">
                {item.label}
              </NavLink>
            )}
          </li>
        );
      })}
    </ul>
  );
}

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
  const location = useLocation();
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
              aria-label="Site navigation"
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
                  <CloseButton
                    className="feiso-drawer-close-btn"
                    aria-label="Close menu"
                    iconSize={26}
                    onClick={() => setOpen(false)}
                  />
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
                          to={account.role === 'guest' ? '/account' : '/dashboard'}
                          onClick={() => setOpen(false)}
                          className="button button-gold feiso-dashboard-btn"
                        >
                          <LayoutDashboard size={16} />
                          {account.role === 'guest' ? 'Account' : 'My Workspace'}
                        </Link>
                        <div className="feiso-account-row-btns">
                          {account.role !== 'guest' && (
                            <Link
                              to="/dashboard/profile"
                              onClick={() => setOpen(false)}
                              className="feiso-sub-btn"
                            >
                              <UserCircle size={15} />
                              Profile
                            </Link>
                          )}
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
                        <AccountLink onClick={() => setOpen(false)} className="feiso-signin-btn">
                          <UserCircle size={16} />
                          Sign In
                        </AccountLink>
                        <AccountLink
                          mode="register"
                          onClick={() => setOpen(false)}
                          className="button button-gold feiso-join-btn"
                        >
                          Join Today
                        </AccountLink>
                      </div>
                    </div>
                  )}
                </div>

                <nav className="feiso-menu-list" aria-label="Main navigation">
                  <MobileNavigationList
                    key={location.key}
                    items={navigation}
                    onNavigate={() => setOpen(false)}
                  />
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
                </nav>

                {/* Quick Action Button */}
                <div className="feiso-cta-wrapper">
                  <AccountLink
                    mode="register"
                    onClick={() => setOpen(false)}
                    className="button button-gold feiso-cta-button"
                  >
                    Apply for Access
                  </AccountLink>
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
