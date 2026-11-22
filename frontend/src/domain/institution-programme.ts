import type { DemoAccount } from './demo';
import {
  activeIncubationPartner,
  certificateFee,
  completedStage,
  credentialKinds,
  credentialReady,
  getStage,
  institutionAccess,
  paymentFor,
  stageIds,
  stageUnlocked,
  type CredentialKind,
  type StageId,
  type StageWork,
} from './incubation.ts';
import { institutionProgrammeMembers } from './institution-members.ts';
import type { Incubation, PlatformState, Venture } from './platform';
import { can } from './roles.ts';

const activityLabels: Record<string, string> = {
  'venture-save': 'Venture saved',
  'venture-review': 'Venture reviewed',
  'incubation-apply': 'Pathway submitted',
  'incubation-assign': 'Pathway decision recorded',
  'incubation-complete': 'Pathway completed',
  'stage-evidence': 'Evidence saved',
  'stage-feedback': 'Mentor feedback recorded',
  'stage-request': 'Stage review requested',
  'stage-meeting': 'Mentor meeting scheduled',
  'stage-revise': 'Revisions requested',
  'stage-open-exam': 'Assessment opened',
  'stage-take-exam': 'Assessment submitted',
  'stage-grade': 'Assessment graded',
};

export type ProgrammeStage = {
  id: StageId;
  title: string;
  action: string;
  evidence: string;
};

export const programmePaymentLabels = {
  due: 'Payment needed',
  pending: 'Awaiting confirmation',
  confirmed: 'Confirmed',
  declined: 'Declined',
  free: 'No fee',
} as const;

export type ProgrammeCertificate = {
  kind: CredentialKind;
  title: string;
  amount: number;
  payment: keyof typeof programmePaymentLabels;
  issuedAt: string;
};

export type ProgrammeVenture = {
  id: string;
  name: string;
  mentor: string;
  stage: ProgrammeStage | undefined;
  stages: ProgrammeStage[];
  action: string;
  assessments: number;
  activity: { id: string; title: string; stage?: string; at: string }[];
  certificates: ProgrammeCertificate[];
};

export type ProgrammeMember = {
  id: string;
  name: string;
  email: string;
  ventures: ProgrammeVenture[];
};

function stageAction(work: StageWork | undefined, saved: number, required: number, owner: string) {
  if (work?.attempts.some((attempt) => attempt.learnerId === owner && attempt.score === null))
    return 'Awaiting grading';
  if (work?.examOpenedAt) return 'Assessment open';
  if (work?.meetingAt) return 'Mentor meeting scheduled';
  if (work?.reviewRequestedAt) return 'Awaiting mentor review';
  if (work?.meetingNote) return 'Revisions requested';
  if (!saved) return 'Prepare stage work';
  return saved === required ? 'Ready to request review' : 'Evidence in progress';
}

function nextAction(venture: Venture, path: Incubation | undefined, stage?: ProgrammeStage) {
  if (path?.status === 'completed') return 'Pathway completed';
  if (path?.status === 'active') return stage?.action ?? 'All stages assessed';
  if (path?.status === 'pending') return 'Awaiting mentor assignment';
  if (venture.status === 'pending') return 'Awaiting venture approval';
  if (venture.status === 'rejected') return 'Revise venture';
  if (path?.status === 'rejected') return 'Pathway declined';
  return 'Launch pathway';
}

