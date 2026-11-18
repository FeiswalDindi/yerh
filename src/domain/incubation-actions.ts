import type { DemoAccount } from './demo';
import type { PlatformState } from './platform';
import { can } from './roles.ts';
import {
  certificateFee,
  credentialReady,
  feePurposes,
  finishedIncubation,
  getStage,
  incubationLearners,
  managesVenture,
  passedStage,
  paymentFor,
  productClearedByIncubation,
  schoolForVenture,
  stageIds,
  stageUnlocked,
  type TrainingAction,
} from './incubation.ts';

const trainingActionTypes = {
  'stage-evidence': true,
  'stage-feedback': true,
  'stage-request': true,
  'stage-meeting': true,
  'stage-open-exam': true,
  'stage-revise': true,
  'stage-take-exam': true,
  'stage-grade': true,
  'stage-offline-result': true,
  'training-credential-issue': true,
  'training-fees-save': true,
  'training-payment-request': true,
  'training-payment-review': true,
  'product-evidence': true,
  'product-evidence-review': true,
  'institution-create': true,
  'institution-proof': true,
  'institution-activate': true,
  'institution-story': true,
  'institution-student': true,
  'institution-profile': true,
  'institution-group': true,
  'institution-affiliation': true,
  'institution-class': true,
  'institution-contribution': true,
  'institution-contributions': true,
} satisfies Record<TrainingAction['type'], true>;

export function isTrainingAction(action: { type: string }): action is TrainingAction {
  return Object.hasOwn(trainingActionTypes, action.type);
}

function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function text(value: string, min: number, max = 3000) {
  const clean = value.trim();
  check(clean.length >= min && clean.length <= max, `Enter between ${min} and ${max} characters.`);
  return clean;
}

const money = (amount: number) => Number.isSafeInteger(amount) && amount >= 0;
const validScore = (score: number) => Number.isInteger(score) && score >= 0 && score <= 100;

