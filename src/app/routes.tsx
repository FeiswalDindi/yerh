import { lazy, Suspense } from 'react';
import { Navigate, useLocation, useParams, type RouteObject } from 'react-router-dom';
import legacyRoutes from '../content/legacy-routes.json';
import { SiteLayout } from '../layout/SiteLayout';
import { HomePage } from '../features/home/HomePage';
import { NotFoundPage } from '../features/info/NotFoundPage';
import { RequireDemo } from '../features/demo/RequireDemo';
const ContentDirectory = lazy(() =>
  import('../features/content/ContentDirectory').then((m) => ({ default: m.ContentDirectory })),
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
const FaqPage = lazy(() =>
  import('../features/info/FaqPage').then((m) => ({ default: m.FaqPage })),
);
const LoginPage = lazy(() =>
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
const ApplicationsPage = lazy(() =>
  import('../features/accounts/ApplicationsPage').then((m) => ({ default: m.ApplicationsPage })),
);
const RoleDashboard = lazy(() =>
  import('../features/platform/RoleDashboard').then((m) => ({ default: m.RoleDashboard })),
);
const WorkspacePage = lazy(() =>
  import('../features/platform/WorkspacePage').then((m) => ({ default: m.WorkspacePage })),
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
  import('../features/platform/CertificatePage').then((m) => ({ default: m.CertificatePage })),
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
  const normalized = pathname.replace(/\/index\.html$/, '').replace(/\/$/, '') || '/';
  const destination = (legacyRoutes as Record<string, string>)[normalized];
  return destination && destination !== pathname ? (
    <Navigate to={destination} replace />
  ) : (
    <NotFoundPage />
  );
}
function CollectionRedirect({ to }: { to: string }) {
  const { slug } = useParams();
  const { search } = useLocation();
  return <Navigate to={`${to}${slug ? `/${encodeURIComponent(slug)}` : ''}${search}`} replace />;
}
/** Compose under the host router; DemoProvider and ContentProvider are supplied at the app boundary. */
export function createYerhRoutes(): RouteObject[] {
  return [
    {
      element: (
        <Suspense
          fallback={
            <div className="status-page" role="status">
              Loading the hub…
            </div>
          }
        >
          <SiteLayout />
        </Suspense>
      ),
      children: [
        { index: true, element: <HomePage /> },
        { path: 'about', element: <AboutPage /> },
        { path: 'faq', element: <FaqPage /> },
        { path: 'resources', element: <ResourcesPage /> },
        { path: 'entrepreneurship/:topic', element: <EntrepreneurshipPage /> },
        { path: 'publications', element: <PublicationsPage /> },
        { path: 'publications/stories', element: <ContentDirectory kind="story" /> },
        { path: 'publications/blogs', element: <ContentDirectory kind="article" /> },
        { path: 'publications/reports', element: <ContentDirectory kind="publication" /> },
        { path: 'marketplace', element: <ContentDirectory kind="business" /> },
        { path: 'events', element: <EventsPage /> },
        { path: 'events/archive', element: <ContentDirectory kind="event" /> },
        { path: 'opportunities', element: <OpportunitiesPage /> },
        { path: 'opportunities/:slug', element: <OpportunityDetail /> },
        { path: 'apply', element: <ApplicationsPage /> },
        { path: 'pages/:slug', element: <ManagedPage /> },
        { path: 'certificates/:id', element: <CertificatePage /> },
        {
          path: 'dashboard/workspace',
          element: (
            <RequireDemo>
              <WorkspacePage />
            </RequireDemo>
          ),
        },
        {
          path: 'dashboard/cms',
          element: (
            <RequireDemo roles={['content_manager', 'admin']}>
              <CmsPage />
            </RequireDemo>
          ),
        },
        ...[
          'publications/stories',
          'publications/blogs',
          'publications/reports',
          'marketplace',
          'events',
        ].map((path) => ({ path: `${path}/:slug`, element: <ContentDetail /> })),
        { path: 'workshops', element: <EventCollectionPage type="workshops" /> },
        { path: 'webinars', element: <EventCollectionPage type="webinars" /> },
        { path: 'learn', element: <LearningPage /> },
        { path: 'learn/:courseId', element: <LearningPage /> },
        { path: 'forums', element: <ForumsPage /> },
        { path: 'forums/:threadId', element: <ThreadPage /> },
        { path: 'network', element: <NetworkPage /> },
        { path: 'network/members/:memberId', element: <MemberProfilePage /> },
        { path: 'network/groups/:groupId', element: <GroupPage /> },
        { path: 'sessions/:sessionId', element: <SessionPage /> },
        { path: 'leaderboard', element: <Navigate to="/network?tab=leaderboard" replace /> },
        { path: 'yem/mentors', element: <MentorshipPage /> },
        { path: 'yem/mentees', element: <MentorshipPage mode="mentees" /> },
        { path: 'community', element: <Navigate to="/network" replace /> },
        { path: 'join', element: <JoinPage /> },
        { path: 'register', element: <JoinPage /> },
        { path: 'login', element: <LoginPage /> },
        { path: 'demo', element: <LoginPage /> },
        {
          path: 'dashboard',
          element: (
            <RequireDemo>
              <RoleDashboard />
            </RequireDemo>
          ),
        },
        {
          path: 'profile',
          element: (
            <RequireDemo>
              <ProfilePage />
            </RequireDemo>
          ),
        },
        {
          path: 'dashboard/mentorship',
          element: (
            <RequireDemo>
              <MentorshipWorkspace />
            </RequireDemo>
          ),
        },
        {
          path: 'dashboard/content',
          element: (
            <RequireDemo
              roles={['entrepreneur', 'mentor', 'partner', 'investor', 'content_manager', 'admin']}
            >
              <ContentWorkspace />
            </RequireDemo>
          ),
        },
        {
          path: 'dashboard/moderation',
          element: (
            <RequireDemo roles={['admin', 'content_manager']}>
              <ModerationPage />
            </RequireDemo>
          ),
        },
        { path: 'contact', element: <ContactPage /> },
        { path: 'search', element: <ContentDirectory search /> },
        { path: 'saved', element: <ContentDirectory savedOnly /> },
        { path: 'privacy', element: <PolicyPage /> },
        { path: 'terms', element: <TermsPage /> },
        { path: 'preferences', element: <CookiePolicyPage /> },
        { path: 'cookies', element: <CookiePolicyPage /> },
        { path: 'cookie-policy', element: <CookiePolicyPage /> },
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
  ];
}
