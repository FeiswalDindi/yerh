import { lazy, Suspense } from 'react';
import { Navigate, useLocation, useParams, type RouteObject } from 'react-router-dom';
import legacyRoutes from '../content/legacy-routes.json';
import { SiteLayout } from '../layout/SiteLayout';
import { HomePage } from '../features/home/HomePage';
import { NotFoundPage } from '../features/info/NotFoundPage';
import { RequireDemo } from '../features/demo/RequireDemo';
import { useCatalog } from './useCatalog';
import { useDemo } from './useDemo';
import { cmsModule, dashboardAccess } from '../features/dashboard/dashboard-navigation';
import { lookupManagedPage } from '../features/platform/server/cms/cms-page-registry';
import { AccountAccess } from '../features/accounts/AccountAccess';
import { AccountEntryRedirect } from '../features/accounts/AccountLink';
import { GuestAccount } from '../features/accounts/GuestAccount';
import { InstitutionInvitationPage } from '../features/accounts/InstitutionInvitationPage';
import { LaravelInvitationPage } from '../features/accounts/LaravelInvitationPage';
import { ResetPasswordPage } from '../features/accounts/ResetPasswordPage';
import { roleAccessPath } from '../features/accounts/role-requests';
import { BreadcrumbProvider } from '../shared/BreadcrumbProvider';
import { SiteLoader } from '../shared/SiteLoader';
import { useLaravelSession } from './useLaravelSession';
import { RouteLoadError } from './RouteLoadError';
import { laravelModeEnabled } from '../config/laravel';
import { loadDashboardLayout, loadLaravelWorkspace } from './route-preload';
import {
  MarketplaceListings,
  MarketplaceProduct,
} from '../features/platform/server/ProductsWorkspace';
const LaravelNotifications = lazy(() =>
  import('../features/accounts/LaravelNotifications').then((m) => ({
    default: m.LaravelNotifications,
  })),
);
const LaravelAccountPage = lazy(() =>
  loadLaravelWorkspace().then((m) => ({
    default: m.LaravelAccountPage,
  })),
);
const LaravelDashboard = lazy(() =>
  loadLaravelWorkspace().then((m) => ({
    default: m.LaravelDashboard,
  })),
);
const LocalLaravelAccountPage = lazy(() =>
  import('../features/accounts/LocalLaravelAccountPage').then((m) => ({
    default: m.LocalLaravelAccountPage,
  })),
);
const DashboardLayout = lazy(() =>
  loadDashboardLayout().then((m) => ({ default: m.DashboardLayout })),
);
const DashboardCatalogue = lazy(() =>
  import('../features/dashboard/DashboardCatalogue').then((m) => ({
    default: m.DashboardCatalogue,
  })),
);
const DashboardCertificates = lazy(() =>
  import('../features/dashboard/DashboardCertificates').then((m) => ({
    default: m.DashboardCertificates,
  })),
);
const DashboardEvents = lazy(() =>
  import('../features/dashboard/DashboardEvents').then((m) => ({ default: m.DashboardEvents })),
);
const ContentDirectory = lazy(() =>
  import('../features/content/ContentDirectory').then((m) => ({ default: m.ContentDirectory })),
);
const MarketplacePage = lazy(() =>
  import('../features/content/MarketplacePage').then((m) => ({ default: m.MarketplacePage })),
);
const ContentDetail = lazy(() =>
  import('../features/content/ContentDetail').then((m) => ({ default: m.ContentDetail })),
);
const PublicationsPage = lazy(() =>
  import('../features/content/PublicationsPage').then((m) => ({ default: m.PublicationsPage })),
);
const ResourcesPage = lazy(() =>
  import('../features/resources/ResourcesPage').then((m) => ({ default: m.ResourcesPage })),
);
const EntrepreneurshipPage = lazy(() =>
  import('../features/resources/EntrepreneurshipPage').then((m) => ({
    default: m.EntrepreneurshipPage,
  })),
);
const EventCatalogue = lazy(() =>
  import('../features/platform/server/EventCatalogue').then((m) => ({ default: m.EventCatalogue })),
);
const LaravelEventPage = lazy(() =>
  import('../features/platform/server/EventCatalogue').then((m) => ({
    default: m.LaravelEventPage,
  })),
);
const LaravelOpportunitiesPage = lazy(() =>
  import('../features/platform/server/OpportunityWorkspace').then((m) => ({
    default: m.LaravelOpportunitiesPage,
  })),
);
const LearningWorkspace = lazy(() =>
  import('../features/platform/server/LearningWorkspace').then((m) => ({
    default: m.LearningWorkspace,
  })),
);
const MoodleLaunchPage = lazy(() =>
  import('../features/platform/server/MoodleLaunchPage').then((m) => ({
    default: m.MoodleLaunchPage,
  })),
);
const LearningPage = lazy(() =>
  import('../features/resources/LearningPage').then((m) => ({ default: m.LearningPage })),
);
const EventCollectionPage = lazy(() =>
  import('../features/resources/EventCollectionPage').then((m) => ({
    default: m.EventCollectionPage,
  })),
);
const AboutPage = lazy(() =>
  import('../features/info/AboutPage').then((m) => ({ default: m.AboutPage })),
);
const TeamMemberPage = lazy(() =>
  import('../features/info/TeamMemberPage').then((m) => ({ default: m.TeamMemberPage })),
);
const FaqPage = lazy(() =>
  import('../features/info/FaqPage').then((m) => ({ default: m.FaqPage })),
);
const DemoLoginPage = lazy(() =>
  import('../features/demo/LoginPage').then((m) => ({ default: m.LoginPage })),
);
const ContactPage = lazy(() =>
  import('../features/contact/ContactPage').then((m) => ({ default: m.ContactPage })),
);
const PolicyPage = lazy(() =>
  import('../features/info/PolicyPage').then((m) => ({ default: m.PolicyPage })),
);
const TermsPage = lazy(() =>
  import('../features/legal/TermsPage').then((m) => ({ default: m.TermsPage })),
);
const JoinPage = lazy(() =>
  import('../features/connect/JoinPage').then((m) => ({ default: m.JoinPage })),
);
const InstitutionOnboardingPage = lazy(() =>
  import('../features/institutions/InstitutionOnboardingPage').then((m) => ({
    default: m.InstitutionOnboardingPage,
  })),
);
const CareersPage = lazy(() =>
  import('../features/careers/CareersPage').then((m) => ({ default: m.CareersPage })),
);
const ApplicationsPage = lazy(() =>
  import('../features/accounts/ApplicationsPage').then((m) => ({ default: m.ApplicationsPage })),
);
const RoleDashboard = lazy(() =>
  import('../features/platform/workspace/RoleDashboard').then((m) => ({
    default: m.RoleDashboard,
  })),
);
const WorkspacePage = lazy(() =>
  import('../features/platform/workspace/WorkspacePage').then((m) => ({
    default: m.WorkspacePage,
  })),
);
const CmsPage = lazy(() => import('../features/cms/CmsPage').then((m) => ({ default: m.CmsPage })));
const OpportunitiesPage = lazy(() =>
  import('../features/benefits/OpportunitiesPage').then((m) => ({ default: m.OpportunitiesPage })),
);
const OpportunityDetail = lazy(() =>
  import('../features/benefits/OpportunitiesPage').then((m) => ({ default: m.OpportunityDetail })),
);
const EventsPage = lazy(() =>
  import('../features/benefits/EventsPage').then((m) => ({ default: m.EventsPage })),
);
const ManagedPage = lazy(() =>
  import('../features/cms/ManagedPage').then((m) => ({ default: m.ManagedPage })),
);
const CertificatePage = lazy(() =>
  import('../features/platform/incubation/CertificatePage').then((m) => ({
    default: m.CertificatePage,
  })),
);
const CookiePolicyPage = lazy(() =>
  import('../features/privacy/CookiePolicyPage').then((m) => ({ default: m.CookiePolicyPage })),
);
const ForumsPage = lazy(() =>
  import('../features/community/ForumsPage').then((m) => ({ default: m.ForumsPage })),
);
const ThreadPage = lazy(() =>
  import('../features/community/ThreadPage').then((m) => ({ default: m.ThreadPage })),
);
const NetworkPage = lazy(() =>
  import('../features/community/NetworkPage').then((m) => ({ default: m.NetworkPage })),
);
const MemberProfilePage = lazy(() =>
  import('../features/community/MemberProfilePage').then((m) => ({ default: m.MemberProfilePage })),
);
const GroupPage = lazy(() =>
  import('../features/community/GroupPage').then((m) => ({ default: m.GroupPage })),
);
const GroupsPage = lazy(() =>
  import('../features/community/GroupsPage').then((m) => ({ default: m.GroupsPage })),
);
const SessionPage = lazy(() =>
  import('../features/resources/SessionPage').then((m) => ({ default: m.SessionPage })),
);
const MentorshipPage = lazy(() =>
  import('../features/community/MentorshipPage').then((m) => ({ default: m.MentorshipPage })),
);
const ProfilePage = lazy(() =>
  import('../features/dashboard/ProfilePage').then((m) => ({ default: m.ProfilePage })),
);
const MentorshipWorkspace = lazy(() =>
  import('../features/dashboard/MentorshipWorkspace').then((m) => ({
    default: m.MentorshipWorkspace,
  })),
);
const ContentWorkspace = lazy(() =>
  import('../features/dashboard/ContentWorkspace').then((m) => ({ default: m.ContentWorkspace })),
);
const ModerationPage = lazy(() =>
  import('../features/dashboard/ModerationPage').then((m) => ({ default: m.ModerationPage })),
);
function LegacyRoute() {
  const { pathname } = useLocation();
  const { site } = useCatalog();
  const normalized = pathname.replace(/\/index\.html$/, '').replace(/\/$/, '') || '/';
  const destination = (legacyRoutes as Record<string, string>)[normalized];
  if (destination && destination !== pathname) {
    return <Navigate to={destination} replace />;
  }
  if (lookupManagedPage(site.pages, normalized)) {
    return <ManagedPage />;
  }
  return <NotFoundPage />;
}
function CollectionRedirect({ to }: { to: string }) {
  const { slug } = useParams();
  const { search } = useLocation();
  return <Navigate to={`${to}${slug ? `/${encodeURIComponent(slug)}` : ''}${search}`} replace />;
}
function ApplicationEntry() {
  const { account } = useDemo();
  if (account?.suspended) return <AccountEntryRedirect />;
  return account ? (
    <Navigate to={account.role === 'guest' ? '/account#incubation' : roleAccessPath} replace />
  ) : (
    <ApplicationsPage />
  );
}
function GroupRedirect() {
  const { groupId } = useParams();
  return <Navigate to={groupId ? `/groups/${encodeURIComponent(groupId)}` : '/groups'} replace />;
}
function LaravelCommunityRedirect({ tab, view }: { tab?: string; view?: string }) {
  const session = useLaravelSession();
  const { groupId } = useParams();
  const profile = session?.profile;
  if (session?.loading) return <SiteLoader screen />;
  const isDashboardUser =
    Boolean(profile?.email_verified) &&
    (profile?.role !== 'guest' || (profile?.staff.length ?? 0) > 0);
  if (!isDashboardUser) {
    return <Navigate to="/forums" replace />;
  }
  const qs = new URLSearchParams({ tab: tab ?? 'community' });
  if (view) qs.set('view', view);
  if (groupId) qs.set('group', groupId);
  return <Navigate to={`/dashboard/workspace?${qs.toString()}`} replace />;
}

