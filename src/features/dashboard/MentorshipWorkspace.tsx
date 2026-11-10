import { usePageTitle } from '../../shared/usePageTitle';
import { useDemo } from '../../app/useDemo';
import { PageIntro } from '../../shared/PageIntro';
import { DemoNotice } from '../demo/DemoNotice';
import { Link } from 'react-router-dom';
export function MentorshipWorkspace() {
  usePageTitle('Mentorship requests');
  const { state, account, execute } = useDemo();
  if (!account) return null;
  const requests = state.requests.filter(
    (r) => account.role === 'admin' || r.mentorId === account.id || r.menteeId === account.id,
  );
  return (
    <>
      <PageIntro
        eyebrow="My mentorship"
        title="Make the next step a shared one."
        description="Track requests or review the ones assigned to your demo account."
      />
      <section className="container section">
        <DemoNotice />
        <div className="request-list">
          {requests.map((r) => (
            <article key={r.id} className="review-card">
              <div>
                <p className="eyebrow">{r.status}</p>
                <h2>
                  {state.accounts.find((a) => a.id === r.menteeId)?.name} →{' '}
                  {state.accounts.find((a) => a.id === r.mentorId)?.name}
                </h2>
                <p>{r.goal}</p>
              </div>
              {r.status === 'pending' &&
                (r.mentorId === account.id || account.role === 'admin') && (
                  <div className="form-actions">
                    <button
                      className="button"
                      onClick={() =>
                        execute({ type: 'request-status', requestId: r.id, status: 'accepted' })
                      }
                    >
                      Accept request
                    </button>
                    <button
                      className="text-link"
                      onClick={() =>
                        execute({ type: 'request-status', requestId: r.id, status: 'declined' })
                      }
                    >
                      Decline
                    </button>
                  </div>
                )}
            </article>
          ))}
        </div>
        {!requests.length && (
          <div className="empty-state">
            <h2>No requests yet.</h2>
            <Link className="button" to="/yem/mentees">
              Explore mentorship
            </Link>
          </div>
        )}
      </section>
    </>
  );
}
