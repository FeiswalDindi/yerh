import type { Incubation, PlatformState, Product, Venture } from './platform';
import type { DemoAccount } from './demo';
import { can, type Role } from './roles.ts';

export const stageIds = ['getting-started', 'advanced', 'funding'] as const;
export type StageId = (typeof stageIds)[number];
export type CredentialKind = StageId | 'venture';
export const feePurposes = ['getting-started', 'advanced', 'marketplace'] as const;
export type FeePurpose = (typeof feePurposes)[number];
export const feeLabels: Record<FeePurpose, string> = {
  'getting-started': 'Getting Started certificate',
  advanced: 'Intermediate / Advanced certificate',
  marketplace: 'Marketplace listing without incubation',
};
export const passMark = 50;
export const schoolCertificateClassifications = [
  { minimum: 70, label: 'First Class' },
  { minimum: 60, label: 'Second Class Upper' },
  { minimum: passMark, label: 'Second Class Lower' },
  { minimum: 0, label: 'Completion' },
] as const;

export interface StageDefinition {
  id: StageId;
  title: string;
  resourceTopic: StageId | 'startups';
  steps: { id: string; title: string; instruction: string }[];
  examPrompt: string;
}

export interface StageWork {
  id: string;
  incubationId: string;
  stage: StageId;
  steps: { id: string; evidence: string; requested: boolean; feedback: string }[];
  reviewRequestedAt: string;
  meetingAt: string;
  meetingLocation?: string;
  meetingNote: string;
  schoolReviewNote?: string;
  examOpenedAt: string;
  attempts: {
    id: string;
    learnerId: string;
    answer: string;
    score: number | null;
    note: string;
    recordedBy: string;
    submittedAt: string;
    corrections?: { previousScore: number; correctedBy: string; correctedAt: string }[];
  }[];
}

export interface IncubationCredential {
  id: string;
  incubationId: string;
  learnerId: string;
  kind: CredentialKind;
  issuedAt: string;
  issuedBy: string;
  schoolScore?: number;
}

export const institutionKindLabels = {
  'high-school': 'High school',
  university: 'University',
  hub: 'Hub',
} as const;

export interface Institution {
  id: string;
  name: string;
  kind: keyof typeof institutionKindLabels;
  adminId: string;
  amount: number;
  status: 'pending' | 'active' | 'inactive';
  proof: { name: string; data: string } | null;
  story: string;
  featured: boolean;
  contactIds?: string[];
  staffIds?: string[];
  intake?: { notes: string; visit: string; terms: string };
  agreements?: Agreement[];
}

export function supportsIndividualIncubation(institution: Institution) {
  return institution.kind === 'university' || institution.kind === 'hub';
}

export function accountInstitution(p: PlatformState, accountId: string) {
  return (
    p.training.institutions.find((institution) => institution.adminId === accountId) ??
    p.training.institutions.find(
      (institution) => institution.id === p.training.affiliations[accountId],
    )
  );
}

export function availableInstitutionAdministrators(
  p: PlatformState,
  accounts: DemoAccount[],
  institutionId?: string,
) {
  return accounts.filter((account) => {
    if (!can(account, 'school')) return false;
    const affiliation = accountInstitution(p, account.id);
    return !affiliation || (affiliation.id === institutionId && affiliation.adminId !== account.id);
  });
}

export function activeIncubationPartner(p: PlatformState, id: string | undefined) {
  return p.training.institutions.find(
    (institution) =>
      institution.id === id &&
      institution.status === 'active' &&
      supportsIndividualIncubation(institution),
  );
}
export type Agreement = {
  id: string;
  name: string;
  data: string;
  addedAt: string;
  addedBy: string;
  amount: number;
  terms: string;
};
export type StudentDetails = {
  age?: number;
  gender?: string;
  form?: string;
  stream?: string;
  admissionNumber?: string;
};
export type Cohort = {
  id: string;
  institutionId: string;
  name: string;
  startsOn: string;
  endsOn: string;
  incubationIds: string[];
};
export type CertificateSelection = {
  incubationId: string;
  learnerId: string;
  kind: CredentialKind;
};
export type CertificateRequest = CertificateSelection & {
  requestedBy: string;
  requestedAt: string;
  status?: 'pending' | 'rejected';
  rejections?: { reason: string; reviewedBy: string; reviewedAt: string }[];
};
export const credentialKinds: CredentialKind[] = [...stageIds, 'venture'];
export function certificateKey(entry: CertificateSelection) {
  return JSON.stringify([entry.incubationId, entry.learnerId, entry.kind]);
}

