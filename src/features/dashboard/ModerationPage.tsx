import { usePageTitle } from '../../shared/usePageTitle';
import { Link } from 'react-router-dom';
import { useDemo } from '../../app/useDemo';
import { PageIntro } from '../../shared/PageIntro';
import { DemoNotice } from '../demo/DemoNotice';
export function ModerationPage() {
  usePageTitle('Moderation');
  const { state, execute } = useDemo();
  return (
    <>
      <PageIntro
        eyebrow="Administration demo"
        title="Keep the community constructive."
        description="Moderate local forum discussions and review submitted content. These controls are simulated, not production security."
      />
      <section className="container section">
        <DemoNotice />
        <Link className="button" to="/dashboard/content">
          Review content & business submissions
        </Link>
        <div className="section-heading section">
          <h2>Forum moderation</h2>
        </div>
        <div className="request-list">
          {state.threads.map((t) => (
            <article className="review-card" key={t.id}>
              <div>
                <span className="eyebrow">{t.hidden ? 'Hidden' : 'Visible'}</span>
                <h2>{t.title}</h2>
                <p>{t.body}</p>
              </div>
              <button
                className="button"
                onClick={() => execute({ type: 'moderate', threadId: t.id })}
              >
                {t.hidden ? 'Restore discussion' : 'Hide discussion'}
              </button>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
