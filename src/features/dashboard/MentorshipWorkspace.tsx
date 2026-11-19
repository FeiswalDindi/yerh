import { usePageTitle } from '../../shared/usePageTitle';
import { useDemo } from '../../app/useDemo';
import { PageIntro } from '../../shared/PageIntro';
import { DemoNotice } from '../demo/DemoNotice';
import { Link, useSearchParams } from 'react-router-dom';
import { WorkspaceDialog, WorkspaceTable, WorkspaceTabs } from '../platform/WorkspaceControls';
export function MentorshipWorkspace() {
  usePageTitle('Mentorship requests');
  const { state, account, execute } = useDemo();
  const [params] = useSearchParams();
  if (!account) return null;
  const requests = state.requests.filter(
    (r) => account.role === 'admin' || r.mentorId === account.id || r.menteeId === account.id,
  );
  const name = (id: string) =>
    state.accounts.find((account) => account.id === id)?.name ?? 'Member';
  const selected = requests.find((row) => row.id === params.get('request'));
  const requestHref = (id?: string) => {
    const next = new URLSearchParams(params);
    if (id) next.set('request', id);
    else next.delete('request');
    return '?' + next.toString();
  };
  const pending = requests.filter((request) => request.status === 'pending');
  const history = requests.filter((request) => request.status !== 'pending');
  const table = (entries: typeof requests, empty: string) => (
    <WorkspaceTable
      label="mentorship requests"
      columns={['Mentee', 'Mentor', 'Action']}
      empty={empty}
      actions={<Link to="/yem/mentees">Explore mentorship</Link>}
      rows={entries.map((request) => {
        const mentor = name(request.mentorId);
        const mentee = name(request.menteeId);
        const canReview =
          request.status === 'pending' &&
          (request.mentorId === account.id || account.role === 'admin');
        return {
          id: request.id,
          search: [mentor, mentee, request.goal].join(' '),
          cells: [
            mentee,
            mentor,
            canReview ? (
              <WorkspaceDialog action="Review request" title={mentee + ' · ' + mentor}>
                {(finish) => (
                  <>
                    <p className="workspace-detail-copy">{request.goal}</p>
                    {canReview && (
                      <div className="workspace-form-footer">
                        <button
                          className="button button-outline"
                          onClick={() =>
                            finish(
                              execute({
                                type: 'request-status',
                                requestId: request.id,
                                status: 'declined',
                              }),
                            )
                          }
                        >
                          Decline
                        </button>
                        <button
                          className="button"
                          onClick={() =>
                            finish(
                              execute({
                                type: 'request-status',
                                requestId: request.id,
                                status: 'accepted',
                              }),
                            )
                          }
                        >
                          Accept request
                        </button>
                      </div>
                    )}
                  </>
                )}
              </WorkspaceDialog>
            ) : (
              <Link to={requestHref(request.id)}>View request</Link>
            ),
          ],
        };
      })}
    />
  );
  return (
    <>
      <PageIntro
        eyebrow="Mentorship"
        title="Mentorship requests"
        description="Review pending requests and track past decisions."
        className="workspace-page-intro"
      />
      <section className="container section workspace-content">
        <DemoNotice />
        {selected ? (
          <section className="workspace-record">
            <Link to={requestHref()}>← Mentorship requests</Link>
            <h3>
              {name(selected.menteeId)} · {name(selected.mentorId)}
            </h3>
            <p className="workspace-detail-copy">{selected.goal}</p>
          </section>
        ) : (
          <WorkspaceTabs
            label="Mentorship request views"
            views={[
              {
                id: 'pending',
                label: 'Pending',
                count: pending.length,
                content: table(pending, 'No mentorship requests are pending.'),
              },
              {
                id: 'history',
                label: 'History',
                count: history.length,
                content: table(history, 'No mentorship requests have been decided.'),
              },
            ]}
          />
        )}
      </section>
    </>
  );
}
