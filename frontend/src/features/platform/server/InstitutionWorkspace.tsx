import { CircleCheck } from 'lucide-react';
import { ExistingUserPicker } from './ExistingUserPicker';
import { useCallback, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { WorkspaceTable, WorkspaceTabs } from '../workspace/WorkspaceControls';
import {
  schoolRepository,
  schoolStages,
  type SchoolStage,
} from '../../../services/laravel-school-repository';
import { ActivityTable } from './WorkspaceOverview';
import { SchoolPortal } from './SchoolPortal';
import { InstitutionAgreements } from './InstitutionAgreements';
import {
  laravelWorkspace,
  type InstitutionRecord,
} from '../../../services/laravel-workspace-repository';
import { localInstitution } from '../../../services/local-institution-repository';
import type { InstitutionChoice } from '../../../services/laravel-identity-repository';
import {
  fieldValue,
  RecordsFeedback,
  useWorkspaceRecords,
  WorkspaceAction,
} from './WorkspaceActions';

const kindLabels = { 'high-school': 'High school', university: 'University', hub: 'Hub' };

export function InstitutionDirectory({ record }: { record?: string }) {
  const { records, error, reload } = useWorkspaceRecords(laravelWorkspace.institutions);
  const [status, setStatus] = useState('');
  const current = records?.find((entry) => entry.slug === record);
  const href = '/dashboard/workspace?tab=institutions';

  return (
    <>
      <RecordsFeedback error={error} loading={records === null} />
      {records && record && !current && (
        <p role="status">
          Institution not found. <Link to={href}>Back to institution directory</Link>
        </p>
      )}
      {current && <InstitutionRecordView key={current.slug} entry={current} reload={reload} />}
      {records && !record && (
        <>
          <h1 className="sr-only">Institution directory</h1>
          <WorkspaceTable
            label="institutions"
            columns={['Institution', 'Type', 'Administrator', 'Agreements', 'Status', 'Action']}
            actions={
              <>
                <label className="workspace-status-filter">
                  <span className="sr-only">Filter by status</span>
                  <select
                    aria-label="Filter by status"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                  >
                    <option value="">All statuses</option>
                    {Array.from(new Set(records.map((entry) => entry.status))).map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </label>
                <WorkspaceAction
                  action="Add institution"
                  create
                  submit="Create institution"
                  save={async (data) => {
                    await laravelWorkspace.addInstitution({
                      name: fieldValue(data, 'name'),
                      kind: fieldValue(data, 'kind'),
                    });
                    reload();
                  }}
                >
                  <label>
                    Name <input name="name" required minLength={2} maxLength={120} />
                  </label>
                  <label>
                    Type
                    <select name="kind">
                      {Object.entries(kindLabels).map(([id, title]) => (
                        <option key={id} value={id}>
                          {title}
                        </option>
                      ))}
                    </select>
                  </label>
                </WorkspaceAction>
              </>
            }
            rows={records
              .filter((entry) => !status || entry.status === status)
              .map((entry) => ({
                id: entry.slug,
                search: [
                  entry.name,
                  kindLabels[entry.kind],
                  entry.status,
                  entry.administrator,
                ].join(' '),
                cells: [
                  entry.name,
                  kindLabels[entry.kind],
                  entry.administrator ?? 'Unassigned',
                  entry.agreements,
                  <InstitutionStatus status={entry.status} />,
                  <Link to={href + '&record=' + encodeURIComponent(entry.slug)}>
                    Manage institution
                  </Link>,
                ],
              }))}
          />
        </>
      )}
    </>
  );
}

function InstitutionStaff({ slug, changed }: { slug: string; changed: () => void }) {
  const load = useCallback((signal: AbortSignal) => laravelWorkspace.staff(slug, signal), [slug]);
  const candidates = useCallback(
    (query: string, signal: AbortSignal) => laravelWorkspace.staffCandidates(slug, query, signal),
    [slug],
  );
  const { records, error, reload } = useWorkspaceRecords(load);
  return (
    <>
      <RecordsFeedback error={error} loading={records === null} />
      {records && (
        <WorkspaceTable
          label="institution staff"
          columns={['Name', 'Access', 'Status']}
          actions={
            <WorkspaceAction
              action="Assign staff"
              submit="Save access"
              save={async (data) => {
                await laravelWorkspace.assignStaff(
                  slug,
                  Number(fieldValue(data, 'user_id')),
                  fieldValue(data, 'access'),
                );
                reload();
                changed();
              }}
            >
              <ExistingUserPicker label="Eligible staff account" load={candidates} />
              <label>
                Access{' '}
                <select name="access">
                  <option value="manage">Manage</option>
                  <option value="view">View</option>
                </select>
              </label>
            </WorkspaceAction>
          }
          rows={records.map((staff) => ({
            id: String(staff.id),
            search: staff.name,
            cells: [staff.name, staff.access, staff.suspended_at ? 'Suspended' : 'Active'],
          }))}
        />
      )}
    </>
  );
}

function SchoolRecords({ slug, teams, portal }: { slug: string; teams?: boolean; portal: string }) {
  const load = useCallback(
    (signal: AbortSignal) => schoolRepository.directory(slug, signal),
    [slug],
  );
  const students = useWorkspaceRecords(load, !teams);
  const ventures = useWorkspaceRecords(laravelWorkspace.institutionVentures, !!teams);
  if (teams)
    return (
      <>
        <RecordsFeedback error={ventures.error} loading={!ventures.records} />
        {ventures.records && (
          <WorkspaceTable
            label="team ventures"
            columns={['Venture', 'Cohort', 'Sector', 'Action']}
            rows={ventures.records
              .filter((v) => v.slug === slug)
              .map((v) => ({
                id: String(v.id),
                search: [v.name, v.sector, v.cohort].join(' '),
                cells: [
                  v.name,
                  v.cohort,
                  v.sector,
                  <Link to={portal + '&cohort=' + v.cohort_id + '&section=teams'}>View</Link>,
                ],
              }))}
          />
        )}
      </>
    );
  return (
    <>
      <RecordsFeedback error={students.error} loading={!students.records} />
      {students.records && (
        <WorkspaceTable
          label="students"
          columns={['Student', 'Admission number', 'Grade or form', 'Gender', 'Age']}
          exportName={slug + '-students.csv'}
          rows={students.records.students.map((s) => ({
            id: String(s.id),
            search: [s.name, s.reference, s.grade].join(' '),
            cells: [s.name, s.reference, s.grade, s.gender, s.age],
          }))}
        />
      )}
    </>
  );
}
function SchoolCohortResults({ slug, portal }: { slug: string; portal: string }) {
  const load = useCallback(
    (signal: AbortSignal) => schoolRepository.directory(slug, signal),
    [slug],
  );
  const { records, error } = useWorkspaceRecords(load);
  return (
    <>
      <RecordsFeedback error={error} loading={!records} />
      {records && (
        <WorkspaceTable
          label="cohort results"
          columns={['Cohort', 'Starts', 'Ends', 'Actions']}
          rows={records.cohorts.map((c) => ({
            id: String(c.id),
            search: [c.name, c.starts_on, c.ends_on].join(' '),
            cells: [
              c.name,
              c.starts_on,
              c.ends_on,
              <div className="workspace-row-actions">
                <Link to={portal + '&cohort=' + c.id + '&section=results'}>Results</Link>
                <Link to={portal + '&cohort=' + c.id + '&section=certificates'}>Certificates</Link>
              </div>,
            ],
          }))}
        />
      )}
    </>
  );
}
function InstitutionRecordView({
  entry,
  reload,
}: {
  entry: InstitutionRecord;
  reload: () => void;
}) {
  const reference = entry.agreement_reference;
  const portal = '/dashboard/workspace?tab=school&institution=' + encodeURIComponent(entry.slug);
  const load = useCallback(
    (signal: AbortSignal) => laravelWorkspace.institution(entry.slug, signal),
    [entry.slug],
  );
  const { records, error } = useWorkspaceRecords(load, entry.status === 'active');
  const noData = <p>Available once this institution is active.</p>;
  const feedback = <RecordsFeedback error={error} loading={records === null} />;
  const scopeNote =
    entry.kind === 'high-school' && entry.status === 'active' ? (
      <p>
        <Link to={portal}>Open the school portal</Link> for group programmes and results.
      </p>
    ) : null;
  const rows = (entries: string[][]) =>
    entries.map(([field = '', value = '']) => ({
      id: field,
      search: field + ' ' + value,
      cells: [field, field === 'Status' ? <InstitutionStatus status={value} /> : value],
    }));

  return (
    <>
      <div className="workspace-record-title">
        <div>
          <h1>{entry.name}</h1>
          <InstitutionStatus status={entry.status} />
        </div>
        <WorkspaceAction
          action="Edit institution"
          title={entry.name}
          submit="Save changes"
          save={async (data) => {
            await laravelWorkspace.renameInstitution(entry.slug, fieldValue(data, 'name'));
            reload();
          }}
        >
          <label>
            Name{' '}
            <input name="name" required minLength={2} maxLength={120} defaultValue={entry.name} />
          </label>
        </WorkspaceAction>
      </div>
      <WorkspaceTabs
        label="Institution record"
        views={[
          {
            id: 'intake',
            label: 'Intake',
            content: (
              <>
                <WorkspaceTable
                  label="intake details"
                  columns={['Field', 'Value']}
                  rows={rows([
                    ['Institution name', entry.name],
                    ['Type', kindLabels[entry.kind]],
                    ['Status', entry.status],
                  ])}
                />
                {entry.status !== 'active' && (
                  <WorkspaceAction
                    action="Activate institution"
                    title={entry.name}
                    submit="Activate"
                    save={async () => {
                      await laravelWorkspace.activate(entry.slug);
                      reload();
                    }}
                  >
                    <p>Make {entry.name} available for sign-in and affiliation?</p>
                  </WorkspaceAction>
                )}
              </>
            ),
          },
          {
            id: 'staff-contacts',
            label: 'Staff & contacts',
            content: <InstitutionStaff slug={entry.slug} changed={reload} />,
          },
          {
            id: 'agreements',
            label: 'Agreements',
            content: (
              <InstitutionAgreements school={entry} slug={entry.slug} reference={reference} admin />
            ),
          },
          {
            id: 'students',
            label: 'Students',
            content: (
              <>
                {scopeNote}
                {entry.status !== 'active' ? (
                  noData
                ) : entry.kind === 'high-school' ? (
                  <SchoolRecords slug={entry.slug} portal={portal} />
                ) : records ? (
                  <WorkspaceTable
                    label="students"
                    columns={['Name', 'Location']}
                    rows={records.members.map((member) => ({
                      id: String(member.id),
                      search: member.name + ' ' + member.location,
                      cells: [member.name, member.location],
                    }))}
                  />
                ) : (
                  feedback
                )}
              </>
            ),
          },
          {
            id: 'ventures-products',
            label: 'Ventures & products',
            content: (
              <>
                {scopeNote}
                {entry.status !== 'active' ? (
                  noData
                ) : entry.kind === 'high-school' ? (
                  <SchoolRecords slug={entry.slug} portal={portal} teams />
                ) : records ? (
                  <WorkspaceTable
                    label="ventures"
                    columns={['Venture', 'Sector', 'Status']}
                    rows={records.ventures.map((venture) => ({
                      id: String(venture.id),
                      search: venture.name + ' ' + venture.sector,
                      cells: [venture.name, venture.sector, venture.status],
                    }))}
                  />
                ) : (
                  feedback
                )}
              </>
            ),
          },
          {
            id: 'results-certificates',
            label: 'Results & Certificates',
            content: (
              <>
                {scopeNote}
                {entry.status !== 'active' ? (
                  noData
                ) : entry.kind === 'high-school' ? (
                  <SchoolCohortResults slug={entry.slug} portal={portal} />
                ) : records ? (
                  <WorkspaceTable
                    label="issued credentials"
                    columns={['Credential', 'Issued']}
                    rows={records.credentials.map((credential, index) => ({
                      id: String(index),
                      search: credential.kind,
                      cells: [credential.kind, new Date(credential.issued_at).toLocaleDateString()],
                    }))}
                  />
                ) : (
                  feedback
                )}
              </>
            ),
          },
          {
            id: 'activity',
            label: 'Activity log',
            content: <ActivityTable institution={entry.slug} />,
          },
        ]}
      />
    </>
  );
}

export function InstitutionPortal({
  institution,
  admin,
}: {
  institution: InstitutionChoice;
  admin: boolean;
}) {
  const { slug, name, kind } = institution;
  const [params] = useSearchParams();
  const candidates = useCallback(
    (query: string, signal: AbortSignal) => localInstitution.candidates(slug, query, signal),
    [slug],
  );
  const load = useCallback(
    (signal: AbortSignal) => laravelWorkspace.institution(slug, signal),
    [slug],
  );
  const { records, error, reload } = useWorkspaceRecords(load);
  return (
    <>
      <h2>{name}</h2>
      <RecordsFeedback error={error} loading={records === null} />
      {records && kind === 'high-school' && (
        <SchoolPortal name={name} slug={slug} agreement={records.agreement} admin={admin} />
      )}
      {records && kind !== 'high-school' && params.get('view') === 'finance' && (
        <WorkspaceTable
          label="venture payments and certificates"
          columns={['Member', 'Venture', 'Certificate fees', 'Certificates issued']}
          exportName={slug + '-payments-certificates.csv'}
          rows={records.paths.map((path) => {
            const venture = records.ventures.find((v) => v.id === path.venture_id);
            const member = records.members.find((m) => m.id === venture?.owner_id);
            const fees = records.payments
              .filter((p) => p.path_id === path.id)
              .map((p) => p.purpose + ' / ' + p.status)
              .join(', ');
            const issued = records.credentials
              .filter((c) => c.path_id === path.id)
              .map((c) => c.kind)
              .join(', ');
            return {
              id: String(path.id),
              search: [member?.name, venture?.name, issued, fees].join(' '),
              cells: [member?.name, venture?.name, fees || '—', issued || '—'],
            };
          })}
        />
      )}
      {records && kind !== 'high-school' && params.get('view') !== 'finance' && (
        <WorkspaceTabs
          label="Institution portal"
          views={[
            {
              id: 'members',
              label: 'Members',
              content: (
                <WorkspaceTable
                  label="members"
                  columns={['Member', 'Location', 'Ventures']}
                  rows={records.members.map((member) => ({
                    id: String(member.id),
                    search: [member.name, member.location].join(' '),
                    cells: [
                      member.name,
                      member.location,
                      records.ventures
                        .filter((venture) => venture.owner_id === member.id)
                        .map((venture) => venture.name)
                        .join(', ') || '—',
                    ],
                  }))}
                />
              ),
            },
            {
              id: 'progress',
              label: 'Pathway progress',
              content: (
                <WorkspaceTable
                  label="pathway progress"
                  columns={[
                    'Member',
                    'Venture',
                    'Current stage',
                    'Stages completed',
                    'Certificate fees',
                    'Certificates issued',
                  ]}
                  exportName={slug + '-pathway-progress.csv'}
                  rows={records.paths.map((path) => {
                    const venture = records.ventures.find((item) => item.id === path.venture_id);
                    const member = records.members.find((item) => item.id === venture?.owner_id);
                    const completed = records.stages.filter(
                      (item) => item.path_id === path.id && item.graded_at,
                    );
                    const current = (Object.keys(schoolStages) as SchoolStage[]).find(
                      (key) => !completed.some((stage) => stage.stage === key),
                    );
                    const fees = records.payments
                      .filter((item) => item.path_id === path.id)
                      .map(
                        (item) =>
                          (schoolStages[item.purpose as SchoolStage] ?? item.purpose) +
                          ' · ' +
                          item.status,
                      )
                      .join(', ');
                    const issued = records.credentials.filter(
                      (item) => item.path_id === path.id,
                    ).length;
                    const stage = current ? schoolStages[current] : 'Graduated';
                    return {
                      id: String(path.id),
                      search: [member?.name, venture?.name, stage].join(' '),
                      cells: [
                        member?.name,
                        venture?.name,
                        stage,
                        completed.length,
                        fees || '—',
                        issued,
                      ],
                    };
                  })}
                />
              ),
            },
            {
              id: 'agreements',
              label: 'Agreements',
              content: (
                <InstitutionAgreements
                  school={{ name, kind }}
                  slug={slug}
                  reference={records.agreement}
                  admin={admin}
                />
              ),
            },
            ...(records.access === 'manage'
              ? [
                  {
                    id: 'invitations',
                    label: 'Invitations',
                    content: (
                      <WorkspaceTable
                        label="invitations"
                        columns={['Name', 'Email', 'Invitation', 'Action']}
                        actions={
                          <>
                            <WorkspaceAction
                              action="Invite members"
                              create
                              submit="Send invitations"
                              save={async (data) => {
                                await localInstitution.inviteMembers(
                                  slug,
                                  data.getAll('members').map(Number),
                                );
                                reload();
                              }}
                            >
                              <ExistingUserPicker
                                multiple
                                name="members"
                                label="Eligible guests"
                                load={candidates}
                              />
                            </WorkspaceAction>
                            <WorkspaceAction
                              action="Invite new member"
                              create
                              submit="Send invitation"
                              save={async (data) => {
                                await localInstitution.issue(slug, {
                                  name: fieldValue(data, 'name'),
                                  email: fieldValue(data, 'email'),
                                });
                                reload();
                              }}
                            >
                              <label>
                                Name
                                <input name="name" required minLength={2} maxLength={80} />
                              </label>
                              <label>
                                Email
                                <input name="email" type="email" required maxLength={254} />
                              </label>
                            </WorkspaceAction>
                          </>
                        }
                        rows={records.invitations.map((invite) => {
                          const status = invite.accepted_at
                            ? 'Accepted'
                            : invite.revoked_at
                              ? 'Revoked'
                              : Date.parse(invite.expires_at.replace(' ', 'T') + 'Z') < Date.now()
                                ? 'Expired'
                                : 'Pending';
                          return {
                            id: String(invite.id),
                            search: [invite.name, invite.email, status].join(' '),
                            cells: [
                              invite.name,
                              invite.email,
                              status,
                              status === 'Pending' ? (
                                <WorkspaceAction
                                  action="Revoke invitation"
                                  title={invite.name}
                                  submit="Revoke"
                                  save={async () => {
                                    await localInstitution.revoke(slug, String(invite.id));
                                    reload();
                                  }}
                                >
                                  <p>The invitation code will stop working.</p>
                                </WorkspaceAction>
                              ) : (
                                '—'
                              ),
                            ],
                          };
                        })}
                      />
                    ),
                  },
                ]
              : []),
          ]}
        />
      )}
    </>
  );
}

function InstitutionStatus({ status }: { status: string }) {
  return status === 'active' ? (
    <span className="institution-active-mark" title="Active">
      <CircleCheck size={18} aria-hidden="true" />
      <span className="sr-only">Active</span>
    </span>
  ) : (
    <span className="workspace-record-status">{status}</span>
  );
}
