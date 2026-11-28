import { MobileNavigationDrawer } from './MobileNavigationDrawer';
import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  Globe,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  Search,
  UserCircle,
  X,
} from 'lucide-react';
import { type NavigationItem } from '../config/navigation';
import { laravelModeEnabled } from '../config/laravel';
import { displayRoleLabel, roleLabels } from '../domain/roles';
import { useCatalog } from '../app/useCatalog';
import { useDemo } from '../app/useDemo';
import { useLaravelSession } from '../app/useLaravelSession';
import { preloadAccountRoute } from '../app/route-preload';
import { AccountLink } from '../features/accounts/AccountLink';
import { LaravelNotificationsLink } from '../features/accounts/LaravelNotifications';
import { BreadcrumbBar } from '../shared/Breadcrumb';
import { SmartImage } from '../shared/SmartImage';
import { SiteThemeSwitch } from './SiteThemeSwitch';

function NavigationBranch({ item, depth = 0 }: { item: NavigationItem; depth?: number }) {
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  const location = useLocation();

  useEffect(() => setOpen(false), [location.pathname, location.search, location.hash]);
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

function accountInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'Y';
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function Header({
  dashboardMenu,
}: {
  dashboardMenu?: { expanded: boolean; onOpen: () => void; notifications: ReactNode };
}) {
  const { media, site } = useCatalog();
  const navigation = site.navigation;
  const { account: demoAccount, enabled, execute } = useDemo();
  const session = useLaravelSession();
  const account = session ? session.profile : demoAccount;
  const accountHref =
    account?.role === 'guest' && !session?.profile?.staff.length ? '/account' : '/dashboard';
  const signingOut = Boolean(session?.signingOut);
  const avatarUrl = session?.profile?.avatar ?? null;
  const [open, setOpen] = useState(false);
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const [avatarImageFailed, setAvatarImageFailed] = useState(false);
  const [navigatingAccount, setNavigatingAccount] = useState(false);
  const navAttemptRef = useRef(0);
  const avatarMenuRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const toggle = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setAvatarImageFailed(false);
  }, [avatarUrl]);

  // Close drawer and avatar menu on route change
  useEffect(() => {
    setOpen(false);
    setAvatarMenuOpen(false);
  }, [location.pathname, location.search, location.hash, account?.id, account?.role]);

  // Close avatar dropdown on outside click or Escape
  useEffect(() => {
    if (!avatarMenuOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!avatarMenuRef.current?.contains(event.target as Node)) {
        setAvatarMenuOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setAvatarMenuOpen(false);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [avatarMenuOpen]);

  // Clear pending navbar navigation state on route change or sign-out transitions
  useEffect(() => {
    navAttemptRef.current += 1;
    setNavigatingAccount(false);
    return () => {
      navAttemptRef.current += 1;
    };
  }, [location.pathname, location.search, location.key, account?.id, signingOut]);

  // Idle-preload heavy account/dashboard route bundle when signed in
  useEffect(() => {
    if (!account || typeof window === 'undefined') return;
    const preload = () => void preloadAccountRoute(Boolean(session));
    const win = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    if (typeof win.requestIdleCallback === 'function') {
      const id = win.requestIdleCallback(preload, { timeout: 1200 });
      return () => win.cancelIdleCallback?.(id);
    }
    const timer = window.setTimeout(preload, 350);
    return () => window.clearTimeout(timer);
  }, [account, session]);

  function openAccountRoute(targetPath: string, event?: MouseEvent<HTMLAnchorElement>) {
    if (
      event &&
      (event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey)
    ) {
      return;
    }
    if (signingOut || navigatingAccount) {
      event?.preventDefault();
      return;
    }
    setAvatarMenuOpen(false);
    const alreadyAtTarget =
      location.pathname.replace(/\/$/, '') === targetPath && !location.search;
    if (alreadyAtTarget) {
      event?.preventDefault();
      document.getElementById('main-content')?.scrollTo({ top: 0, behavior: 'smooth' });
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    event?.preventDefault();
    setNavigatingAccount(true);
    const attempt = ++navAttemptRef.current;
    void preloadAccountRoute(Boolean(session)).finally(() => {
      if (navAttemptRef.current !== attempt) return;
      navigate(targetPath);
    });
  }

  const announcement = site.announcement;
  const showAnnouncement = Boolean(
    !dashboardMenu && announcement?.enabled && announcement.text?.trim(),
  );
  const announcementLink = announcement?.linkHref?.trim() || '';

  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>

      {showAnnouncement && announcement && (
        <div className="site-announcement-bar" role="region" aria-label="Site announcement">
          <div className="container site-announcement-inner">
            <span>{announcement.text}</span>
            {announcement.linkLabel?.trim() &&
              announcementLink &&
              (/^https?:\/\//i.test(announcementLink) ? (
                <a href={announcementLink} target="_blank" rel="noreferrer">
                  {announcement.linkLabel}
                </a>
              ) : (
                <Link to={announcementLink}>{announcement.linkLabel}</Link>
              ))}
          </div>
        </div>
      )}

      {/* Demo account top strip */}
      {!session && enabled && demoAccount && (
        <div className="demo-session-strip">
          <div className="container demo-strip-inner">
            <span>
              DEVELOPMENT DEMO · {demoAccount.name} · {roleLabels[demoAccount.role]}
            </span>
            <div className="demo-strip-links">
              <Link to="/demo">Switch demo role</Link>
              <Link to={accountHref}>
                {demoAccount.role === 'guest' ? 'Account' : 'My workspace'}
              </Link>
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

      <div className={dashboardMenu ? 'dashboard-navigation-frame' : 'site-navigation-frame'}>
        <header className="site-header reference-header">
          <div className="container header-inner">
            <Link className="reference-brand" to="/" aria-label="YERH home">
              <SmartImage
                src={media.wordmark}
                alt="Youth Entrepreneurship Resource Hub — YERH Kenya"
                priority
                width={197}
                height={40}
              />
            </Link>

            <nav className="desktop-tree" aria-label="Main navigation">
              <ul>
                {navigation.map((item) => (
                  <NavigationBranch key={item.id} item={item} />
                ))}
              </ul>
            </nav>

            <div className="header-actions">
              <SiteThemeSwitch />
              {dashboardMenu ? (
                dashboardMenu.notifications
              ) : session?.profile?.email_verified &&
                (session.profile.role !== 'guest' || session.profile.staff.length > 0) ? (
                <LaravelNotificationsLink key={session.profile.id} />
              ) : (
                <Link to="/search" className="icon-button" aria-label="Search the hub">
                  <Search size={19} aria-hidden="true" />
                </Link>
              )}

              {account ? (
                <div className="header-avatar-dropdown" ref={avatarMenuRef}>
                  <button
                    type="button"
                    className={`header-avatar-trigger${navigatingAccount ? ' is-busy' : ''}`}
                    aria-haspopup="menu"
                    aria-expanded={avatarMenuOpen}
                    aria-label={`${account.name} account menu`}
                    title={account.name}
                    onMouseEnter={() => void preloadAccountRoute(Boolean(session))}
                    onFocus={() => void preloadAccountRoute(Boolean(session))}
                    onClick={() => setAvatarMenuOpen((prev) => !prev)}
                  >
                    <span className="header-avatar-circle" aria-hidden="true">
                      {avatarUrl && !avatarImageFailed ? (
                        <img
                          src={avatarUrl}
                          alt=""
                          referrerPolicy="no-referrer"
                          onError={() => setAvatarImageFailed(true)}
                        />
                      ) : (
                        accountInitials(account.name)
                      )}
                    </span>
                    <ChevronDown
                      size={14}
                      className={`header-avatar-chevron${avatarMenuOpen ? ' is-open' : ''}`}
                      aria-hidden="true"
                    />
                  </button>

                  {avatarMenuOpen && (
                    <div className="header-avatar-menu" role="menu" aria-label="Account actions">
                      <div className="header-avatar-header">
                        <strong>{account.name}</strong>
                        <span>{session?.profile?.email || account.headline || ''}</span>
                        {account.role !== 'guest' && (
                          <span className="header-avatar-role">
                            {laravelModeEnabled
                              ? displayRoleLabel(account.role)
                              : roleLabels[account.role]}
                          </span>
                        )}
                      </div>

                      {accountHref === '/dashboard' ? (
                        <>
                          <Link
                            to="/dashboard"
                            role="menuitem"
                            className="header-avatar-item"
                            aria-disabled={navigatingAccount || signingOut || undefined}
                            onClick={(event) => openAccountRoute('/dashboard', event)}
                          >
                            {navigatingAccount ? (
                              <Loader2
                                size={16}
                                className="header-action-spinner"
                                aria-hidden="true"
                              />
                            ) : (
                              <LayoutDashboard size={16} aria-hidden="true" />
                            )}
                            <span>{navigatingAccount ? 'Opening…' : 'My Account'}</span>
                          </Link>

                          <Link
                            to="/dashboard/profile"
                            role="menuitem"
                            className="header-avatar-item"
                            onClick={(event) => openAccountRoute('/dashboard/profile', event)}
                          >
                            <UserCircle size={16} aria-hidden="true" />
                            <span>Profile &amp; security</span>
                          </Link>
                        </>
                      ) : (
                        <>
                          <Link
                            to="/account"
                            role="menuitem"
                            className="header-avatar-item"
                            aria-disabled={navigatingAccount || signingOut || undefined}
                            onClick={(event) => openAccountRoute('/account', event)}
                          >
                            {navigatingAccount ? (
                              <Loader2
                                size={16}
                                className="header-action-spinner"
                                aria-hidden="true"
                              />
                            ) : (
                              <UserCircle size={16} aria-hidden="true" />
                            )}
                            <span>{navigatingAccount ? 'Opening…' : 'Profile'}</span>
                          </Link>

                          <Link
                            to="/learn"
                            role="menuitem"
                            className="header-avatar-item"
                            onClick={(event) => openAccountRoute('/learn', event)}
                          >
                            <BookOpen size={16} aria-hidden="true" />
                            <span>Browse courses</span>
                          </Link>
                        </>
                      )}

                      <div className="header-avatar-divider" role="separator" />

                      <button
                        type="button"
                        role="menuitem"
                        className="header-avatar-item header-avatar-item--danger"
                        disabled={signingOut}
                        aria-busy={signingOut || undefined}
                        onClick={() => {
                          if (signingOut) return;
                          navAttemptRef.current += 1;
                          setNavigatingAccount(false);
                          setAvatarMenuOpen(false);
                          if (session) void session.signOut();
                          else execute({ type: 'logout' });
                        }}
                      >
                        {signingOut ? (
                          <Loader2 size={16} className="header-action-spinner" aria-hidden="true" />
                        ) : (
                          <LogOut size={16} aria-hidden="true" />
                        )}
                        <span>{signingOut ? 'Signing out…' : 'Sign out'}</span>
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <AccountLink className="header-login">LOGIN</AccountLink>
                  <AccountLink className="button button-gold button-small" mode="register">
                    REGISTER
                  </AccountLink>
                </>
              )}

              <button
                ref={toggle}
                type="button"
                className="menu-toggle icon-button"
                aria-label={
                  dashboardMenu
                    ? 'Open site menu'
                    : open
                      ? 'Close navigation drawer'
                      : 'Open navigation drawer'
                }
                aria-haspopup="dialog"
                aria-expanded={open}
                aria-controls="feiso-mobile-drawer"
                title={dashboardMenu ? 'Site menu' : undefined}
                onClick={() => setOpen((v) => !v)}
              >
                {dashboardMenu ? (
                  <Globe size={21} aria-hidden="true" />
                ) : open ? (
                  <X size={24} aria-hidden="true" />
                ) : (
                  <Menu size={24} aria-hidden="true" />
                )}
              </button>
              {dashboardMenu && (
                <button
                  className="menu-toggle icon-button"
                  type="button"
                  aria-label="Open dashboard menu"
                  aria-haspopup="dialog"
                  aria-controls="dashboard-menu"
                  aria-expanded={dashboardMenu.expanded}
                  onClick={dashboardMenu.onOpen}
                >
                  <Menu size={24} aria-hidden="true" />
                </button>
              )}
            </div>
          </div>
          {(navigatingAccount || signingOut) && (
            <div
              className="header-progress-bar"
              role="progressbar"
              aria-label={signingOut ? 'Signing out' : 'Opening your account'}
            />
          )}
        </header>
        {!dashboardMenu && (
          <BreadcrumbBar
            home={
              location.pathname.startsWith('/learn/') && account?.role === 'entrepreneur'
                ? '/dashboard'
                : undefined
            }
          />
        )}
      </div>

      <MobileNavigationDrawer open={open} setOpen={setOpen} toggle={toggle} />
    </>
  );
}