/** Compose under the host router; DemoProvider and ContentProvider are supplied at the app boundary. */
export function createYerhRoutes(): RouteObject[] {
  return [
    {
      errorElement: <RouteLoadError />,
      element: (
        <BreadcrumbProvider identifyPage={breadcrumbPageKey}>
          <AccountAccess />
        </BreadcrumbProvider>
      ),
      children: siteRoutes(),
    },
  ];
}

function breadcrumbPageKey(pathname: string, search: string) {
  if (pathname === '/dashboard/workspace') {
    const tab = new URLSearchParams(search).get('tab');
    return tab ? `${pathname}?tab=${tab}` : pathname;
  }
  if (pathname === '/dashboard/cms')
    return `${pathname}?module=${cmsModule(new URLSearchParams(search).get('module'))}`;
  return pathname;
}

function siteRoutes(): RouteObject[] {
  return [
    {
      element: (
        <Suspense fallback={<SiteLoader screen />}>
          <SiteLayout />
        </Suspense>
      ),
      children: [
        { index: true, element: <HomePage /> },
        { path: 'about', element: <AboutPage /> },
        { path: 'about/team/:memberId', element: <TeamMemberPage /> },
        { path: 'team/:memberId', element: <TeamMemberPage /> },
        { path: 'faq', element: <FaqPage /> },
        { path: 'resources', element: <ResourcesPage /> },
        { path: 'entrepreneurship/:topic', element: <EntrepreneurshipPage /> },
        { path: 'publications', element: <PublicationsPage /> },
        { path: 'publications/stories', element: <ContentDirectory kind="story" /> },
        { path: 'publications/blogs', element: <ContentDirectory kind="article" /> },
        { path: 'publications/reports', element: <ContentDirectory kind="publication" /> },
        {
          path: 'marketplace',
          element: laravelModeEnabled ? <MarketplaceListings /> : <MarketplacePage />,
        },
        {
          path: 'marketplace/:slug',
          element: laravelModeEnabled ? <MarketplaceProduct /> : <ContentDetail />,
        },
        { path: 'events', element: laravelModeEnabled ? <EventCatalogue /> : <EventsPage /> },
        { path: 'events/archive', element: <ContentDirectory kind="event" /> },
        {
          path: 'opportunities',
          element: laravelModeEnabled ? <LaravelOpportunitiesPage /> : <OpportunitiesPage />,
        },
        {
          path: 'opportunities/:slug',
          element: laravelModeEnabled ? <LaravelOpportunitiesPage /> : <OpportunityDetail />,
        },
        {
          path: 'apply',
          element: laravelModeEnabled ? <Navigate to="/account" replace /> : <ApplicationEntry />,
        },
        { path: 'pages/*', element: <ManagedPage /> },
        { path: 'certificates/:id', element: <CertificatePage /> },
        ...['publications/stories', 'publications/blogs', 'publications/reports', 'events'].map(
          (path) => ({ path: `${path}/:slug`, element: <ContentDetail /> }),
        ),
        {
          path: 'workshops',
          element: laravelModeEnabled ? (
            <EventCatalogue categoryName="Workshop" />
          ) : (
            <EventCollectionPage type="workshops" />
          ),
        },
        {
          path: 'webinars',
          element: laravelModeEnabled ? (
            <EventCatalogue categoryName="Webinar" />
          ) : (
            <EventCollectionPage type="webinars" />
          ),
        },
        { path: 'learn', element: laravelModeEnabled ? <LearningWorkspace /> : <LearningPage /> },
        {
          path: 'learn/:courseId',
          element: laravelModeEnabled ? <LearningWorkspace /> : <LearningPage />,
        },
        ...(laravelModeEnabled
          ? []
          : [
              {
                path: 'dashboard/learning/:courseId',
                element: (
                  <RequireDemo workspace capabilities={dashboardAccess.learning}>
                    <LearningPage dashboard />
                  </RequireDemo>
                ),
              },
            ]),
        {
          path: 'account',
          element: laravelModeEnabled ? (
            <LaravelAccountPage />
          ) : (
            <RequireDemo>
              <GuestAccount />
            </RequireDemo>
          ),
        },
        ...(laravelModeEnabled
          ? [{ path: 'account/notifications', element: <LaravelNotifications /> }]
          : []),
        {
          path: 'account/certificates',
          element: (
            <RequireDemo>
              <DashboardCertificates publicAccount />
            </RequireDemo>
          ),
        },
        {
          path: 'account/invitations/:id',
          element: laravelModeEnabled ? <LaravelInvitationPage /> : <InstitutionInvitationPage />,
        },
        {
          path: 'reset-password',
          element: <ResetPasswordPage />,
        },
        { path: 'forums', element: <ForumsPage /> },
        { path: 'forums/:threadId', element: <ThreadPage /> },
        { path: 'groups', element: <GroupsPage /> },
        { path: 'groups/:groupId', element: <GroupsPage /> },
        {
          path: 'network',
          element: laravelModeEnabled ? <Navigate to="/groups" replace /> : <NetworkPage />,
        },
        { path: 'members/:memberId', element: <MemberProfilePage /> },
        { path: 'network/members/:memberId', element: <MemberProfilePage /> },
        {
          path: 'network/groups/:groupId',
          element: laravelModeEnabled ? <GroupRedirect /> : <GroupPage />,
        },
        {
          path: 'sessions/:sessionId',
          element: laravelModeEnabled ? <LaravelEventPage /> : <SessionPage />,
        },
        {
          path: 'leaderboard',
          element: laravelModeEnabled ? (
            <LaravelCommunityRedirect view="leaderboard" />
          ) : (
            <Navigate to="/network?tab=leaderboard" replace />
          ),
        },
        {
          path: 'yem/mentors',
          element: laravelModeEnabled ? (
            <Navigate to="/join?role=mentor" replace />
          ) : (
            <MentorshipPage />
          ),
        },
        {
          path: 'yem/mentees',
          element: laravelModeEnabled ? (
            <Navigate to="/join?role=entrepreneur" replace />
          ) : (
            <MentorshipPage mode="mentees" />
          ),
        },
        {
          path: 'community',
          element: laravelModeEnabled ? (
            <Navigate to="/groups" replace />
          ) : (
            <Navigate to="/network" replace />
          ),
        },
        { path: 'join', element: <JoinPage /> },
        { path: 'institutions/apply', element: <InstitutionOnboardingPage /> },
        { path: 'careers', element: <CareersPage /> },
        { path: 'careers/institutions', element: <CareersPage /> },
        { path: 'careers/partnerships', element: <CareersPage /> },
        { path: 'careers/mentorship', element: <CareersPage /> },
        { path: 'careers/invest', element: <CareersPage /> },
        { path: 'register', element: <AccountEntryRedirect mode="register" /> },
        { path: 'login', element: <AccountEntryRedirect /> },
        { path: 'demo', element: <DemoLoginPage /> },
        ...(import.meta.env?.VITE_ENABLE_LOCAL_LARAVEL_AUTH === 'true'
          ? [{ path: 'local-account', element: <LocalLaravelAccountPage /> }]
          : []),
        { path: 'profile', element: <Navigate to="/dashboard/profile" replace /> },
        { path: 'contact', element: <ContactPage /> },
        { path: 'search', element: <ContentDirectory search /> },
        { path: 'saved', element: <ContentDirectory savedOnly /> },
        { path: 'privacy', element: <PolicyPage /> },
        { path: 'terms', element: <TermsPage /> },
        { path: 'preferences', element: <Navigate to="/cookies" replace /> },
        { path: 'cookies', element: <CookiePolicyPage /> },
        { path: 'cookie-policy', element: <Navigate to="/cookies" replace /> },
        ...[
          ['news', 'publications/blogs'],
          ['blogs', 'publications/blogs'],
          ['stories', 'publications/stories'],
          ['businesses', 'marketplace'],
        ].flatMap(([from, to]) => [
          { path: from, element: <CollectionRedirect to={`/${to}`} /> },
          { path: `${from}/:slug`, element: <CollectionRedirect to={`/${to}`} /> },
        ]),
        { path: 'publications/:slug', element: <CollectionRedirect to="/publications/reports" /> },
        { path: '*', element: <LegacyRoute /> },
      ],
    },
    {
      path: 'dashboard',
      element: laravelModeEnabled ? (
        <Suspense fallback={<SiteLoader screen />}>
          <LaravelDashboard />
        </Suspense>
      ) : (
        <RequireDemo workspace>
          <Suspense fallback={<SiteLoader screen />}>
            <DashboardLayout />
          </Suspense>
        </RequireDemo>
      ),
      children: [
        { index: true, element: <RoleDashboard /> },
        { path: 'profile', element: <ProfilePage /> },
        { path: 'applications', element: <Navigate to={roleAccessPath} replace /> },
        { path: 'certificates', element: <DashboardCertificates /> },
        { path: 'workspace', element: <WorkspacePage /> },
        {
          path: 'mentorship',
          element: (
            <RequireDemo capabilities={dashboardAccess.mentorship}>
              <MentorshipWorkspace />
            </RequireDemo>
          ),
        },
        {
          path: 'content',
          element: (
            <RequireDemo capabilities={dashboardAccess.content}>
              <ContentWorkspace />
            </RequireDemo>
          ),
        },
        {
          path: 'cms',
          element: (
            <RequireDemo capabilities={dashboardAccess.cms}>
              <CmsPage />
            </RequireDemo>
          ),
        },
        {
          path: 'moderation',
          element: (
            <RequireDemo capabilities={dashboardAccess.moderation}>
              <ModerationPage />
            </RequireDemo>
          ),
        },
        {
          path: 'learning',
          element: (
            <RequireDemo capabilities={dashboardAccess.learning}>
              <DashboardCatalogue kind="learning" />
            </RequireDemo>
          ),
        },
        ...(laravelModeEnabled
          ? [{ path: 'learning/:courseId', element: <LearningWorkspace /> }]
          : []),
        {
          path: 'opportunities',
          element: (
            <RequireDemo capabilities={dashboardAccess.opportunities}>
              <OpportunitiesPage dashboard />
            </RequireDemo>
          ),
        },
        {
          path: 'opportunities/:slug',
          element: (
            <RequireDemo capabilities={dashboardAccess.opportunities}>
              <OpportunityDetail dashboard />
            </RequireDemo>
          ),
        },
        {
          path: 'events',
          element: (
            <RequireDemo capabilities={dashboardAccess.events}>
              <DashboardEvents />
            </RequireDemo>
          ),
        },
        {
          path: 'events/:sessionId',
          element: (
            <RequireDemo capabilities={dashboardAccess.events}>
              <SessionPage dashboard />
            </RequireDemo>
          ),
        },
        { path: 'marketplace', element: <DashboardCatalogue kind="marketplace" /> },
        { path: 'marketplace/:slug', element: <ContentDetail dashboard /> },
        { path: '*', element: <NotFoundPage /> },
      ],
    },
    {
      path: 'moodle/launch',
      element: (
        <Suspense fallback={<SiteLoader screen heartbeat message="Opening YERH Learning…" />}>
          <MoodleLaunchPage />
        </Suspense>
      ),
    },
  ];
}
