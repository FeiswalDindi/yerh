import { Link } from 'react-router-dom';
import { laravelWorkspace } from '../../../services/laravel-workspace-repository';
import { laravelProgramme } from '../../../services/laravel-programme-repository';
import { WorkspaceTable, WorkspaceTabs } from '../workspace/WorkspaceControls';
import { DecisionAction, RecordsFeedback, useWorkspaceRecords } from './WorkspaceActions';
import { MentorAssignment } from './IncubationProgramme';
import { formatKsh } from './ProgrammeFinance';

async function loadQueue(signal: AbortSignal) {
  const [products, paths, applications, ventures] = await Promise.all([
    laravelProgramme.products(signal),
    laravelProgramme.paths(signal),
    laravelWorkspace.applications(signal),
    laravelWorkspace.ventures(signal),
  ]);
  return { products, paths, applications, ventures };
}

export function ApprovalQueue() {
  const { records, error, reload } = useWorkspaceRecords(loadQueue);
  if (!records) return <RecordsFeedback loading error={error} />;
  const listings = records.products.filter((p) => p.moderation === 'pending');
  const evidence = records.products.filter((p) => p.evidence_status === 'pending');
  const requests = records.applications.filter((a) => a.status === 'pending');
  const ventures = records.ventures.filter((v) => v.status === 'pending');
  const unassigned = records.paths.filter((p) => !p.mentor_id && !p.graduated_at);
  const active = records.paths.filter((p) => p.mentor_id && !p.graduated_at);
  function review(name: string, save: (decision: string, note: string) => Promise<unknown>) {
    return (
      <DecisionAction
        name={name}
        decide={async (decision, note) => {
          await save(decision, note);
          reload();
        }}
      />
    );
  }
  return (
    <>
      <RecordsFeedback loading={false} error={error} />
      <WorkspaceTabs
        label="Approval queue"
        views={[
          {
            id: 'products',
            label: 'Product listings',
            count: listings.length,
            content: (
              <WorkspaceTable
                label="product listings"
                columns={['Product', 'Venture', 'Submitted by', 'Price', 'Action']}
                empty="No product listings are awaiting approval."
                rows={listings.map((p) => ({
                  id: String(p.id),
                  search: [p.name, p.venture, p.owner].join(' '),
                  cells: [
                    p.name,
                    p.venture,
                    p.owner,
                    formatKsh(p.price),
                    review(p.name, (d, n) => laravelProgramme.reviewProduct(p.id, 'listing', d, n)),
                  ],
                }))}
              />
            ),
          },
          {
            id: 'incubation',
            label: 'Incubation applications',
            count: unassigned.length,
            content: (
              <WorkspaceTable
                label="incubation applications"
                columns={['Venture', 'Entrepreneur', 'Action']}
                empty="No ventures are awaiting mentor assignment."
                rows={unassigned.map((p) => ({
                  id: String(p.id),
                  search: [p.venture, p.owner].join(' '),
                  cells: [p.venture, p.owner, <MentorAssignment path={p} reload={reload} />],
                }))}
              />
            ),
          },
          {
            id: 'evidence',
            label: 'Product evidence reviews',
            count: evidence.length,
            content: (
              <WorkspaceTable
                label="product evidence"
                columns={['Product', 'Venture', 'Evidence', 'Action']}
                rows={evidence.map((p) => ({
                  id: String(p.id),
                  search: [p.name, p.venture, p.evidence].join(' '),
                  cells: [
                    p.name,
                    p.venture,
                    p.evidence,
                    review(p.name, (d, n) =>
                      laravelProgramme.reviewProduct(p.id, 'evidence', d, n),
                    ),
                  ],
                }))}
              />
            ),
          },
          {
            id: 'roles',
            label: 'Role requests',
            count: requests.length,
            content: (
              <WorkspaceTable
                label="affiliation applications"
                columns={['Applicant', 'Institution', 'Details', 'Action']}
                rows={requests.map((a) => ({
                  id: String(a.id),
                  search: [a.applicant, a.institution, a.location].join(' '),
                  cells: [
                    a.applicant,
                    a.institution,
                    <>
                      {a.details}
                      <p>{a.location}</p>
                    </>,
                    review(a.applicant, (d, n) =>
                      laravelWorkspace.review('applications', a.id, d, n),
                    ),
                  ],
                }))}
              />
            ),
          },
          {
            id: 'ventures',
            label: 'Ventures & organisations',
            count: ventures.length,
            content: (
              <WorkspaceTable
                label="venture submissions"
                columns={['Venture', 'Founder', 'Sector', 'Actions']}
                rows={ventures.map((v) => ({
                  id: String(v.id),
                  search: [v.name, v.owner, v.sector].join(' '),
                  cells: [
                    v.name,
                    v.owner,
                    v.sector,
                    <div className="workspace-row-actions">
                      <Link to={'/dashboard/workspace?tab=ventures&venture=' + v.id}>View</Link>
                      {review(v.name, (d, n) => laravelWorkspace.review('ventures', v.id, d, n))}
                    </div>,
                  ],
                }))}
              />
            ),
          },
          {
            id: 'active',
            label: 'Active incubations',
            count: active.length,
            content: (
              <WorkspaceTable
                label="active incubations"
                columns={['Venture', 'Entrepreneur', 'Mentor', 'Action']}
                rows={active.map((p) => ({
                  id: String(p.id),
                  search: [p.venture, p.owner, p.mentor].join(' '),
                  cells: [
                    p.venture,
                    p.owner,
                    p.mentor,
                    <Link to={'/dashboard/workspace?tab=incubation&path=' + p.id}>
                      Open pathway
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
