import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useDemo } from '../../app/useDemo';
import { roleLabels } from '../../domain/roles';
import { PageIntro } from '../../shared/PageIntro';
import { usePageTitle } from '../../shared/usePageTitle';
import { dashboardGroups } from '../dashboard/dashboard-navigation';
import { dashboardMetrics, dashboardTitles } from '../dashboard/dashboard-overview';
import { DemoNotice } from '../demo/DemoNotice';

const guestLinks = [
  {
    label: 'Explore courses',
    to: '/learn',
    description: 'Browse entrepreneurship courses and learning resources.',
  },
  {
    label: 'Upcoming events',
    to: '/events',
    description: 'Find workshops, webinars and community events.',
  },
  {
    label: 'Marketplace',
    to: '/marketplace',
    description: 'Discover products and services from youth ventures.',
  },
];

export function RoleDashboard() {
  const { account, state } = useDemo();
  const title = account ? dashboardTitles[account.role] : 'My dashboard';
  usePageTitle(title);
  if (!account) return null;

  const isGuest = account.role === 'guest';
  const applications = state.platform.applications
    .filter((a) => a.accountId === account.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const pending = applications.find((a) => a.status === 'pending');
  const recent = applications[0];
  const metrics = dashboardMetrics(state, account);
  const shortcuts = isGuest
    ? guestLinks
    : dashboardGroups(account)
        .slice(1, -1)
        .flatMap((group) => group.links)
        .slice(0, 4);

  return (
    <>
      <PageIntro
        eyebrow={title}
        title={`Welcome, ${account.name.split(' ')[0]}.`}
        description={`Signed in as ${roleLabels[account.role]}.`}
      />
      <section className="container section dashboard-overview">
        <DemoNotice />
        {isGuest && (
          <section className="profile-panel">
            <h2>{pending ? 'Application under review' : 'Apply for a role'}</h2>
            <p>
              {pending
                ? `Your ${roleLabels[pending.role]} application is pending review.`
                : 'Choose Entrepreneur, Mentor, Investor or Partner to apply for access.'}
            </p>
            {recent?.status === 'rejected' && recent.reason && (
              <p>Reviewer feedback: {recent.reason}</p>
            )}
            <Link className="button" to="/dashboard/applications">
              {pending ? 'Track application' : 'Choose a role'}{' '}
              <ArrowRight size={16} aria-hidden="true" />
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
        <div className="workspace-links">
          {shortcuts.map((link) => (
            <Link className="collection-card" key={link.to} to={link.to}>
              <h3>{link.label}</h3>
              <p>{link.description}</p>
              <ArrowRight size={18} aria-hidden="true" />
            </Link>
          ))}
        </div>
        {!isGuest && recent && (
          <section className="profile-panel">
            <h2>Latest role application</h2>
            <p>
              {roleLabels[recent.role]} · {recent.status}
            </p>
            {recent.reason && <p>Reviewer feedback: {recent.reason}</p>}
            <Link className="text-link" to="/dashboard/applications">
              View application history <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </section>
        )}
      </section>
    </>
  );
}
