import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, LogOut, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { useDemo } from '../../app/useDemo';
import { PageIntro } from '../../shared/PageIntro';
import { usePageTitle } from '../../shared/usePageTitle';
import { platformHref } from '../../config/site';
import { DemoNotice } from './DemoNotice';
import { roleLabels } from '../../domain/roles';
export function LoginPage() {
  const { state, account, enabled, execute, reset } = useDemo();
  const navigate = useNavigate();
  const [confirm, setConfirm] = useState(false);
  const host = platformHref('/login');
  usePageTitle('Login');
  return (
    <>
      <PageIntro
        eyebrow="Member login"
        title="Find your place in the hub."
        description="Explore the different member experiences with a development demo account."
      />
      <section className="container section">
        <DemoNotice />
        {enabled ? (
          <>
            <div className="demo-account-grid">
              {state.accounts.map((person) => (
                <article key={person.id} className="demo-account-card">
                  <span className="avatar-initials">
                    {person.name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')}
                  </span>
                  <p className="eyebrow">{roleLabels[person.role]} demo</p>
                  <h2>{person.name}</h2>
                  <p>{person.headline}</p>
                  <button
                    className="button"
                    onClick={() => {
                      if (execute({ type: 'login', accountId: person.id })) navigate('/dashboard');
                    }}
                  >
                    Login as {roleLabels[person.role]}
                    <ArrowRight size={16} />
                  </button>
                </article>
              ))}
            </div>
            <div className="demo-controls">
              {account && (
                <button className="text-link" onClick={() => execute({ type: 'logout' })}>
                  <LogOut size={16} />
                  Sign out of {account.name}
                </button>
              )}
              <button className="text-link" onClick={() => setConfirm((v) => !v)}>
                <RotateCcw size={16} />
                Reset demo data
              </button>
            </div>
            {confirm && (
              <div className="inline-confirm">
                <p>
                  Reset fictional profiles, discussions, progress, and drafts stored by this demo?
                  Your original website archive is unaffected.
                </p>
                <button
                  className="button"
                  onClick={() => {
                    reset();
                    setConfirm(false);
                  }}
                >
                  Reset local demo
                </button>
                <button className="text-link" onClick={() => setConfirm(false)}>
                  Cancel
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="empty-state">
            <h2>Demo sign-in is disabled in production builds.</h2>
            {host ? (
              <a className="button" href={host}>
                Continue to member login
              </a>
            ) : (
              <Link className="button" to="/resources">
                Explore public resources
              </Link>
            )}
          </div>
        )}
        {host && enabled && (
          <p className="external-login">
            <a href={host}>Continue to the connected platform instead →</a>
          </p>
        )}
      </section>
    </>
  );
}
