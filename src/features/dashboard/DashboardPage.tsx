import { Link } from 'react-router-dom';
import { BookOpen, FileText, MessageSquare, Shield, Users, UserRound } from 'lucide-react';
import { useDemo } from '../../app/useDemo';
import { useCatalog } from '../../app/useCatalog';
import { PageIntro } from '../../shared/PageIntro';
import { DemoNotice } from '../demo/DemoNotice';
import { usePageTitle } from '../../shared/usePageTitle';
export function DashboardPage() {
  const { state, account } = useDemo();
  const { lessons } = useCatalog();
  usePageTitle('My workspace');
  if (!account) return null;
  const requests = state.requests.filter(
    (r) => account.role === 'admin' || r.menteeId === account.id || r.mentorId === account.id,
  );
  return (
    <>
      <PageIntro
        eyebrow={`${account.role} workspace`}
        title={`Welcome, ${account.name.split(' ')[0]}.`}
        description="Your local demo workspace. Switch roles to explore both sides of the community workflows."
      />
      <section className="container section">
        <DemoNotice />
        <p className="community-toolbar">
          <Link className="text-link" to={`/network/members/${account.id}`}>
            View my community profile →
          </Link>
          <Link className="text-link" to={`/network/members/${account.id}?tab=events`}>
            My sessions & registrations →
          </Link>
        </p>
        <div className="workspace-stats">
          <div>
            <strong>
              {(state.progress[account.id] ?? []).length}/{lessons.length}
            </strong>
            <span>Lessons marked complete</span>
          </div>
          <div>
            <strong>{state.groups.filter((g) => g.memberIds.includes(account.id)).length}</strong>
            <span>Groups joined</span>
          </div>
          <div>
            <strong>{requests.filter((r) => r.status === 'pending').length}</strong>
            <span>Pending mentorship requests</span>
          </div>
          <div>
            <strong>{state.submissions.filter((s) => s.ownerId === account.id).length}</strong>
            <span>My content drafts</span>
          </div>
        </div>
        <div className="workspace-links">
          {[
            {
              label: 'My profile',
              text: 'Edit your fictional profile and headline.',
              href: '/profile',
              icon: UserRound,
            },
            {
              label: 'My learning',
              text: 'Continue lessons and update your progress.',
              href: '/learn',
              icon: BookOpen,
            },
            {
              label: 'Mentorship requests',
              text:
                account.role === 'mentor'
                  ? 'Review and respond to assigned requests.'
                  : 'Track your guidance requests and their status.',
              href: '/dashboard/mentorship',
              icon: Users,
            },
            {
              label:
                account.role === 'entrepreneur'
                  ? 'My business & stories'
                  : account.role === 'content_manager'
                    ? 'Editorial workspace'
                    : 'My contributions',
              text: 'Create drafts and try the local review workflow.',
              href: '/dashboard/content',
              icon: FileText,
            },
            {
              label: 'Community discussions',
              text: 'Start a topic or reply to the community.',
              href: '/forums',
              icon: MessageSquare,
            },
            ...(account.role === 'admin'
              ? [
                  {
                    label: 'Moderation & review',
                    text: 'Review business submissions and moderate forum topics.',
                    href: '/dashboard/moderation',
                    icon: Shield,
                  },
                ]
              : []),
          ].map(({ label, text, href, icon: Icon }) => (
            <Link className="collection-card" to={href} key={href}>
              <Icon size={28} />
              <h2>{label}</h2>
              <p>{text}</p>
              <span>Open workspace →</span>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
