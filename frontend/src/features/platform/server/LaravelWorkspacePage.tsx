import { MarketplaceSectorAdmin } from './MarketplaceSectors';
import { ProfileForm } from '../../dashboard/ProfileForm';
import { ChangePasswordDialog } from '../../accounts/ChangePasswordForm';
import { laravelWorkspace } from '../../../services/laravel-workspace-repository';
import { ApprovalQueue } from './ApprovalQueue';
import { AdminVentures } from './AdminVentures';
import { WorkspaceOverview, ActivityReport, AccountDirectory } from './WorkspaceOverview';
import { useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useSearchParams } from 'react-router-dom';
import { useLaravelSession } from '../../../app/useLaravelSession';
import { localLaravelIdentity } from '../../../services/laravel-identity-repository';
import { roleLabels } from '../../../domain/roles';
import { Header } from '../../../layout/Header';
import { AccountLink } from '../../accounts/AccountLink';
import { AffiliationWorkspace } from './AffiliationWorkspace';
import { InstitutionDirectory, InstitutionPortal } from './InstitutionWorkspace';
import { SchoolCertificateQueue } from './SchoolResults';
import { CourseAdministration, CourseEnrolmentRegistry } from './CourseAdministration';
import { EventAdministration } from './EventAdministration';
import { EditorialWorkspace } from './EditorialWorkspace';
import { CommunicationsWorkspace } from './CommunicationsWorkspace';
import { OpportunityWorkspace } from './OpportunityWorkspace';
import { WorkspaceTabs } from '../workspace/WorkspaceControls';
import { VentureWorkspace } from './VentureWorkspace';
import { IncubationProgramme, ProgrammeMentors } from './IncubationProgramme';
import { ProductsWorkspace } from './ProductsWorkspace';
import { ProgrammePayments, VentureCertificates } from './ProgrammeFinance';
import { errorText, RecordsFeedback, useWorkspaceRecords } from './WorkspaceActions';
import { LaravelDashboardFrame } from './LaravelDashboardFrame';
import { LearningWorkspace } from './LearningWorkspace';
import { EventCatalogue, LaravelEventPage } from './EventCatalogue';
import './server-workspace.css';

export function LaravelAccountPage() {
  const session = useLaravelSession();
  const [params] = useSearchParams();
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  if (!session) return null;
  const { profile, refresh } = session;
  if (profile?.email_verified && (profile.role !== 'guest' || profile.staff.length > 0)) {
    return <Navigate to="/dashboard" replace />;
  }

  async function verifyLocally() {
    setBusy(true);
    setError('');
    try {
      window.location.assign(await localLaravelIdentity.localVerificationLink());
    } catch (failure) {
      setError(errorText(failure));
      setBusy(false);
    }
  }

  async function resend() {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await localLaravelIdentity.resendVerification();
      setNotice('A new verification email has been queued.');
    } catch (failure) {
      setError(errorText(failure));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="container section server-account">
      <h1>Account</h1>
      {params.get('verification') === 'invalid' && !profile?.email_verified && (
        <p role="alert" className="form-error">
          This verification link has expired or is invalid. Sign in and choose Resend verification
          to get a new link.
        </p>
      )}
      <RecordsFeedback loading={session.loading} error={session.error} />
      {!session.loading && !profile && !session.error && (
        <AccountLink className="button">Sign in</AccountLink>
      )}
      {profile && (
        <>
          <p>
            {profile.name} · {profile.email}
          </p>
          {!profile.email_verified ? (
            <>
              <p>
                {profile.requested_institution
                  ? `Verify your email to complete affiliation with ${profile.requested_institution.name}.`
                  : 'Verify your email to apply for incubation or join an institution.'}
              </p>
              {profile.local_verification_available && (
                <button
                  type="button"
                  className="button"
                  disabled={busy}
                  onClick={() => void verifyLocally()}
                >
                  Verify email address
                </button>
              )}
              <button
                type="button"
                className="button button-outline"
                disabled={busy}
                onClick={() => void resend()}
              >
                Resend verification
              </button>
              {notice && <p role="status">{notice}</p>}
              {error && (
                <p role="alert" className="form-error">
                  {error}
                </p>
              )}
            </>
          ) : (
            <>
              <p role="status">Email verified.</p>
              <h2>Incubation applications</h2>
              <AffiliationWorkspace refresh={refresh} />
              <Link to="/learn">Browse general courses</Link>
            </>
          )}
          <button type="button" className="button button-outline" onClick={() => void refresh()}>
            Refresh account
          </button>
        </>
      )}
    </section>
  );
}

