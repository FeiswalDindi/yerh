import { ArrowRight, Award, CalendarDays, GraduationCap, Store } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useDemo } from '../../app/useDemo';
import { roleLabels } from '../../domain/roles';
import { PageIntro } from '../../shared/PageIntro';
import { usePageTitle } from '../../shared/usePageTitle';
import { accountRoleRequests, roleAccessPath } from '../accounts/role-requests';
import { dashboardCataloguePaths } from '../dashboard/catalogue-paths';
import { dashboardGroups, guestResourceLinks } from '../dashboard/dashboard-navigation';
import { dashboardMetrics, dashboardTitles } from '../dashboard/dashboard-overview';
import { DemoNotice } from '../demo/DemoNotice';
import './workspace.css';

const guestResourceIcons: Record<string, typeof Award> = {
  '/dashboard/learning': GraduationCap,
  '/dashboard/events': CalendarDays,
  [dashboardCataloguePaths.marketplace]: Store,
  '/dashboard/certificates': Award,
};

export function RoleDashboard() {
  const { account, state } = useDemo();
  const title = account ? dashboardTitles[account.role] : 'My dashboard';
  usePageTitle(title);
  if (!account) return null;

  const isGuest = account.role === 'guest';
  const applications = accountRoleRequests(state.platform.applications, account.id);
  const recent = applications[0];
  const metrics = dashboardMetrics(state, account);
  const shortcuts = isGuest
    ? guestResourceLinks
    : dashboardGroups(account)
        .slice(1, -1)
        .flatMap((group) => group.links)
        .slice(0, 4);

  return (
    <>
      <PageIntro
        className={isGuest ? undefined : 'workspace-page-intro'}
        eyebrow={title}
        title={`Welcome, ${account.name.split(' ')[0]}.`}
        description={`Signed in as ${roleLabels[account.role]}.`}
      />
      <section className="container section dashboard-overview">
        <DemoNotice />
        {isGuest && recent && (
          <section className="profile-panel guest-role-panel">
            <div>
              <h2>Role application</h2>
              <p>Requested role · {roleLabels[recent.role]}</p>
              {recent?.status === 'rejected' && recent.reason && (
                <p>Reviewer feedback: {recent.reason}</p>
              )}
            </div>
            <Link className="button" to={roleAccessPath}>
              View in Profile <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </section>
        )}
        {!isGuest && (
          <div className="workspace-stats" aria-label="Workspace activity">
            {metrics.map((metric) => (
              <Link key={metric.label} to={metric.to} className="dashboard-metric">
                <strong>{metric.value}</strong>
                <span>{metric.label}</span>
              </Link>
            ))}
          </div>
        )}
        <h2 className="dashboard-section-title">{isGuest ? 'Explore the hub' : 'Quick actions'}</h2>
        <div className={isGuest ? 'guest-resource-grid' : 'workspace-quick-links'}>
          {shortcuts.map((link) => {
            const Icon = isGuest ? guestResourceIcons[link.to] : undefined;
            return (
              <Link
                className={isGuest ? 'collection-card' : 'workspace-quick-link'}
                key={link.to}
                to={link.to}
              >
                {Icon && (
                  <span className="guest-resource-icon">
                    <Icon size={22} aria-hidden="true" />
                  </span>
                )}
                {isGuest ? (
                  <>
                    <h3>{link.label}</h3>
                    <p>{link.description}</p>
                  </>
                ) : (
                  <div>
                    <h3>{link.label}</h3>
                    <p>{link.description}</p>
                  </div>
                )}
                <ArrowRight size={18} aria-hidden="true" />
              </Link>
            );
          })}
        </div>
        {!isGuest && account.role !== 'school_admin' && recent && (
          <section className="profile-panel">
            <h2>Latest role request</h2>
            <p>
              {roleLabels[recent.role]}
              {account.role === 'admin' && ' · ' + recent.status}
            </p>
            {recent.reason && <p>Reviewer feedback: {recent.reason}</p>}
            <Link className="text-link" to={roleAccessPath}>
              View role request history <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </section>
        )}
      </section>
    </>
  );
}
