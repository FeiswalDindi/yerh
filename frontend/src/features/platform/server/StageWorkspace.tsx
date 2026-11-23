import type { ReactNode } from 'react';
import { passMark } from '../../../domain/incubation';
import {
  laravelProgramme,
  type Pathway,
  type Stage,
} from '../../../services/laravel-programme-repository';
import { fieldValue, WorkspaceAction } from './WorkspaceActions';

export type ProgrammeRole = 'admin' | 'entrepreneur' | 'mentor';

export function StageWorkspace({
  path,
  stage,
  role,
  unlocked,
  reload,
}: {
  path: Pathway;
  stage: Stage;
  role: ProgrammeRole;
  unlocked: boolean;
  reload: () => void;
}) {
  const { definition, work, evidence } = stage;
  const founder = role === 'entrepreneur';
  const mentor = role === 'mentor';
  const canEdit = founder && !work?.review_requested_at && !work?.exam_opened_at;
  const canReview = mentor && work?.review_requested_at && !work.exam_opened_at;
  const score = work?.score;
  const savedSteps = evidence.length === definition.steps.length;

  function action(
    label: string,
    command: string,
    fields: ReactNode,
    body: (data: FormData) => object,
  ) {
    return (
      <WorkspaceAction
        action={label}
        title={definition.title}
        submit={label}
        save={async (data) => {
          await laravelProgramme.updateStage(path.id, definition.id, command, body(data));
          reload();
        }}
      >
        {fields}
      </WorkspaceAction>
    );
  }

  return (
    <section className="server-programme-stage">
      <h3>{definition.title}</h3>
      {!unlocked ? (
        <p>
          {path.mentor_id
            ? 'Locked until the previous assessment is graded.'
            : 'Locked until a mentor is assigned.'}
        </p>
      ) : (
        <>
          {definition.steps.map((step) => {
            const entry = evidence.find((row) => row.step_key === step.id);
            return (
              <div key={step.id} className="training-step">
                <h4>{step.title}</h4>
                <p>{step.instruction}</p>
                {entry && <p>{entry.body}</p>}
                {entry?.feedback && <p>Mentor feedback · {entry.feedback}</p>}
                {canEdit &&
                  action(
                    entry ? 'Edit evidence' : 'Save evidence',
                    'evidence',
                    <>
                      <label>
                        Evidence
                        <textarea
                          name="evidence"
                          defaultValue={entry?.body}
                          required
                          minLength={10}
                          maxLength={5000}
                        />
                      </label>
                      <label className="inline-checkbox">
                        <input
                          type="checkbox"
                          name="feedback"
                          defaultChecked={Boolean(entry?.feedback_requested)}
                        />{' '}
                        Request mentor feedback
                      </label>
                    </>,
                    (data) => ({
                      step: step.id,
                      body: fieldValue(data, 'evidence'),
                      request_feedback: data.get('feedback') === 'on',
                    }),
                  )}
                {mentor &&
                  Boolean(entry?.feedback_requested) &&
                  action('Give feedback', 'feedback', <NoteField />, (data) => ({
                    step: step.id,
                    note: fieldValue(data, 'note'),
                  }))}
              </div>
            );
          })}
          {canEdit &&
            savedSteps &&
            action(
              'Request stage review',
              'request-review',
              <p>Send this stage to your assigned mentor.</p>,
              () => ({}),
            )}
          {work?.review_requested_at && !work.exam_opened_at && <p>Stage review requested.</p>}
          {work?.meeting_at && (
            <p>
              Mentor meeting · {new Date(work.meeting_at.replace(' ', 'T') + 'Z').toLocaleString()}{' '}
              · {work.meeting_location}
            </p>
          )}
          {work?.meeting_note && <p>Review notes · {work.meeting_note}</p>}
          {canReview &&
            action(
              'Schedule meeting',
              'meeting',
              <>
                <label>
                  Meeting time (local)
                  <input name="meeting" type="datetime-local" required />
                </label>
                <label>
                  Meeting location or call link
                  <input name="location" required maxLength={240} />
                </label>
              </>,
              (data) => ({
                meeting_at: new Date(fieldValue(data, 'meeting')).toISOString(),
                location: fieldValue(data, 'location'),
              }),
            )}
          {canReview && work.meeting_at && (
            <div className="workspace-row-actions">
              {action('Open exam', 'open-exam', <NoteField />, (data) => ({
                note: fieldValue(data, 'note'),
              }))}
              {action('Request changes', 'revise', <NoteField />, (data) => ({
                note: fieldValue(data, 'note'),
              }))}
            </div>
          )}
          {founder &&
            work?.exam_opened_at &&
            !work.submitted_at &&
            action(
              'Take exam',
              'submit',
              <>
                <p>{definition.examPrompt}</p>
                <label>
                  Your answer
                  <textarea name="answer" required minLength={10} maxLength={8000} />
                </label>
              </>,
              (data) => ({ answer: fieldValue(data, 'answer') }),
            )}
          {work?.submitted_at && (
            <>
              <h4>Assessment response</h4>
              <p>{work.answer}</p>
            </>
          )}
          {mentor &&
            work?.submitted_at &&
            !work.graded_at &&
            action(
              'Grade exam',
              'grade',
              <>
                <label>
                  Mark (%)
                  <input name="score" type="number" min={0} max={100} step={1} required />
                </label>
                <NoteField />
              </>,
              (data) => ({
                score: Number(fieldValue(data, 'score')),
                note: fieldValue(data, 'note'),
              }),
            )}
          {work?.graded_at && typeof score === 'number' && (
            <p>
              Assessment completed · {score}% ·{' '}
              {score >= passMark ? 'Passed' : 'Below the pass mark'}
              {work.grade_note ? ' · ' + work.grade_note : ''}
            </p>
          )}
        </>
      )}
    </section>
  );
}

function NoteField() {
  return (
    <label>
      Notes
      <textarea name="note" minLength={5} maxLength={2000} required />
    </label>
  );
}
