import { useState, type FormEvent } from 'react';
import { Pencil } from 'lucide-react';
import {
  schoolCredentials,
  schoolRepository,
  schoolStages,
  type SchoolCohortDetail,
  type SchoolCredentialKind,
  type SchoolResult,
  type SchoolStage,
} from '../../../services/laravel-school-repository';
import { WorkspaceTable } from '../workspace/WorkspaceControls';
import {
  DecisionAction,
  errorText,
  fieldValue,
  RecordsFeedback,
  useWorkspaceRecords,
  WorkspaceAction,
} from './WorkspaceActions';

type Props = { slug: string; detail: SchoolCohortDetail; manage: boolean; reload: () => void };
const stageKeys = Object.keys(schoolStages) as SchoolStage[];

function ScoreCell({
  name,
  title,
  result,
  editable,
  save,
}: {
  name: string;
  title: string;
  result?: SchoolResult;
  editable: boolean;
  save: (form: FormData) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      await save(new FormData(event.currentTarget));
      setEditing(false);
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setBusy(false);
    }
  }

  if (!editable || !editing) {
    return (
      <div className="workspace-row-actions">
        <span>{result ? Number(result.score) + '%' : '—'}</span>
        {editable && (
          <button
            type="button"
            className="button button-outline workspace-action"
            aria-label={'Edit ' + name + ' · ' + title}
            onClick={() => setEditing(true)}
          >
            <Pencil size={14} aria-hidden="true" />
          </button>
        )}
      </div>
    );
  }

  return (
    <form className="workspace-form" onSubmit={(event) => void submit(event)}>
      <input
        type="number"
        name="score"
        min="0"
        max="100"
        step="0.01"
        required
        autoFocus
        defaultValue={result?.score ?? ''}
        aria-label={name + ' · ' + title + ' mark'}
      />
      <input
        name="notes"
        maxLength={3000}
        defaultValue={result?.notes ?? ''}
        placeholder="Assessment notes"
        aria-label="Assessment notes"
      />
      {error && (
        <span role="alert" className="form-error">
          {error}
        </span>
      )}
      <div className="workspace-row-actions">
        <button className="button workspace-action" disabled={busy}>
          Save
        </button>
        <button
          className="button button-outline workspace-action"
          type="button"
          disabled={busy}
          onClick={() => setEditing(false)}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

export function SchoolResults({ slug, detail, manage, reload }: Props) {
  const [teamFilter, setTeamFilter] = useState('');
  const members = detail.members.filter(
    (member) => !teamFilter || String(member.venture_id) === teamFilter,
  );

  return (
    <>
      <p>
        {detail.members.length} students · {detail.results.length} marks recorded
      </p>
      <WorkspaceTable
        label="results"
        columns={['Student', 'Grade or form', 'Team venture', ...Object.values(schoolStages)]}
        exportName={'cohort-' + detail.cohort.id + '-results.csv'}
        actions={
          <label>
            Team{' '}
            <select value={teamFilter} onChange={(event) => setTeamFilter(event.target.value)}>
              <option value="">All teams</option>
              {detail.teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </label>
        }
        rows={members.map((student) => {
          const team = detail.teams.find((item) => item.id === student.venture_id);
          const results = detail.results.filter((result) => result.student_id === student.id);
          const credentials = detail.credentials.filter((entry) => entry.student_id === student.id);
          return {
            id: String(student.id),
            search: [student.name, student.grade, team?.name].join(' '),
            csv: [
              student.name,
              student.grade,
              team?.name ?? '',
              ...stageKeys.map(
                (stage) => results.find((entry) => entry.stage === stage)?.score ?? '',
              ),
            ],
            cells: [
              student.name,
              student.grade,
              team?.name,
              ...stageKeys.map((stage, index) => {
                const result = results.find((entry) => entry.stage === stage);
                const locked = credentials.some(
                  (entry) =>
                    (entry.kind === stage || entry.kind === 'venture') &&
                    entry.status !== 'rejected',
                );
                const eligible = stageKeys
                  .slice(0, index)
                  .every((earlier) => results.some((entry) => entry.stage === earlier));
                return (
                  <ScoreCell
                    key={stage}
                    name={student.name}
                    title={schoolStages[stage]}
                    result={result}
                    editable={manage && !locked && eligible}
                    save={async (form) => {
                      await schoolRepository.recordResult(
                        slug,
                        detail.cohort.id,
                        student.id,
                        stage,
                        {
                          score: fieldValue(form, 'score'),
                          notes: fieldValue(form, 'notes'),
                        },
                      );
                      reload();
                    }}
                  />
                );
              }),
            ],
          };
        })}
      />
    </>
  );
}

export function SchoolCertificates({ slug, detail, manage, reload }: Props) {
  const [kind, setKind] = useState<SchoolCredentialKind>('getting-started');
  const credentials = detail.credentials.filter((entry) => entry.kind === kind);
  const neededStages =
    kind === 'venture' ? stageKeys : stageKeys.slice(0, stageKeys.indexOf(kind) + 1);
  const ready = detail.members.filter(
    (student) =>
      neededStages.every((stage) =>
        detail.results.some((entry) => entry.student_id === student.id && entry.stage === stage),
      ) &&
      !credentials.some((entry) => entry.student_id === student.id && entry.status !== 'rejected'),
  );

  function request(student?: number) {
    return async () => {
      await schoolRepository.requestCertificate(slug, detail.cohort.id, kind, student);
      reload();
    };
  }

  return (
    <>
      <p>
        {credentials.filter((entry) => entry.status === 'issued').length} issued ·{' '}
        {credentials.filter((entry) => entry.status === 'pending').length} awaiting review ·{' '}
        {ready.length} ready to request
      </p>
      <WorkspaceTable
        label="school certificates"
        columns={['Student', 'Team venture', 'Classification', 'Certificate', 'Action']}
        actions={
          <>
            <label>
              Stage{' '}
              <select
                value={kind}
                onChange={(event) => setKind(event.target.value as SchoolCredentialKind)}
              >
                {Object.entries(schoolCredentials).map(([id, title]) => (
                  <option key={id} value={id}>
                    {title}
                  </option>
                ))}
              </select>
            </label>
            {manage && ready.length > 0 && (
              <WorkspaceAction
                action="Request all eligible"
                submit="Send requests"
                save={request()}
              >
                <p>
                  Request {ready.length} certificates for {schoolCredentials[kind]}.
                </p>
              </WorkspaceAction>
            )}
          </>
        }
        rows={detail.members.map((student) => {
          const credential = credentials.find((entry) => entry.student_id === student.id);
          const team = detail.teams.find((item) => item.id === student.venture_id);
          const canRequest = ready.some((entry) => entry.id === student.id);
          const status =
            credential?.status === 'issued'
              ? 'Issued'
              : credential?.status === 'pending'
                ? 'Awaiting review'
                : credential?.status === 'rejected'
                  ? 'Returned'
                  : canRequest
                    ? 'Ready to request'
                    : 'Awaiting results';
          return {
            id: String(student.id),
            search: [student.name, team?.name, status, credential?.classification].join(' '),
            cells: [
              student.name,
              team?.name,
              credential?.classification ?? '—',
              <>
                {status}
                {credential?.status === 'rejected' && credential.review_notes && (
                  <div>{credential.review_notes}</div>
                )}
              </>,
              credential?.document_id ? (
                <a
                  href={schoolRepository.document(credential.document_id)}
                  target="_blank"
                  rel="noreferrer"
                >
                  View
                </a>
              ) : manage && canRequest ? (
                <WorkspaceAction
                  action={credential ? 'Request again' : 'Request'}
                  title={student.name}
                  submit="Send request"
                  save={request(student.id)}
                >
                  <p>
                    {schoolCredentials[kind]} certificate for {student.name}.
                  </p>
                </WorkspaceAction>
              ) : (
                '—'
              ),
            ],
          };
        })}
      />
    </>
  );
}

export function SchoolCertificateQueue() {
  const { records, error, reload } = useWorkspaceRecords(schoolRepository.queue);
  return (
    <>
      <RecordsFeedback error={error} loading={records === null} />
      {records && (
        <WorkspaceTable
          label="school certificate requests"
          columns={[
            'School and cohort',
            'Student',
            'Venture',
            'Stage',
            'Mark',
            'Assessment notes',
            'Status',
            'Action',
          ]}
          rows={records.map((entry) => ({
            id: String(entry.id),
            search: [
              entry.institution,
              entry.cohort,
              entry.student,
              entry.venture,
              entry.status,
              schoolCredentials[entry.kind],
            ].join(' '),
            cells: [
              entry.institution + ' · ' + entry.cohort,
              entry.student,
              entry.venture,
              schoolCredentials[entry.kind],
              Number(entry.score) + '% · ' + entry.classification,
              entry.assessment_notes ?? '—',
              <>
                {entry.status}
                {entry.review_notes && <div>{entry.review_notes}</div>}
              </>,
              entry.status === 'pending' ? (
                <DecisionAction
                  name={entry.student}
                  decide={async (decision, note) => {
                    await schoolRepository.review(entry.id, decision, note);
                    reload();
                  }}
                />
              ) : entry.document_id ? (
                <a
                  href={schoolRepository.document(entry.document_id)}
                  target="_blank"
                  rel="noreferrer"
                >
                  View
                </a>
              ) : (
                '—'
              ),
            ],
          }))}
        />
      )}
    </>
  );
}