export interface TrainingState {
  curriculum: StageDefinition[];
  stages: StageWork[];
  fees: Record<FeePurpose, number>;
  bypassEnabled: boolean;
  payments: {
    id: string;
    accountId: string;
    purpose: FeePurpose;
    targetId: string;
    amount: number;
    status: 'pending' | 'confirmed' | 'declined';
    submittedAt: string;
  }[];
  credentials: IncubationCredential[];
  productReviews: {
    productId: string;
    incubationId: string;
    evidence: string;
    status: 'pending' | 'approved' | 'rejected';
    feedback: string;
  }[];
  institutions: Institution[];
  students: (StudentDetails & {
    id: string;
    institutionId: string;
    name: string;
    profileDraft?: { headline: string; about: string; skills: string };
  })[];
  cohorts?: Cohort[];
  certificateRequests?: CertificateRequest[];
  groups: { id: string; institutionId: string; name: string; studentIds: string[] }[];
  classes: {
    id: string;
    groupId: string;
    groupIds?: string[];
    date: string;
    challenge: string;
    attendance: string[];
  }[];
  affiliations: Record<string, string>;
  yerhSignIn?: boolean;
}

export type TrainingCommand =
  | {
      type: 'stage-evidence';
      incubationId: string;
      stage: StageId;
      stepId: string;
      evidence: string;
      requestFeedback: boolean;
    }
  | {
      type: 'stage-feedback';
      incubationId: string;
      stage: StageId;
      stepId: string;
      feedback: string;
    }
  | { type: 'stage-request'; incubationId: string; stage: StageId }
  | { type: 'school-stage-open'; incubationId: string; stage: StageId }
  | {
      type: 'stage-meeting';
      incubationId: string;
      stage: StageId;
      meetingAt: string;
      location?: string;
    }
  | { type: 'stage-open-exam'; incubationId: string; stage: StageId; note: string }
  | { type: 'stage-revise'; incubationId: string; stage: StageId; note: string }
  | {
      type: 'stage-take-exam';
      incubationId: string;
      stage: StageId;
      attemptId: string;
      answer: string;
    }
  | {
      type: 'stage-grade';
      incubationId: string;
      stage: StageId;
      attemptId: string;
      score: number;
      note: string;
    }
  | {
      type: 'stage-offline-result';
      incubationId: string;
      stage: StageId;
      attemptId: string;
      learnerId: string;
      score: number;
      note: string;
    }
  | {
      type: 'stage-offline-score-edit';
      incubationId: string;
      stage: StageId;
      learnerId: string;
      attemptId: string;
      expectedScore: number;
      score: number;
    }
  | {
      type: 'training-credential-issue';
      id: string;
      incubationId: string;
      learnerId: string;
      kind: CredentialKind;
    }
  | { type: 'training-fees-save'; fees: TrainingState['fees']; bypassEnabled: boolean }
  | { type: 'training-payment-request'; id: string; purpose: FeePurpose; targetId: string }
  | { type: 'training-payment-review'; id: string; decision: 'confirmed' | 'declined' }
  | { type: 'product-evidence'; productId: string; evidence: string }
  | {
      type: 'product-evidence-review';
      productId: string;
      decision: 'approved' | 'rejected';
      feedback: string;
    }
  | {
      type: 'institution-create';
      id: string;
      name: string;
      kind: Institution['kind'];
      adminId: string;
      amount: number;
    }
  | { type: 'institution-assign-admin'; id: string; adminId: string }
  | { type: 'institution-proof'; id: string; name: string; data: string }
  | {
      type: 'institution-settings';
      id: string;
      contactIds: string[];
      staffIds: string[];
      amount: number;
      notes: string;
      visit: string;
      terms: string;
    }
  | { type: 'yerh-sign-in'; enabled: boolean }
  | { type: 'institution-activate'; id: string }
  | { type: 'institution-deactivate'; id: string }
  | {
      type: 'institution-access';
      id: string;
      accountId: string;
      access: 'view' | 'manage' | 'none';
    }
  | {
      type: 'institution-intake';
      id: string;
      notes: string;
      visit: string;
      terms: string;
      amount: number;
    }
  | { type: 'institution-story'; id: string; story: string; featured: boolean }
  | ({ type: 'institution-student'; id: string; name: string } & StudentDetails)
  | {
      type: 'institution-cohort';
      id: string;
      name: string;
      startsOn: string;
      endsOn: string;
      incubationIds: string[];
    }
  | { type: 'institution-certificates-request'; entries: CertificateSelection[] }
  | {
      type: 'school-credentials-issue';
      incubationId: string;
      kind: CredentialKind;
      recipients: { learnerId: string; id: string }[];
    }
  | {
      type: 'school-certificates-reject';
      incubationId: string;
      kind: CredentialKind;
      learnerIds: string[];
      reason: string;
    }
  | { type: 'institution-profile'; id: string; headline: string; about: string; skills: string }
  | { type: 'institution-group'; id: string; name: string; studentIds: string[] }
  | {
      type: 'institution-class';
      id: string;
      groupId?: string;
      groupIds?: string[];
      date: string;
      challenge: string;
      attendance: string[];
    };

