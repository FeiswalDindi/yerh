import { Link } from 'react-router-dom';
import { useDemo } from '../../app/useDemo';
import { can, roleLabels } from '../../domain/roles';
import { PageIntro } from '../../shared/PageIntro';
import { DemoNotice } from '../demo/DemoNotice';
import { usePageTitle } from '../../shared/usePageTitle';
export function RoleDashboard() {
  const { account, state } = useDemo();
  usePageTitle('My dashboard');
  if (!account) return null;
  const p = state.platform;
  const links = [
    {
      title: 'My profile',
      text: 'Keep your member profile up to date.',
      to: '/profile',
      show: true,
    },
    {
      title: 'Role applications',
      text: 'Apply for a role and track decisions.',
      to: '/apply',
      show: true,
    },
    {
      title: 'My learning',
      text: 'Enroll and track your course progress.',
      to: '/learn',
      show: can(account, 'learn'),
    },
    {
      title: 'Ventures & products',
      text: 'Manage your venture, listings and incubation.',
      to: '/dashboard/workspace?tab=ventures',
      show: can(account, 'venture'),
    },
    {
      title: 'Mentor workspace',
      text: 'Set availability and guide assigned founders.',
      to: '/dashboard/workspace?tab=mentor',
      show: can(account, 'mentor'),
    },
    {
      title: 'Organisation workspace',
      text: 'Manage opportunities, applicants and your profile.',
      to: '/dashboard/workspace?tab=organisation',
      show: can(account, 'organisation'),
    },
    {
      title: 'Content studio',
      text: 'Manage site content, media, pages and publishing.',
      to: '/dashboard/cms',
      show: can(account, 'cms'),
    },
    {
      title: 'Administration',
      text: 'Review applications, users and approvals.',
      to: '/dashboard/workspace?tab=approvals',
      show: can(account, 'admin'),
    },
    {
      title: 'Analytics & reporting',
      text: 'Current platform counts and audit export.',
      to: '/dashboard/workspace?tab=reports',
      show: can(account, 'admin'),
    },
    {
      title: 'My event registrations',
      text: 'Review your sessions and reserved places.',
      to: `/network/members/${account.id}?tab=events`,
      show: can(account, 'attend'),
    },
    {
      title: 'Community',
      text: 'Find your groups and participate in discussions.',
      to: '/forums',
      show: can(account, 'community'),
    },
    {
      title: 'Mentorship',
      text: 'Request guidance or respond to assigned requests.',
      to: '/dashboard/mentorship',
      show: can(account, 'apply') || can(account, 'mentor'),
    },
    {
      title: 'My contributions',
      text: 'Write and review blogs, stories and listings.',
      to: '/dashboard/content',
      show: account.role !== 'guest',
    },
    {
      title: 'Content moderation',
      text: 'Review community discussions.',
      to: '/dashboard/moderation',
      show: can(account, 'cms'),
    },
  ];
  return (
    <>
      <PageIntro
        eyebrow={roleLabels[account.role]}
        title={`Welcome, ${account.name.split(' ')[0]}.`}
        description={
          account.role === 'guest'
            ? 'Your account is ready. Choose a pathway and apply for role access.'
            : 'Your approved role connects you to the tools and workflows below.'
        }
      />
      <section className="container section">
        <DemoNotice />
        <div className="workspace-stats">
          <div>
            <strong>
              {
                p.applications.filter((a) => a.accountId === account.id && a.status === 'pending')
                  .length
              }
            </strong>
            <span>Pending role applications</span>
          </div>
          <div>
            <strong>{p.enrollments[account.id]?.length ?? 0}</strong>
            <span>Courses enrolled</span>
          </div>
          <div>
            <strong>
              {
                state.registrations.filter(
                  (r) => r.memberId === account.id && r.status === 'registered',
                ).length
              }
            </strong>
            <span>Reserved sessions</span>
          </div>
          <div>
            <strong>
              {can(account, 'cms')
                ? p.cmsRevision
                : p.ventures.filter((v) => v.ownerId === account.id).length}
            </strong>
            <span>{can(account, 'cms') ? 'Published site revision' : 'My ventures'}</span>
          </div>
        </div>
        <div className="workspace-links">
          {links
            .filter((l) => l.show)
            .map((l) => (
              <Link className="collection-card" key={l.to} to={l.to}>
                <h2>{l.title}</h2>
                <p>{l.text}</p>
                <span className="text-link">Open workspace →</span>
              </Link>
            ))}
        </div>
        {p.certificates.some((c) => c.accountId === account.id) && (
          <section className="profile-panel">
            <h2>My completion records</h2>
            {p.certificates
              .filter((c) => c.accountId === account.id)
              .map((c) => (
                <Link className="profile-sidebar-link" to={`/certificates/${c.id}`} key={c.id}>
                  View course completion record · {new Date(c.issuedAt).toLocaleDateString('en-KE')}{' '}
                  →
                </Link>
              ))}
          </section>
        )}
        <h2 className="community-section-title">Recent role decisions</h2>
        {p.applications
          .filter((a) => a.accountId === account.id)
          .map((a) => (
            <p key={a.id}>
              {roleLabels[a.role]} · {a.status}
              {a.reason ? ` · ${a.reason}` : ''}
            </p>
          ))}
      </section>
    </>
  );
}
