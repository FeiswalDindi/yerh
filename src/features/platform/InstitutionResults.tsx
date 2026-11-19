import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import {
  certificateKey,
  cohortForVenture,
  credentialKinds,
  credentialReady,
  getStage,
  incubationLearners,
  institutionForPath,
  schoolForVenture,
  passMark,
  passedStage,
  stageUnlocked,
  type CertificateSelection,
  type Cohort,
  type Institution,
  type StageId,
} from '../../domain/incubation';
import type { DemoAccount } from '../../domain/demo';
import type { PlatformState } from '../../domain/platform';
import { credentialTitle, field, TrainingForm, type Save } from './TrainingForms';
import { WorkspaceTable, WorkspaceTabs } from './WorkspaceControls';

function certificateFile(
  title: string,
  learner: string,
  venture: string,
  role: string,
  issued: string,
  id: string,
) {
  const escape = (value: string) =>
    value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  const document = `<!doctype html><html lang="en"><meta charset="utf-8"><title>${escape(title)}</title>
  <style>body{max-width:48rem;margin:8vh auto;padding:3rem;border:4px double #243962;text-align:center;color:#17294a;font:1.15rem Georgia,serif;overflow-wrap:anywhere}h1{margin:2rem 0}small{display:block;margin-top:2rem}</style>
  <p>Youth Entrepreneurship Resource Hub · Kenya</p><h1>${escape(title)}</h1><h2>${escape(learner)}</h2>
  <p>${role} · ${escape(venture)}</p><p>Issued ${escape(new Date(issued).toLocaleDateString('en-KE', { dateStyle: 'medium', timeZone: 'Africa/Nairobi' }))}</p>
  <small>Record ID: ${escape(id)}</small><p>YERH development demo · Browser-local certificate</p></html>`;
  return 'data:text/html;charset=utf-8,' + encodeURIComponent(document);
}

