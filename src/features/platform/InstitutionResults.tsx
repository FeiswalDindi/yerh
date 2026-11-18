import { Link } from 'react-router-dom';
import { WorkspaceDialog, WorkspaceStatus, WorkspaceTable } from './WorkspaceControls';
import {
  credentialReady,
  getStage,
  passedStage,
  stageUnlocked,
  type Institution,
} from '../../domain/incubation';
import type { DemoAccount } from '../../domain/demo';
import type { PlatformState } from '../../domain/platform';
import { credentialTitle, field, TrainingForm, type Save } from './TrainingForms';

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
}: {
  p: PlatformState;
  school: Institution;
  accounts: DemoAccount[];
  save: Save;
}) {
  const offline = school.kind === 'high-school';
  const rows = p.incubations.flatMap((path) => {
    const venture = p.ventures.find((item) => item.id === path.ventureId);
    if (!venture || !['active', 'completed'].includes(path.status)) return [];
    const group = p.training.groups.find(
      (item) => item.id === venture.groupId && item.institutionId === school.id,
    );
    const learners = offline
      ? p.training.students.filter(
          (student) =>
            path.ownerId === school.adminId &&
            student.institutionId === school.id &&
            group?.studentIds.includes(student.id),
        )
      : accounts.filter(
          (account) =>
            !venture.groupId &&
            account.id === path.ownerId &&
            p.training.affiliations[account.id] === school.id,
        );
    return learners.map((learner) => ({ learner, venture, path }));
  });
  return (
    <WorkspaceTable
      label="member results"
      columns={['Member', 'Venture', 'Stages passed', 'Status', 'Certificates', 'Action']}
      empty="Member results appear once a venture starts incubation."
      rows={rows.map(({ learner, venture, path }) => {
        const credentials = p.training.credentials.filter(
          (credential) =>
            credential.incubationId === path.id && credential.learnerId === learner.id,
        );
        const passed = p.training.curriculum.filter((stage) =>
          passedStage(p.training, path.id, stage.id, learner.id),
        );
        const next = p.training.curriculum.find((stage) => !passed.includes(stage));
        const last =
          next &&
          getStage(p.training, path.id, next.id)
            ?.attempts.filter((attempt) => attempt.learnerId === learner.id)
            .at(-1);
        const status = !next
          ? 'Passed'
          : !last
            ? 'In progress'
            : last.score === null
              ? 'Awaiting grade'
              : 'Resit available';
        return {
          id: path.id + ':' + learner.id,
          search: [learner.name, venture.name, status].join(' '),
          cells: [
            learner.name,
            venture.name,
            `${passed.length} / ${p.training.curriculum.length}`,
            <WorkspaceStatus>{status}</WorkspaceStatus>,
            credentials.length,
            <WorkspaceDialog action="View results" title={`${learner.name} · ${venture.name}`}>
              {() => (
                <>
                  {p.training.curriculum.map((stage) => {
                    const work = getStage(p.training, path.id, stage.id);
                    const attempts = work?.attempts.filter((a) => a.learnerId === learner.id) ?? [];
                    const last = attempts.at(-1);
                    const passed = passedStage(p.training, path.id, stage.id, learner.id);
                    const unlocked = stageUnlocked(p, path, stage.id, learner.id);
                    const failed = unlocked && !passed && last && last.score !== null;
                    return (
                      <div key={stage.id} className="training-step">
                        <strong>{stage.title}</strong>
                        <p>
                          {passed
                            ? 'Passed'
                            : !unlocked
                              ? 'Locked until earlier stages are passed'
                              : failed
                                ? 'Resit available'
                                : last
                                  ? 'Awaiting grade'
                                  : work?.examOpenedAt
                                    ? 'Exam open'
                                    : 'Awaiting exam'}
                          {attempts.length > 0 &&
                            ' · Attempts: ' +
                              attempts
                                .map((a) => (a.score === null ? 'ungraded' : a.score + '%'))
                                .join(', ')}
                        </p>
                        {passed &&
                          !p.training.credentials.some(
                            (c) =>
                              c.incubationId === path.id &&
                              c.learnerId === learner.id &&
                              c.kind === stage.id,
                          ) && (
                            <p>
                              {credentialReady(p, path, learner.id, stage.id)
                                ? 'Certificate awaiting issuance.'
                                : 'Record the learner’s contribution in Incubation for certificate eligibility.'}
                            </p>
                          )}
                        {failed &&
                          work?.examOpenedAt &&
                          (offline ? (
                            <div>
                              <TrainingForm
                                save={save}
                                reset
                                label="Save resit result"
                                dialog={{ action: 'Record offline resit', title: stage.title }}
                                build={(data) => ({
                                  type: 'stage-offline-result',
                                  incubationId: path.id,
                                  stage: stage.id,
                                  learnerId: learner.id,
                                  attemptId: crypto.randomUUID(),
                                  score: Number(field(data, 'score')),
                                  note: field(data, 'note'),
                                })}
                              >
                                <label>
                                  Resit score (%)
                                  <input type="number" name="score" min="0" max="100" required />
                                </label>
                                <label>
                                  Assessment notes
                                  <textarea name="note" minLength={5} maxLength={3000} required />
                                </label>
                              </TrainingForm>
                            </div>
                          ) : (
                            <p>The student can submit a resit in their Incubation workspace.</p>
                          ))}
                      </div>
                    );
                  })}
                  {credentials.length > 0 && <h3>Issued certificates</h3>}
                  {credentials.map((c) => {
                    const title = credentialTitle(p.training, c.kind);
                    return (
                      <p key={c.id}>
                        <strong>{title}</strong> ·{' '}
                        <Link to={'/certificates/' + c.id}>View certificate</Link> ·{' '}
                        <a
                          download={learner.name + ' - ' + venture.name + ' - ' + title + '.html'}
                          href={certificateFile(
                            title,
                            learner.name,
                            venture.name,
                            offline ? 'Venture contributor' : 'Venture owner',
                            c.issuedAt,
                            c.id,
                          )}
                        >
                          Download certificate (HTML)
                        </a>
                      </p>
                    );
                  })}
                </>
              )}
            </WorkspaceDialog>,
          ],
        };
      })}
    />
  );
}
