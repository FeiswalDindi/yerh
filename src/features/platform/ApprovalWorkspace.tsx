import { Link, useSearchParams } from 'react-router-dom';
import type { DemoAccount } from '../../domain/demo';
import type { PlatformState } from '../../domain/platform';
import { roleLabels } from '../../domain/roles';
import { canGraduate } from '../../domain/incubation-actions';
import { schoolForVenture } from '../../domain/incubation';
import { ProductReviewQueue } from './TrainingReview';
import { amount, field, type Save } from './TrainingForms';
import {
  WorkspaceDialog,
  WorkspaceFormDialog,
  WorkspaceStatus,
  WorkspaceTable,
  WorkspaceTabs,
} from './WorkspaceControls';

const now = () => new Date().toISOString();

export function ApprovalWorkspace({
  p,
  accounts,
  save,
  name,
}: {
  p: PlatformState;
  accounts: DemoAccount[];
  save: Save;
  name: (id: string) => string;
}) {
  const marketplaceProducts = p.products.filter((product) =>
    p.ventures.some((venture) => venture.id === product.ventureId && !venture.groupId),
  );
  const products = marketplaceProducts.filter((product) => product.status === 'pending');
  const isSchoolPath = (ventureId: string) =>
    p.ventures.some((venture) => venture.id === ventureId && venture.groupId);
  const applications = p.incubations.filter(
    (path) => path.status === 'pending' && !isSchoolPath(path.ventureId),
  );
  const roles = p.applications.filter((application) => application.status === 'pending');
  const entities = [
    ...p.ventures
      .filter((v) => v.status === 'pending' && !v.groupId)
      .map((v) => ({
        id: v.id,
        name: v.name,
        owner: schoolForVenture(p, v)?.name ?? name(v.ownerId),
        kind: 'venture' as const,
        details: [v.description, v.sector, v.stage, v.location],
      })),
    ...p.organisations
      .filter((o) => o.status === 'pending')
      .map((o) => ({
        id: o.accountId,
        name: o.name,
        owner: name(o.accountId),
        kind: 'organisation' as const,
        details: [o.type, o.sectors, o.contact, o.website],
      })),
  ];
  const active = p.incubations.filter(
    (path) => path.status === 'active' && !isSchoolPath(path.ventureId),
  );
  const ventureName = (id: string) =>
    p.ventures.find((venture) => venture.id === id)?.name ?? 'Venture';
  const [params] = useSearchParams();
  const activePathways = '/dashboard/workspace?tab=approvals&view=active';
  const selectedPath = active.find((row) => row.id === params.get('path'));
  if (selectedPath && params.get('view') === 'active') {
    const ready = selectedPath.status === 'active' && canGraduate(p, selectedPath);
    return (
      <section className="workspace-record">
        <Link to={activePathways}>← Active incubations</Link>
        <h3>{ventureName(selectedPath.ventureId)}</h3>
        <WorkspaceStatus>{selectedPath.status}</WorkspaceStatus>
        <p>{selectedPath.goal}</p>
        {selectedPath.milestones.map((milestone) => (
          <p key={milestone.id}>
            <strong>{milestone.title}</strong> · {milestone.note}
          </p>
        ))}
        {ready && (
          <WorkspaceFormDialog
            action="Graduate incubation"
            submit="Confirm graduation"
            onSave={() => save({ type: 'incubation-complete', id: selectedPath.id, now: now() })}
          >
            <p>Confirm graduation for {ventureName(selectedPath.ventureId)}.</p>
          </WorkspaceFormDialog>
        )}
      </section>
    );
  }
  return (
    <WorkspaceTabs
      label="Approval queue views"
      views={[
        {
          id: 'products',
          label: 'Product listings',
          count: products.length,
          content: (
            <WorkspaceTable
              label="product listings"
              columns={['Product', 'Venture', 'Submitted by', 'Price', 'Action']}
              empty={
                <>
                  No product listings are awaiting approval in this browser profile. If you
                  submitted a product in another profile, use{' '}
                  <strong>Switch demo role to review</strong> from the original profile.
                </>
              }
              rows={products.map((product) => ({
                id: product.id,
                search: [product.name, ventureName(product.ventureId), name(product.ownerId)].join(
                  ' ',
                ),
                cells: [
                  product.name,
                  ventureName(product.ventureId),
                  name(product.ownerId),
                  amount(product.price),
                  <WorkspaceDialog action="Review listing" title={product.name}>
                    {(finish) => (
                      <>
                        <p>
                          {ventureName(product.ventureId)} · {name(product.ownerId)} ·{' '}
                          {amount(product.price)}
                        </p>
                        <p className="workspace-detail-copy">{product.description}</p>
                        <div className="workspace-form-footer">
                          <button
                            className="button button-outline"
                            onClick={() =>
                              finish(
                                save({
                                  type: 'venture-review',
                                  entity: 'product',
                                  id: product.id,
                                  decision: 'rejected',
                                  now: now(),
                                }),
                              )
                            }
                          >
                            Reject listing
                          </button>
                          <button
                            className="button"
                            onClick={() =>
                              finish(
                                save({
                                  type: 'venture-review',
                                  entity: 'product',
                                  id: product.id,
                                  decision: 'approved',
                                  now: now(),
                                }),
                              )
                            }
                          >
                            Approve listing
                          </button>
                        </div>
                      </>
                    )}
                  </WorkspaceDialog>,
                ],
              }))}
            />
          ),
        },
        {
          id: 'incubation',
          label: 'Incubation applications',
          count: applications.length,
          content: (
            <WorkspaceTable
              label="incubation applications"
              columns={['Venture', 'Applicant', 'Products in scope', 'Action']}
              empty="No ventures are awaiting activation or mentor assignment."
              rows={applications.map((path) => {
                const included = p.products.filter((product) =>
                  path.productIds?.includes(product.id),
                );
                const title = ventureName(path.ventureId);
                return {
                  id: path.id,
                  search: [
                    title,
                    name(path.ownerId),
                    ...included.map((product) => product.name),
                  ].join(' '),
                  cells: [
                    title,
                    name(path.ownerId),
                    included.length ? included.map((product) => product.name).join(', ') : 'None',
                    <WorkspaceFormDialog
                      action="Review application"
                      title={title}
                      submit="Save incubation decision"
                      onSave={(data) =>
                        save({
                          type: 'incubation-assign',
                          id: path.id,
                          mentorId: field(data, 'mentor'),
                          decision: field(data, 'decision') as 'active' | 'rejected',
                          now: now(),
                        })
                      }
                    >
                      <p>{path.goal}</p>
                      {included.length > 0 && (
                        <ul aria-label="Products included in the application">
                          {included.map((product) => (
                            <li key={product.id}>
                              {product.name}
                              {' · Listing ' + product.status}
                            </li>
                          ))}
                        </ul>
                      )}
                      <label>
                        Mentor
                        <select name="mentor">
                          {accounts
                            .filter((a) => a.role === 'mentor' && !a.suspended)
                            .map((a) => (
                              <option value={a.id} key={a.id}>
                                {a.name}
                              </option>
                            ))}
                        </select>
                      </label>
                      <label>
                        Decision
                        <select name="decision">
                          <option value="active">Accept &amp; assign</option>
                          <option value="rejected">Reject</option>
                        </select>
                      </label>
                    </WorkspaceFormDialog>,
                  ],
                };
              })}
            />
          ),
        },
        {
          id: 'evidence',
          label: 'Product evidence reviews',
          count: p.training.productReviews.filter(
            (review) =>
              review.status === 'pending' &&
              marketplaceProducts.some((item) => item.id === review.productId),
          ).length,
          content: <ProductReviewQueue p={p} save={save} />,
        },
        {
          id: 'roles',
          label: 'Role requests',
          count: roles.length,
          content: (
            <WorkspaceTable
              label="role requests"
              columns={['Applicant', 'Requested role', 'Institution', 'Request type', 'Action']}
              empty="No role requests are awaiting review."
              rows={roles.map((application) => {
                const applicant = name(application.accountId);
                const role = roleLabels[application.role];
                const institution = p.training.institutions.find(
                  (row) => row.id === application.institutionId,
                );
                const request =
                  application.fromRole && application.fromRole !== 'guest'
                    ? `Role change from ${roleLabels[application.fromRole]}`
                    : 'Role application';
                return {
                  id: application.id,
                  search: `${applicant} ${role} ${institution?.name ?? ''} ${request}`,
                  cells: [
                    applicant,
                    role,
                    institution?.name ?? '—',
                    request,
                    <WorkspaceFormDialog
                      action="Review request"
                      title={`${applicant} · ${role}`}
                      submit="Save decision"
                      onSave={(data) =>
                        save({
                          type: 'role-review',
                          id: application.id,
                          decision: field(data, 'decision') as 'approved' | 'rejected',
                          reason: field(data, 'reason'),
                          now: now(),
                        })
                      }
                    >
                      {institution && (
                        <p>
                          <strong>Requested affiliation</strong> · {institution.name}
                        </p>
                      )}
                      <p>{application.motivation}</p>
                      <p>
                        {application.organisation} {application.expertise}
                      </p>
                      <label>
                        Decision
                        <select name="decision">
                          <option value="approved">Approve</option>
                          <option value="rejected">Reject</option>
                        </select>
                      </label>
                      <label>
                        Decision reason / feedback
                        <textarea name="reason" required minLength={10} maxLength={3000} />
                      </label>
                    </WorkspaceFormDialog>,
                  ],
                };
              })}
            />
          ),
        },
        {
          id: 'ventures',
          label: 'Ventures & organisations',
          count: entities.length,
          content: (
            <WorkspaceTable
              label="ventures and organisations"
              columns={['Name', 'Type', 'Owner', 'Action']}
              empty="No ventures or organisations are awaiting review."
              rows={entities.map((entity) => ({
                id: entity.kind + ':' + entity.id,
                search: `${entity.name} ${entity.kind} ${entity.owner}`,
                cells: [
                  entity.name,
                  <WorkspaceStatus>{entity.kind}</WorkspaceStatus>,
                  entity.owner,
                  <WorkspaceDialog action="Review submission" title={entity.name}>
                    {(finish) => (
                      <>
                        <p>{entity.details.filter(Boolean).join(' · ')}</p>
                        <div className="workspace-form-footer">
                          <button
                            className="button button-outline"
                            onClick={() =>
                              finish(
                                save({
                                  type: 'venture-review',
                                  id: entity.id,
                                  entity: entity.kind,
                                  decision: 'rejected',
                                  now: now(),
                                }),
                              )
                            }
                          >
                            Reject
                          </button>
                          <button
                            className="button"
                            onClick={() =>
                              finish(
                                save({
                                  type: 'venture-review',
                                  id: entity.id,
                                  entity: entity.kind,
                                  decision: 'approved',
                                  now: now(),
                                }),
                              )
                            }
                          >
                            Approve
                          </button>
                        </div>
                      </>
                    )}
                  </WorkspaceDialog>,
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
              columns={['Venture', 'Owner', 'Mentor', 'Progress', 'Action']}
              empty="There are no active incubations."
              rows={active.map((path) => {
                const title = ventureName(path.ventureId);
                const ready = canGraduate(p, path);
                return {
                  id: path.id,
                  search: `${title} ${name(path.ownerId)} ${name(path.mentorId)}`,
                  cells: [
                    title,
                    name(path.ownerId),
                    name(path.mentorId),
                    <WorkspaceStatus>
                      {ready ? 'Ready to graduate' : 'In progress'}
                    </WorkspaceStatus>,
                    <Link
                      to={activePathways + '&path=' + encodeURIComponent(path.id)}
                      aria-label="View incubation"
                    >
                      View
                    </Link>,
                  ],
                };
              })}
            />
          ),
        },
      ]}
    />
  );
}
