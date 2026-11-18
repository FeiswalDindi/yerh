import { useState } from 'react';
import {
  WorkspaceDialog,
  WorkspaceFormDialog,
  WorkspaceStatus,
  WorkspaceTable,
} from './WorkspaceControls';
import { Link } from 'react-router-dom';
import type { DemoAccount } from '../../domain/demo';
import {
  canPublishProduct,
  certificateFee,
  credentialReady,
  getStage,
  incubationLearners,
  managesVenture,
  passMark,
  passedStage,
  paymentFor,
  productClearedByIncubation,
  stageUnlocked,
  type CredentialKind,
  type StageDefinition,
} from '../../domain/incubation';
import type { Incubation, PlatformState, Product, Venture } from '../../domain/platform';
import {
  amount,
  credentialTitle,
  field,
  submitTraining,
  TrainingForm,
  type Save,
} from './TrainingForms';

const shortDate = new Intl.DateTimeFormat('en-KE', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Africa/Nairobi',
});

export function UniversitySelection({
  p,
  account,
  save,
  modal = false,
}: {
  p: PlatformState;
  account: DemoAccount;
  save: Save;
  modal?: boolean;
}) {
  const universities = p.training.institutions.filter(
    (school) => school.kind === 'university' && school.status === 'active',
  );
  if (universities.length === 0) return null;
  return (
    <TrainingForm
      save={save}
      label="Save university"
      dialog={modal ? { action: 'Set university' } : undefined}
      build={(data) => ({ type: 'institution-affiliation', id: field(data, 'university') })}
    >
      <label>
        University
        <select name="university" required defaultValue={p.training.affiliations[account.id] ?? ''}>
          <option value="" disabled>
            Select your university
          </option>
          {universities.map((school) => (
            <option key={school.id} value={school.id}>
              {school.name}
            </option>
          ))}
        </select>
      </label>
      {p.training.affiliations[account.id] && (
        <small role="status">
          Saved university ·{' '}
          {universities.find((school) => school.id === p.training.affiliations[account.id])?.name}
        </small>
      )}
    </TrainingForm>
  );
}

