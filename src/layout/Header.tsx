import { MobileNavigationDrawer } from './MobileNavigationDrawer';
import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { ChevronDown, ChevronRight, LogOut, Menu, Search, X } from 'lucide-react';
import { type NavigationItem } from '../config/navigation';
import { roleLabels } from '../domain/roles';
import { useCatalog } from '../app/useCatalog';
import { useDemo } from '../app/useDemo';

function NavigationBranch({ item, depth = 0 }: { item: NavigationItem; depth?: number }) {
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  const location = useLocation();

  useEffect(() => setOpen(false), [location.pathname, location.search]);
  const id = `desktop-${item.id}-children`;

  return (
    <li
      className={`nav-branch depth-${depth}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && open) {
          event.stopPropagation();
          setOpen(false);
          toggle.current?.focus();
        }
      }}
    >
      <div className="nav-entry">
        <NavLink to={item.href} end={item.href === '/'}>
          {item.label}
        </NavLink>
        {item.children && (
          <button
            ref={toggle}
            type="button"
            aria-label={`${item.label} submenu`}
            aria-expanded={open}
            aria-controls={id}
            onClick={(event) => setOpen((v) => (event.detail === 0 ? !v : true))}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                setOpen(true);
              }
            }}
          >
            {depth === 0 ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        )}
      </div>
      {item.children && (
        <ul id={id} className="nav-dropdown" hidden={!open}>
          {item.children.map((child) => (
            <NavigationBranch key={child.id} item={child} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}

export function Header() {
  const { media, site } = useCatalog();
  const navigation = site.navigation;
  const { account, enabled, execute } = useDemo();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const toggle = useRef<HTMLButtonElement>(null);

  // Close drawer on route change
  useEffect(() => {
    setOpen(false);
  }, [location.pathname, location.search]);

  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>

      {/* Demo account top strip */}
      {enabled && account && (
        <div className="demo-session-strip">
          <div className="container demo-strip-inner">
            <span>
              DEVELOPMENT DEMO · {account.name} · {roleLabels[account.role]}
            </span>
            <div className="demo-strip-links">
              <Link to="/dashboard">My workspace</Link>
              <button
                type="button"
                className="demo-strip-signout"
                onClick={() => execute({ type: 'logout' })}
                title="Sign out of demo account"
              >
                <LogOut size={13} />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      <header className="site-header reference-header">
        <div className="container header-inner">
          <Link className="reference-brand" to="/" aria-label="YERH home">
            <img src={media.wordmark} alt="Youth Entrepreneurship Resource Hub — YERH Kenya" />
          </Link>

          <nav className="desktop-tree" aria-label="Main navigation">
            <ul>
              {navigation.map((item) => (
                <NavigationBranch key={item.id} item={item} />
              ))}
            </ul>
          </nav>

          <div className="header-actions">
            <Link to="/search" className="icon-button" aria-label="Search the hub">
              <Search size={19} />
            </Link>

            {account ? (
              <>
                <Link className="header-login" to="/dashboard">
                  MY ACCOUNT
                </Link>
                <button
                  type="button"
                  className="button button-gold button-small header-signout-btn"
                  onClick={() => execute({ type: 'logout' })}
                  title="Sign out of demo account"
                >
                  SIGN OUT
                </button>
              </>
            ) : (
              <>
                <Link className="header-login" to="/login">
                  LOGIN
                </Link>
                <Link className="button button-gold button-small" to="/register">
                  REGISTER
                </Link>
              </>
            )}

            {/* Mobile Hamburger Menu Toggle Button */}
            <button
              ref={toggle}
              type="button"
              className="menu-toggle icon-button"
              aria-label={open ? 'Close navigation drawer' : 'Open navigation drawer'}
              aria-expanded={open}
              aria-controls="feiso-mobile-drawer"
              onClick={() => setOpen((v) => !v)}
            >
              {open ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </header>

      <MobileNavigationDrawer open={open} setOpen={setOpen} toggle={toggle} />
    </>
  );
}
