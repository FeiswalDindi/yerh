import { Link, useSearchParams } from 'react-router-dom';
import { useDemo } from '../../app/useDemo';
import { WorkspaceTable } from '../platform/workspace/WorkspaceControls';

export function OpportunityApplications() {
  const { account, state } = useDemo();
  const [params] = useSearchParams();
  const { opportunities, opportunityApplications } = state.platform;
  const applications = opportunityApplications.filter((row) => row.accountId === account?.id);
  const requested = params.get('application');
  const selected = applications.find((row) => row.id === requested);
  const title = (id: string) =>
    opportunities.find((opportunity) => opportunity.id === id)?.title ?? 'Opportunity';

  function applicationHref(id?: string) {
    const next = new URLSearchParams(params);
    next.set('view', 'applications');
    if (id) next.set('application', id);
    else next.delete('application');
    return `?${next}`;
  }

  if (requested)
    return (
      <section className="workspace-record">
        <Link className="text-link" to={applicationHref()}>
          ← All applications
        </Link>
        {selected ? (
          <>
            <h2>{title(selected.opportunityId)}</h2>
            <p className="workspace-detail-copy">{selected.motivation}</p>
          </>
        ) : (
          <p>This application is unavailable.</p>
        )}
      </section>
    );

  return (
    <WorkspaceTable
      label="opportunity applications"
      columns={['Opportunity', 'Action']}
      empty="Applications you submit through YERH will appear here."
      rows={applications.map((application) => {
        const name = title(application.opportunityId);
        return {
          id: application.id,
          search: name,
          cells: [
            name,
            <Link to={applicationHref(application.id)} aria-label={`View application for ${name}`}>
              View
            </Link>,
          ],
        };
      })}
    />
  );
}
