import { Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowUpRight, LogOut } from 'lucide-react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useDemo } from '../../app/useDemo';
import { roleLabels } from '../../domain/roles';
import type { DemoAccount } from '../../domain/demo';
import { Header } from '../../layout/Header';
import { BreadcrumbBar } from '../../shared/Breadcrumb';
import { CloseButton } from '../../shared/CloseButton';
import { CookieConsentModal } from '../privacy/CookieConsentModal';
import { DashboardNotifications } from './DashboardNotifications';
import { dashboardCataloguePaths } from './catalogue-paths';
import {
  activeWorkspaceModule,
  cmsHref,
  cmsModule,
  cmsModules,
  dashboardGroups,
  workspaceHref,
} from './dashboard-navigation';
import './dashboard.css';

function DashboardNavigation({
  account,
  onNavigate,
}: {
  account: DemoAccount;
  onNavigate?: () => void;
}) {
  const { pathname: routePath, search } = useLocation();
  const pathname = routePath.replace(/\/$/, '');
  const params = new URLSearchParams(search);
  const studioOpen = pathname === '/dashboard/cms';
  const studioModule = cmsModule(params.get('module'));
  const activeTab = activeWorkspaceModule(account, params.get('tab'))?.id;

  function isCurrent(to: string) {
    if (studioOpen && to === '/dashboard/cms') return studioModule === 'overview';
    if (pathname === '/dashboard/workspace' && activeTab && to === workspaceHref(activeTab))
      return true;
    if (
      Object.values(dashboardCataloguePaths).some(
        (base) => to === base && pathname.startsWith(`${base}/`),
      )
    )
      return true;
    return to === pathname;
  }

  return (
    <nav className="role-nav" aria-label="Dashboard navigation">
      {dashboardGroups(account).map((group) => (
        <div className="role-nav-group" key={group.label}>
          <p>{group.label}</p>
          <ul>
            {group.links.map((link) => (
              <li key={link.to}>
                <Link
                  to={link.to}
                  aria-current={isCurrent(link.to) ? 'page' : undefined}
                  onClick={onNavigate}
                >
                  {link.label}
                </Link>
                {studioOpen && link.to === '/dashboard/cms' && (
                  <ul className="role-nav-sublist" aria-label="Content Studio modules">
                    {cmsModules.slice(1).map(([key, label]) => (
                      <li key={key}>
                        <Link
                          to={cmsHref(key)}
                          aria-current={studioModule === key ? 'page' : undefined}
                          onClick={onNavigate}
                        >
                          {label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function DashboardLayout() {
  const { account, execute } = useDemo();
  const location = useLocation();
  const shell = useRef<HTMLDivElement>(null);
  const dashboardDrawer = useRef<HTMLDialogElement>(null);
  const main = useRef<HTMLElement>(null);
  const [dashboardOpen, setDashboardOpen] = useState(false);
  const pagePath = location.pathname.replace(/\/+$/, '');
  const sectionQuery =
    pagePath === '/dashboard/workspace' || pagePath === '/dashboard/cms' ? location.search : '';

  useLayoutEffect(() => {
    const root = shell.current;
    const navbar = root?.querySelector('.dashboard-navigation-frame');
    if (!root || !navbar) return;

    const updateNavbarHeight = () =>
      root.style.setProperty(
        '--dashboard-navbar-height',
        `${navbar.getBoundingClientRect().height}px`,
      );

    updateNavbarHeight();
    const observer = new ResizeObserver(updateNavbarHeight);
    observer.observe(navbar);
    return () => observer.disconnect();
  }, [account?.id]);

  useEffect(() => {
    dashboardDrawer.current?.close();
    main.current?.scrollTo({ top: 0, behavior: 'instant' });
    window.scrollTo({ top: 0, behavior: 'instant' });
    main.current?.focus({ preventScroll: true });
  }, [pagePath, sectionQuery, account?.id, account?.role]);

  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 1001px)');
    function closeOnDesktop(event: MediaQueryListEvent) {
      if (event.matches) dashboardDrawer.current?.close();
    }
    desktop.addEventListener('change', closeOnDesktop);
    return () => desktop.removeEventListener('change', closeOnDesktop);
  }, []);

  if (!account) return null;
  const role = roleLabels[account.role];

  function openDashboard() {
    dashboardDrawer.current?.showModal();
    setDashboardOpen(true);
  }

  return (
    <div className="dashboard-shell" ref={shell}>
      <Header
        dashboardMenu={{
          expanded: dashboardOpen,
          onOpen: openDashboard,
          notifications: <DashboardNotifications key={account.id} account={account} />,
        }}
      />

      <div className="dashboard-body">
        <aside className="dashboard-sidebar">
          <DashboardNavigation account={account} />
          <Link className="dashboard-visit" to="/">
            Visit website <ArrowUpRight size={15} aria-hidden="true" />
          </Link>
        </aside>
        <main id="main-content" className="dashboard-content" ref={main} tabIndex={-1}>
          <BreadcrumbBar />
          <Suspense
            fallback={
              <p className="container section" role="status">
                Loading workspace…
              </p>
            }
          >
            <Outlet key={account.id} />
          </Suspense>
        </main>
      </div>

      <dialog
        ref={dashboardDrawer}
        id="dashboard-menu"
        className="dashboard-drawer"
        aria-labelledby="dashboard-menu-title"
        onClose={() => setDashboardOpen(false)}
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
              onClick={() => dashboardDrawer.current?.close()}
            />
          </header>
          <DashboardNavigation
            account={account}
            onNavigate={() => dashboardDrawer.current?.close()}
          />
          <button
            className="dashboard-visit"
            type="button"
            onClick={() => {
              dashboardDrawer.current?.close();
              execute({ type: 'logout' });
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
