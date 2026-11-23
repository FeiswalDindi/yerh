import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowUpRight, LogOut } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { Header } from '../../../layout/Header';
import { BreadcrumbTrail } from '../../../shared/Breadcrumb';
import { CloseButton } from '../../../shared/CloseButton';
import { CookieConsentModal } from '../../privacy/CookieConsentModal';
import { LaravelNotificationsLink } from '../../accounts/LaravelNotifications';
import '../../dashboard/dashboard.css';

export type NavigationGroup = { label: string; links: { label: string; to: string }[] };

function activeRoute(pathname: string, search: string, href: string) {
  const [path, query = ''] = href.split('?');
  if (pathname.replace(/\/$/, '') !== path) return false;
  const params = new URLSearchParams(search);
  return [...new URLSearchParams(query)].every(([key, value]) => params.get(key) === value);
}

export function LaravelDashboardFrame({
  groups,
  badges,
  title,
  role,
  accountId,
  signOut,
  children,
  record,
}: {
  groups: NavigationGroup[];
  badges: Record<string, number>;
  title: string;
  role: string;
  accountId: number;
  signOut: () => Promise<void>;
  children: ReactNode;
  record?: string;
}) {
  const { pathname, search } = useLocation();
  const shell = useRef<HTMLDivElement>(null);
  const drawer = useRef<HTMLDialogElement>(null);
  const main = useRef<HTMLElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    drawer.current?.close();
    main.current?.scrollTo({ top: 0 });
    main.current?.focus({ preventScroll: true });
  }, [pathname, title, record]);

  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 1001px)');
    const close = (event: MediaQueryListEvent) => {
      if (event.matches) drawer.current?.close();
    };
    desktop.addEventListener('change', close);
    return () => desktop.removeEventListener('change', close);
  }, []);

  useLayoutEffect(() => {
    const root = shell.current;
    const header = root?.querySelector('.dashboard-navigation-frame');
    if (!root || !header) return;
    const resize = () =>
      root.style.setProperty(
        '--dashboard-navbar-height',
        header.getBoundingClientRect().height + 'px',
      );
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(header);
    return () => observer.disconnect();
  }, []);
  function navigation() {
    return (
      <nav className="role-nav" aria-label="Dashboard navigation">
        {groups.map((group) => (
          <div className="role-nav-group" key={group.label}>
            <p>{group.label}</p>
            <ul>
              {group.links.map((link) => (
                <li key={link.to}>
                  <Link
                    to={link.to}
                    aria-current={
                      activeRoute(pathname, search, link.to) &&
                      !group.links.some(
                        (other) =>
                          other.to.length > link.to.length &&
                          activeRoute(pathname, search, other.to),
                      )
                        ? 'page'
                        : undefined
                    }
                    onClick={() => drawer.current?.close()}
                  >
                    {link.label}
                    {!!badges[link.to] && (
                      <span
                        className="dashboard-nav-badge"
                        aria-label={badges[link.to] + ' pending'}
                      >
                        {badges[link.to]}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    );
  }

  return (
    <div className="dashboard-shell" ref={shell}>
      <Header
        dashboardMenu={{
          expanded: open,
          onOpen: () => {
            drawer.current?.showModal();
            setOpen(true);
          },
          notifications: <LaravelNotificationsLink key={accountId} />,
        }}
      />
      <div className="dashboard-body">
        <aside className="dashboard-sidebar">
          {navigation()}
          <Link className="dashboard-visit" to="/">
            Visit website <ArrowUpRight size={15} aria-hidden="true" />
          </Link>
        </aside>
        <main id="main-content" className="dashboard-content" ref={main} tabIndex={-1}>
          <BreadcrumbTrail
            current={record ? 'Manage institution' : title}
            parents={
              record
                ? [{ label: 'Institution directory', to: '/dashboard/workspace?tab=institutions' }]
                : undefined
            }
          />
          <div className="server-workspace-content">{children}</div>
        </main>
      </div>
      <dialog
        ref={drawer}
        id="dashboard-menu"
        className="dashboard-drawer"
        aria-labelledby="dashboard-menu-title"
        onClose={() => setOpen(false)}
        onClick={(event) => {
          if (event.target === event.currentTarget) event.currentTarget.close();
        }}
      >
        <div className="dashboard-drawer-inner">
          <header className="dashboard-drawer-header">
            <div>
              <h2 id="dashboard-menu-title">Dashboard menu</h2>
              <p>{role}</p>
            </div>
            <CloseButton
              className="icon-button"
              aria-label="Close dashboard menu"
              onClick={() => drawer.current?.close()}
            />
          </header>
          {navigation()}
          <Link className="dashboard-visit" to="/" onClick={() => drawer.current?.close()}>
            Visit website <ArrowUpRight size={15} aria-hidden="true" />
          </Link>
          <button
            className="dashboard-visit"
            type="button"
            onClick={() => {
              drawer.current?.close();
              void signOut();
            }}
          >
            <LogOut size={17} aria-hidden="true" /> Sign out
          </button>
        </div>
      </dialog>
      <CookieConsentModal />
    </div>
  );
}