export function IncubationWorkspace({
  p,
  account,
  save,
  accountName,
}: {
  p: PlatformState;
  account: DemoAccount;
  save: Save;
  accountName: (id: string) => string;
}) {
  const ventures = p.ventures.filter(
    (v) =>
      managesVenture(p, account, v) &&
      v.status === 'approved' &&
      !p.incubations.some((path) => path.ventureId === v.id && path.status !== 'rejected'),
  );
  const [selected, select] = useState('');
  const ventureId = ventures.some((v) => v.id === selected) ? selected : (ventures[0]?.id ?? '');
  return (
    <WorkspaceTable
      label="incubations"
      columns={['Venture', 'Mentor', 'Status', 'Action']}
      empty="No ventures have been launched into incubation."
      actions={
        ventures.length > 0 ? (
          <WorkspaceFormDialog
            action="Launch venture"
            create
            submit="Launch into incubation"
            onSave={(data) =>
              save({
                type: 'incubation-apply',
                now: new Date().toISOString(),
                id: crypto.randomUUID(),
                ventureId,
                productIds: data.getAll('product').map(String),
                goal: field(data, 'goal'),
              })
            }
          >
            <label>
              Venture
              <select value={ventureId} onChange={(event) => select(event.target.value)}>
                {ventures.map((venture) => (
                  <option key={venture.id} value={venture.id}>
                    {venture.name}
                  </option>
                ))}
              </select>
            </label>
            <fieldset key={ventureId}>
              <legend>Products in scope</legend>
              {p.products
                .filter((product) => product.ventureId === ventureId)
                .map((product) => (
                  <label key={product.id} className="inline-checkbox">
                    <input type="checkbox" name="product" value={product.id} /> {product.name}
                  </label>
                ))}
              <small>You can also launch a venture before it has a product.</small>
            </fieldset>
            <label>
              Incubation goals <textarea name="goal" required minLength={30} maxLength={2000} />
            </label>
            <p>
              The platform administrator assigns a mentor to this venture from the incubation
              application.
            </p>
          </WorkspaceFormDialog>
        ) : (
          <Link to="/dashboard/workspace?tab=ventures">Find an approved venture</Link>
        )
      }
      rows={p.incubations.flatMap((path) => {
        const venture = p.ventures.find((entry) => entry.id === path.ventureId);
        if (path.ownerId !== account.id || !managesVenture(p, account, venture)) return [];
        const mentor = path.mentorId ? accountName(path.mentorId) : '—';
        return [
          {
            id: path.id,
            search: [venture.name, mentor, path.status].join(' '),
            cells: [
              venture.name,
              mentor,
              <WorkspaceStatus>{path.status}</WorkspaceStatus>,
              <WorkspaceDialog action="Open pathway" title={venture.name}>
                {() => (
                  <>
                    <p>{path.goal}</p>
                    {path.productIds?.length ? (
                      <p>
                        Products in scope:{' '}
                        {path.productIds
                          .map((id) => p.products.find((product) => product.id === id)?.name)
                          .join(', ')}
                      </p>
                    ) : null}
                    {path.status === 'pending' && (
                      <p>Waiting for an administrator to assign a mentor.</p>
                    )}
                    {path.status === 'rejected' && (
                      <p>You can submit a new incubation application for this venture.</p>
                    )}
                    {venture.groupId &&
                      (path.status === 'active' || path.status === 'completed') && (
                        <div className="training-step">
                          <TrainingForm
                            save={save}
                            label="Save all contributions"
                            dialog={{ action: 'Individual contributions' }}
                            build={(data) => ({
                              type: 'institution-contributions',
                              ventureId: venture.id,
                              entries: incubationLearners(p, path)
                                .map((learnerId) => ({
                                  learnerId,
                                  evidence: field(data, learnerId).trim(),
                                }))
                                .filter((entry) => entry.evidence.length > 0),
                            })}
                          >
                            <p>
                              Enter at least 10 characters per contribution. Blank fields keep any
                              previously saved notes.
                            </p>
                            {incubationLearners(p, path).map((id) => (
                              <label key={id}>
                                {p.training.students.find((student) => student.id === id)?.name}
                                <textarea
                                  name={id}
                                  minLength={10}
                                  maxLength={3000}
                                  defaultValue={
                                    p.training.contributions.find(
                                      (item) =>
                                        item.learnerId === id && item.ventureId === venture.id,
                                    )?.evidence
                                  }
                                />
                              </label>
                            ))}
                          </TrainingForm>
                        </div>
                      )}
                    {(path.status === 'active' || path.status === 'completed') &&
                      p.training.curriculum.map((stage) => (
                        <LearnerStage
                          key={stage.id}
                          p={p}
                          path={path}
                          stage={stage}
                          venture={venture}
                          save={save}
                        />
                      ))}
                    {incubationLearners(p, path).some((id) =>
                      credentialReady(p, path, id, 'venture'),
                    ) && (
                      <div className="training-status">
                        <CredentialStatus p={p} path={path} kind="venture" save={save} />
                      </div>
                    )}
                    {path.milestones.map((milestone) => (
                      <p key={milestone.id}>
                        <strong>{milestone.title}</strong> · {milestone.note}
                      </p>
                    ))}
                  </>
                )}
              </WorkspaceDialog>,
            ],
          },
        ];
      })}
    />
  );
}