export type TrainingAction = TrainingCommand & { now: string };

export function getStage(t: TrainingState, incubationId: string, stage: StageId) {
  return t.stages.find((work) => work.incubationId === incubationId && work.stage === stage);
}

export function schoolForVenture(p: PlatformState, venture: Venture | undefined) {
  const group = p.training.groups.find((g) => g.id === venture?.groupId);
  return p.training.institutions.find((school) => school.id === group?.institutionId);
}

export function cohortForVenture(p: PlatformState, venture: Venture) {
  const cohorts = (p.training.cohorts ?? []).filter(
    (cohort) => cohort.institutionId === schoolForVenture(p, venture)?.id,
  );
  if (venture.cohortId) return cohorts.find((cohort) => cohort.id === venture.cohortId);
  return cohorts.find((cohort) =>
    p.incubations.some(
      (path) => path.ventureId === venture.id && cohort.incubationIds.includes(path.id),
    ),
  );
}

export function institutionForPath(p: PlatformState, path: Incubation) {
  const venture = p.ventures.find((row) => row.id === path.ventureId);
  if (!venture) return undefined;
  if (venture.groupId) return schoolForVenture(p, venture);
  const affiliation = p.training.affiliations[path.ownerId];
  return p.training.institutions.find(
    (row) => row.id === affiliation && supportsIndividualIncubation(row),
  );
}

/** Release legacy approval holds for teams in already onboarded schools. */
export function migrateSchoolPathways(p: PlatformState) {
  const schoolVentureIds = new Set<string>();
  for (const venture of p.ventures) {
    const school = schoolForVenture(p, venture);
    if (
      school?.kind !== 'high-school' ||
      school.status !== 'active' ||
      school.adminId !== venture.ownerId
    )
      continue;
    schoolVentureIds.add(venture.id);
    if (venture.status === 'pending') venture.status = 'approved';
  }
  for (const path of p.incubations) {
    if (!schoolVentureIds.has(path.ventureId)) continue;
    if (path.status === 'pending') path.status = 'active';
    path.mentorId = '';
    const learners = incubationLearners(p, path);
    if (
      learners.length &&
      learners.every((learner) => credentialReady(p, path, learner, 'venture'))
    )
      path.status = 'completed';
    for (const record of p.training.credentials) {
      if (record.incubationId === path.id && record.schoolScore === undefined) {
        const score = schoolCertificateScore(p.training, record);
        if (score !== undefined) record.schoolScore = score;
      }
    }
  }
}

export function sameCertificate(a: CertificateSelection, b: CertificateSelection) {
  return a.incubationId === b.incubationId && a.learnerId === b.learnerId && a.kind === b.kind;
}

export function institutionAccess(
  school: Institution,
  actor: { id: string; role: Role; suspended?: boolean },
) {
  if (actor.suspended) return null;
  if (actor.id === school.adminId && can(actor, 'school')) return 'manage';
  if (school.status !== 'active' || !['guest', 'admin'].includes(actor.role)) return null;
  if (school.staffIds?.includes(actor.id)) return 'manage';
  if (school.contactIds?.includes(actor.id)) return 'view';
  return null;
}

export function managesVenture(
  p: PlatformState,
  actor: { id: string; role: Role; suspended?: boolean },
  venture: Venture | undefined,
): venture is Venture {
  if (!venture || !can(actor, 'venture') || venture.ownerId !== actor.id) return false;
  if (!venture.groupId) return !can(actor, 'school');
  const institution = schoolForVenture(p, venture);
  return (
    can(actor, 'school') && institution?.status === 'active' && institution.adminId === actor.id
  );
}

export function incubationLearners(p: PlatformState, incubation: Incubation) {
  const groupId = p.ventures.find((v) => v.id === incubation.ventureId)?.groupId;
  return groupId
    ? (p.training.groups.find((g) => g.id === groupId)?.studentIds ?? [])
    : [incubation.ownerId];
}

export function completedStage(
  t: TrainingState,
  incubationId: string,
  stage: StageId,
  learnerId: string,
) {
  return !!getStage(t, incubationId, stage)?.attempts.some(
    (attempt) => attempt.learnerId === learnerId && attempt.score !== null,
  );
}

