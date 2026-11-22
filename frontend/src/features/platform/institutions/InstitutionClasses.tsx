import { useState } from 'react';
import type { TrainingState } from '../../../domain/incubation';
import { field, TrainingForm, type Save } from '../incubation/TrainingForms';
import { WorkspaceDialog, WorkspaceTable } from '../workspace/WorkspaceControls';

export function ClassDirectory({
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
