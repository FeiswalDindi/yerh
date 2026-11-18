import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { DemoAccount } from '../../domain/demo';
import type { Institution, TrainingState } from '../../domain/incubation';
import type { PlatformState } from '../../domain/platform';
import { can } from '../../domain/roles';
import { workspaceHref } from '../dashboard/dashboard-navigation';
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
}: {
  p: PlatformState;
  accounts: DemoAccount[];
  save: Save;
}) {
  const staff = accounts.filter(
    (account) =>
      can(account, 'school') &&
      !p.training.institutions.some((school) => school.adminId === account.id),
  );
  return (
    <WorkspaceTable
      label="institutions"
      columns={['Institution', 'Type', 'Administrator', 'Agreement', 'Status', 'Action']}
      actions={
        staff.length ? (
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
        )
      }
      rows={p.training.institutions.map((school) => {
        const kind = school.kind === 'high-school' ? 'High school' : 'University';
        const administrator = accounts.find((account) => account.id === school.adminId)?.name;
        return {
          id: school.id,
          search: [school.name, kind, administrator, school.status].join(' '),
          cells: [
            school.name,
            kind,
            administrator,
            amount(school.amount),
            <WorkspaceStatus>{school.status}</WorkspaceStatus>,
            <WorkspaceDialog action="Manage institution" title={school.name}>
              {(finish) => (
                <>
                  {' '}
                  {school.proof && (
                    <p>
                      <a href={school.proof.data} download={school.proof.name}>
                        Download submitted agreement
                      </a>
                    </p>
                  )}
                  {school.status === 'pending' ? (
                    <>
                      <WorkspaceDialog
                        action={school.proof ? 'Replace agreement' : 'Upload agreement'}
                      >
                        {(uploaded) => (
                          <AgreementUpload school={school} save={save} finish={uploaded} />
                        )}
                      </WorkspaceDialog>
                      <button
                        type="button"
                        className="button"
                        disabled={!school.proof}
                        onClick={() =>
                          finish(
                            submitTraining(save, { type: 'institution-activate', id: school.id }),
                          )
                        }
                      >
                        Approve agreement and activate
                      </button>
                    </>
                  ) : (
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
                        Institution success story{' '}
                        <textarea name="story" maxLength={3000} defaultValue={school.story} />
                      </label>
                      <label className="inline-checkbox">
                        <input type="checkbox" name="featured" defaultChecked={school.featured} />{' '}
                        Feature this institution on the homepage
                      </label>
                      <small>
                        Include institution-level results and keep student details private.
                      </small>
                    </TrainingForm>
                  )}
                </>
              )}
            </WorkspaceDialog>,
          ],
        };
      })}
    />
  );
}

