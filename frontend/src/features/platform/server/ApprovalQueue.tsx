import { Link } from 'react-router-dom';
import { Download } from 'lucide-react';
import { laravelWorkspace } from '../../../services/laravel-workspace-repository';
import { laravelProgramme } from '../../../services/laravel-programme-repository';
import { StatusIndicator } from '../../../shared/StatusIndicator';
import { WorkspaceTable, WorkspaceTabs } from '../workspace/WorkspaceControls';
import {
  DecisionAction,
  fieldValue,
  RecordsFeedback,
  useWorkspaceRecords,
  WorkspaceAction,
} from './WorkspaceActions';
import { MentorAssignment } from './IncubationProgramme';
import { formatKsh } from './ProgrammeFinance';

async function loadQueue(signal: AbortSignal) {
  const [products, paths, applications, ventures, onboarding] = await Promise.all([
    laravelProgramme.products(signal),
    laravelProgramme.paths(signal),
    laravelWorkspace.applications(signal),
    laravelWorkspace.ventures(signal),
    laravelWorkspace.institutionApplications(signal),
  ]);
  return { products, paths, applications, ventures, onboarding };
}

export function ApprovalQueue() {
  const { records, error, reload } = useWorkspaceRecords(loadQueue);
  if (!records) return <RecordsFeedback loading error={error} />;
  const listings = records.products.filter((p) => p.moderation === 'pending');
  const evidence = records.products.filter((p) => p.evidence_status === 'pending');
  const requests = records.applications.filter((a) => a.status === 'pending');
  const onboarding = records.onboarding.filter((a) => a.status === 'pending');
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
            id: 'institutions',
            label: 'Institution onboarding',
            count: onboarding.length,
            content: (
              <WorkspaceTable
                label="institution onboarding applications"
                columns={[
                  'Institution',
                  'Type',
                  'Coordinator',
                  'Domains & MOU',
                  'Status',
                  'Action',
                ]}
                empty="No institution onboarding applications pending."
                rows={records.onboarding.map((app) => ({
                  id: String(app.id),
                  search: [
                    app.institution_name,
                    app.kind,
                    app.contact_name,
                    app.contact_email,
                    app.status,
                  ].join(' '),
                  cells: [
                    <>
                      <strong>{app.institution_name}</strong>
                      {app.website && (
                        <div>
                          <a href={app.website} target="_blank" rel="noreferrer">
                            Website
                          </a>
                        </div>
                      )}
                    </>,
                    app.kind,
                    <>
                      <div>{app.contact_name}</div>
                      <div>{app.contact_email}</div>
                      <div>{app.contact_phone}</div>
                    </>,
                    <>
                      <div>
                        {app.allowed_domains.length
                          ? `Domains: ${app.allowed_domains.join(', ')}`
                          : 'No verified domains'}
                      </div>
                      {app.agreement_reference && <div>Ref: {app.agreement_reference}</div>}
                      {app.has_document && (
                        <a
                          href={laravelWorkspace.institutionApplicationDocumentUrl(app.id)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <Download size={14} aria-hidden="true" />{' '}
                          {app.agreement_name || 'Download agreement PDF'}
                        </a>
                      )}
                      {app.notes && <p>{app.notes}</p>}
                    </>,
                    <>
                      <StatusIndicator status={app.status} />
                      {app.decision_note && <p>{app.decision_note}</p>}
                    </>,
                    app.status === 'pending' ? (
                      <WorkspaceAction
                        action="Review application"
                        title={app.institution_name}
                        submit="Save decision"
                        save={async (data) => {
                          await laravelWorkspace.reviewInstitutionApplication(
                            app.id,
                            fieldValue(data, 'decision') as 'approved' | 'rejected',
                            fieldValue(data, 'note'),
                            data.get('activate') === 'on',
                          );
                          reload();
                        }}
                      >
                        <label>
                          Decision
                          <select name="decision" defaultValue="approved">
                            <option value="approved">Approve &amp; provision institution</option>
                            <option value="rejected">Reject application</option>
                          </select>
                        </label>
                        <label className="inline-checkbox">
                          <input type="checkbox" name="activate" defaultChecked /> Activate
                          institution immediately on approval
                        </label>
                        <label>
                          Note (required to reject)
                          <textarea name="note" maxLength={1500} />
                        </label>
                      </WorkspaceAction>
                    ) : app.institution_slug ? (
                      <Link
                        to={
                          '/dashboard/workspace?tab=institutions&record=' +
                          encodeURIComponent(app.institution_slug)
                        }
                      >
                        Open institution
                      </Link>
                    ) : (
                      '—'
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
