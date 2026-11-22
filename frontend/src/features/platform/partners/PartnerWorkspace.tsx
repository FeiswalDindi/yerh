import { Link } from 'react-router-dom';
import { can, roleLabels } from '../../../domain/roles';
import type { Opportunity } from '../../../domain/platform';
import { OpportunityForm } from '../workspace/WorkspaceEditors';
import { workspaceHref } from '../../dashboard/dashboard-navigation';
import {
  WorkspaceDialog,
  WorkspaceFormDialog,
  WorkspaceTable,
} from '../workspace/WorkspaceControls';

import { Field, Panel, now } from '../workspace/WorkspacePanel';
import type { DemoAccount } from '../../../domain/demo';
import type { PlatformState } from '../../../domain/platform';
import type { Save } from '../incubation/TrainingForms';

export function PartnerWorkspace({
  tab,
  account,
  p,
  params,
  name,
  run,
  opportunityImage,
}: {
  tab: string;
  account: DemoAccount;
  p: PlatformState;
  params: URLSearchParams;
  name: (id: string) => string;
  run: Save;
  opportunityImage: string;
}) {
  const org = p.organisations.find((o) => o.accountId === account.id);
  const displayedApplication = p.opportunityApplications.find(
    (application) =>
      tab === 'applicants' &&
      application.id === params.get('application') &&
      p.opportunities.some(
        (opportunity) =>
          opportunity.id === application.opportunityId && opportunity.ownerId === account.id,
      ),
  );
  const opportunityEditor = (opportunity?: Opportunity) => (
    <WorkspaceDialog
      action={opportunity ? 'Edit opportunity' : 'Add opportunity'}
      title={opportunity?.title}
      create={!opportunity}
    >
      {(finish) => (
        <OpportunityForm
          opportunity={opportunity}
          ownerId={account.id}
          organiser={org?.name ?? account.name}
          image={opportunityImage}
          onSave={(action) => {
            const saved = run(action);
            finish(saved);
            return saved;
          }}
        />
      )}
    </WorkspaceDialog>
  );

  return (
    <>
      {tab === 'organisation' && (
        <Panel title={`${roleLabels[account.role]} organisation profile`}>
          <p>Profile approval is required before opportunities can be submitted.</p>
          {org && (
            <dl className="workspace-profile">
              <div>
                <dt>Organisation</dt>
                <dd>{org.name}</dd>
              </div>
              <div>
                <dt>Type</dt>
                <dd>{org.type}</dd>
              </div>
              <div>
                <dt>Sectors</dt>
                <dd>{org.sectors}</dd>
              </div>
            </dl>
          )}
          <WorkspaceFormDialog
            action={org ? 'Edit organisation' : 'Add organisation'}
            create={!org}
            submit="Submit profile for approval"
            onSave={(f) =>
              run({
                type: 'organisation-save',
                now: now(),
                organisation: {
                  accountId: account.id,
                  name: String(f.get('name')),
                  type: String(f.get('type')),
                  sectors: String(f.get('sectors')),
                  contact: String(f.get('contact')),
                  website: String(f.get('website')),
                  status: 'pending',
                },
              })
            }
          >
            <Field label="Organisation name" name="name" minLength={3} defaultValue={org?.name} />
            <Field label="Organisation type" name="type" defaultValue={org?.type} />
            <Field label="Sectors supported" name="sectors" defaultValue={org?.sectors} />
            <Field label="Primary contact" name="contact" defaultValue={org?.contact} />
            <Field
              label="Website (HTTPS)"
              name="website"
              type="url"
              required={false}
              defaultValue={org?.website}
            />
          </WorkspaceFormDialog>
        </Panel>
      )}
      {tab === 'opportunities' && (
        <Panel title="Opportunities">
          <WorkspaceTable
            label="opportunities"
            columns={['Opportunity', 'Category', 'Actions']}
            actions={opportunityEditor()}
            rows={p.opportunities
              .filter((item) => item.ownerId === account.id)
              .map((item) => ({
                id: item.id,
                search: [item.title, item.category].join(' '),
                cells: [
                  item.title,
                  item.category,
                  <div className="workspace-row-actions">
                    {item.status !== 'archived' && opportunityEditor(item)}
                    {item.status === 'draft' && (
                      <button
                        type="button"
                        className="button button-outline workspace-action"
                        onClick={() =>
                          run({
                            type: 'opportunity-status',
                            id: item.id,
                            status: 'review',
                            now: now(),
                          })
                        }
                      >
                        Submit for review
                      </button>
                    )}
                    {['published', 'closed'].includes(item.status) && (
                      <Link to={'/opportunities/' + item.slug} aria-label="View public listing">
                        View
                      </Link>
                    )}
                  </div>,
                ],
              }))}
          />
        </Panel>
      )}
      {tab === 'applicants' && (
        <Panel title="Opportunity applicants">
          {displayedApplication ? (
            <section className="workspace-record">
              <Link to={workspaceHref('applicants')}>← Applicants</Link>
              <h3>{name(displayedApplication.accountId)}</h3>
              <p className="workspace-detail-copy">{displayedApplication.motivation}</p>
            </section>
          ) : (
            <WorkspaceTable
              label="applicants"
              columns={['Applicant', 'Opportunity', 'Action']}
              rows={p.opportunityApplications.flatMap((application) => {
                const opportunity = p.opportunities.find(
                  (item) => item.id === application.opportunityId,
                );
                if (!opportunity || (opportunity.ownerId !== account.id && !can(account, 'admin')))
                  return [];
                const applicant = name(application.accountId);
                const canDecide = ['submitted', 'shortlisted'].includes(application.status);
                return [
                  {
                    id: application.id,
                    search: [applicant, opportunity.title].join(' '),
                    cells: [
                      applicant,
                      opportunity.title,
                      canDecide ? (
                        <WorkspaceDialog action="Review applicant" title={applicant}>
                          {(finish) => (
                            <>
                              <p className="workspace-detail-copy">{application.motivation}</p>
                              {canDecide && (
                                <div className="workspace-form-footer">
                                  {(['shortlisted', 'accepted', 'rejected'] as const).map(
                                    (status) => (
                                      <button
                                        key={status}
                                        type="button"
                                        className="button button-outline"
                                        onClick={() =>
                                          finish(
                                            run({
                                              type: 'opportunity-review',
                                              id: application.id,
                                              status,
                                              now: now(),
                                            }),
                                          )
                                        }
                                      >
                                        {
                                          {
                                            shortlisted: 'Shortlist',
                                            accepted: 'Accept',
                                            rejected: 'Reject',
                                          }[status]
                                        }
                                      </button>
                                    ),
                                  )}
                                </div>
                              )}
                            </>
                          )}
                        </WorkspaceDialog>
                      ) : (
                        <Link
                          to={
                            workspaceHref('applicants') +
                            '&application=' +
                            encodeURIComponent(application.id)
                          }
                          aria-label="View application"
                        >
                          View
                        </Link>
                      ),
                    ],
                  },
                ];
              })}
            />
          )}
        </Panel>
      )}
      {tab === 'discovery' && (
        <Panel title="Discover youth-led ventures">
          <div className="platform-table-wrap">
            <table className="platform-table">
              <thead>
                <tr>
                  <th>Venture</th>
                  <th>Sector</th>
                  <th>Stage</th>
                  <th>Location</th>
                </tr>
              </thead>
              <tbody>
                {p.ventures
                  .filter((v) => v.status === 'approved')
                  .map((v) => (
                    <tr key={v.id}>
                      <td>
                        <strong>{v.name}</strong>
                        <p>{v.description}</p>
                      </td>
                      <td>{v.sector}</td>
                      <td>{v.stage}</td>
                      <td>{v.location}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </>
  );
}
