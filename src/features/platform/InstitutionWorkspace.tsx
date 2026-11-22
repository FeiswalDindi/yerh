import { useState } from 'react';
import { Settings } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { StudentDirectory } from './StudentDirectory';
import { InstitutionResults } from './InstitutionResults';
import { InstitutionMembers } from './InstitutionMembers';
import { InstitutionProgramme } from './InstitutionProgramme';
import type { DemoAccount } from '../../domain/demo';
import type { Institution, TrainingState } from '../../domain/incubation';
import type { PlatformState } from '../../domain/platform';
import { can } from '../../domain/roles';
import {
  institutionHref,
  ventureResultsHref,
  workspaceHref,
} from '../dashboard/dashboard-navigation';
import {
  accountInstitution,
  availableInstitutionAdministrators,
  cohortForVenture,
  institutionAccess,
  institutionKindLabels,
  passMark,
  schoolCertificateClassifications,
} from '../../domain/incubation';
import { amount, field, submitTraining, TrainingForm, type Save } from './TrainingForms';
import {
  WorkspaceDialog,
  WorkspaceFormDialog,
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

function InstitutionAdministratorField({
  staff,
  optional = false,
}: {
  staff: DemoAccount[];
  optional?: boolean;
}) {
  return (
    <label>
      Institution administrator
      <select name="admin" defaultValue="" required={!optional}>
        <option value="">{optional ? 'Assign later' : 'Choose an administrator'}</option>
        {staff.map((account) => (
          <option value={account.id} key={account.id}>
            {account.name}
          </option>
        ))}
      </select>
    </label>
  );
}

export function InstitutionPortal({
  p,
  account,
  school,
  accounts,
  save,
  portalHref = workspaceHref,
}: {
  p: PlatformState;
  account: DemoAccount;
  school?: Institution;
  accounts: DemoAccount[];
  save: Save;
  portalHref?: (tab: string) => string;
}) {
  if (!school)
    return (
      <p>Your institution will appear here once the platform administrator sets up its portal.</p>
    );
  const groups = p.training.groups.filter((group) => group.institutionId === school.id);
  const students = p.training.students.filter((student) => student.institutionId === school.id);
  const agreements = <AgreementsPanel school={school} accounts={accounts} save={save} />;
  if (school.status !== 'active') return agreements;
  if (school.kind !== 'high-school') {
    const access = institutionAccess(school, account);
    const progress = {
      id: 'progress',
      label: 'Member Progress',
      content: (
        <InstitutionProgramme
          p={p}
          institution={school}
          accounts={accounts}
          operator={account}
          tab="progress"
        />
      ),
    };
    if (access !== 'manage') return access === 'view' ? progress.content : null;
    return (
      <WorkspaceTabs
        label="Institution portal views"
        views={[
          {
            id: 'members',
            label: 'Members',
            content: (
              <InstitutionMembers p={p} institution={school} accounts={accounts} save={save} />
            ),
          },
          progress,
          {
            id: 'programme-payments',
            label: 'Payments & Certificates',
            content: (
              <InstitutionProgramme
                p={p}
                institution={school}
                accounts={accounts}
                operator={account}
                tab="programme-payments"
              />
            ),
          },
          { id: 'agreements', label: 'Agreements', content: agreements },
        ]}
      />
    );
  }
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
  p,
  school,
  accounts,
  save,
  person,
}: {
  p: PlatformState;
  school: Institution;
  accounts: DemoAccount[];
  save: Save;
  person?: DemoAccount;
}) {
  const candidates = accounts.filter((account) => {
    const affiliation = accountInstitution(p, account.id);
    return (
      (!affiliation || affiliation.id === school.id) &&
      !account.suspended &&
      ['guest', 'admin'].includes(account.role) &&
      !school.staffIds?.includes(account.id) &&
      !school.contactIds?.includes(account.id) &&
      account.id !== school.adminId
    );
  });
  if (!person && !candidates.length)
    return (
      <WorkspaceDialog action="Add staff or contact" create>
        {() => (
          <>
            <p>
              All eligible guest and platform administrator accounts already have access to this
              institution.
            </p>
            <Link to={workspaceHref('users')} aria-label="View users and roles">
              View
            </Link>
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

function SchoolAssessmentTerms() {
  return (
    <section className="agreement-assessment-terms" aria-label="Assessment and certification">
      <h3>Assessment and certification</h3>
      <p>
        The pass benchmark is {passMark}%. Any recorded assessment score, including 0%, completes
        the stage and makes the student eligible for its certificate. The next stage opens as soon
        as the score is recorded.
      </p>
      <div className="workspace-data-scroll">
        <table
          className="workspace-data-table"
          aria-label="High-school certificate classifications"
        >
          <thead>
            <tr>
              <th scope="col">High-school score</th>
              <th scope="col">Certificate classification</th>
            </tr>
          </thead>
          <tbody>
            {schoolCertificateClassifications.map(({ minimum, label }, index) => {
              const upper = schoolCertificateClassifications[index - 1]?.minimum;
              const range =
                upper === undefined
                  ? `${minimum}% and above`
                  : minimum === 0
                    ? `Below ${upper}%`
                    : `${minimum}% to under ${upper}%`;
              return (
                <tr key={label}>
                  <th scope="row">{range}</th>
                  <td>{label}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p>
        Each stage certificate uses the score for that stage. The final venture certificate requires
        a score for all three stages and uses the average of those scores.
      </p>
      <p>
        School administrators request certificates in <strong>Results &amp; Certificates</strong>.
        YERH reviews the requests and issues approved school certificates free of charge.
      </p>
    </section>
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
      {() => (
        <>
          {terms?.trim() ? (
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
                    Appoint a programme lead, supervise teams, and record attendance and marks.
                  </dd>
                </div>
                <div>
                  <dt>YERH commitments</dt>
                  <dd>
                    Provide the pathway materials, review the school’s assessment evidence, and
                    issue certificates for eligible learners.
                  </dd>
                </div>
                <div>
                  <dt>Learner records</dt>
                  <dd>
                    Use student information for programme delivery and reporting. Share public
                    success stories only with the school’s permission.
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
          )}
          {!historical && school.kind === 'high-school' && <SchoolAssessmentTerms />}
        </>
      )}
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

function InstitutionActivation({
  school,
  administrator,
  availableStaff,
  save,
}: {
  school: Institution;
  administrator?: DemoAccount;
  availableStaff: DemoAccount[];
  save: Save;
}) {
  const needsAgreement = school.status === 'pending' && !school.proof;
  const needsAdministrator = !can(administrator, 'school');
  const canAssign = !school.adminId && availableStaff.length > 0;
  const agreementsHref =
    '?' +
    new URLSearchParams({
      tab: 'institutions',
      record: school.id,
      area: 'agreements',
    });
  const ready = !needsAgreement && !needsAdministrator;
  return (
    <section className="workspace-data workspace-data-toolbar institution-activation">
      <div>
        <h3>Portal activation</h3>
        {ready ? (
          <p>Ready to open the institution’s portal.</p>
        ) : (
          <>
            {school.status === 'pending' && (
              <p>
                {needsAgreement ? (
                  <>
                    Upload the signed PDF in{' '}
                    <Link className="text-link" to={agreementsHref} preventScrollReset>
                      Agreements
                    </Link>
                    .
                  </>
                ) : (
                  'Signed agreement uploaded.'
                )}
              </p>
            )}
            {needsAdministrator && (
              <p>
                {school.adminId ? (
                  <>
                    Restore the primary administrator’s access in{' '}
                    <Link className="text-link" to={workspaceHref('users')}>
                      Users &amp; roles
                    </Link>
                    .
                  </>
                ) : canAssign ? (
                  'Assign a primary administrator to open the portal.'
                ) : (
                  <>
                    Give an unassigned account the <strong>Institutional Administrator</strong> role
                    in{' '}
                    <Link className="text-link" to={workspaceHref('users')}>
                      Users &amp; roles
                    </Link>
                    , then return here to assign that account.
                  </>
                )}
              </p>
            )}
          </>
        )}
      </div>
      {canAssign && (
        <TrainingForm
          save={save}
          label="Save administrator"
          dialog={{ action: 'Assign administrator' }}
          build={(data) => ({
            type: 'institution-assign-admin',
            id: school.id,
            adminId: field(data, 'admin'),
          })}
        >
          <InstitutionAdministratorField staff={availableStaff} />
        </TrainingForm>
      )}
      {ready && (
        <TrainingForm
          save={save}
          label="Activate institution"
          dialog={{ action: 'Activate institution' }}
          build={() => ({ type: 'institution-activate', id: school.id })}
        >
          <p>This opens the institution’s portal for its assigned staff.</p>
        </TrainingForm>
      )}
    </section>
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
                    save={save}
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