export function InstitutionResults({
  p,
  school,
  accounts,
  save,
  readonly = false,
  incubationHref = '/dashboard/workspace?tab=incubation',
}: {
  p: PlatformState;
  school: Institution;
  accounts: DemoAccount[];
  save: Save;
  readonly?: boolean;
  incubationHref?: string;
}) {
  const [params, setParams] = useSearchParams();
  const [outcome, setOutcome] = useState('');
  const [certificateKind, setCertificateKind] = useState('');
  const cohorts = (p.training.cohorts ?? []).filter((row) => row.institutionId === school.id);
  const cohortId = params.get('cohort');
  const cohort = cohorts.find((row) => row.id === cohortId);
  const paths = p.incubations.filter(
    (path) =>
      ['pending', 'active', 'completed'].includes(path.status) &&
      institutionForPath(p, path)?.id === school.id,
  );
  const ventureName = (id: string) =>
    p.ventures.find((venture) => venture.id === id)?.name ?? 'Venture';
  const ventures = p.ventures.filter(
    (venture) =>
      schoolForVenture(p, venture)?.id === school.id ||
      paths.some((path) => path.ventureId === venture.id),
  );
  const inCohort = (venture: (typeof ventures)[number], target: Cohort) =>
    venture.groupId
      ? cohortForVenture(p, venture)?.id === target.id
      : paths.some(
          (path) => path.ventureId === venture.id && target.incubationIds.includes(path.id),
        );
  const cohortVentures = cohort
    ? ventures.filter((venture) => inCohort(venture, cohort))
    : ventures;
  const ventureId = params.get('venture') ?? '';
  const selectedPaths = paths.filter(
    (path) =>
      (!ventureId || path.ventureId === ventureId) &&
      cohortVentures.some((venture) => venture.id === path.ventureId),
  );
  const ventureFilter = cohortVentures.length > 0 && (
    <label className="workspace-toolbar-filter">
      Venture
      <select
        value={ventureId}
        onChange={(event) =>
          setParams((current) => {
            const next = new URLSearchParams(current);
            if (event.target.value) next.set('venture', event.target.value);
            else next.delete('venture');
            return next;
          })
        }
      >
        <option value="">All ventures in this cohort</option>
        {cohortVentures.map((venture) => (
          <option key={venture.id} value={venture.id}>
            {venture.name}
          </option>
        ))}
      </select>
    </label>
  );
  const rows = selectedPaths.flatMap((path) =>
    incubationLearners(p, path).flatMap((learnerId) => {
      const learner = (school.kind === 'high-school' ? p.training.students : accounts).find(
        (row) => row.id === learnerId,
      );
      return learner
        ? [
            {
              key: JSON.stringify([path.id, learnerId]),
              path,
              learner,
              venture: ventureName(path.ventureId),
            },
          ]
        : [];
    }),
  );
  function href(values: Record<string, string | null>) {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(values)) {
      if (value === null) next.delete(key);
      else next.set(key, value);
    }
    return '?' + next.toString();
  }
  const cohortLink = (id: string) => href({ cohort: id, learner: null, view: null, venture: null });
  const directory = href({ cohort: null, learner: null, view: null, venture: null });
  const selected = rows.find((row) => row.key === params.get('learner'));
  const title = cohort?.name ?? 'All pathways';

  const cohortEditor = (current?: Cohort) => (
    <TrainingForm
      save={save}
      label="Save cohort"
      dialog={{
        action: current ? 'Edit cohort' : 'Add cohort',
        create: !current,
        title: current?.name,
      }}
      build={(data) => ({
        type: 'institution-cohort',
        id: current?.id ?? crypto.randomUUID(),
        name: field(data, 'name'),
        startsOn: field(data, 'start'),
        endsOn: field(data, 'end'),
        incubationIds: data.getAll('path').map(String),
      })}
    >
      <label>
        Cohort name
        <input
          name="name"
          required
          minLength={2}
          maxLength={120}
          placeholder="Term 1 or Jan–Apr"
          defaultValue={current?.name}
        />
      </label>
      <div className="form-field-grid">
        <label>
          Start date
          <input name="start" type="date" defaultValue={current?.startsOn} />
        </label>
        <label>
          End date
          <input name="end" type="date" defaultValue={current?.endsOn} />
        </label>
      </div>
      <fieldset>
        <legend>Include venture pathways</legend>
        {!paths.length && <p>Venture pathways can be added as soon as they begin.</p>}
        {paths
          .filter(
            (path) =>
              !p.ventures.find((venture) => venture.id === path.ventureId)?.cohortId &&
              path.status !== 'pending',
          )
          .map((path) => (
            <label className="inline-checkbox" key={path.id}>
              <input
                name="path"
                type="checkbox"
                value={path.id}
                defaultChecked={current?.incubationIds.includes(path.id)}
              />
              {ventureName(path.ventureId)}
            </label>
          ))}
      </fieldset>
    </TrainingForm>
  );
  if (!cohortId || (!cohort && cohortId !== 'all'))
    return (
      <>
        <div className="workspace-data-toolbar">
          <h2>Cohorts</h2>
          {!readonly && cohortEditor()}
        </div>
        <div className="cohort-grid">
          <Link className="cohort-card" to={cohortLink('all')}>
            <strong>All pathways</strong>
            <span>{ventures.length} ventures</span>
            <ArrowRight size={18} aria-hidden="true" />
          </Link>
          {cohorts.map((entry) => (
            <Link to={cohortLink(entry.id)} className="cohort-card" key={entry.id}>
              <strong>{entry.name}</strong>
              {(entry.startsOn || entry.endsOn) && (
                <span>{[entry.startsOn, entry.endsOn].filter(Boolean).join(' to ')}</span>
              )}
              <span>{ventures.filter((venture) => inCohort(venture, entry)).length} ventures</span>
              <ArrowRight size={18} aria-hidden="true" />
            </Link>
          ))}
        </div>
      </>
    );

  const marks = rows.flatMap((row) =>
    p.training.curriculum.map((stage) => {
      const work = getStage(p.training, row.path.id, stage.id);
      const attempts =
        work?.attempts.filter((attempt) => attempt.learnerId === row.learner.id) ?? [];
      return {
        ...row,
        stage,
        assessmentId: JSON.stringify([row.path.id, row.learner.id, stage.id]),
        attempts,
        latest: attempts.at(-1)?.score ?? null,
        canRecord:
          school.kind === 'high-school' &&
          row.path.status !== 'pending' &&
          !!work?.examOpenedAt &&
          !attempts.some((attempt) => attempt.score === null) &&
          stageUnlocked(p, row.path, stage.id, row.learner.id) &&
          !passedStage(p.training, row.path.id, stage.id, row.learner.id),
      };
    }),
  );
  const noResults = 'Launch a venture into incubation to see its participants here.';
  const filteredRows = rows.filter((row) => {
    if (!outcome) return true;
    const scores = marks
      .filter((mark) => mark.key === row.key)
      .flatMap((mark) => (mark.latest === null ? [] : [mark.latest]));
    if (outcome === 'resit') return scores.some((score) => score < passMark);
    if (outcome === 'assessed') return scores.length > 0;
    return scores.length === 0;
  });
  const entryForm = (studentKey?: string) => {
    const entries = marks.filter((row) => row.canRecord && (!studentKey || row.key === studentKey));
    if (readonly || !entries.length) return null;
    return (
      <TrainingForm
        save={save}
        label="Save result"
        dialog={{ action: 'Add result', create: true }}
        build={(data) => {
          const entry = entries.find((row) => row.assessmentId === field(data, 'assessment'));
          if (!entry) throw new Error('Select an assessment.');
          return {
            type: 'stage-offline-result',
            incubationId: entry.path.id,
            stage: entry.stage.id,
            learnerId: entry.learner.id,
            attemptId: crypto.randomUUID(),
            score: Number(field(data, 'score')),
            note: field(data, 'note'),
          };
        }}
      >
        <label>
          Student and assessment
          <select name="assessment" required>
            {entries.map(({ learner, venture, stage, assessmentId }) => (
              <option key={assessmentId} value={assessmentId}>
                {learner.name} · {venture} · {stage.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          Mark (%)
          <input name="score" type="number" min={0} max={100} step={1} required />
        </label>
        <label>
          Assessment notes
          <textarea name="note" minLength={5} maxLength={3000} required />
        </label>
      </TrainingForm>
    );
  };
  const dateName = (date: string) =>
    new Date(date).toLocaleDateString('en-KE', { dateStyle: 'medium', timeZone: 'Africa/Nairobi' });
  const scoreFor = (key: string, stage: StageId) =>
    marks.find((row) => row.key === key && row.stage.id === stage)?.latest ?? '—';
  const requests = new Map(
    (p.training.certificateRequests ?? []).map((row) => [certificateKey(row), row]),
  );
  const issuedByKey = new Map(p.training.credentials.map((row) => [certificateKey(row), row]));
  const certificates = rows.flatMap((row) =>
    credentialKinds.flatMap((kind) => {
      const selection = { incubationId: row.path.id, learnerId: row.learner.id, kind };
      const key = certificateKey(selection);
      const issued = issuedByKey.get(key);
      const qualifies = credentialReady(p, row.path, row.learner.id, kind);
      if (!qualifies && !issued) return [];
      return [
        {
          ...row,
          selection,
          key,
          issued,
          requested: requests.get(key),
          title: credentialTitle(p.training, kind),
        },
      ];
    }),
  );
  const shownCertificates = certificates.filter(
    (row) => !certificateKind || row.selection.kind === certificateKind,
  );
  const eligible = shownCertificates.filter((row) => !row.issued && !row.requested);
  const showAssessmentHelp =
    !readonly &&
    school.kind === 'high-school' &&
    marks.some((row) => (row.latest ?? -1) < passMark) &&
    !marks.some((row) => row.canRecord);
  const request = (entries: CertificateSelection[], all = false) =>
    !readonly && (
      <TrainingForm
        save={save}
        label={all ? 'Send all requests' : 'Send certificate request'}
        dialog={{
          action: all ? `Request all eligible (${entries.length})` : 'Request certificate',
          title: all ? 'Request certificates' : undefined,
        }}
        build={() => ({ type: 'institution-certificates-request', entries })}
      >
        <p>
          {entries.length === 1
            ? 'Send this certificate request to the platform administrator.'
            : `Send ${entries.length} certificate requests to the platform administrator.`}
        </p>
      </TrainingForm>
    );
  const results = (
    <>
      <div className="cohort-metrics">
        <div>
          <strong>{new Set(rows.map((row) => row.learner.id)).size}</strong>
          <span>Students</span>
        </div>
        {p.training.curriculum.map((stage) => {
          const scores = marks.filter((mark) => mark.stage.id === stage.id && mark.latest !== null);
          const passed = scores.filter((mark) => (mark.latest ?? 0) >= passMark).length;
          return (
            <div key={stage.id}>
              <strong>
                {scores.length ? Math.round((100 * passed) / scores.length) + '%' : '—'}
              </strong>
              <span>{stage.title} pass rate</span>
              <small>
                {passed} of {scores.length} venture assessments
              </small>
            </div>
          );
        })}
      </div>
      {showAssessmentHelp && (
        <p>
          {selectedPaths.some((path) => path.status === 'pending')
            ? 'Launch the team venture from Incubation to start recording its activities.'
            : 'Open the venture pathway, save the stage evidence and open the assessment. Then return here to add results.'}
          {ventureId && selectedPaths[0] && (
            <>
              {' '}
              <Link to={incubationHref + '&path=' + encodeURIComponent(selectedPaths[0].id)}>
                Open pathway
              </Link>
            </>
          )}
        </p>
      )}
      <WorkspaceTable
        label="member results"
        exportName="yerh-cohort-results.csv"
        exportLabel="Export results CSV"
        columns={[
          'Student',
          'Venture',
          ...p.training.curriculum.map((stage) => stage.title + ' (%)'),
          'Action',
        ]}
        empty={filteredRows.length === rows.length ? noResults : 'No students match these filters.'}
        actions={
          <>
            {ventureFilter}
            <label className="workspace-toolbar-filter">
              Assessment
              <select value={outcome} onChange={(event) => setOutcome(event.target.value)}>
                <option value="">All results</option>
                <option value="assessed">Has marks</option>
                <option value="resit">Resit available</option>
                <option value="unassessed">No marks yet</option>
              </select>
            </label>
            {entryForm()}
          </>
        }
        rows={filteredRows.map((row) => ({
          id: row.key,
          search: [row.learner.name, row.venture].join(' '),
          cells: [
            row.learner.name,
            row.venture,
            ...p.training.curriculum.map((stage) => scoreFor(row.key, stage.id)),
            <Link to={href({ learner: row.key })} aria-label="View results">
              View
            </Link>,
          ],
        }))}
      />
    </>
  );
  const certificateView = (
    <>
      <div className="cohort-metrics">
        {credentialKinds.map((kind) => (
          <div key={kind}>
            <strong>
              {
                new Set(
                  certificates
                    .filter((row) => row.issued && row.selection.kind === kind)
                    .map((row) => row.learner.id),
                ).size
              }
            </strong>
            <span>{credentialTitle(p.training, kind)}</span>
          </div>
        ))}
      </div>
      <WorkspaceTable
        label="certificates"
        columns={['Student', 'Certificate', 'Venture', 'Requested on', 'Issued on', 'Action']}
        empty="Certificates appear here as learners qualify."
        exportName="yerh-cohort-certificates.csv"
        actions={
          <>
            {ventureFilter}
            <label className="workspace-toolbar-filter">
              Certificate
              <select
                value={certificateKind}
                onChange={(event) => setCertificateKind(event.target.value)}
              >
                <option value="">All certificates</option>
                {credentialKinds.map((kind) => (
                  <option key={kind} value={kind}>
                    {credentialTitle(p.training, kind)}
                  </option>
                ))}
              </select>
            </label>
            {eligible.length > 0 &&
              request(
                eligible.map((row) => row.selection),
                true,
              )}
          </>
        }
        rows={shownCertificates.map((row) => ({
          id: row.key,
          search: [row.learner.name, row.title, row.venture].join(' '),
          cells: [
            row.learner.name,
            row.title,
            row.venture,
            row.requested ? dateName(row.requested.requestedAt) : '—',
            row.issued ? dateName(row.issued.issuedAt) : '—',
            row.issued ? (
              <div className="workspace-row-actions">
                <Link to={'/certificates/' + row.issued.id} aria-label="View certificate">
                  View
                </Link>
                <a
                  download={row.learner.name + ' - ' + row.title + '.html'}
                  href={certificateFile(
                    row.title,
                    row.learner.name,
                    row.venture,
                    school.kind === 'high-school' ? 'Venture contributor' : 'Venture owner',
                    row.issued.issuedAt,
                    row.issued.id,
                  )}
                >
                  Download HTML
                </a>
              </div>
            ) : !row.requested ? (
              request([row.selection])
            ) : (
              '—'
            ),
          ],
        }))}
      />
    </>
  );
  if (selected) {
    const selectedMarks = marks.filter((row) => row.key === selected.key);
    return (
      <>
        <Link className="text-link" to={href({ learner: null, view: 'results' })}>
          ← {title} results
        </Link>
        <h2>{selected.learner.name}</h2>
        <p>
          {selected.venture} · {school.name}
        </p>
        <WorkspaceTable
          label="assessment history"
          columns={['Stage', 'Attempt', 'Mark (%)', 'Date', 'Assessment notes']}
          empty="No assessments have been recorded for this student."
          actions={entryForm(selected.key)}
          rows={selectedMarks.flatMap((row) =>
            row.attempts.map((attempt, index) => ({
              id: attempt.id,
              search: row.stage.title + ' ' + attempt.note,
              cells: [
                row.stage.title,
                index + 1,
                attempt.score ?? '—',
                dateName(attempt.submittedAt),
                attempt.note,
              ],
            })),
          )}
        />
      </>
    );
  }
  return (
    <>
      <Link className="text-link" to={directory}>
        ← Cohorts
      </Link>
      <div className="workspace-data-toolbar">
        <div>
          <h2>{title}</h2>
          {cohort && (cohort.startsOn || cohort.endsOn) && (
            <p>{[cohort.startsOn, cohort.endsOn].filter(Boolean).join(' to ')}</p>
          )}
        </div>
        {cohort && !readonly && cohortEditor(cohort)}
      </div>
      <WorkspaceTabs
        label="Cohort views"
        views={[
          { id: 'results', label: 'Results', content: results },
          { id: 'certificates', label: 'Certificates', content: certificateView },
        ]}
      />
    </>
  );
}
