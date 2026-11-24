import { SectorSelect } from './MarketplaceSectors';
import { useCallback, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type {
  SchoolCohort,
  SchoolCohortDetail,
  SchoolStudent,
} from '../../../services/laravel-school-repository';
import { schoolRepository } from '../../../services/laravel-school-repository';
import { WorkspaceTable, WorkspaceTabs } from '../workspace/WorkspaceControls';
import { SchoolCertificates, SchoolResults } from './SchoolResults';
import { InstitutionAgreements } from './InstitutionAgreements';
import {
  fieldValue,
  RecordsFeedback,
  useWorkspaceRecords,
  WorkspaceAction,
} from './WorkspaceActions';

function StudentEditor({
  slug,
  student,
  reload,
}: {
  slug: string;
  student?: SchoolStudent;
  reload: () => void;
}) {
  return (
    <WorkspaceAction
      action={student ? 'Edit' : 'Add student'}
      create={!student}
      title={student ? 'Edit ' + student.name : undefined}
      save={async (form) => {
        const age = fieldValue(form, 'age');
        await schoolRepository.saveStudent(
          slug,
          {
            name: fieldValue(form, 'name'),
            reference: fieldValue(form, 'reference'),
            age: age ? Number(age) : null,
            gender: fieldValue(form, 'gender'),
            grade: fieldValue(form, 'grade'),
          },
          student?.id,
        );
        reload();
      }}
    >
      <label>
        Full name
        <input name="name" defaultValue={student?.name} maxLength={120} required />
      </label>
      <label>
        School admission number
        <input name="reference" defaultValue={student?.reference} maxLength={60} required />
      </label>
      <label>
        Grade or form
        <input name="grade" defaultValue={student?.grade} maxLength={60} required />
      </label>
      <label>
        Age
        <input name="age" type="number" min="5" max="30" defaultValue={student?.age ?? ''} />
      </label>
      <label>
        Gender
        <input name="gender" defaultValue={student?.gender ?? ''} maxLength={60} />
      </label>
    </WorkspaceAction>
  );
}

function AddCohort({ slug, reload }: { slug: string; reload: () => void }) {
  return (
    <WorkspaceAction
      action="Add cohort"
      create
      save={async (form) => {
        await schoolRepository.addCohort(slug, {
          name: fieldValue(form, 'name'),
          starts_on: fieldValue(form, 'starts_on'),
          ends_on: fieldValue(form, 'ends_on'),
        });
        reload();
      }}
    >
      <label>
        Cohort name
        <input name="name" placeholder="Term 1" maxLength={120} required />
      </label>
      <label>
        Starts
        <input name="starts_on" type="date" required />
      </label>
      <label>
        Ends
        <input name="ends_on" type="date" required />
      </label>
    </WorkspaceAction>
  );
}

function ChoiceFields({
  name,
  label,
  options,
  selectAll,
}: {
  name: string;
  label: string;
  options: { id: number; name: string }[];
  selectAll?: boolean;
}) {
  const [selected, setSelected] = useState<number[]>([]);
  return (
    <fieldset>
      <legend>{label}</legend>
      {selectAll && (
        <button
          type="button"
          className="button button-outline workspace-action"
          onClick={() =>
            setSelected(
              selected.length === options.length ? [] : options.map((option) => option.id),
            )
          }
        >
          {selected.length === options.length ? 'Clear selection' : 'Select all'}
        </button>
      )}
      {options.map((option) => (
        <label key={option.id} className="checkbox-label">
          <input
            type="checkbox"
            name={name}
            value={option.id}
            checked={selected.includes(option.id)}
            onChange={(event) =>
              setSelected(
                event.target.checked
                  ? [...selected, option.id]
                  : selected.filter((id) => id !== option.id),
              )
            }
          />
          {option.name}
        </label>
      ))}
    </fieldset>
  );
}

function TeamEditor({
  slug,
  detail,
  students,
  reload,
}: {
  slug: string;
  detail: SchoolCohortDetail;
  students: SchoolStudent[];
  reload: () => void;
}) {
  const available = students.filter(
    (student) => !detail.members.some((member) => member.id === student.id),
  );
  if (!available.length)
    return <span>Add students to the roster before creating another team.</span>;
  return (
    <WorkspaceAction
      action="Add team venture"
      create
      save={async (form) => {
        await schoolRepository.addTeam(slug, detail.cohort.id, {
          name: fieldValue(form, 'name'),
          sector: fieldValue(form, 'sector'),
          description: fieldValue(form, 'description'),
          students: form.getAll('students').map(Number),
        });
        reload();
      }}
    >
      <label>
        Venture name
        <input name="name" maxLength={120} required />
      </label>
      <label>
        Sector
        <SectorSelect />
      </label>
      <label>
        Description
        <textarea name="description" maxLength={3000} required />
      </label>
      <ChoiceFields name="students" label="Students in this team" options={available} />
    </WorkspaceAction>
  );
}

function ClassEditor({
  slug,
  detail,
  reload,
}: {
  slug: string;
  detail: SchoolCohortDetail;
  reload: () => void;
}) {
  if (!detail.teams.length) return <span>Create a team venture before recording a class.</span>;
  return (
    <WorkspaceAction
      action="Record class"
      create
      save={async (form) => {
        await schoolRepository.addClass(slug, detail.cohort.id, {
          title: fieldValue(form, 'title'),
          class_date: fieldValue(form, 'class_date'),
          notes: fieldValue(form, 'notes'),
          teams: form.getAll('teams').map(Number),
        });
        reload();
      }}
    >
      <label>
        Class title
        <input name="title" maxLength={160} required />
      </label>
      <label>
        Date
        <input name="class_date" type="date" required />
      </label>
      <label>
        Activities and evidence
        <textarea name="notes" maxLength={3000} />
      </label>
      <ChoiceFields name="teams" label="Teams that attended" options={detail.teams} selectAll />
    </WorkspaceAction>
  );
}

function CohortWorkspace({
  slug,
  cohort,
  students,
  manage,
}: {
  slug: string;
  cohort: SchoolCohort;
  students: SchoolStudent[];
  manage: boolean;
}) {
  const load = useCallback(
    (signal: AbortSignal) => schoolRepository.cohort(slug, cohort.id, signal),
    [slug, cohort.id],
  );
  const { records: detail, error, reload } = useWorkspaceRecords(load);
  const [params] = useSearchParams();
  const directory = new URLSearchParams(params);
  directory.delete('cohort');
  directory.delete('section');
  return (
    <>
      <Link to={'?' + directory}>All cohorts</Link>
      <h3>{cohort.name}</h3>
      <p>
        {cohort.starts_on} to {cohort.ends_on}
      </p>
      <RecordsFeedback error={error} loading={detail === null} />
      {detail && (
        <WorkspaceTabs
          label="Cohort sections"
          param="section"
          views={[
            {
              id: 'teams',
              label: 'Team ventures',
              count: detail.teams.length,
              content: (
                <WorkspaceTable
                  label="team ventures"
                  columns={['Venture', 'Sector', 'Students', 'Description']}
                  actions={
                    manage && (
                      <TeamEditor slug={slug} detail={detail} students={students} reload={reload} />
                    )
                  }
                  rows={detail.teams.map((team) => {
                    const members = detail.members
                      .filter((member) => member.venture_id === team.id)
                      .map((member) => member.name)
                      .join(', ');
                    return {
                      id: String(team.id),
                      search: [team.name, team.sector, members].join(' '),
                      cells: [team.name, team.sector, members, team.description],
                    };
                  })}
                />
              ),
            },
            {
              id: 'classes',
              label: 'Classes',
              count: detail.classes.length,
              content: (
                <WorkspaceTable
                  label="classes"
                  columns={['Date', 'Class', 'Teams', 'Activities']}
                  actions={manage && <ClassEditor slug={slug} detail={detail} reload={reload} />}
                  rows={detail.classes.map((entry) => {
                    const teams = detail.classTeams
                      .filter((team) => team.class_id === entry.id)
                      .map((team) => detail.teams.find((item) => item.id === team.venture_id)?.name)
                      .join(', ');
                    return {
                      id: String(entry.id),
                      search: [entry.title, teams, entry.class_date].join(' '),
                      cells: [entry.class_date, entry.title, teams, entry.notes ?? '—'],
                    };
                  })}
                />
              ),
            },
            {
              id: 'results',
              label: 'Results',
              count: detail.results.length,
              content: (
                <SchoolResults slug={slug} detail={detail} manage={manage} reload={reload} />
              ),
            },
            {
              id: 'certificates',
              label: 'Certificates',
              count: detail.credentials.length,
              content: (
                <SchoolCertificates slug={slug} detail={detail} manage={manage} reload={reload} />
              ),
            },
          ]}
        />
      )}
    </>
  );
}

export function SchoolPortal({
  name,
  slug,
  agreement,
  admin,
}: {
  slug: string;
  name: string;
  agreement: string | null;
  admin: boolean;
}) {
  const load = useCallback(
    (signal: AbortSignal) => schoolRepository.directory(slug, signal),
    [slug],
  );
  const { records, error, reload } = useWorkspaceRecords(load);
  const [params] = useSearchParams();
  const cohort = records?.cohorts.find((entry) => String(entry.id) === params.get('cohort'));
  const manage = records?.access === 'manage';
  return (
    <>
      <RecordsFeedback error={error} loading={records === null} />
      {records &&
        (cohort ? (
          <CohortWorkspace
            key={cohort.id}
            slug={slug}
            cohort={cohort}
            students={records.students}
            manage={manage}
          />
        ) : (
          <WorkspaceTabs
            label="School portal"
            views={[
              {
                id: 'cohorts',
                label: 'Cohorts',
                count: records.cohorts.length,
                content: (
                  <WorkspaceTable
                    label="cohorts"
                    columns={['Cohort', 'Starts', 'Ends', 'Action']}
                    actions={manage && <AddCohort slug={slug} reload={reload} />}
                    rows={records.cohorts.map((entry) => {
                      const next = new URLSearchParams(params);
                      next.set('cohort', String(entry.id));
                      return {
                        id: String(entry.id),
                        search: [entry.name, entry.starts_on, entry.ends_on].join(' '),
                        cells: [
                          entry.name,
                          entry.starts_on,
                          entry.ends_on,
                          <Link aria-label={'View ' + entry.name} to={'?' + next}>
                            View
                          </Link>,
                        ],
                      };
                    })}
                  />
                ),
              },
              {
                id: 'students',
                label: 'Students',
                count: records.students.length,
                content: (
                  <WorkspaceTable
                    label="students"
                    columns={[
                      'Student',
                      'Admission number',
                      'Grade or form',
                      'Age',
                      'Gender',
                      ...(manage ? ['Action'] : []),
                    ]}
                    actions={manage && <StudentEditor slug={slug} reload={reload} />}
                    rows={records.students.map((student) => ({
                      id: String(student.id),
                      search: [student.name, student.reference, student.grade].join(' '),
                      cells: [
                        student.name,
                        student.reference,
                        student.grade,
                        student.age ?? '—',
                        student.gender ?? '—',
                        ...(manage
                          ? [<StudentEditor slug={slug} student={student} reload={reload} />]
                          : []),
                      ],
                    }))}
                  />
                ),
              },
              {
                id: 'agreements',
                label: 'Agreements',
                content: (
                  <InstitutionAgreements
                    school={{ name, kind: 'high-school' }}
                    slug={slug}
                    reference={agreement}
                    admin={admin}
                  />
                ),
              },
            ]}
          />
        ))}
    </>
  );
}
