import { RegistryReview } from './RegistryReview';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { laravelWorkspace, type Venture } from '../../../services/laravel-workspace-repository';
import { WorkspaceTable, WorkspaceTabs } from '../workspace/WorkspaceControls';
import { StatusIndicator } from '../../../shared/StatusIndicator';
import { RecordsFeedback, useWorkspaceRecords } from './WorkspaceActions';

const registry = '/dashboard/workspace?tab=ventures';
export function AdminVentures() {
  const individual = useWorkspaceRecords(laravelWorkspace.ventures);
  const teams = useWorkspaceRecords(laravelWorkspace.institutionVentures);
  const [params] = useSearchParams();
  const [status, setStatus] = useState('');
  const [institution, setInstitution] = useState('');
  const ventureId = params.get('venture') ?? params.get('record');
  const selected = individual.records?.find((v) => String(v.id) === ventureId);
  const individuals = individual.records ?? [];
  const institutions = teams.records ?? [];
  const feedback = (
    <RecordsFeedback
      loading={!individual.records || !teams.records}
      error={individual.error || teams.error}
    />
  );
  if (ventureId)
    return (
      <>
        {feedback}
        <Link to={registry}>Back to ventures</Link>
        {selected ? (
          <article className="profile-panel">
            <h2>{selected.name}</h2>
            <p>{selected.description}</p>
            <dl>
              {Object.entries({
                Founder: selected.owner,
                Institution: selected.institution,
                Sector: selected.sector,
                Location: selected.location,
                Status: selected.status,
              }).map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
            {selected.decision_note && <p>{selected.decision_note}</p>}
            <ReviewVenture venture={selected} reload={individual.reload} />
          </article>
        ) : (
          individual.records && <p>Venture unavailable.</p>
        )}
      </>
    );
  return (
    <>
      {feedback}
      <WorkspaceTabs
        label="Venture ownership"
        views={[
          {
            id: 'individuals',
            label: 'Individual ventures',
            count: individual.records?.length,
            content: (
              <WorkspaceTable
                label="individual ventures"
                columns={['Venture', 'Founder', 'Sector', 'Status', 'Actions']}
                exportName="individual-ventures.csv"
                actions={
                  <label className="workspace-status-filter">
                    Status{' '}
                    <select value={status} onChange={(e) => setStatus(e.target.value)}>
                      <option value="">All statuses</option>
                      {['Approved', 'Pending', 'Rejected'].map((s) => (
                        <option key={s} value={s.toLowerCase()}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </label>
                }
                rows={individuals
                  .filter((v) => !status || v.status === status)
                  .map((v) => ({
                    id: String(v.id),
                    search: [v.name, v.owner, v.sector, v.institution, v.status].join(' '),
                    csv: [v.name, v.owner, v.sector, v.status],
                    cells: [
                      v.name,
                      v.owner,
                      v.sector,
                      <StatusIndicator status={v.status} />,
                      <div className="workspace-row-actions">
                        <Link to={registry + '&venture=' + v.id}>View</Link>
                        <ReviewVenture venture={v} reload={individual.reload} />
                      </div>,
                    ],
                  }))}
              />
            ),
          },
          {
            id: 'institutions',
            label: 'Institution ventures',
            count: teams.records?.length,
            content: (
              <WorkspaceTable
                label="institution ventures"
                columns={['Venture', 'Institution', 'Cohort', 'Sector', 'Action']}
                exportName="institution-ventures.csv"
                actions={
                  <label className="workspace-toolbar-filter">
                    Institution
                    <select value={institution} onChange={(e) => setInstitution(e.target.value)}>
                      <option value="">All institutions</option>
                      {Array.from(new Map(institutions.map((v) => [v.slug, v.institution]))).map(
                        ([slug, name]) => (
                          <option key={slug} value={slug}>
                            {name}
                          </option>
                        ),
                      )}
                    </select>
                  </label>
                }
                rows={institutions
                  .filter((v) => !institution || v.slug === institution)
                  .map((v) => ({
                    id: String(v.id),
                    search: [v.name, v.institution, v.cohort, v.sector].join(' '),
                    cells: [
                      v.name,
                      v.institution,
                      v.cohort,
                      v.sector,
                      <Link
                        to={
                          '/dashboard/workspace?tab=school&institution=' +
                          encodeURIComponent(v.slug) +
                          '&cohort=' +
                          v.cohort_id +
                          '&section=teams'
                        }
                      >
                        View
                      </Link>,
                    ],
                  }))}
              />
            ),
          },
        ]}
      />
    </>
  );
}

function ReviewVenture({ venture, reload }: { venture: Venture; reload: () => void }) {
  return (
    <RegistryReview
      current={venture.status}
      name={venture.name}
      description={venture.description}
      note={venture.decision_note}
      decide={async (d, n) => {
        await laravelWorkspace.setVentureStatus(venture, d, n);
        reload();
      }}
    />
  );
}
