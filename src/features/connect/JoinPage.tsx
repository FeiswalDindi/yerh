import { useState } from 'react';
import { ArrowRight, ArrowUpRight, Check, Lightbulb, Sprout, Users } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { PageIntro } from '../../shared/PageIntro';
import { usePageTitle } from '../../shared/usePageTitle';
import { platformHref } from '../../config/site';
const pathways = [
  {
    id: 'entrepreneur',
    icon: Lightbulb,
    title: 'I have an idea',
    text: 'Build your business foundations.',
    next: '/resources',
    action: 'Explore business essentials',
  },
  {
    id: 'mentee',
    icon: Sprout,
    title: 'I’m growing a business',
    text: 'Find knowledge and inspiration.',
    next: '/publications/stories',
    action: 'Learn from other entrepreneurs',
  },
  {
    id: 'mentor',
    icon: Users,
    title: 'I want to give back',
    text: 'Share your experience as a mentor.',
    next: '/contact?topic=Mentorship',
    action: 'Talk to the YERH team',
  },
];
export function JoinPage({ login = false }: { login?: boolean }) {
  const [params] = useSearchParams();
  const [role, setRole] = useState(params.get('role') || 'entrepreneur');
  const [ready, setReady] = useState(false);
  const selected = pathways.find((p) => p.id === role) || pathways[0]!;
  const hostHref = platformHref(login ? '/login' : '/register');
  usePageTitle(login ? 'Member area' : 'Find your pathway');
  return (
    <>
      <PageIntro
        eyebrow={login ? 'Member area' : 'Get started'}
        title={login ? 'Welcome back to the hub.' : 'Where will your next step take you?'}
        description={
          login
            ? 'Continue your entrepreneurial journey with the YERH community.'
            : 'Choose the path that feels right for you. You can explore the hub freely.'
        }
      />
      <section className="container section join-section">
        {login ? (
          <div className="member-panel">
            <Users size={34} />
            <h2>Your community is here.</h2>
            {hostHref ? (
              <>
                <p>Continue to the YERH platform to access your account.</p>
                <a className="button" href={hostHref}>
                  Continue to log in
                  <ArrowRight size={17} />
                </a>
              </>
            ) : (
              <>
                <p>
                  Member sign-in is not available in this local preview. You can still explore the
                  full resource collection and save your favourites on this browser.
                </p>
                <Link className="button" to="/resources">
                  Explore the resources
                  <ArrowRight size={17} />
                </Link>
                <Link className="text-link" to="/saved">
                  View saved resources
                  <ArrowUpRight size={16} />
                </Link>
              </>
            )}
          </div>
        ) : (
          <>
            <div className="pathway-options" role="group" aria-label="Choose your pathway">
              {pathways.map(({ id, icon: Icon, title, text }) => (
                <button
                  key={id}
                  className={role === id ? 'selected' : ''}
                  aria-pressed={role === id}
                  onClick={() => {
                    setRole(id);
                    setReady(false);
                  }}
                >
                  <span className="pathway-check">{role === id && <Check size={16} />}</span>
                  <Icon size={32} />
                  <h2>{title}</h2>
                  <p>{text}</p>
                </button>
              ))}
            </div>
            {ready ? (
              <div className="pathway-result" role="status">
                <span className="eyebrow">YOUR NEXT STEP</span>
                <h2>{selected.action}</h2>
                <p>Start with the collection selected for your journey.</p>
                <Link className="button" to={selected.next}>
                  Let’s get started
                  <ArrowRight size={18} />
                </Link>
                {hostHref && (
                  <a className="text-link" href={hostHref}>
                    Create a member account
                    <ArrowUpRight size={16} />
                  </a>
                )}
              </div>
            ) : (
              <div className="join-continue">
                <button className="button" onClick={() => setReady(true)}>
                  Show my next step
                  <ArrowRight size={18} />
                </button>
                <p>No account needed to explore.</p>
              </div>
            )}
          </>
        )}
      </section>
    </>
  );
}