export function applyTrainingAction(
  p: PlatformState,
  accounts: DemoAccount[],
  actor: DemoAccount,
  action: TrainingAction,
): string {
  const t = p.training;
  const admin = can(actor, 'admin');
  const now = action.now;
  const ownSchool = t.institutions.find((school) => school.adminId === actor.id);
  const isSchoolAdmin =
    can(actor, 'school') && ownSchool?.status === 'active' && ownSchool.kind === 'high-school';

  if ('stage' in action) {
    const path = p.incubations.find((i) => i.id === action.incubationId);
    check(
      path && (path.status === 'active' || path.status === 'completed'),
      'This incubation is awaiting approval.',
    );
    const venture = p.ventures.find((v) => v.id === path.ventureId);
    const institution = schoolForVenture(p, venture);
    const mentor = can(actor, 'mentor') && actor.id === path.mentorId;
    const owner = managesVenture(p, actor, venture);
    check(owner || mentor, 'You do not have access to this incubation.');
    const definition = t.curriculum.find((stage) => stage.id === action.stage);
    check(definition && stageUnlocked(p, path, action.stage), 'Pass the previous stage first.');
    let work = getStage(t, path.id, action.stage);
    if (!work) {
      work = {
        id: `${path.id}:${action.stage}`,
        incubationId: path.id,
        stage: action.stage,
        steps: [],
        reviewRequestedAt: '',
        meetingAt: '',
        meetingNote: '',
        examOpenedAt: '',
        attempts: [],
      };
      t.stages.push(work);
    }
    switch (action.type) {
      case 'stage-evidence': {
        check(
          owner && !work.reviewRequestedAt && !work.examOpenedAt,
          'This stage is under review.',
        );
        check(
          definition.steps.some((step) => step.id === action.stepId),
          'Unknown step.',
        );
        const prior = work.steps.find((step) => step.id === action.stepId);
        work.steps = [
          ...work.steps.filter((step) => step.id !== action.stepId),
          {
            id: action.stepId,
            evidence: text(action.evidence, 10),
            requested: action.requestFeedback,
            feedback: prior?.feedback ?? '',
          },
        ];
        break;
      }
      case 'stage-feedback': {
        const step = work.steps.find((item) => item.id === action.stepId);
        check(mentor && step?.requested, 'This step has no feedback request assigned to you.');
        step.feedback = text(action.feedback, 5);
        step.requested = false;
        break;
      }
      case 'stage-request':
        check(
          owner &&
            !work.reviewRequestedAt &&
            !work.examOpenedAt &&
            definition.steps.every((step) => work.steps.some((saved) => saved.id === step.id)),
          'Save every required step before requesting a review.',
        );
        work.reviewRequestedAt = now;
        work.meetingNote = '';
        break;
      case 'stage-meeting':
        check(
          mentor &&
            work.reviewRequestedAt &&
            !work.examOpenedAt &&
            Number.isFinite(Date.parse(action.meetingAt)),
          'Choose a meeting time for this stage review.',
        );
        work.meetingAt = action.meetingAt;
        work.meetingLocation = action.location ? text(action.location, 3, 300) : '';
        break;
      case 'stage-revise':
      case 'stage-open-exam':
        check(
          mentor && work.reviewRequestedAt && work.meetingAt && !work.examOpenedAt,
          'Schedule the mentor review before recording its outcome.',
        );
        work.meetingNote = text(action.note, 5);
        if (action.type === 'stage-open-exam') work.examOpenedAt = now;
        else {
          work.reviewRequestedAt = '';
          work.meetingAt = '';
          work.meetingLocation = '';
        }
        break;
      case 'stage-take-exam':
      case 'stage-offline-result': {
        const offline = action.type === 'stage-offline-result';
        const learnerId = offline ? action.learnerId : actor.id;
        check(
          owner && (offline ? !!institution : !institution) && work.examOpenedAt,
          'An authorized exam is required.',
        );
        check(
          incubationLearners(p, path).includes(learnerId) &&
            stageUnlocked(p, path, action.stage, learnerId),
          'The learner must pass the earlier stages first.',
        );
        check(
          !passedStage(t, path.id, action.stage, learnerId) &&
            !work.attempts.some(
              (attempt) =>
                attempt.id === action.attemptId ||
                (attempt.learnerId === learnerId && attempt.score === null),
            ),
          'A passing or ungraded attempt already exists.',
        );
        if (offline) check(validScore(action.score), 'Enter a whole-number score from 0 to 100.');
        work.attempts.push({
          id: action.attemptId,
          learnerId,
          recordedBy: actor.id,
          submittedAt: now,
          answer: offline ? '' : text(action.answer, 10),
          score: offline ? action.score : null,
          note: offline ? text(action.note, 5) : '',
        });
        break;
      }
      case 'stage-grade': {
        const attempt = work.attempts.find((row) => row.id === action.attemptId);
        check(mentor && attempt?.score === null, 'Choose an ungraded attempt assigned to you.');
        check(validScore(action.score), 'Enter a whole-number score from 0 to 100.');
        attempt.score = action.score;
        attempt.note = text(action.note, 5);
        break;
      }
    }
    return work.id;
  }
  switch (action.type) {
    case 'training-credential-issue': {
      check(admin, 'Only a platform administrator can issue certificates.');
      const path = p.incubations.find((i) => i.id === action.incubationId);
      check(
        stageIds.some((stage) => stage === action.kind) || action.kind === 'venture',
        'Unknown certificate.',
      );
      check(
        path && credentialReady(p, path, action.learnerId, action.kind),
        'The learner must pass all required stages.',
      );
      check(
        !t.credentials.some(
          (c) =>
            c.id === action.id ||
            (c.incubationId === path.id &&
              c.learnerId === action.learnerId &&
              c.kind === action.kind),
        ),
        'This certificate has already been issued.',
      );
      const payment =
        action.kind === 'funding' || action.kind === 'venture'
          ? undefined
          : paymentFor(t, action.kind, path.id);
      check(
        certificateFee(p, path, action.kind) === 0 || payment?.status === 'confirmed',
        'Confirm the stage certificate payment first.',
      );
      t.credentials.push({
        id: action.id,
        incubationId: path.id,
        learnerId: action.learnerId,
        kind: action.kind,
        issuedBy: actor.id,
        issuedAt: now,
      });
      if (action.kind === 'venture' && path.status === 'active') path.status = 'completed';
      return action.id;
    }
    case 'training-fees-save':
      check(
        admin && feePurposes.every((key) => money(action.fees[key])) && action.fees.marketplace > 0,
        'Only an administrator can set non-negative fees. Paid listings require a positive fee.',
      );
      t.fees = {
        'getting-started': action.fees['getting-started'],
        advanced: action.fees.advanced,
        marketplace: action.fees.marketplace,
      };
      t.bypassEnabled = action.bypassEnabled;
      return 'training-fees';
    case 'training-payment-request': {
      check(
        can(actor, 'venture') && feePurposes.includes(action.purpose),
        'A venture account is required.',
      );
      const current = paymentFor(t, action.purpose, action.targetId);
      check(
        !current || current.status === 'declined',
        'A payment is already recorded for this item.',
      );
      check(!t.payments.some((payment) => payment.id === action.id), 'Duplicate payment ID.');
      let amount: number;
      if (action.purpose === 'marketplace') {
        const product = p.products.find(
          (row) => row.id === action.targetId && row.ownerId === actor.id,
        );
        const venture = p.ventures.find((row) => row.id === product?.ventureId);
        check(
          t.bypassEnabled &&
            product &&
            product.status !== 'rejected' &&
            venture?.status === 'approved' &&
            managesVenture(p, actor, venture),
          'This product is ineligible for paid listing.',
        );
        check(!productClearedByIncubation(p, product), 'Incubation already covers this product.');
        amount = t.fees.marketplace;
      } else {
        const path = p.incubations.find(
          (row) => row.id === action.targetId && row.ownerId === actor.id,
        );
        check(
          path && credentialReady(p, path, actor.id, action.purpose),
          'Pass the stage exam before requesting a certificate payment.',
        );
        check(
          !t.credentials.some(
            (c) =>
              c.incubationId === path.id && c.learnerId === actor.id && c.kind === action.purpose,
          ),
          'This certificate has already been issued.',
        );
        amount = certificateFee(p, path, action.purpose);
      }
      check(amount > 0, 'This item has no fee.');
      t.payments.push({
        id: action.id,
        accountId: actor.id,
        purpose: action.purpose,
        targetId: action.targetId,
        amount,
        status: 'pending',
        submittedAt: now,
      });
      return action.id;
    }
    case 'training-payment-review': {
      const payment = t.payments.find((row) => row.id === action.id);
      check(
        admin &&
          payment?.status === 'pending' &&
          ['confirmed', 'declined'].includes(action.decision),
        'Choose a pending payment to review.',
      );
      payment.status = action.decision;
      return payment.id;
    }
    case 'product-evidence': {
      const product = p.products.find(
        (row) => row.id === action.productId && row.ownerId === actor.id,
      );
      const venture = p.ventures.find((row) => row.id === product?.ventureId);
      const path = p.incubations.find(
        (row) =>
          row.ventureId === venture?.id &&
          (row.status === 'completed' ||
            (row.status === 'active' && row.productIds?.includes(action.productId))),
      );
      check(
        product && path && managesVenture(p, actor, venture),
        'Select this product at launch or submit it after venture graduation.',
      );
      check(
        !t.productReviews.some(
          (review) => review.productId === product.id && review.status !== 'rejected',
        ),
        'This product already has a submitted or approved review.',
      );
      t.productReviews = t.productReviews.filter((review) => review.productId !== product.id);
      t.productReviews.push({
        productId: product.id,
        incubationId: path.id,
        evidence: text(action.evidence, 10),
        status: 'pending',
        feedback: '',
      });
      return product.id;
    }
    case 'product-evidence-review': {
      const review = t.productReviews.find((row) => row.productId === action.productId);
      const path = p.incubations.find((row) => row.id === review?.incubationId);
      check(
        review?.status === 'pending' &&
          path &&
          (admin || (can(actor, 'mentor') && path.mentorId === actor.id)),
        'This product review is not assigned to you.',
      );
      check(
        action.decision === 'approved' || action.decision === 'rejected',
        'Choose a review decision.',
      );
      review.feedback = text(action.feedback, 5);
      review.status = action.decision;
      return action.productId;
    }
    case 'institution-create':
      check(
        admin && accounts.some((a) => a.id === action.adminId && can(a, 'school')),
        'Select an active institutional administrator.',
      );
      check(
        ['high-school', 'university'].includes(action.kind) && money(action.amount),
        'Enter a valid institution type and amount.',
      );
      check(
        !t.institutions.some(
          (i) =>
            i.id === action.id ||
            i.adminId === action.adminId ||
            i.name.toLowerCase() === action.name.trim().toLowerCase(),
        ),
        'This institution or administrator is already assigned.',
      );
      t.institutions.push({
        id: action.id,
        name: text(action.name, 3, 120),
        kind: action.kind,
        adminId: action.adminId,
        amount: action.amount,
        status: 'pending',
        proof: null,
        story: '',
        featured: false,
      });
      return action.id;
    case 'institution-proof':
    case 'institution-activate':
    case 'institution-story': {
      const institution = t.institutions.find((row) => row.id === action.id);
      check(institution, 'Institution unavailable.');
      if (action.type === 'institution-proof') {
        check(
          institution.status === 'pending' &&
            (admin || (can(actor, 'school') && institution.adminId === actor.id)),
          'Only an authorized administrator can upload an agreement.',
        );
        check(
          action.data.length <= 350000 &&
            /^data:application\/pdf;base64,JVBERi0[A-Za-z0-9+/=]*$/.test(action.data),
          'Upload a demonstration PDF no larger than 250 KB.',
        );
        institution.proof = { name: text(action.name, 5, 140), data: action.data };
      } else if (action.type === 'institution-activate') {
        check(
          admin && institution.status === 'pending' && institution.proof,
          'Review the signed agreement and proof before activating.',
        );
        institution.status = 'active';
      } else {
        check(
          admin && institution.status === 'active',
          'Activate the institution before featuring it.',
        );
        institution.story = action.featured
          ? text(action.story, 20)
          : action.story.trim().slice(0, 3000);
        institution.featured = action.featured;
      }
      return institution.id;
    }
    case 'institution-student':
      check(
        isSchoolAdmin && ownSchool && !t.students.some((s) => s.id === action.id),
        'An active high school portal is required.',
      );
      t.students.push({
        id: action.id,
        institutionId: ownSchool.id,
        name: text(action.name, 2, 120),
      });
      return action.id;
    case 'institution-profile': {
      const student = t.students.find(
        (row) => row.id === action.id && row.institutionId === ownSchool?.id,
      );
      check(isSchoolAdmin && student, 'Choose a student from your active high school.');
      student.profileDraft = {
        headline: text(action.headline, 3, 120),
        about: text(action.about, 10, 1000),
        skills: text(action.skills, 3, 400),
      };
      return student.id;
    }
    case 'institution-group': {
      check(
        isSchoolAdmin && ownSchool && !t.groups.some((group) => group.id === action.id),
        'An active high school portal is required.',
      );
      const studentIds = [...new Set(action.studentIds)];
      check(
        studentIds.length >= 2 &&
          studentIds.every((id) =>
            t.students.some((s) => s.id === id && s.institutionId === ownSchool.id),
          ),
        'Choose at least two students from your high school.',
      );
      t.groups.push({
        id: action.id,
        institutionId: ownSchool.id,
        name: text(action.name, 3, 120),
        studentIds,
      });
      return action.id;
    }
    case 'institution-class': {
      const group = t.groups.find(
        (row) => row.id === action.groupId && row.institutionId === ownSchool?.id,
      );
      check(
        isSchoolAdmin && group && !t.classes.some((row) => row.id === action.id),
        'Choose a group from your active high school.',
      );
      check(
        /^\d{4}-\d{2}-\d{2}$/.test(action.date) && Number.isFinite(Date.parse(action.date)),
        'Choose the date of the offline class.',
      );
      const attendance = [...new Set(action.attendance)];
      check(
        attendance.every((id) => group.studentIds.includes(id)),
        'Attendance must refer to students in this group.',
      );
      t.classes.push({
        id: action.id,
        groupId: group.id,
        date: action.date,
        challenge: text(action.challenge, 10),
        attendance,
      });
      return action.id;
    }
    case 'institution-contribution':
    case 'institution-contributions': {
      const venture = p.ventures.find(
        (row) => row.id === action.ventureId && row.ownerId === actor.id,
      );
      const group = t.groups.find(
        (row) => row.id === venture?.groupId && row.institutionId === ownSchool?.id,
      );
      check(isSchoolAdmin && venture && group, 'Choose a venture from your school.');
      const entries = action.type === 'institution-contribution' ? [action] : action.entries;
      check(entries.length > 0, 'Enter at least one contribution before saving.');
      const learnerIds = new Set(entries.map((entry) => entry.learnerId));
      check(
        learnerIds.size === entries.length &&
          entries.every((entry) => group.studentIds.includes(entry.learnerId)),
        'Choose distinct students from this venture group.',
      );
      const notes = entries.map(({ learnerId, evidence }) => ({
        ventureId: venture.id,
        learnerId,
        evidence: text(evidence, 10),
      }));
      t.contributions = [
        ...t.contributions.filter(
          (row) => row.ventureId !== venture.id || !learnerIds.has(row.learnerId),
        ),
        ...notes,
      ];
      return venture.id;
    }
    case 'institution-affiliation':
      check(
        can(actor, 'learn') &&
          t.institutions.some(
            (i) => i.id === action.id && i.kind === 'university' && i.status === 'active',
          ),
        'Choose an active university.',
      );
      t.affiliations[actor.id] = action.id;
      return action.id;
  }
}

export function canGraduate(p: PlatformState, path: PlatformState['incubations'][number]) {
  return path.status === 'active' && finishedIncubation(p, path);
}
