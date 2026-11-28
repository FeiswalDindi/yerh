import { ExistingUserPicker } from './ExistingUserPicker';
import { useCallback, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { passMark } from '../../../domain/incubation';
import { learningRepository } from '../../../services/laravel-learning-repository';
import {
  laravelProgramme,
  type Pathway,
  type Product,
} from '../../../services/laravel-programme-repository';
import { laravelWorkspace } from '../../../services/laravel-workspace-repository';
import { WorkspaceTable } from '../workspace/WorkspaceControls';
import {
  fieldValue,
  RecordsFeedback,
  useWorkspaceRecords,
  WorkspaceAction,
} from './WorkspaceActions';
import { StageWorkspace, type ProgrammeRole } from './StageWorkspace';

const incubationHref = '/dashboard/workspace?tab=incubation';

export function IncubationProgramme({ role }: { role: ProgrammeRole }) {
  const [params] = useSearchParams();
  const selected = Number(params.get('path'));
  if (Number.isSafeInteger(selected) && selected > 0) {
    return <PathwayDetail key={selected} id={selected} role={role} />;
  }
  return <PathwayDirectory role={role} />;
}

function PathwayDirectory({ role }: { role: ProgrammeRole }) {
  const paths = useWorkspaceRecords(laravelProgramme.paths);

  return (
    <>
      <RecordsFeedback error={paths.error} loading={paths.records === null} />
      {paths.records && (
        <WorkspaceTable
          label="incubation pathways"
          columns={['Venture', 'Entrepreneur', 'Mentor', 'Progress', 'Actions']}
          actions={
            role === 'entrepreneur' && <LaunchPathway paths={paths.records} reload={paths.reload} />
          }
          rows={paths.records.map((path) => ({
            id: String(path.id),
            search: [path.venture, path.owner, path.mentor].join(' '),
            cells: [
              path.venture,
              path.owner,
              path.mentor ?? 'Unassigned',
              path.graduated_at ? 'Graduated' : path.mentor_id ? 'In progress' : 'Awaiting mentor',
              <div className="workspace-row-actions">
                <Link to={incubationHref + '&path=' + path.id}>Open pathway</Link>
                {role === 'admin' && !path.graduated_at && (
                  <MentorAssignment path={path} reload={paths.reload} />
                )}
              </div>,
            ],
          }))}
        />
      )}
    </>
  );
}

function LaunchPathway({ paths, reload }: { paths: Pathway[]; reload: () => void }) {
  const [params] = useSearchParams();
  return (
    <WorkspaceAction
      initialOpen={params.has('launch')}
      action="Launch venture"
      submit="Launch into incubation"
      create
      save={async (data) => {
        await laravelProgramme.launch(
          Number(fieldValue(data, 'venture_id')),
          data.getAll('product').map(Number),
        );
        reload();
      }}
    >
      <LaunchFields paths={paths} />
    </WorkspaceAction>
  );
}

function LaunchFields({ paths }: { paths: Pathway[] }) {
  const ventures = useWorkspaceRecords(laravelWorkspace.ventures);
  const products = useWorkspaceRecords(laravelProgramme.products);
  return (
    <LaunchSelection
      ventures={
        ventures.records?.filter(
          (venture) =>
            venture.status === 'approved' && !paths.some((path) => path.venture_id === venture.id),
        ) ?? []
      }
      products={products.records ?? []}
      error={ventures.error || products.error}
      loading={ventures.records === null || products.records === null}
    />
  );
}

function LaunchSelection({
  ventures,
  products,
  error,
  loading,
}: {
  ventures: { id: number; name: string }[];
  products: Product[];
  error: string;
  loading: boolean;
}) {
  const [params] = useSearchParams();
  const [venture, setVenture] = useState(params.get('launch') ?? '');
  const available = products.filter((product) => product.venture_id === Number(venture));
  return (
    <>
      <RecordsFeedback error={error} loading={loading} />
      <label>
        Approved venture
        <select
          name="venture_id"
          value={venture}
          onChange={(event) => setVenture(event.target.value)}
          required
        >
          <option value="" disabled>
            {ventures.length ? 'Select a venture' : 'No approved ventures ready to launch'}
          </option>
          {ventures.map((row) => (
            <option key={row.id} value={row.id}>
              {row.name}
            </option>
          ))}
        </select>
      </label>
      {available.length > 0 && (
        <fieldset key={venture}>
          <legend>Products to include</legend>
          {available.map((product) => (
            <label className="inline-checkbox" key={product.id}>
              <input type="checkbox" name="product" value={product.id} /> {product.name}
            </label>
          ))}
        </fieldset>
      )}
    </>
  );
}

export function MentorAssignment({ path, reload }: { path: Pathway; reload: () => void }) {
  return (
    <WorkspaceAction
      action={path.mentor ? 'Edit mentor assignment' : 'Assign mentor'}
      title={path.venture}
      submit="Save assignment"
      save={async (data) => {
        const mentorId = Number(fieldValue(data, 'mentor_id'));
        if (!Number.isSafeInteger(mentorId) || mentorId < 1) {
          throw new Error('Choose an eligible mentor account.');
        }
        await laravelProgramme.assignMentor(path.id, mentorId);
        reload();
      }}
    >
      {path.mentor && <p>Current mentor: {path.mentor}</p>}
      <ExistingUserPicker
        name="mentor_id"
        label="Verified mentor account"
        load={searchVerifiedMentors}
      />
    </WorkspaceAction>
  );
}

async function searchVerifiedMentors(query: string, signal: AbortSignal) {
  const list = await laravelProgramme.mentors(signal);
  const term = query.toLocaleLowerCase();
  return list
    .filter(
      (mentor) =>
        mentor.name.toLocaleLowerCase().includes(term) ||
        mentor.email.toLocaleLowerCase().includes(term),
    )
    .map(({ id, name }) => ({ id, name }));
}

export function ProgrammeMentors() {
  const { records, error, reload } = useWorkspaceRecords(laravelProgramme.mentors);
  return (
    <>
      <RecordsFeedback error={error} loading={records === null} />
      {records && (
        <WorkspaceTable
          label="mentors"
          columns={['Name', 'Email']}
          actions={
            <WorkspaceAction
              action="Add mentor"
              create
              submit="Grant mentor access"
              save={async (data) => {
                const userId = Number(fieldValue(data, 'user_id'));
                if (!Number.isSafeInteger(userId) || userId < 1) {
                  throw new Error('Select an eligible account from the search results.');
                }
                await laravelProgramme.addMentor(userId);
                reload();
              }}
            >
              <ExistingUserPicker
                label="Eligible mentor account"
                hint="Only verified, unaffiliated guest accounts without a pending institution request appear here."
                load={laravelProgramme.mentorCandidates}
              />
            </WorkspaceAction>
          }
          rows={records.map((mentor) => ({
            id: String(mentor.id),
            search: mentor.name + ' ' + mentor.email,
            cells: [mentor.name, mentor.email],
          }))}
        />
      )}
    </>
  );
}

function PathwayDetail({ id, role }: { id: number; role: ProgrammeRole }) {
  const load = useCallback((signal: AbortSignal) => laravelProgramme.path(id, signal), [id]);
  const { records, error, reload } = useWorkspaceRecords(load);

  return (
    <>
      <p>
        <Link to={incubationHref}>Back to incubation</Link>
      </p>
      <RecordsFeedback error={error} loading={records === null} />
      {records && (
        <>
          <h2>{records.path.venture}</h2>
          {records.path.mentor ? (
            <p>Mentor · {records.path.mentor}</p>
          ) : (
            <p>Awaiting mentor assignment.</p>
          )}
          {records.path.graduated_at && <p role="status">Incubation completed.</p>}
          {records.path.moodle_course_id && (
            <section className="profile-panel" aria-label="Moodle Incubation Classroom">
              <p className="eyebrow">Moodle Incubation Classroom</p>
              <p>
                Progress: <strong>{records.path.moodle_progress ?? 0}%</strong>
                {records.path.moodle_score !== null && records.path.moodle_score !== undefined
                  ? ` · Score: ${records.path.moodle_score}%`
                  : ''}
                {records.path.moodle_group_id
                  ? ` · Mentor group #${records.path.moodle_group_id}`
                  : ''}
              </p>
              <p className="source-note">Progress and graduation sync automatically from Moodle.</p>
              {records.path.moodle_launch_url && (
                <div className="workspace-row-actions">
                  <a
                    className="button"
                    href={learningRepository.toMoodleHandoffUrl(records.path.moodle_launch_url)}
                  >
                    Open Incubation Classroom in Moodle
                  </a>
                </div>
              )}
            </section>
          )}
          {records.stages.map((stage, index) => (
            <StageWorkspace
              key={stage.definition.id}
              path={records.path}
              stage={stage}
              role={role}
              unlocked={
                Boolean(records.path.mentor_id) &&
                records.stages
                  .slice(0, index)
                  .every(
                    (prior) =>
                      prior.work?.graded_at &&
                      (prior.work.passed === true ||
                        prior.work.passed === 1 ||
                        (prior.work.passed == null && (prior.work.score ?? 0) >= passMark)),
                  )
              }
              reload={reload}
            />
          ))}
        </>
      )}
    </>
  );
}