export function LaravelDashboard() {
  const session = useLaravelSession();
  const profile = session?.profile;
  return <SessionDashboard key={profile ? profile.id + ':' + profile.role : 'anonymous'} />;
}

function SessionDashboard() {
  const session = useLaravelSession();
  const [params] = useSearchParams();
  const { pathname } = useLocation();
  const { records: institutions, error: institutionError } = useWorkspaceRecords(
    localLaravelIdentity.choices,
    session?.profile?.role === 'admin' && params.get('tab') === 'school',
  );
  const summary = useWorkspaceRecords(laravelWorkspace.summary, !!session?.profile?.email_verified);
  const refreshSummary = summary.reload;
  useEffect(() => {
    window.addEventListener('yerh:workspace-updated', refreshSummary);
    return () => window.removeEventListener('yerh:workspace-updated', refreshSummary);
  }, [refreshSummary]);
  if (!session) return null;
  const { profile } = session;
  if (session.loading || session.error) {
    return (
      <>
        <Header />
        <main id="main-content" className="container section">
          <RecordsFeedback loading={session.loading} error={session.error} />
          {session.error && (
            <button className="button" onClick={() => void session.refresh()}>
              Retry
            </button>
          )}
        </main>
      </>
    );
  }
  if (
    !profile ||
    !profile.email_verified ||
    (profile.role === 'guest' && profile.staff.length === 0)
  ) {
    return <Navigate to="/account" replace />;
  }

  const admin = profile.role === 'admin';
  const contentManager = profile.role === 'content_manager';
  const canEditContent = admin || contentManager;
  const founder = profile.role === 'entrepreneur';
  const mentor = profile.role === 'mentor';
  const programmeRole = admin ? 'admin' : founder ? 'entrepreneur' : mentor ? 'mentor' : null;
  const portal = (admin ? (institutions ?? []) : profile.staff).find(
    (institution) => institution.slug === params.get('institution'),
  );
  const dashboardEventMatch = pathname.match(/^\/dashboard\/events\/([^/]+)$/);
  const tab = params.get('tab') ?? '';
  const requested =
    pathname === '/dashboard/profile'
      ? 'profile'
      : pathname === '/dashboard/cms'
        ? 'editorial'
        : pathname === '/dashboard/certificates'
          ? 'certificates'
          : pathname.startsWith('/dashboard/opportunities')
            ? 'opportunities'
            : pathname.startsWith('/dashboard/events')
              ? 'events'
              : pathname.startsWith('/dashboard/learning')
                ? 'learning'
                : pathname === '/dashboard/workspace'
                  ? tab
                  : '';
  const aliases: Record<string, string> = {
    'manage-ventures': 'ventures',
    'manage-products': 'products',
    'admin-courses': 'courses',
    mentees: 'incubation',
    enquiries: 'communications',
  };
  const view = aliases[requested] ?? requested;
  const overview = pathname.replace(/\/$/, '') === '/dashboard';

  const section = (label: string, entries: string[][]) => ({
    label,
    links: entries.map(([label, target]) => ({ label: label!, to: target! })),
  });
  const workspace = (tab: string) => '/dashboard/workspace?tab=' + tab;
  const records = params.get('record') ?? undefined;
  const navGroups = [
    section('Dashboard', [
      ['Overview', '/dashboard'],
      ...(admin ? [['Analytics & reports', workspace('reports')]] : []),
    ]),
    ...(admin
      ? [
          section('People & Access', [
            ['Approval queue', workspace('approvals')],
            ['Users & roles', workspace('users')],
            ['Institution directory', workspace('institutions')],
            ['Mentors', workspace('mentors')],
          ]),
          section('Ventures & Programmes', [
            ['Manage ventures', workspace('ventures')],
            ['Incubation', workspace('incubation')],
            ['Courses', workspace('courses')],
            ['Certificates', '/dashboard/certificates'],
          ]),
          section('Shop & Finance', [
            ['Shop products', workspace('products')],
            ['Payments', workspace('payments')],
          ]),
          section('Content & Events', [
            ['Content Studio', '/dashboard/cms'],
            ['Events', '/dashboard/events'],
            ['Opportunities', '/dashboard/opportunities'],
          ]),
          section('Communications', [['Emails', workspace('communications')]]),
        ]
      : []),
    ...(founder
      ? [
          section('Venture & learning', [
            ['Ventures', workspace('ventures')],
            ['Products', workspace('products')],
            ['Incubation', workspace('incubation')],
            ['Courses', '/dashboard/learning'],
            ['Opportunities', '/dashboard/opportunities'],
          ]),
        ]
      : []),
    ...(mentor
      ? [
          section('Mentorship', [
            ['Assigned pathways', workspace('incubation')],
            ['Product evidence', workspace('products')],
            ['Course proposals', workspace('courses')],
          ]),
        ]
      : []),
    ...(contentManager && !admin
      ? [
          section('Content & Events', [
            ['Content Studio', '/dashboard/cms'],
            ['Events', '/dashboard/events'],
            ['Opportunities', '/dashboard/opportunities'],
            ['Shop categories', workspace('sectors')],
          ]),
          section('Communications', [['Emails', workspace('communications')]]),
        ]
      : []),
    ...profile.staff.map(({ slug, name, kind }) => {
      const base = workspace('school') + '&institution=' + encodeURIComponent(slug);
      const links =
        kind === 'high-school'
          ? [
              ['Incubation Pathway', base + '&view=cohorts&section=teams'],
              ['Results & Certificates', base + '&view=cohorts&section=results'],
            ]
          : [
              ['Affiliation Requests', base + '&view=requests'],
              ['Member Progress', base + '&view=progress'],
              ['Payments & Certificates', base + '&view=finance'],
            ];
      return section(name, [['Portal', base], ...links]);
    }),
    section('Account', [
      ['Profile', '/dashboard/profile'],
      ...(founder || mentor ? [['Events', '/dashboard/events']] : []),
      ...(founder ? [['Certificates', '/dashboard/certificates']] : []),
    ]),
  ];
  const currentPath = pathname.replace(/\/$/, '');
  const portalView = params.get('view');
  const institutionTitle =
    portalView === 'requests'
      ? 'Affiliation Requests'
      : portalView === 'finance'
        ? 'Payments & Certificates'
        : portalView === 'progress'
          ? 'Member Progress'
          : params.get('section') === 'results'
            ? 'Results & Certificates'
            : params.get('section') === 'teams'
              ? 'Incubation Pathway'
              : 'Portal';
  const title =
    (view === 'school' ? institutionTitle : dashboardEventMatch ? 'Event details' : undefined) ??
    navGroups
      .flatMap((group) => group.links)
      .find((link) => link.to === currentPath || link.to === workspace(view))?.label ??
    'Workspace';

  return (
    <LaravelDashboardFrame
      groups={navGroups}
      badges={{
        [workspace('approvals')]: summary.records?.metrics.approvals ?? 0,
        [workspace('payments')]: summary.records?.metrics.payments ?? 0,
        [workspace('communications')]: summary.records?.metrics.enquiries ?? 0,
      }}
      title={title}
      role={roleLabels[profile.role]}
      accountId={profile.id}
      signOut={session.signOut}
      record={view === 'institutions' ? records : undefined}
    >
      {overview ? (
        <>
          <RecordsFeedback error={summary.error} loading={!summary.records} />
          <WorkspaceOverview groups={navGroups} profile={profile} summary={summary.records} />
        </>
      ) : view === 'profile' ? (
        <section className="dashboard-profile">
          <h1 className="sr-only">Profile</h1>
          <div className="dashboard-profile-grid">
            <aside className="dashboard-profile-settings">
              <div className="profile-panel dashboard-profile-card dashboard-profile-summary">
                <span className="avatar-initials">
                  {profile.name
                    .trim()
                    .split(/\s+/)
                    .slice(0, 2)
                    .map((word) => word[0])
                    .join('')
                    .toUpperCase()}
                </span>
                <h2>{profile.name}</h2>
                <span className="dashboard-profile-role">{roleLabels[profile.role]}</span>
                <p>{profile.affiliation?.name ?? profile.staff.map((s) => s.name).join(', ')}</p>
                <ChangePasswordDialog />
              </div>
            </aside>
            <div>
              <ProfileForm
                person={profile}
                save={async (fields) => {
                  await localLaravelIdentity.updateProfile(fields);
                  await session.refresh();
                  return true;
                }}
              />
            </div>
          </div>
        </section>
      ) : view === 'institutions' && admin ? (
        <>
          <InstitutionDirectory record={records} />
        </>
      ) : view === 'approvals' && admin ? (
        <ApprovalQueue />
      ) : view === 'reports' && admin ? (
        summary.records ? (
          <ActivityReport summary={summary.records} />
        ) : (
          <RecordsFeedback error={summary.error} loading />
        )
      ) : view === 'users' && admin ? (
        <AccountDirectory actor={profile.id} />
      ) : view === 'ventures' && (admin || founder) ? (
        admin ? (
          <AdminVentures />
        ) : (
          <VentureWorkspace admin={false} />
        )
      ) : view === 'incubation' && programmeRole ? (
        <>
          <IncubationProgramme role={programmeRole} />
        </>
      ) : view === 'products' && programmeRole ? (
        <>
          {admin ? (
            <WorkspaceTabs
              label="Marketplace management"
              views={[
                { id: 'products', label: 'Products', content: <ProductsWorkspace role="admin" /> },
                { id: 'categories', label: 'Categories', content: <MarketplaceSectorAdmin /> },
              ]}
            />
          ) : (
            <ProductsWorkspace role={programmeRole} />
          )}
        </>
      ) : view === 'editorial' && canEditContent ? (
        <EditorialWorkspace />
      ) : view === 'communications' && canEditContent ? (
        <CommunicationsWorkspace />
      ) : view === 'sectors' && canEditContent ? (
        <MarketplaceSectorAdmin />
      ) : dashboardEventMatch?.[1] && (canEditContent || founder || mentor) ? (
        <LaravelEventPage dashboard slugOverride={decodeURIComponent(dashboardEventMatch[1])} />
      ) : view === 'events' && (canEditContent || founder || mentor) ? (
        canEditContent ? (
          <EventAdministration />
        ) : (
          <EventCatalogue embedded />
        )
      ) : view === 'learning' && founder ? (
        <LearningWorkspace />
      ) : view === 'opportunities' && (canEditContent || founder) ? (
        <OpportunityWorkspace admin={canEditContent} canReviewSubmissions={admin} />
      ) : view === 'courses' && (admin || mentor) ? (
        <CourseAdministration admin={admin} />
      ) : view === 'mentors' && admin ? (
        <>
          <ProgrammeMentors />
        </>
      ) : view === 'payments' && admin ? (
        <>
          <ProgrammePayments />
        </>
      ) : view === 'certificates' && (admin || founder) ? (
        <>
          {admin ? (
            <WorkspaceTabs
              label="Certificate sections"
              views={[
                {
                  id: 'ventures',
                  label: 'Individual ventures',
                  content: <VentureCertificates admin />,
                },
                {
                  id: 'courses',
                  label: 'General courses',
                  content: <CourseEnrolmentRegistry />,
                },
                {
                  id: 'schools',
                  label: 'School requests',
                  content: <SchoolCertificateQueue />,
                },
              ]}
            />
          ) : (
            <VentureCertificates admin={false} />
          )}
        </>
      ) : view === 'school' && admin && institutions === null ? (
        <RecordsFeedback loading error={institutionError} />
      ) : view === 'school' && portal ? (
        <>
          <InstitutionPortal key={portal.slug} institution={portal} admin={admin} />
        </>
      ) : (
        <>
          <h1>Workspace unavailable</h1>
          <Link to="/dashboard">Return to the dashboard</Link>
        </>
      )}
    </LaravelDashboardFrame>
  );
}