function LearnerStage({
  p,
  path,
  stage,
  venture,
  save,
}: {
  p: PlatformState;
  path: Incubation;
  stage: StageDefinition;
  venture: Venture;
  save: Save;
}) {
  const key = { incubationId: path.id, stage: stage.id };
  const work = getStage(p.training, path.id, stage.id);
  const missingSteps = stage.steps.filter(
    (step) => !work?.steps.some((item) => item.id === step.id),
  );
  if (!stageUnlocked(p, path, stage.id))
    return (
      <div className="training-stage">
        <h4>{stage.title}</h4>
        <p>Locked until the previous stage is passed.</p>
      </div>
    );
  const learners = incubationLearners(p, path);
  const studentName = (id: string) =>
    p.training.students.find((student) => student.id === id)?.name ?? 'You';
  const allPassed = learners.every((id) => passedStage(p.training, path.id, stage.id, id));
  const available = learners.filter(
    (id) =>
      stageUnlocked(p, path, stage.id, id) &&
      !passedStage(p.training, path.id, stage.id, id) &&
      !work?.attempts.some((attempt) => attempt.learnerId === id && attempt.score === null),
  );
  return (
    <details className="training-stage">
      <summary>
        {stage.title} ·{' '}
        {allPassed
          ? 'Passed'
          : work?.examOpenedAt
            ? 'Exam open'
            : work?.reviewRequestedAt
              ? 'Mentor review'
              : 'In progress'}
      </summary>
      <Link to={`/entrepreneurship/${stage.resourceTopic}`}>Browse stage learning materials →</Link>
      {stage.steps.map((step) => {
        const entry = work?.steps.find((item) => item.id === step.id);
        return (
          <div key={step.id} className="training-step">
            <h4>{step.title}</h4>
            <p>{step.instruction}</p>
            {work?.reviewRequestedAt || work?.examOpenedAt ? (
              <p>{entry?.evidence}</p>
            ) : (
              <TrainingForm
                save={save}
                build={(data) => ({
                  ...key,
                  type: 'stage-evidence',
                  stepId: step.id,
                  evidence: field(data, 'evidence'),
                  requestFeedback: data.get('feedback') === 'on',
                })}
                label="Save step"
                dialog={{
                  action: entry ? 'Edit evidence' : 'Add evidence',
                  title: step.title,
                  create: !entry,
                }}
              >
                <label>
                  Your evidence{' '}
                  <textarea
                    name="evidence"
                    required
                    minLength={10}
                    maxLength={3000}
                    defaultValue={entry?.evidence}
                  />
                </label>
                <label className="inline-checkbox">
                  <input type="checkbox" name="feedback" defaultChecked={entry?.requested} />{' '}
                  Request mentor feedback
                </label>
              </TrainingForm>
            )}
            {entry && !work?.reviewRequestedAt && !work?.examOpenedAt && <p>Evidence saved</p>}
            {entry?.feedback && (
              <p>
                <strong>Mentor feedback</strong> {entry.feedback}
              </p>
            )}
            {entry?.requested && <p>Feedback requested.</p>}
          </div>
        );
      })}
      {!work?.reviewRequestedAt && !work?.examOpenedAt && (
        <>
          <p role="status">
            {missingSteps.length
              ? `Save evidence for: ${missingSteps.map((step) => step.title).join(', ')}.`
              : 'All stage evidence is saved. You can request the mentor review.'}
          </p>
          <button
            type="button"
            className="button"
            disabled={missingSteps.length > 0}
            onClick={() => submitTraining(save, { ...key, type: 'stage-request' })}
          >
            Request stage review
          </button>
        </>
      )}
      {work?.meetingAt && <p>Mentor meeting · {shortDate.format(new Date(work.meetingAt))} EAT</p>}
      {work?.meetingLocation && <p>{work.meetingLocation}</p>}
      {work?.meetingNote && <p>{work.meetingNote}</p>}
      {work?.examOpenedAt && (
        <>
          <h4>Stage exam</h4>
          <p>{stage.examPrompt}</p>
          <p>Pass mark {passMark}%</p>
          {work.attempts.map((attempt) => (
            <p key={attempt.id}>
              {studentName(attempt.learnerId)} ·{' '}
              {attempt.score === null
                ? 'Awaiting grade'
                : `${attempt.score}% · ${attempt.score >= passMark ? 'Passed' : 'Resit available'}`}
              {attempt.note && ` · ${attempt.note}`}
            </p>
          ))}
          {available.length > 0 &&
            (venture.groupId ? (
              <TrainingForm
                save={save}
                reset
                label="Save offline exam result"
                dialog={{ action: 'Record offline exam result', create: true }}
                build={(data) => ({
                  ...key,
                  type: 'stage-offline-result',
                  attemptId: crypto.randomUUID(),
                  learnerId: field(data, 'student'),
                  score: Number(field(data, 'score')),
                  note: field(data, 'note'),
                })}
              >
                <label>
                  Student
                  <select name="student" required>
                    {available.map((id) => (
                      <option key={id} value={id}>
                        {studentName(id)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Offline exam score (%){' '}
                  <input name="score" type="number" min="0" max="100" step="1" required />
                </label>
                <label>
                  Assessment notes <textarea name="note" required minLength={5} maxLength={3000} />
                </label>
              </TrainingForm>
            ) : (
              <TrainingForm
                save={save}
                label="Submit exam"
                dialog={{ action: 'Enter exam answer' }}
                build={(data) => ({
                  ...key,
                  type: 'stage-take-exam',
                  attemptId: crypto.randomUUID(),
                  answer: field(data, 'answer'),
                })}
              >
                <label>
                  Your answer <textarea name="answer" required minLength={10} maxLength={3000} />
                </label>
              </TrainingForm>
            ))}
          <CredentialStatus p={p} path={path} kind={stage.id} save={save} />
        </>
      )}
    </details>
  );
}

function CredentialStatus({
  p,
  path,
  kind,
  save,
}: {
  p: PlatformState;
  path: Incubation;
  kind: CredentialKind;
  save: Save;
}) {
  const title = credentialTitle(p.training, kind);
  return incubationLearners(p, path)
    .filter((id) => credentialReady(p, path, id, kind))
    .map((id) => {
      const student = p.training.students.find((item) => item.id === id);
      const issued = p.training.credentials.find(
        (c) => c.incubationId === path.id && c.learnerId === id && c.kind === kind,
      );
      const fee = certificateFee(p, path, kind);
      const payment =
        kind === 'funding' || kind === 'venture'
          ? undefined
          : paymentFor(p.training, kind, path.id);
      return (
        <div key={id} className="training-status">
          <p>
            <strong>
              {student ? `${student.name} · ` : ''}
              {title}
            </strong>{' '}
            ·{' '}
            {issued
              ? 'Issued'
              : payment?.status === 'pending'
                ? 'Payment under review'
                : !fee || payment?.status === 'confirmed'
                  ? 'Awaiting administrator approval'
                  : payment?.status === 'declined'
                    ? 'Payment declined'
                    : 'Payment due'}
          </p>
          {issued && <Link to={`/certificates/${issued.id}`}>View certificate</Link>}
          {!issued &&
            fee > 0 &&
            kind !== 'funding' &&
            kind !== 'venture' &&
            (!payment || payment.status === 'declined') && (
              <button
                type="button"
                className="button button-outline"
                onClick={() =>
                  submitTraining(save, {
                    type: 'training-payment-request',
                    id: crypto.randomUUID(),
                    purpose: kind,
                    targetId: path.id,
                  })
                }
              >
                Record demo payment · {amount(fee)}
              </button>
            )}
        </div>
      );
    });
}

export function ProductPathways({
  p,
  product,
  save,
}: {
  p: PlatformState;
  product: Product;
  save: Save;
}) {
  const path = p.incubations.find(
    (item) =>
      item.ventureId === product.ventureId &&
      (item.status === 'completed' ||
        (item.status === 'active' && item.productIds?.includes(product.id))),
  );
  const review = p.training.productReviews.find((row) => row.productId === product.id);
  const payment = paymentFor(p.training, 'marketplace', product.id);
  const visible = canPublishProduct(p, product);
  return (
    <div className="training-status">
      <p>
        <strong>{visible ? 'Live in marketplace' : 'Private listing'}</strong> · Listing moderation:{' '}
        {product.status}
      </p>
      {visible && <Link to={`/marketplace/product-${product.id}`}>View public listing</Link>}
      {review && (
        <p>
          Product evidence · {review.status}
          {review.feedback && ` · ${review.feedback}`}
        </p>
      )}
      {path && (!review || review.status === 'rejected') && (
        <div>
          <TrainingForm
            save={save}
            label="Send product for review"
            dialog={{
              action: path.productIds?.includes(product.id)
                ? 'Submit product evidence'
                : 'Request targeted product review',
            }}
            build={(data) => ({
              type: 'product-evidence',
              productId: product.id,
              evidence: field(data, 'evidence'),
            })}
          >
            <label>
              Customer test or product evidence{' '}
              <textarea
                name="evidence"
                minLength={10}
                maxLength={3000}
                required
                defaultValue={review?.evidence}
              />
            </label>
          </TrainingForm>
        </div>
      )}
      {!path && !visible && (
        <p>
          Include this product when launching the venture or submit it for review after graduation.
        </p>
      )}
      {payment && (
        <p>
          Listing payment · {payment.status} · {amount(payment.amount)}
        </p>
      )}
      {!visible &&
        !productClearedByIncubation(p, product) &&
        product.status !== 'rejected' &&
        p.ventures.some((v) => v.id === product.ventureId && v.status === 'approved') &&
        p.training.bypassEnabled &&
        (!payment || payment.status === 'declined') && (
          <button
            type="button"
            className="button button-outline"
            onClick={() =>
              submitTraining(save, {
                type: 'training-payment-request',
                id: crypto.randomUUID(),
                purpose: 'marketplace',
                targetId: product.id,
              })
            }
          >
            Record paid listing · {amount(p.training.fees.marketplace)}
          </button>
        )}
      {!visible && payment?.status === 'confirmed' && (
        <p>Payment is confirmed. The listing goes live when moderation is approved.</p>
      )}
    </div>
  );
}
