import { Link } from 'react-router-dom';
import { StudentDirectory } from './StudentDirectory';
import { InstitutionInvitations, InstitutionMembers } from './InstitutionMembers';
import { InstitutionProgramme } from './InstitutionProgramme';
import type { DemoAccount } from '../../../domain/demo';
import type { Institution } from '../../../domain/incubation';
import type { PlatformState } from '../../../domain/platform';
import { ventureResultsHref, workspaceHref } from '../../dashboard/dashboard-navigation';
import { cohortForVenture, institutionAccess } from '../../../domain/incubation';
import { field, TrainingForm, type Save } from '../incubation/TrainingForms';
import { WorkspaceTable, WorkspaceTabs } from '../workspace/WorkspaceControls';

import { InstitutionActivity } from './InstitutionAdministration';
import { ClassDirectory } from './InstitutionClasses';
import { AgreementsPanel } from './InstitutionAgreements';

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
            content: <InstitutionMembers p={p} institution={school} accounts={accounts} />,
          },
          {
            id: 'invitations',
            label: 'Invitations',
            content: <InstitutionInvitations p={p} institution={school} save={save} />,
          },
          progress,
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
