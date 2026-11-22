import { Settings } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { StudentDirectory } from './StudentDirectory';
import { InstitutionResults } from './InstitutionResults';
import { InstitutionInvitations, InstitutionMembers } from './InstitutionMembers';
import { InstitutionProgramme } from './InstitutionProgramme';
import type { DemoAccount } from '../../../domain/demo';
import type { Institution } from '../../../domain/incubation';
import type { PlatformState } from '../../../domain/platform';
import { institutionHref, workspaceHref } from '../../dashboard/dashboard-navigation';
import {
  availableInstitutionAdministrators,
  institutionAccess,
  institutionKindLabels,
} from '../../../domain/incubation';
import {
  amount,
  field,
  submitTraining,
  TrainingForm,
  type Save,
} from '../incubation/TrainingForms';
import {
  WorkspaceFormDialog,
  WorkspaceStatus,
  WorkspaceTable,
  WorkspaceTabs,
} from '../workspace/WorkspaceControls';

import {
  InstitutionAdministratorField,
  InstitutionSettings,
  InstitutionAccessEditor,
  InstitutionActivity,
  InstitutionActivation,
} from './InstitutionAdministration';
import { AgreementsPanel } from './InstitutionAgreements';

export function InstitutionsAdmin({
  p,
  accounts,
  save,
  operator,
}: {
  p: PlatformState;
  accounts: DemoAccount[];
  save: Save;
  operator: DemoAccount;
}) {
  const [params, setParams] = useSearchParams();
  const selected = p.training.institutions.find((school) => school.id === params.get('record'));
  if (selected)
    return (
      <InstitutionAdminDetails
        p={p}
        school={selected}
        accounts={accounts}
        save={save}
        operator={operator}
      />
    );
  const filter = params.get('filter') ?? '';
  const staff = availableInstitutionAdministrators(p, accounts);
  return (
    <WorkspaceTable
      label="institutions"
      columns={['Institution', 'Type', 'Administrator', 'Agreements', 'Status', 'Action']}
      actions={
        <>
          <label className="workspace-toolbar-filter">
            Status
            <select
              value={filter}
              onChange={(event) =>
                setParams((current) => {
                  const next = new URLSearchParams(current);
                  if (event.target.value) next.set('filter', event.target.value);
                  else next.delete('filter');
                  return next;
                })
              }
            >
              <option value="">All institutions</option>
              <option value="pending">Pending</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>
          <TrainingForm
            save={save}
            label="Save sign-in settings"
            dialog={{ action: 'Sign-in settings', icon: <Settings size={18} aria-hidden="true" /> }}
            build={(data) => ({ type: 'yerh-sign-in', enabled: data.get('yerh') === 'on' })}
          >
            <label className="inline-checkbox">
              <input name="yerh" type="checkbox" defaultChecked={p.training.yerhSignIn !== false} />
              Show YERH in the institution selector
            </label>
          </TrainingForm>
          <WorkspaceFormDialog
            action="Add institution"
            create
            submit="Create institution"
            onSave={(data) => {
              const id = crypto.randomUUID();
              const saved = submitTraining(save, {
                type: 'institution-create',
                id,
                name: field(data, 'name'),
                kind: field(data, 'kind') as Institution['kind'],
                adminId: field(data, 'admin'),
                amount: Number(field(data, 'amount')),
              });
              if (saved) setParams({ tab: 'institutions', record: id, area: 'intake' });
              return saved;
            }}
          >
            <label>
              Institution name <input name="name" required minLength={3} maxLength={120} />
            </label>
            <label>
              Institution type{' '}
              <select name="kind">
                {Object.entries(institutionKindLabels).map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <InstitutionAdministratorField staff={staff} optional />
            <p>
              You can assign the administrator from Portal activation after creating the record.
            </p>
            <label>
              Agreed contract amount (KES){' '}
              <input name="amount" type="number" min="0" step="1" required />
            </label>
          </WorkspaceFormDialog>
        </>
      }
      rows={p.training.institutions
        .filter((school) => !filter || school.status === filter)
        .map((school) => {
          const kind = institutionKindLabels[school.kind];
          const administrator = accounts.find((account) => account.id === school.adminId)?.name;
          return {
            id: school.id,
            search: [school.name, kind, administrator, school.status].join(' '),
            cells: [
              school.name,
              kind,
              administrator ?? 'Unassigned',
              school.agreements?.length ?? (school.proof ? 1 : 0),
              <WorkspaceStatus>{school.status}</WorkspaceStatus>,
              <Link to={workspaceHref('institutions') + '&record=' + encodeURIComponent(school.id)}>
                Manage institution
              </Link>,
            ],
          };
        })}
    />
  );
}

function InstitutionAdminDetails({
  p,
  school,
  accounts,
  save,
  operator,
}: {
  p: PlatformState;
  school: Institution;
  accounts: DemoAccount[];
  save: Save;
  operator: DemoAccount;
}) {
  const administrator = accounts.find((account) => account.id === school.adminId);
  const availableStaff = availableInstitutionAdministrators(p, accounts, school.id);
  const students = p.training.students.filter((row) => row.institutionId === school.id);
  const groups = p.training.groups.filter((row) => row.institutionId === school.id);
  const ventures = p.ventures.filter((row) =>
    school.kind === 'high-school'
      ? groups.some((group) => group.id === row.groupId)
      : !row.groupId && p.training.affiliations[row.ownerId] === school.id,
  );
  const managedProducts = p.products.filter((row) =>
    ventures.some((venture) => venture.id === row.ventureId),
  );
  const people = accounts.filter((row) =>
    [school.adminId, ...(school.staffIds ?? []), ...(school.contactIds ?? [])].includes(row.id),
  );
  return (
    <>
      <Link className="text-link" to={workspaceHref('institutions')}>
        ← Institution directory
      </Link>
      <div className="workspace-data-toolbar">
        <div>
          <h2>{school.name}</h2>
          <WorkspaceStatus>{school.status}</WorkspaceStatus>
        </div>
        <div className="workspace-toolbar-actions">
          {institutionAccess(school, operator) === 'manage' && (
            <Link to={institutionHref('school', school.id)}>Open shared workspace</Link>
          )}
          <InstitutionSettings school={school} save={save} />
        </div>
      </div>
      {school.status !== 'active' && (
        <InstitutionActivation
          school={school}
          administrator={administrator}
          availableStaff={availableStaff}
          save={save}
        />
      )}
      <WorkspaceTabs
        label="Institution administration pages"
        param="area"
        views={[
          {
            id: 'intake',
            label: 'Intake',
            content: (
              <>
                <dl className="workspace-profile">
                  <div>
                    <dt>Institution type</dt>
                    <dd>{institutionKindLabels[school.kind]}</dd>
                  </div>
                  <div>
                    <dt>Primary administrator</dt>
                    <dd>{administrator?.name ?? 'Unassigned'}</dd>
                  </div>
                  <div>
                    <dt>Site visit</dt>
                    <dd>{school.intake?.visit || '—'}</dd>
                  </div>
                  <div>
                    <dt>Application details</dt>
                    <dd className="workspace-detail-copy">{school.intake?.notes || '—'}</dd>
                  </div>
                </dl>
                <div className="workspace-toolbar-actions">
                  {school.status === 'active' && (
                    <>
                      <TrainingForm
                        save={save}
                        label="Deactivate institution"
                        dialog={{ action: 'Deactivate institution' }}
                        build={() => ({ type: 'institution-deactivate', id: school.id })}
                      >
                        <p>Staff will retain their records. The shared portal will be locked.</p>
                      </TrainingForm>
                      <TrainingForm
                        save={save}
                        label="Save success story"
                        dialog={{ action: 'Edit success story' }}
                        build={(data) => ({
                          type: 'institution-story',
                          id: school.id,
                          story: field(data, 'story'),
                          featured: data.get('featured') === 'on',
                        })}
                      >
                        <label>
                          Institution success story
                          <textarea name="story" maxLength={3000} defaultValue={school.story} />
                        </label>
                        <label className="inline-checkbox">
                          <input type="checkbox" name="featured" defaultChecked={school.featured} />
                          Feature this institution on the homepage
                        </label>
                      </TrainingForm>
                    </>
                  )}
                </div>
              </>
            ),
          },
          {
            id: 'people',
            label: 'Staff & contacts',
            count: people.length,
            content: (
              <WorkspaceTable
                label="institution contacts"
                columns={['Name', 'Email', 'Access', 'Status', 'Action']}
                actions={
                  <InstitutionAccessEditor p={p} school={school} accounts={accounts} save={save} />
                }
                rows={people.map((person) => ({
                  id: person.id,
                  search: person.name + ' ' + person.email,
                  cells: [
                    person.name,
                    person.email,
                    person.id === school.adminId
                      ? 'Primary administrator'
                      : school.staffIds?.includes(person.id)
                        ? 'Manage portal'
                        : 'Read results',
                    <WorkspaceStatus>{person.suspended ? 'Suspended' : 'Active'}</WorkspaceStatus>,
                    person.id !== school.adminId && (
                      <InstitutionAccessEditor
                        p={p}
                        school={school}
                        accounts={accounts}
                        save={save}
                        person={person}
                      />
                    ),
                  ],
                }))}
              />
            ),
          },
          {
            id: 'agreements',
            label: 'Agreements',
            content: <AgreementsPanel school={school} accounts={accounts} save={save} />,
          },
          school.kind === 'high-school'
            ? {
                id: 'students',
                label: 'Students',
                count: students.length,
                content: <StudentDirectory students={students} groups={groups} />,
              }
            : {
                id: 'members',
                label: 'Members',
                content: (
                  <InstitutionMembers
                    p={p}
                    institution={school}
                    accounts={accounts}
                    tabParameter="area"
                  />
                ),
              },
          {
            id: 'ventures',
            label: 'Ventures & products',
            count: ventures.length,
            content: (
              <>
                <WorkspaceTable
                  label="institution ventures"
                  columns={['Venture', 'Team', 'Sector', 'Status']}
                  rows={ventures.map((venture) => ({
                    id: venture.id,
                    search: venture.name + ' ' + venture.sector,
                    cells: [
                      venture.name,
                      groups.find((group) => group.id === venture.groupId)?.name,
                      venture.sector,
                      <WorkspaceStatus>{venture.status}</WorkspaceStatus>,
                    ],
                  }))}
                />
                <WorkspaceTable
                  label="institution products"
                  columns={['Product', 'Venture', 'Price']}
                  rows={managedProducts.map((product) => ({
                    id: product.id,
                    search: product.name,
                    cells: [
                      product.name,
                      ventures.find((venture) => venture.id === product.ventureId)?.name,
                      amount(product.price),
                    ],
                  }))}
                />
              </>
            ),
          },
          ...(school.kind === 'high-school'
            ? [
                {
                  id: 'results',
                  label: 'Results & Certificates',
                  content: (
                    <InstitutionResults
                      p={p}
                      school={school}
                      accounts={accounts}
                      save={save}
                      readonly
                    />
                  ),
                },
              ]
            : [
                {
                  id: 'invitations',
                  label: 'Invitations',
                  content: <InstitutionInvitations p={p} institution={school} save={save} />,
                },
                {
                  id: 'progress',
                  label: 'Member Progress',
                  content: (
                    <InstitutionProgramme
                      p={p}
                      institution={school}
                      accounts={accounts}
                      operator={operator}
                      tab="progress"
                      tabParameter="area"
                    />
                  ),
                },
                {
                  id: 'programme-payments',
                  label: 'Payments & Certificates',
                  content: (
                    <InstitutionProgramme
                      p={p}
                      institution={school}
                      accounts={accounts}
                      operator={operator}
                      tab="programme-payments"
                      tabParameter="area"
                    />
                  ),
                },
              ]),
          {
            id: 'activity',
            label: 'Activity log',
            content: <InstitutionActivity p={p} school={school} accounts={accounts} />,
          },
        ]}
      />
    </>
  );
}
