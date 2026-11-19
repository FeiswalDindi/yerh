import { useState } from 'react';
import { Settings } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { StudentDirectory } from './StudentDirectory';
import { InstitutionResults } from './InstitutionResults';
import type { DemoAccount } from '../../domain/demo';
import type { Institution, TrainingState } from '../../domain/incubation';
import type { PlatformState } from '../../domain/platform';
import { can } from '../../domain/roles';
import {
  institutionHref,
  ventureResultsHref,
  workspaceHref,
} from '../dashboard/dashboard-navigation';
import { cohortForVenture, institutionAccess } from '../../domain/incubation';
import { amount, field, submitTraining, TrainingForm, type Save } from './TrainingForms';
import {
  WorkspaceDialog,
  WorkspaceStatus,
  WorkspaceTable,
  WorkspaceTabs,
} from './WorkspaceControls';

function AgreementUpload({
  school,
  save,
  finish,
}: {
  school: Institution;
  save: Save;
  finish: (saved: boolean) => void;
}) {
  const [error, setError] = useState('');
  return (
    <form
      className="workspace-form"
      onSubmit={(event) => {
        event.preventDefault();
        const file = new FormData(event.currentTarget).get('agreement');
        if (
          !(file instanceof File) ||
          !file.size ||
          file.size > 250 * 1024 ||
          file.type !== 'application/pdf'
        ) {
          setError('Choose a demonstration PDF no larger than 250 KB.');
          return;
        }
        setError('');
        const reader = new FileReader();
        reader.onerror = () => setError('The selected file could not be read.');
        reader.onload = () =>
          finish(
            submitTraining(save, {
              type: 'institution-proof',
              id: school.id,
              name: file.name,
              data: String(reader.result),
            }),
          );
        reader.readAsDataURL(file);
      }}
    >
      <label>
        Signed agreement and required payment proof (demo PDF)
        <input name="agreement" type="file" accept="application/pdf,.pdf" required />
      </label>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button className="button button-outline">Upload agreement proof</button>
    </form>
  );
}

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
  const staff = accounts.filter(
    (account) =>
      can(account, 'school') &&
      !p.training.institutions.some((school) => school.adminId === account.id),
  );
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
          {staff.length ? (
            <TrainingForm
              save={save}
              dialog={{ action: 'Add institution', create: true }}
              label="Create institution portal"
              build={(data) => ({
                type: 'institution-create',
                id: crypto.randomUUID(),
                name: field(data, 'name'),
                kind: field(data, 'kind') === 'university' ? 'university' : 'high-school',
                adminId: field(data, 'admin'),
                amount: Number(field(data, 'amount')),
              })}
            >
              <label>
                Institution name <input name="name" required minLength={3} maxLength={120} />
              </label>
              <label>
                Institution type{' '}
                <select name="kind">
                  <option value="high-school">High school</option>
                  <option value="university">University</option>
                </select>
              </label>
              <label>
                Institution administrator{' '}
                <select name="admin" required>
                  {staff.map((account) => (
                    <option value={account.id} key={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Agreed contract amount (KES){' '}
                <input name="amount" type="number" min="0" step="1" required />
              </label>
            </TrainingForm>
          ) : (
            <Link to={workspaceHref('users')}>Assign an institution administrator</Link>
          )}
        </>
      }
      rows={p.training.institutions
        .filter((school) => !filter || school.status === filter)
        .map((school) => {
          const kind = school.kind === 'high-school' ? 'High school' : 'University';
          const administrator = accounts.find((account) => account.id === school.adminId)?.name;
          return {
            id: school.id,
            search: [school.name, kind, administrator, school.status].join(' '),
            cells: [
              school.name,
              kind,
              administrator,
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

export function InstitutionPortal({
  p,
  account,
  accounts,
  save,
  portalHref = workspaceHref,
}: {
  p: PlatformState;
  account: DemoAccount;
  accounts: DemoAccount[];
  save: Save;
  portalHref?: (tab: string) => string;
}) {
  const school = p.training.institutions.find((entry) => entry.adminId === account.id);
  if (!school)
    return (
      <p>Your institution will appear here once the platform administrator sets up its portal.</p>
    );
  const groups = p.training.groups.filter((group) => group.institutionId === school.id);
  const students = p.training.students.filter((student) => student.institutionId === school.id);
  const agreements = <AgreementsPanel school={school} accounts={accounts} save={save} />;
  if (school.status !== 'active' || school.kind !== 'high-school') return agreements;
  return (
    <WorkspaceTabs
      label="Institution portal views"
      views={[
        {
          id: 'students',
          label: 'Students',
          count: students.length,
          content: <StudentDirectory students={students} groups={groups} save={save} />,
        },
        {
          id: 'teams',
          label: 'Venture teams',
          count: groups.length,
          content: (
            <WorkspaceTable
              label="venture teams"
              columns={['Team', 'Members', 'Action']}
              exportName="yerh-teams.csv"
              empty={
                students.length < 2
                  ? 'Add at least two students to create a team.'
                  : 'There are no venture teams yet.'
              }
              actions={
                students.length >= 2 && (
                  <TrainingForm
                    save={save}
                    label="Create venture team"
                    dialog={{ action: 'Add team', create: true }}
                    build={(data) => ({
                      type: 'institution-group',
                      id: crypto.randomUUID(),
                      name: field(data, 'name'),
                      studentIds: data.getAll('student').map(String),
                    })}
                  >
                    <label>
                      Team name
                      <input name="name" required minLength={3} maxLength={120} />
                    </label>
                    <fieldset>
                      <legend>Team members</legend>
                      {students.map((student) => (
                        <label key={student.id} className="inline-checkbox">
                          <input type="checkbox" name="student" value={student.id} />
                          {student.name}
                        </label>
                      ))}
                    </fieldset>
                  </TrainingForm>
                )
              }
              rows={groups.map((group) => {
                const members = students
                  .filter((student) => group.studentIds.includes(student.id))
                  .map((student) => student.name);
                return {
                  id: group.id,
                  search: [group.name, ...members].join(' '),
                  cells: [
                    group.name,
                    members.join(', '),
                    <Link to={portalHref('ventures')}>Manage ventures</Link>,
                  ],
                };
              })}
            />
          ),
        },
        {
          id: 'activity',
          label: 'Activity log',
          content: <InstitutionActivity p={p} school={school} accounts={accounts} />,
        },
        {
          id: 'assessments',
          label: 'Assessments',
          content: (
            <WorkspaceTable
              label="school assessments"
              columns={['Venture', 'Cohort', 'Action']}
              empty="Launch a venture in Incubation to see its assessments here."
              rows={p.ventures.flatMap((venture) => {
                if (
                  !groups.some((group) => group.id === venture.groupId) ||
                  !p.incubations.some(
                    (path) => path.ventureId === venture.id && path.status !== 'rejected',
                  )
                )
                  return [];
                const cohort = cohortForVenture(p, venture);
                return [
                  {
                    id: venture.id,
                    search: venture.name + ' ' + (cohort?.name ?? ''),
                    cells: [
                      venture.name,
                      cohort?.name ?? '—',
                      <Link
                        to={ventureResultsHref(
                          portalHref('member-results'),
                          venture.id,
                          cohort?.id,
                        )}
                      >
                        Record marks
                      </Link>,
                    ],
                  },
                ];
              })}
            />
          ),
        },
        {
          id: 'classes',
          label: 'Classes',
          content: (
            <ClassDirectory
              classes={p.training.classes}
              groups={groups}
              students={students}
              save={save}
            />
          ),
        },
        { id: 'agreements', label: 'Agreements', content: agreements },
      ]}
    />
  );
}

function InstitutionSettings({ school, save }: { school: Institution; save: Save }) {
  return (
    <TrainingForm
      save={save}
      label="Save intake details"
      dialog={{ action: 'Edit intake', title: school.name }}
      build={(data) => ({
        type: 'institution-intake',
        id: school.id,
        notes: field(data, 'notes'),
        visit: field(data, 'visit'),
        terms: field(data, 'terms'),
        amount: Number(field(data, 'amount')),
      })}
    >
      <label>
        Application details
        <textarea name="notes" maxLength={3000} defaultValue={school.intake?.notes} />
      </label>
      <label>
        Site visit date
        <input type="date" name="visit" defaultValue={school.intake?.visit} />
      </label>
      <label>
        Agreed terms
        <textarea name="terms" maxLength={3000} defaultValue={school.intake?.terms} />
      </label>
      <label>
        Agreed amount (KES)
        <input type="number" min={0} step={1} required name="amount" defaultValue={school.amount} />
      </label>
    </TrainingForm>
  );
}

function InstitutionAccessEditor({
  school,
  accounts,
  save,
  person,
}: {
  school: Institution;
  accounts: DemoAccount[];
  save: Save;
  person?: DemoAccount;
}) {
  const candidates = accounts.filter(
    (account) =>
      !account.suspended &&
      ['guest', 'admin'].includes(account.role) &&
      !school.staffIds?.includes(account.id) &&
      !school.contactIds?.includes(account.id) &&
      account.id !== school.adminId,
  );
  if (!person && !candidates.length)
    return (
      <WorkspaceDialog action="Add staff or contact" create>
        {() => (
          <>
            <p>
              All eligible guest and platform administrator accounts already have access to this
              institution.
            </p>
            <Link to={workspaceHref('users')}>View users and roles</Link>
          </>
        )}
      </WorkspaceDialog>
    );
  return (
    <TrainingForm
      save={save}
      label="Save access"
      dialog={{
        action: person ? 'Edit access' : 'Add staff or contact',
        title: person?.name,
        create: !person,
      }}
      build={(data) => ({
        type: 'institution-access',
        id: school.id,
        accountId: person?.id ?? field(data, 'account'),
        access: field(data, 'access') as 'manage' | 'view' | 'none',
      })}
    >
      {!person && (
        <label>
          Account
          <select name="account" required>
            <option value="">Select an existing account</option>
            {candidates.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name} · {account.email}
              </option>
            ))}
          </select>
        </label>
      )}
      <label>
        Access level
        <select
          name="access"
          defaultValue={person && school.staffIds?.includes(person.id) ? 'manage' : 'view'}
        >
          <option value="view">Contact · View results</option>
          <option value="manage">Staff · Manage institution workspace</option>
          {person && <option value="none">Remove access</option>}
        </select>
      </label>
    </TrainingForm>
  );
}

function ClassDirectory({
  classes,
  groups,
  students,
  save,
}: {
  classes: TrainingState['classes'];
  groups: TrainingState['groups'];
  students: TrainingState['students'];
  save: Save;
}) {
  const [team, setTeam] = useState('');
  const [date, setDate] = useState('');
  return (
    <WorkspaceTable
      label="classes"
      exportName="yerh-classes.csv"
      columns={['Date', 'Teams', 'Attended', 'Challenge and class notes']}
      empty={groups.length ? 'No classes match these filters.' : 'Create a team to record a class.'}
      actions={
        groups.length > 0 && (
          <>
            <label className="workspace-toolbar-filter">
              Team
              <select value={team} onChange={(event) => setTeam(event.target.value)}>
                <option value="">All teams</option>
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="workspace-toolbar-filter">
              Class date
              <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
            </label>
            <WorkspaceDialog action="Record class" create>
              {(finish) => (
                <ClassForm students={students} groups={groups} save={save} finish={finish} />
              )}
            </WorkspaceDialog>
          </>
        )
      }
      rows={classes.flatMap((entry) => {
        const ids = entry.groupIds ?? [entry.groupId];
        const teams = groups.filter((group) => ids.includes(group.id)).map((group) => group.name);
        if (!teams.length || (team && !ids.includes(team)) || (date && entry.date !== date))
          return [];
        return [
          {
            id: entry.id,
            search: [entry.date, ...teams, entry.challenge].join(' '),
            cells: [entry.date, teams.join(', '), entry.attendance.length, entry.challenge],
          },
        ];
      })}
    />
  );
}

function ClassForm({
  groups,
  students,
  save,
  finish,
}: {
  groups: TrainingState['groups'];
  students: TrainingState['students'];
  save: Save;
  finish: (saved: boolean) => void;
}) {
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const roster = students.filter((student) =>
    groups.some((group) => groupIds.includes(group.id) && group.studentIds.includes(student.id)),
  );
  return (
    <TrainingForm
      save={(action) => {
        const saved = save(action);
        finish(saved);
        return saved;
      }}
      label="Save class"
      build={(data) => ({
        type: 'institution-class',
        id: crypto.randomUUID(),
        groupIds,
        date: field(data, 'date'),
        challenge: field(data, 'challenge'),
        attendance: data.getAll('attendance').map(String),
      })}
    >
      <fieldset>
        <legend>Teams attending</legend>
        <label className="inline-checkbox">
          <input
            type="checkbox"
            checked={groupIds.length === groups.length}
            onChange={(event) =>
              setGroupIds(event.target.checked ? groups.map((group) => group.id) : [])
            }
          />
          Select all teams
        </label>
        {groups.map((team) => (
          <label key={team.id} className="inline-checkbox">
            <input
              type="checkbox"
              checked={groupIds.includes(team.id)}
              onChange={(event) =>
                setGroupIds(
                  event.target.checked
                    ? [...groupIds, team.id]
                    : groupIds.filter((id) => id !== team.id),
                )
              }
            />
            {team.name}
          </label>
        ))}
      </fieldset>
      <label>
        Class date
        <input name="date" type="date" required />
      </label>
      <label>
        Challenge and class notes
        <textarea name="challenge" required minLength={10} maxLength={3000} />
      </label>
      <fieldset>
        <legend>Students who attended</legend>
        {!roster.length && <p>Select teams to view their students.</p>}
        {roster.map((student) => (
          <label key={student.id} className="inline-checkbox">
            <input type="checkbox" name="attendance" value={student.id} />
            {student.name}
          </label>
        ))}
      </fieldset>
    </TrainingForm>
  );
}

function InstitutionActivity({
  p,
  school,
  accounts,
}: {
  p: PlatformState;
  school: Institution;
  accounts: DemoAccount[];
}) {
  return (
    <WorkspaceTable
      label="institution activity"
      exportName="yerh-institution-activity.csv"
      columns={['Date', 'Staff member', 'Action']}
      rows={p.audit
        .filter((entry) => entry.institutionId === school.id)
        .map((entry) => {
          const actor = accounts.find((account) => account.id === entry.actorId)?.name ?? 'Member';
          const action = entry.action.replaceAll('-', ' ');
          return {
            id: entry.id,
            search: [actor, action].join(' '),
            cells: [
              new Date(entry.createdAt).toLocaleString('en-KE', { timeZone: 'Africa/Nairobi' }),
              actor,
              action,
            ],
          };
        })}
    />
  );
}

function AgreementTerms({
  school,
  terms,
  historical = false,
}: {
  school: Institution;
  terms?: string;
  historical?: boolean;
}) {
  return (
    <WorkspaceDialog
      action="View"
      title={historical ? 'Agreement terms at upload' : 'Institution agreement terms'}
    >
      {() =>
        terms?.trim() ? (
          <p className="workspace-detail-copy">{terms}</p>
        ) : (
          <>
            <p>
              <strong>Sample agreement</strong> · YERH and {school.name}
            </p>
            <dl className="workspace-profile">
              <div>
                <dt>Programme</dt>
                <dd>
                  One school term of venture incubation with class activities, team projects, and
                  stage assessments.
                </dd>
              </div>
              <div>
                <dt>School commitments</dt>
                <dd>
                  Appoint a programme lead, supervise teams, and record attendance, marks, and
                  individual contributions.
                </dd>
              </div>
              <div>
                <dt>YERH commitments</dt>
                <dd>
                  Provide the pathway materials, review the school’s assessment evidence, and issue
                  certificates for eligible learners.
                </dd>
              </div>
              <div>
                <dt>Learner records</dt>
                <dd>
                  Use student information for programme delivery and reporting. Share public success
                  stories only with the school’s permission.
                </dd>
              </div>
              <div>
                <dt>End-of-term review</dt>
                <dd>
                  Both teams review participation and results before agreeing on the next cohort.
                </dd>
              </div>
            </dl>
          </>
        )
      }
    </WorkspaceDialog>
  );
}

function AgreementsPanel({
  school,
  accounts,
  save,
}: {
  school: Institution;
  accounts: DemoAccount[];
  save: Save;
}) {
  const documents = school.agreements?.length
    ? school.agreements
    : school.proof
      ? [
          {
            id: school.id + ':original',
            ...school.proof,
            addedAt: '',
            addedBy: '',
            amount: school.amount,
            terms: school.intake?.terms ?? '',
          },
        ]
      : [];
  return (
    <>
      <h3>Agreements</h3>
      <dl className="workspace-profile">
        <div>
          <dt>Institution</dt>
          <dd>{school.name}</dd>
        </div>
        <div>
          <dt>Agreed terms</dt>
          <dd>
            <AgreementTerms school={school} terms={school.intake?.terms} />
          </dd>
        </div>
      </dl>
      <WorkspaceTable
        label="agreement documents"
        columns={['Document', 'Terms at upload', 'Added by', 'Date', 'Action']}
        actions={
          <WorkspaceDialog action="Upload agreement" create>
            {(finish) => <AgreementUpload school={school} save={save} finish={finish} />}
          </WorkspaceDialog>
        }
        rows={[...documents].reverse().map((document) => {
          const author = accounts.find((row) => row.id === document.addedBy)?.name ?? '—';
          return {
            id: document.id,
            search: [document.name, author, document.terms].join(' '),
            cells: [
              document.name,
              <AgreementTerms school={school} terms={document.terms} historical />,
              author,
              document.addedAt
                ? new Date(document.addedAt).toLocaleDateString('en-KE', {
                    dateStyle: 'medium',
                    timeZone: 'Africa/Nairobi',
                  })
                : '—',
              <a href={document.data} download={document.name}>
                Download PDF
              </a>,
            ],
          };
        })}
      />
    </>
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
  const students = p.training.students.filter((row) => row.institutionId === school.id);
  const groups = p.training.groups.filter((row) => row.institutionId === school.id);
  const ventures = p.ventures.filter((row) => groups.some((group) => group.id === row.groupId));
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
                    <dd>{school.kind === 'high-school' ? 'High school' : 'University'}</dd>
                  </div>
                  <div>
                    <dt>Primary administrator</dt>
                    <dd>{administrator?.name ?? '—'}</dd>
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
                  <TrainingForm
                    save={save}
                    label={
                      school.status === 'active' ? 'Deactivate institution' : 'Activate institution'
                    }
                    dialog={{
                      action:
                        school.status === 'active'
                          ? 'Deactivate institution'
                          : 'Activate institution',
                    }}
                    build={() => ({
                      type:
                        school.status === 'active'
                          ? 'institution-deactivate'
                          : 'institution-activate',
                      id: school.id,
                    })}
                  >
                    <p>
                      {school.status === 'active'
                        ? 'Staff will retain their records. The shared portal will be locked.'
                        : 'Review the signed agreement before opening access to this portal.'}
                    </p>
                  </TrainingForm>
                  {school.status === 'active' && (
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
                  <InstitutionAccessEditor school={school} accounts={accounts} save={save} />
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
          {
            id: 'students',
            label: 'Students',
            count: students.length,
            content: <StudentDirectory students={students} groups={groups} />,
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
          {
            id: 'results',
            label: 'Results & Certificates',
            content: (
              <InstitutionResults p={p} school={school} accounts={accounts} save={save} readonly />
            ),
          },
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