export function stageUnlocked(
  p: PlatformState,
  incubation: Incubation,
  stage: StageId,
  learnerId?: string,
) {
  const previous = stageIds.slice(0, stageIds.indexOf(stage));
  const learners = learnerId ? [learnerId] : incubationLearners(p, incubation);
  return learners.some((id) =>
    previous.every((key) => completedStage(p.training, incubation.id, key, id)),
  );
}

export function finishedIncubation(p: PlatformState, incubation: Incubation) {
  return incubationLearners(p, incubation).some((id) =>
    credentialReady(p, incubation, id, 'venture'),
  );
}

export function paymentFor(t: TrainingState, purpose: FeePurpose, targetId: string) {
  return t.payments
    .filter((payment) => payment.purpose === purpose && payment.targetId === targetId)
    .at(-1);
}

export function certificateFee(p: PlatformState, incubation: Incubation, kind: CredentialKind) {
  if (kind === 'funding' || kind === 'venture') return 0;
  const venture = p.ventures.find((v) => v.id === incubation.ventureId);
  return venture?.groupId ? 0 : p.training.fees[kind];
}

export function certificateStages(kind: CredentialKind) {
  return stageIds.slice(0, kind === 'venture' ? stageIds.length : stageIds.indexOf(kind) + 1);
}

export function credentialReady(
  p: PlatformState,
  incubation: Incubation,
  learnerId: string,
  kind: CredentialKind,
) {
  return (
    (incubation.status === 'active' || incubation.status === 'completed') &&
    incubationLearners(p, incubation).includes(learnerId) &&
    certificateStages(kind).every((stage) =>
      completedStage(p.training, incubation.id, stage, learnerId),
    )
  );
}

export function schoolCertificateScore(t: TrainingState, entry: CertificateSelection) {
  const stages = entry.kind === 'venture' ? stageIds : [entry.kind];
  const scores = stages.map(
    (stage) =>
      getStage(t, entry.incubationId, stage)
        ?.attempts.filter(
          (attempt) => attempt.learnerId === entry.learnerId && attempt.score !== null,
        )
        .at(-1)?.score,
  );
  if (!scores.every((score): score is number => typeof score === 'number')) return undefined;
  return scores.reduce((total, score) => total + score, 0) / scores.length;
}

export function schoolDivision(score: number) {
  return (
    schoolCertificateClassifications.find(({ minimum }) => score >= minimum)?.label ??
    schoolCertificateClassifications.at(-1)!.label
  );
}

export function incubationCertificateQueue(p: PlatformState) {
  const issued = new Set(p.training.credentials.map(certificateKey));
  const requested = new Map(
    (p.training.certificateRequests ?? [])
      .filter((entry) => entry.status !== 'rejected')
      .map((entry) => [certificateKey(entry), entry]),
  );
  return p.incubations.flatMap((path) => {
    const school = !!schoolForVenture(
      p,
      p.ventures.find((venture) => venture.id === path.ventureId),
    );
    return incubationLearners(p, path).flatMap((learnerId) =>
      credentialKinds.flatMap((kind) => {
        const key = certificateKey({ incubationId: path.id, learnerId, kind });
        const request = school ? requested.get(key) : undefined;
        const eligible = credentialReady(p, path, learnerId, kind);
        if (issued.has(key) || (school ? !request : !eligible)) return [];
        const fee = certificateFee(p, path, kind);
        const payment =
          kind === 'getting-started' || kind === 'advanced'
            ? paymentFor(p.training, kind, path.id)
            : undefined;
        return [
          {
            key,
            path,
            learnerId,
            kind,
            fee,
            payment,
            request,
            ready: eligible && (fee === 0 || payment?.status === 'confirmed'),
          },
        ];
      }),
    );
  });
}

export function productClearedByIncubation(p: PlatformState, product: Product) {
  return p.training.productReviews.some(
    (review) =>
      review.productId === product.id &&
      review.status === 'approved' &&
      p.incubations.some(
        (path) =>
          path.id === review.incubationId &&
          path.ventureId === product.ventureId &&
          path.status === 'completed' &&
          finishedIncubation(p, path),
      ),
  );
}

export function canPublishProduct(p: PlatformState, product: Product) {
  const venture = p.ventures.find((v) => v.id === product.ventureId);
  return (
    product.status === 'approved' &&
    venture?.status === 'approved' &&
    !venture.groupId &&
    (paymentFor(p.training, 'marketplace', product.id)?.status === 'confirmed' ||
      productClearedByIncubation(p, product))
  );
}
