import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useDemo } from '../../app/useDemo';
import { applicationRoles, roleLabels, type AppliedRole } from '../../domain/roles';
import { PageIntro } from '../../shared/PageIntro';
import { DemoNotice } from '../demo/DemoNotice';
import { usePageTitle } from '../../shared/usePageTitle';
export function ApplicationsPage() {
  const { account, state, execute } = useDemo();
  const [role, setRole] = useState<AppliedRole>('entrepreneur');
  usePageTitle('Apply for a role');
  const applications = state.platform.applications.filter((a) => a.accountId === account?.id);
  const pending = applications.some((a) => a.status === 'pending');
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (
      execute({
        type: 'role-apply',
        id: crypto.randomUUID(),
        role,
        motivation: String(f.get('motivation')),
        organisation: String(f.get('organisation') ?? ''),
        expertise: String(f.get('expertise') ?? ''),
        now: new Date().toISOString(),
      })
    )
      e.currentTarget.reset();
  }
  return (
    <>
      <PageIntro
        eyebrow="Your pathway"
        title="One account. A world of possibilities."
        description="Create your account first, apply for a role, and track the administrator’s decision here."
      />
      <section className="container section">
        <DemoNotice />
        {!account ? (
          <div className="empty-state">
            <h2>Sign in before applying</h2>
            <Link className="button" to="/register">
              Create an account
            </Link>
            <Link to="/login">Already have an account? Sign in</Link>
          </div>
        ) : (
          <>
            <div className="role-choice-grid">
              {applicationRoles.map((r) => (
                <button
                  className={`role-choice ${r === role ? 'selected' : ''}`}
                  aria-pressed={role === r}
                  key={r}
                  onClick={() => setRole(r)}
                >
                  <h2>{roleLabels[r]}</h2>
                  <p>
                    {r === 'entrepreneur'
                      ? 'Build your venture, learn, and apply for support.'
                      : r === 'mentor'
                        ? 'Share your expertise and support founder progress.'
                        : r === 'investor'
                          ? 'Discover ventures and offer funding opportunities.'
                          : 'Offer programmes, markets and technical support.'}
                  </p>
                </button>
              ))}
            </div>
            <form className="workspace-form" onSubmit={submit}>
              <h2>Apply as {roleLabels[role]}</h2>
              <p>
                Current role: {roleLabels[account.role]}. Approval replaces your current primary
                role.
              </p>
              {['investor', 'partner'].includes(role) && (
                <label>
                  Organisation name
                  <input name="organisation" required minLength={3} maxLength={120} />
                </label>
              )}
              {role === 'mentor' && (
                <label>
                  Expertise and experience
                  <textarea name="expertise" required minLength={5} maxLength={500} />
                </label>
              )}
              <label>
                Why are you applying? Include your goals and relevant experience.
                <textarea name="motivation" rows={5} required minLength={30} maxLength={2000} />
              </label>
              <button className="button" disabled={pending || account.role === role}>
                Submit application
              </button>
              {pending && (
                <p role="status">
                  Your application is pending review. You can continue browsing public content.
                </p>
              )}
            </form>
            <h2>Application history</h2>
            <div className="request-list">
              {applications.map((a) => (
                <article className="profile-panel" key={a.id}>
                  <span className={`status-pill ${a.status}`}>{a.status}</span>
                  <h3>{roleLabels[a.role]}</h3>
                  <p>{a.motivation}</p>
                  {a.reason && <p>Reviewer feedback: {a.reason}</p>}
                </article>
              ))}
              {!applications.length && <p>No applications submitted yet.</p>}
            </div>
          </>
        )}
      </section>
    </>
  );
}
