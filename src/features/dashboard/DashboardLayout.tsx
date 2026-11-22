import { Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowUpRight, LogOut, Moon, Sun } from 'lucide-react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useDemo } from '../../app/useDemo';
import { roleLabels } from '../../domain/roles';
import type { DemoAccount } from '../../domain/demo';
import { Header } from '../../layout/Header';
import { BreadcrumbBar } from '../../shared/Breadcrumb';
import { SiteLoader } from '../../shared/SiteLoader';
import { CloseButton } from '../../shared/CloseButton';
import { CookieConsentModal } from '../privacy/CookieConsentModal';
import { DashboardNotifications } from './DashboardNotifications';
import {
  useDashboardNotifications,
  type DashboardNotificationState,
} from './useDashboardNotifications';
import { dashboardCataloguePaths } from './catalogue-paths';
import {
  activeWorkspaceModule,
  cmsHref,
  cmsModule,
  cmsModules,
  dashboardGroups,
  workspaceHref,
  institutionHref,
  institutionModule,
} from './dashboard-navigation';
import { institutionAccess } from '../../domain/incubation';
import './dashboard.css';
import './dashboard-theme.css';

const themeKey = 'yerh.dashboard.theme';

function DashboardNavigation({
  account,
  notifications,
  onNavigate,
}: {
  account: DemoAccount;
  notifications: DashboardNotificationState;
  onNavigate?: () => void;
}) {
  const { pathname: routePath, search } = useLocation();
  const pathname = routePath.replace(/\/$/, '');
  const params = new URLSearchParams(search);
  const { state } = useDemo();
  const primary = state.platform.training.institutions.find(
    (school) => school.adminId === account.id,
  );
  const linked = state.platform.training.institutions.filter(
    (school) => school.adminId !== account.id && institutionAccess(school, account),
  );
  const selectedSchool = linked.find((school) => school.id === params.get('institution'));
  const schoolModule =
    selectedSchool &&
    institutionModule(
      params.get('tab'),
      institutionAccess(selectedSchool, account) === 'manage',
      selectedSchool.kind,
    );
  const studioOpen = pathname === '/dashboard/cms';
  const studioModule = cmsModule(params.get('module'));
  const activeTab = activeWorkspaceModule(account, params.get('tab'))?.id;
  const unread = (href: string) => notifications.badges.get(href) ?? 0;

  function isCurrent(to: string) {
    if (selectedSchool && schoolModule && pathname === '/dashboard/workspace')
      return to === institutionHref(schoolModule.id, selectedSchool.id);
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
      {[
        ...(account.role === 'guest'
          ? []
          : dashboardGroups(
              account,
              primary?.kind === 'high-school' && primary.status === 'active',
            )),
        ...linked.map((school) => ({
          label: school.name,
          links: (school.kind !== 'high-school'
            ? [
                [
                  'school',
                  institutionAccess(school, account) === 'manage'
                    ? 'Institution portal'
                    : 'Member Progress',
                ],
              ]
            : institutionAccess(school, account) === 'manage'
              ? [
                  ['school', 'Institution portal'],
                  ['member-results', 'Results & Certificates'],
                  ['ventures', 'Ventures'],
                  ['products', 'Products'],
                  ['incubation', 'Incubation'],
                ]
              : [['member-results', 'Results & Certificates']]
          ).map(([tab, label]) => ({ label: label!, to: institutionHref(tab!, school.id) })),
        })),
      ].map((group) => (
        <div className="role-nav-group" key={group.label}>
          <p>{group.label}</p>
          <ul>
            {group.links.map((link) => {
              const badge =
                link.to === cmsHref('overview') && !studioOpen
                  ? unread(cmsHref('opportunities'))
                  : unread(link.to);
              const destination =
                notifications.groups.find(
                  (update) => update.unread && update.sidebarHref === link.to,
                )?.to ?? link.to;
              return (
                <li key={link.to}>
                  <Link
                    to={destination}
                    aria-current={isCurrent(link.to) ? 'page' : undefined}
                    onClick={onNavigate}
                  >
                    {link.label}
                    <NavigationBadge count={badge} />
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
                            <NavigationBadge count={unread(cmsHref(key))} />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function NavigationBadge({ count }: { count: number }) {
  return (
    count > 0 && (
      <>
        <span className="dashboard-nav-badge" aria-hidden="true">
          {count > 9 ? '9+' : count}
        </span>
        <span className="sr-only">, {count} new</span>
      </>
    )
  );
}

export function DashboardLayout() {
  const { account } = useDemo();
  return account ? <DashboardShell key={account.id} account={account} /> : null;
}

function DashboardShell({ account }: { account: DemoAccount }) {
  const { state, execute } = useDemo();
  const notifications = useDashboardNotifications(state, account);
  const location = useLocation();
  const shell = useRef<HTMLDivElement>(null);
  const dashboardDrawer = useRef<HTMLDialogElement>(null);
  const main = useRef<HTMLElement>(null);
  const [dashboardOpen, setDashboardOpen] = useState(false);
  const [dark, setDark] = useState(() => {
    try {
      return window.localStorage.getItem(themeKey) === 'dark';
    } catch {
      return false;
    }
  });
  const pagePath = location.pathname.replace(/\/+$/, '');
  const workspaceParams = new URLSearchParams(location.search);
  workspaceParams.delete('filter');
  workspaceParams.delete('view');
  const sectionQuery =
    pagePath === '/dashboard/workspace'
      ? workspaceParams.toString()
      : pagePath === '/dashboard/cms'
        ? location.search
        : '';

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

  const role = roleLabels[account.role];
  const themeLabel = dark ? 'Switch to light mode' : 'Switch to dark mode';

  function toggleTheme() {
    setDark(!dark);
    try {
      window.localStorage.setItem(themeKey, dark ? 'light' : 'dark');
    } catch {
      // Keep the current session usable when storage is restricted.
    }
  }

  function openDashboard() {
    dashboardDrawer.current?.showModal();
    setDashboardOpen(true);
  }

  return (
    <div className="dashboard-shell" data-dashboard-theme={dark ? 'dark' : 'light'} ref={shell}>
      <Header
        dashboardMenu={{
          expanded: dashboardOpen,
          onOpen: openDashboard,
          notifications: (
            <>
              <button
                className="icon-button dashboard-theme-toggle"
                type="button"
                aria-label={themeLabel}
                title={themeLabel}
                onClick={toggleTheme}
              >
                {dark ? (
                  <Sun size={19} aria-hidden="true" />
                ) : (
                  <Moon size={19} aria-hidden="true" />
                )}
              </button>
              <DashboardNotifications notifications={notifications} />
            </>
          ),
        }}
      />

      <div className="dashboard-body">
        <aside className="dashboard-sidebar">
          <DashboardNavigation account={account} notifications={notifications} />
          <Link className="dashboard-visit" to="/">
            Visit website <ArrowUpRight size={15} aria-hidden="true" />
          </Link>
        </aside>
        <main id="main-content" className="dashboard-content" ref={main} tabIndex={-1}>
          <BreadcrumbBar />
          <Suspense fallback={<SiteLoader />}>
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
            notifications={notifications}
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