export function InstitutionPortal({
  p,
  account,
  save,
}: {
  p: PlatformState;
  account: DemoAccount;
  save: Save;
}) {
  const school = p.training.institutions.find((entry) => entry.adminId === account.id);
  if (!school)
    return (
      <p>Your institution will appear here once the platform administrator sets up its portal.</p>
    );
  const groups = p.training.groups.filter((group) => group.institutionId === school.id);
  const students = p.training.students.filter((student) => student.institutionId === school.id);
  const overview = (
    <>
      <div className="workspace-toolbar-actions">
        <h3>{school.name}</h3> <WorkspaceStatus>{school.status}</WorkspaceStatus>
      </div>
      <p>Agreement amount · {amount(school.amount)}</p>
      {school.status === 'pending' ? (
        <>
          <p>
            {school.proof
              ? 'Agreement submitted. Waiting for platform approval.'
              : 'Upload the signed agreement and required proof to request activation.'}
          </p>
          <WorkspaceDialog action={school.proof ? 'Replace agreement' : 'Upload agreement'}>
            {(finish) => <AgreementUpload school={school} save={save} finish={finish} />}
          </WorkspaceDialog>
        </>
      ) : (
        <>
          {school.kind === 'university' && (
            <p>Affiliated students manage their own ventures and certificate payments.</p>
          )}
          <Link to={workspaceHref('member-results')}>View member results and certificates</Link>
        </>
      )}
    </>
  );
  if (school.status !== 'active' || school.kind !== 'high-school') return overview;

  return (
    <WorkspaceTabs
      label="Institution portal views"
      views={[
        { id: 'overview', label: 'Overview', content: overview },
        {
          id: 'students',
          label: 'Students',
          count: students.length,
          content: (
            <WorkspaceTable
              label="students"
              columns={['Student', 'Teams', 'Portfolio', 'Action']}
              actions={
                <TrainingForm
                  save={save}
                  label="Save student"
                  dialog={{ action: 'Add student', create: true }}
                  build={(data) => ({
                    type: 'institution-student',
                    id: crypto.randomUUID(),
                    name: field(data, 'name'),
                  })}
                >
                  <label>
                    Student name
                    <input name="name" required minLength={2} maxLength={120} />
                  </label>
                  <small>
                    Use fictional student information in this demo. Profiles are private to the
                    school.
                  </small>
                </TrainingForm>
              }
              rows={students.map((student) => {
                const memberships = groups
                  .filter((group) => group.studentIds.includes(student.id))
                  .map((group) => group.name);
                return {
                  id: student.id,
                  search: [student.name, ...memberships].join(' '),
                  cells: [
                    student.name,
                    memberships.join(', ') || '—',
                    student.profileDraft ? 'Draft saved' : '—',
                    <TrainingForm
                      save={save}
                      label="Save profile draft"
                      dialog={{ action: 'Professional profile draft', title: student.name }}
                      build={(data) => ({
                        type: 'institution-profile',
                        id: student.id,
                        headline: field(data, 'headline'),
                        about: field(data, 'about'),
                        skills: field(data, 'skills'),
                      })}
                    >
                      <label>
                        Professional headline
                        <input
                          name="headline"
                          required
                          minLength={3}
                          maxLength={120}
                          defaultValue={student.profileDraft?.headline}
                        />
                      </label>
                      <label>
                        About the student
                        <textarea
                          name="about"
                          required
                          minLength={10}
                          maxLength={1000}
                          defaultValue={student.profileDraft?.about}
                        />
                      </label>
                      <label>
                        Skills and projects
                        <textarea
                          name="skills"
                          required
                          minLength={3}
                          maxLength={400}
                          defaultValue={student.profileDraft?.skills}
                        />
                      </label>
                    </TrainingForm>,
                  ],
                };
              })}
            />
          ),
        },
        {
          id: 'teams',
          label: 'Venture teams',
          count: groups.length,
          content: (
            <WorkspaceTable
              label="venture teams"
              columns={['Team', 'Members', 'Action']}
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
                    <Link to={workspaceHref('ventures')}>Manage ventures</Link>,
                  ],
                };
              })}
            />
          ),
        },
        {
          id: 'classes',
          label: 'Offline classes',
          content: (
            <WorkspaceTable
              label="offline classes"
              columns={['Date', 'Team', 'Attended', 'Challenge and class notes']}
              empty={
                groups.length
                  ? 'There are no recorded classes yet.'
                  : 'Create a team to record a class.'
              }
              actions={
                groups.length > 0 && (
                  <WorkspaceDialog action="Record class" create>
                    {(finish) => (
                      <ClassForm students={students} groups={groups} save={save} finish={finish} />
                    )}
                  </WorkspaceDialog>
                )
              }
              rows={p.training.classes.flatMap((entry) => {
                const group = groups.find((team) => team.id === entry.groupId);
                return group
                  ? [
                      {
                        id: entry.id,
                        search: [entry.date, group.name, entry.challenge].join(' '),
                        cells: [entry.date, group.name, entry.attendance.length, entry.challenge],
                      },
                    ]
                  : [];
              })}
            />
          ),
        },
      ]}
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
  const [groupId, setGroupId] = useState(groups[0]?.id ?? '');
  const group = groups.find((team) => team.id === groupId);
  return (
    <TrainingForm
      save={(action) => {
        const saved = save(action);
        finish(saved);
        return saved;
      }}
      label="Save offline class"
      build={(data) => ({
        type: 'institution-class',
        id: crypto.randomUUID(),
        groupId,
        date: field(data, 'date'),
        challenge: field(data, 'challenge'),
        attendance: data.getAll('attendance').map(String),
      })}
    >
      <label>
        Team
        <select value={groupId} onChange={(event) => setGroupId(event.target.value)}>
          {groups.map((team) => (
            <option key={team.id} value={team.id}>
              {team.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Class date
        <input name="date" type="date" required />
      </label>
      <label>
        Challenge and class notes
        <textarea name="challenge" required minLength={10} maxLength={3000} />
      </label>
      <fieldset key={groupId}>
        <legend>Students who attended</legend>
        {students
          .filter((student) => group?.studentIds.includes(student.id))
          .map((student) => (
            <label key={student.id} className="inline-checkbox">
              <input type="checkbox" name="attendance" value={student.id} />
              {student.name}
            </label>
          ))}
      </fieldset>
    </TrainingForm>
  );
}
