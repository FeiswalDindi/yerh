import type { ReactNode } from 'react';
import { Paperclip } from 'lucide-react';
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
  const passed = Boolean(
    work?.graded_at &&
    (work.passed === true ||
      work.passed === 1 ||
      (work.passed == null && typeof score === 'number' && score >= passMark)),
  );
  const mentorApprovedBelowPass = Boolean(passed && typeof score === 'number' && score < passMark);
  const failed = Boolean(work?.graded_at && !passed);
  const attempt = work?.attempt ?? 1;
  const savedSteps = evidence.length === definition.steps.length;

  function action(
    label: string,
    command: string,
    fields: ReactNode,
    body: (data: FormData) => object | FormData,
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
      <h3>
        {definition.title}
        {attempt > 1 ? ` · Attempt ${attempt}` : ''}
      </h3>
      {!unlocked ? (
        <p>
          {path.mentor_id
            ? `Locked until the previous assessment is passed (${passMark}% minimum) or approved by your mentor.`
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
                {entry?.has_attachment && (
                  <p>
                    <a
                      className="workspace-attachment-link"
                      href={laravelProgramme.evidenceAttachmentUrl(path.id, definition.id, step.id)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <Paperclip size={14} aria-hidden="true" />{' '}
                      {entry.attachment_name || 'Download attached evidence'}
                    </a>
                  </p>
                )}
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
                      <label>
                        Supporting document or image (optional: PDF, Office, JPG/PNG/WebP, max 8 MB)
                        <input
                          name="attachment"
                          type="file"
                          accept=".pdf,.ppt,.pptx,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp"
                        />
                      </label>
                      {entry?.has_attachment && (
                        <label className="inline-checkbox">
                          <input type="checkbox" name="remove_attachment" /> Remove existing
                          attachment ({entry.attachment_name || 'file'})
                        </label>
                      )}
                      <label className="inline-checkbox">
                        <input
                          type="checkbox"
                          name="feedback"
                          defaultChecked={Boolean(entry?.feedback_requested)}
                        />{' '}
                        Request mentor feedback
                      </label>
                    </>,
                    (data) => {
                      const file = data.get('attachment');
                      const removeAttachment = data.get('remove_attachment') === 'on';
                      if ((file instanceof File && file.size > 0) || removeAttachment) {
                        const form = new FormData();
                        form.append('step', step.id);
                        form.append('body', fieldValue(data, 'evidence'));
                        form.append('request_feedback', data.get('feedback') === 'on' ? '1' : '0');
                        if (file instanceof File && file.size > 0) {
                          form.append('attachment', file);
                        }
                        if (removeAttachment) {
                          form.append('remove_attachment', '1');
                        }
                        return form;
                      }
                      return {
                        step: step.id,
                        body: fieldValue(data, 'evidence'),
                        request_feedback: data.get('feedback') === 'on',
                      };
                    },
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
              attempt > 1 ? 'Retake exam' : 'Take exam',
              'submit',
              <>
                <p>{definition.examPrompt}</p>
                <label>
                  Your answer
                  <textarea name="answer" required minLength={10} maxLength={8000} />
                </label>
                <label>
                  Pitch deck or supporting file (optional: PDF, Office, image, max 8 MB)
                  <input
                    name="attachment"
                    type="file"
                    accept=".pdf,.ppt,.pptx,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp"
                  />
                </label>
              </>,
              (data) => {
                const file = data.get('attachment');
                if (file instanceof File && file.size > 0) {
                  const form = new FormData();
                  form.append('answer', fieldValue(data, 'answer'));
                  form.append('attachment', file);
                  return form;
                }
                return { answer: fieldValue(data, 'answer') };
              },
            )}
          {work?.submitted_at && (
            <>
              <h4>Assessment response</h4>
              <p>{work.answer}</p>
              {work.has_answer_attachment && (
                <p>
                  <a
                    className="workspace-attachment-link"
                    href={laravelProgramme.examAttachmentUrl(path.id, definition.id)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Paperclip size={14} aria-hidden="true" />{' '}
                    {work.answer_attachment_name || 'Download assessment attachment'}
                  </a>
                </p>
              )}
            </>
          )}
          {mentor &&
            work?.submitted_at &&
            !work.graded_at &&
            action(
              'Grade exam',
              'grade',
              <>
                <p>
                  Pass mark is {passMark}%. For scores below {passMark}%, you can open a retake or
                  approve progression to the next stage.
                </p>
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
            <p role="status">
              Assessment graded · {score}% ·{' '}
              {mentorApprovedBelowPass
                ? 'Approved by mentor to continue'
                : passed
                  ? 'Passed'
                  : `Below the ${passMark}% pass mark — awaiting mentor retake or approval to continue`}
              {work.grade_note ? ' · ' + work.grade_note : ''}
            </p>
          )}
          {mentor && failed && (
            <div className="workspace-row-actions">
              {action('Open exam retake', 'reopen-exam', <NoteField />, (data) => ({
                note: fieldValue(data, 'note'),
              }))}
              {action(
                'Approve to continue',
                'approve-progression',
                <>
                  <p>
                    Allow {path.owner} to proceed to the next stage despite scoring {score}% (below{' '}
                    {passMark}%). Your note will be saved on the stage record.
                  </p>
                  <NoteField />
                </>,
                (data) => ({ note: fieldValue(data, 'note') }),
              )}
              {action('Return for evidence revision', 'revise', <NoteField />, (data) => ({
                note: fieldValue(data, 'note'),
              }))}
            </div>
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
