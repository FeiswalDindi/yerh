import { getStage } from '../../../domain/incubation';
import type { Incubation, PlatformState } from '../../../domain/platform';
import { field, TrainingForm, type Save } from '../incubation/TrainingForms';

export function MentorStages({
  p,
  path,
  save,
  editable,
}: {
  p: PlatformState;
  path: Incubation;
  save: Save;
  editable: boolean;
}) {
  return p.training.curriculum.map((stage) => {
    const work = getStage(p.training, path.id, stage.id);
    if (!work) return null;
    const key = { incubationId: path.id, stage: stage.id };
    const pending = work.attempts.filter((attempt) => attempt.score === null);
    const needsReview = work.reviewRequestedAt && !work.examOpenedAt;
    return (
      <details
        className="training-stage"
        key={stage.id}
        open={!!needsReview || pending.length > 0 || work.steps.some((step) => step.requested)}
      >
        <summary>{stage.title}</summary>
        {stage.steps.map((step) => {
          const entry = work.steps.find((row) => row.id === step.id);
          if (!entry) return null;
          return (
            <div key={step.id} className="training-step">
              <h4>{step.title}</h4>
              <p>{entry.evidence}</p>
              {entry.feedback && <p>Feedback sent · {entry.feedback}</p>}
              {entry.requested && editable && (
                <TrainingForm
                  save={save}
                  label="Send step feedback"
                  dialog={{ action: 'Give feedback', title: step.title }}
                  build={(data) => ({
                    ...key,
                    type: 'stage-feedback',
                    stepId: step.id,
                    feedback: field(data, 'note'),
                  })}
                >
                  <label>
                    Feedback <textarea name="note" required minLength={5} maxLength={3000} />
                  </label>
                </TrainingForm>
              )}
            </div>
          );
        })}
        {needsReview && editable && (
          <>
            <TrainingForm
              save={save}
              label="Save meeting"
              dialog={{ action: work.meetingAt ? 'Reschedule meeting' : 'Schedule meeting' }}
              build={(data) => ({
                ...key,
                type: 'stage-meeting',
                meetingAt: `${field(data, 'meeting')}:00+03:00`,
                location: field(data, 'location'),
              })}
            >
              <label>
                Review meeting time (EAT) <input name="meeting" type="datetime-local" required />
              </label>
              <label>
                Meeting link or location{' '}
                <input
                  name="location"
                  minLength={3}
                  maxLength={300}
                  defaultValue={work.meetingLocation}
                />
              </label>
            </TrainingForm>
            {work.meetingAt && (
              <>
                <p>
                  Meeting scheduled for{' '}
                  {new Date(work.meetingAt).toLocaleString('en-KE', { timeZone: 'Africa/Nairobi' })}{' '}
                  EAT.
                </p>
                <TrainingForm
                  save={save}
                  label="Save review decision"
                  dialog={{ action: 'Record review decision' }}
                  build={(data) => ({
                    ...key,
                    type: field(data, 'decision') === 'ready' ? 'stage-open-exam' : 'stage-revise',
                    note: field(data, 'note'),
                  })}
                >
                  <label>
                    Review decision{' '}
                    <select name="decision">
                      <option value="ready">Ready · open stage exam</option>
                      <option value="revise">Request revisions</option>
                    </select>
                  </label>
                  <label>
                    Meeting outcome <textarea name="note" required minLength={5} maxLength={3000} />
                  </label>
                </TrainingForm>
              </>
            )}
          </>
        )}
        {pending.map((attempt) => (
          <div className="training-step" key={attempt.id}>
            <h4>Exam answer</h4>
            <p>{attempt.answer}</p>
            {editable && (
              <TrainingForm
                save={save}
                label="Save exam grade"
                dialog={{ action: 'Grade exam' }}
                build={(data) => ({
                  ...key,
                  type: 'stage-grade',
                  attemptId: attempt.id,
                  score: Number(field(data, 'score')),
                  note: field(data, 'note'),
                })}
              >
                <label>
                  Exam score (%){' '}
                  <input name="score" type="number" min="0" max="100" step="1" required />
                </label>
                <label>
                  Exam feedback <textarea name="note" required minLength={5} maxLength={3000} />
                </label>
              </TrainingForm>
            )}
          </div>
        ))}
      </details>
    );
  });
}
