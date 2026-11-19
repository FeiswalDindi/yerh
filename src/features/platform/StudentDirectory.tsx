import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type { TrainingState } from '../../domain/incubation';
import { field, TrainingForm, type Save } from './TrainingForms';
import { WorkspaceTable } from './WorkspaceControls';

type Student = TrainingState['students'][number];

function StudentEditor({ student, save }: { student?: Student; save: Save }) {
  return (
    <TrainingForm
      save={save}
      label="Save student"
      dialog={{
        action: student ? 'Edit student' : 'Add student',
        title: student?.name,
        create: !student,
      }}
      build={(data) => ({
        type: 'institution-student',
        id: student?.id ?? crypto.randomUUID(),
        name: field(data, 'name'),
        admissionNumber: field(data, 'admission'),
        age: field(data, 'age') ? Number(field(data, 'age')) : undefined,
        gender: field(data, 'gender'),
        form: field(data, 'form'),
        stream: field(data, 'stream'),
      })}
    >
      <label>
        Full name
        <input name="name" required minLength={2} maxLength={120} defaultValue={student?.name} />
      </label>
      <div className="form-field-grid">
        <label>
          Admission number
          <input name="admission" maxLength={50} defaultValue={student?.admissionNumber} />
        </label>
        <label>
          Age
          <input name="age" type="number" min={1} max={120} step={1} defaultValue={student?.age} />
        </label>
        <label>
          Gender
          <select name="gender" defaultValue={student?.gender ?? ''}>
            <option value="">Unspecified</option>
            <option value="Female">Female</option>
            <option value="Male">Male</option>
            <option value="Other">Other</option>
            <option value="Prefer not to say">Prefer not to say</option>
          </select>
        </label>
        <label>
          Form or grade
          <input
            name="form"
            maxLength={50}
            placeholder="Form 2 or Grade 10"
            defaultValue={student?.form}
          />
        </label>
        <label>
          Stream or class
          <input name="stream" maxLength={50} defaultValue={student?.stream} />
        </label>
      </div>
    </TrainingForm>
  );
}

export function StudentDirectory({
  students,
  groups,
  save,
}: {
  students: Student[];
  groups: TrainingState['groups'];
  save?: Save;
}) {
  const [params] = useSearchParams();
  const [form, setForm] = useState('');
  const [team, setTeam] = useState('');
  const [gender, setGender] = useState('');
  const genders = [
    ...new Set(students.flatMap((student) => (student.gender ? [student.gender] : []))),
  ].sort();
  const forms = [
    ...new Set(students.flatMap((student) => (student.form ? [student.form] : []))),
  ].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const selected = students.find((student) => student.id === params.get('student'));
  const studentHref = (id?: string) => {
    const next = new URLSearchParams(params);
    if (id) next.set('student', id);
    else next.delete('student');
    return '?' + next.toString();
  };
  const teams = (id: string) =>
    groups.filter((group) => group.studentIds.includes(id)).map((group) => group.name);
  if (selected) {
    const { profileDraft } = selected;
    return (
      <>
        <Link className="text-link" to={studentHref()}>
          ← Student directory
        </Link>
        <div className="workspace-data-toolbar">
          <h2>{selected.name}</h2>
          {save && <StudentEditor student={selected} save={save} />}
        </div>
        <dl className="workspace-profile">
          {[
            ['Admission number', selected.admissionNumber],
            ['Age', selected.age],
            ['Gender', selected.gender],
            ['Form or grade', selected.form],
            ['Stream', selected.stream],
            ['Venture teams', teams(selected.id).join(', ')],
          ].map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value || '—'}</dd>
            </div>
          ))}
        </dl>
        <h3>Professional profile draft</h3>
        {profileDraft && (
          <dl className="workspace-profile">
            <div>
              <dt>Headline</dt>
              <dd>{profileDraft.headline}</dd>
            </div>
            <div>
              <dt>About</dt>
              <dd>{profileDraft.about}</dd>
            </div>
            <div>
              <dt>Skills and projects</dt>
              <dd>{profileDraft.skills}</dd>
            </div>
          </dl>
        )}
        {save && (
          <TrainingForm
            save={save}
            label="Save profile draft"
            dialog={{ action: 'Edit professional profile', title: selected.name }}
            build={(data) => ({
              type: 'institution-profile',
              id: selected.id,
              headline: field(data, 'headline'),
              about: field(data, 'about'),
              skills: field(data, 'skills'),
            })}
          >
            <label>
              Headline
              <input
                name="headline"
                required
                minLength={3}
                maxLength={120}
                defaultValue={profileDraft?.headline}
              />
            </label>
            <label>
              About
              <textarea
                name="about"
                required
                minLength={10}
                maxLength={1000}
                defaultValue={profileDraft?.about}
              />
            </label>
            <label>
              Skills and projects
              <textarea
                name="skills"
                required
                minLength={3}
                maxLength={400}
                defaultValue={profileDraft?.skills}
              />
            </label>
          </TrainingForm>
        )}
      </>
    );
  }
  return (
    <WorkspaceTable
      label="students"
      exportName="yerh-students.csv"
      columns={[
        'Student',
        'Admission no.',
        'Gender',
        'Age',
        'Form or grade',
        'Stream',
        'Teams',
        'Action',
      ]}
      actions={
        <>
          {forms.length > 0 && (
            <label className="workspace-toolbar-filter">
              Form or grade{' '}
              <select
                aria-label="Filter by form or grade"
                value={form}
                onChange={(event) => setForm(event.target.value)}
              >
                <option value="">All forms and grades</option>
                {forms.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
          )}
          {groups.length > 0 && (
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
          )}
          {genders.length > 0 && (
            <label className="workspace-toolbar-filter">
              Gender
              <select value={gender} onChange={(event) => setGender(event.target.value)}>
                <option value="">All genders</option>
                {genders.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
          )}
          {save && <StudentEditor save={save} />}
        </>
      }
      rows={students
        .filter(
          (student) =>
            (!form || student.form === form) &&
            (!gender || student.gender === gender) &&
            (!team ||
              groups.some((group) => group.id === team && group.studentIds.includes(student.id))),
        )
        .map((student) => {
          const memberships = teams(student.id);
          return {
            id: student.id,
            search: [
              student.name,
              student.admissionNumber,
              student.gender,
              student.form,
              student.stream,
              ...memberships,
            ].join(' '),
            cells: [
              student.name,
              student.admissionNumber || '—',
              student.gender || '—',
              student.age ?? '—',
              student.form || '—',
              student.stream || '—',
              memberships.join(', ') || '—',
              <Link to={studentHref(student.id)} aria-label="View student">
                View
              </Link>,
            ],
          };
        })}
    />
  );
}