export function institutionProgramme(
  p: PlatformState,
  accounts: DemoAccount[],
  institutionId: string,
  operator: DemoAccount,
) {
  const institution = activeIncubationPartner(p, institutionId);
  if (!institution) return null;
  const access = can(operator, 'admin') ? 'manage' : institutionAccess(institution, operator);
  if (!access) return null;
  const canViewPayments = access === 'manage';
  const memberAccounts = institutionProgrammeMembers(p, accounts, institution.id);
  const memberIds = new Set(memberAccounts.map(({ id }) => id));
  const mentors = new Map(accounts.map(({ id, name }) => [id, name]));
  const paths = new Map<string, Incubation>();
  for (const path of p.incubations) {
    if (memberIds.has(path.ownerId) && paths.get(path.ventureId)?.status !== 'completed')
      paths.set(path.ventureId, path);
  }
  const activityByTarget = new Map<string, PlatformState['audit']>();
  for (const entry of p.audit) {
    if (!Object.hasOwn(activityLabels, entry.action)) continue;
    const list = activityByTarget.get(entry.targetId) ?? [];
    list.push(entry);
    activityByTarget.set(entry.targetId, list);
  }
  const programmes = new Map<string, ProgrammeVenture[]>();
  for (const venture of p.ventures) {
    if (venture.groupId || !memberIds.has(venture.ownerId)) continue;
    const path = paths.get(venture.id);
    const learner = venture.ownerId;
    const curriculum = p.training.curriculum;
    const stages = stageIds.map((id): ProgrammeStage => {
      const definition = curriculum.find((row) => row.id === id);
      const work = path && getStage(p.training, path.id, id);
      const required = definition?.steps ?? [];
      const saved = required.filter((step) => work?.steps.some((row) => row.id === step.id)).length;
      const complete = path && completedStage(p.training, path.id, id, learner);
      const unlocked = path?.status === 'active' && stageUnlocked(p, path, id, learner);
      return {
        id,
        title: definition?.title ?? id,
        action: complete
          ? 'Complete'
          : unlocked
            ? stageAction(work, saved, required.length, learner)
            : 'Locked',
        evidence: `${saved} / ${required.length}`,
      };
    });
    const stage = stages.find(({ action }) => action !== 'Complete' && action !== 'Locked');
    const targets = [
      { id: venture.id, stage: undefined },
      ...(path
        ? [
            { id: path.id, stage: undefined },
            ...stages.map(({ id, title }) => ({
              id: getStage(p.training, path.id, id)?.id ?? '',
              stage: title,
            })),
          ]
        : []),
    ];
    const activity = targets
      .flatMap((target) =>
        (activityByTarget.get(target.id) ?? []).map((entry) => ({
          id: entry.id,
          title: activityLabels[entry.action]!,
          stage: target.stage,
          at: entry.createdAt,
        })),
      )
      .sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
    const certificates =
      path && canViewPayments
        ? credentialKinds.flatMap((kind): ProgrammeCertificate[] => {
            if (!credentialReady(p, path, learner, kind)) return [];
            const issued = p.training.credentials.find(
              (row) =>
                row.incubationId === path.id && row.learnerId === learner && row.kind === kind,
            );
            const charge =
              kind === 'getting-started' || kind === 'advanced'
                ? paymentFor(p.training, kind, path.id)
                : undefined;
            const payment =
              charge?.accountId === learner && (!issued || charge.status === 'confirmed')
                ? charge
                : undefined;
            const fee = issued ? 0 : certificateFee(p, path, kind);
            return [
              {
                kind,
                title:
                  kind === 'venture'
                    ? 'Venture incubation certificate'
                    : `${stages.find(({ id }) => id === kind)?.title ?? kind} certificate`,
                amount: payment?.amount ?? fee,
                payment: payment?.status ?? (fee > 0 ? 'due' : 'free'),
                issuedAt: issued?.issuedAt ?? '',
              },
            ];
          })
        : [];
    const ventures = programmes.get(learner) ?? [];
    ventures.push({
      id: venture.id,
      name: venture.name,
      mentor: mentors.get(path?.mentorId ?? '') ?? '',
      stage,
      stages,
      action: nextAction(venture, path, stage),
      assessments: stages.filter(({ action }) => action === 'Complete').length,
      activity,
      certificates,
    });
    programmes.set(learner, ventures);
  }
  const members: ProgrammeMember[] = memberAccounts.map(({ id, name, email }) => ({
    id,
    name,
    email,
    ventures: programmes.get(id) ?? [],
  }));
  return { members, canViewPayments };
}
