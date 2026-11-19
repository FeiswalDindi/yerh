import type { DemoAccount } from './demo';
import type { PlatformState } from './platform';
import {
  certificateKey,
  feePurposes,
  incubationLearners,
  institutionForPath,
  schoolForVenture,
  stageIds,
  type TrainingState,
} from './incubation.ts';

const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const fields = (value: unknown, keys: string[]): value is Record<string, unknown> =>
  record(value) && keys.every((key) => typeof value[key] === 'string');
const isStage = (value: unknown) => stageIds.some((id) => id === value);
const money = (value: unknown) =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const score = (value: unknown) =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 100;
const date = (value: string) => Number.isFinite(Date.parse(value));
const rows = (value: unknown, check: (item: unknown) => boolean) =>
  Array.isArray(value) && value.every(check);
const unique = (ids: string[]) => new Set(ids).size === ids.length;
const pdf = (value: unknown) =>
  typeof value === 'string' &&
  value.length <= 350000 &&
  /^data:application\/pdf;base64,JVBERi0[A-Za-z0-9+/=]*$/.test(value);

export function isTrainingState(value: unknown): value is TrainingState {
  if (!record(value) || !record(value.fees) || typeof value.bypassEnabled !== 'boolean')
    return false;
  const fees = value.fees;
  return (
    feePurposes.every((purpose) => money(fees[purpose])) &&
    Number(fees.marketplace) > 0 &&
    Array.isArray(value.curriculum) &&
    value.curriculum.length === stageIds.length &&
    value.curriculum.every(
      (stage, i) =>
        fields(stage, ['id', 'title', 'examPrompt', 'resourceTopic']) &&
        stage.id === stageIds[i] &&
        ['startups', 'advanced', 'funding'].includes(String(stage.resourceTopic)) &&
        rows(stage.steps, (step) => fields(step, ['id', 'title', 'instruction'])),
    ) &&
    rows(
      value.stages,
      (row) =>
        fields(row, [
          'id',
          'incubationId',
          'stage',
          'reviewRequestedAt',
          'meetingAt',
          'meetingNote',
          'examOpenedAt',
        ]) &&
        isStage(row.stage) &&
        (row.schoolReviewNote === undefined || typeof row.schoolReviewNote === 'string') &&
        (row.meetingLocation === undefined || typeof row.meetingLocation === 'string') &&
        rows(
          row.steps,
          (step) =>
            fields(step, ['id', 'evidence', 'feedback']) && typeof step.requested === 'boolean',
        ) &&
        rows(
          row.attempts,
          (attempt) =>
            fields(attempt, ['id', 'learnerId', 'answer', 'note', 'recordedBy', 'submittedAt']) &&
            (attempt.score === null || score(attempt.score)) &&
            (attempt.corrections === undefined ||
              (score(attempt.score) &&
                rows(
                  attempt.corrections,
                  (entry) =>
                    fields(entry, ['correctedBy', 'correctedAt']) && score(entry.previousScore),
                ))),
        ),
    ) &&
    rows(
      value.payments,
      (row) =>
        fields(row, ['id', 'accountId', 'purpose', 'targetId', 'status', 'submittedAt']) &&
        feePurposes.some((key) => key === row.purpose) &&
        ['pending', 'confirmed', 'declined'].includes(String(row.status)) &&
        money(row.amount) &&
        Number(row.amount) > 0,
    ) &&
    rows(
      value.credentials,
      (row) =>
        fields(row, ['id', 'incubationId', 'learnerId', 'kind', 'issuedAt', 'issuedBy']) &&
        (isStage(row.kind) || row.kind === 'venture') &&
        (row.schoolScore === undefined ||
          (typeof row.schoolScore === 'number' && row.schoolScore >= 0 && row.schoolScore <= 100)),
    ) &&
    rows(
      value.productReviews,
      (row) =>
        fields(row, ['productId', 'incubationId', 'evidence', 'status', 'feedback']) &&
        ['pending', 'approved', 'rejected'].includes(String(row.status)),
    ) &&
    rows(
      value.institutions,
      (row) =>
        fields(row, ['id', 'name', 'kind', 'adminId', 'status', 'story']) &&
        ['high-school', 'university'].includes(String(row.kind)) &&
        ['pending', 'active', 'inactive'].includes(String(row.status)) &&
        money(row.amount) &&
        typeof row.featured === 'boolean' &&
        (row.agreements === undefined ||
          rows(
            row.agreements,
            (agreement) =>
              fields(agreement, ['id', 'name', 'data', 'addedAt', 'addedBy', 'terms']) &&
              money(agreement.amount) &&
              pdf(agreement.data),
          )) &&
        [row.contactIds, row.staffIds].every(
          (ids) => ids === undefined || rows(ids, (id) => typeof id === 'string'),
        ) &&
        (row.intake === undefined || fields(row.intake, ['notes', 'visit', 'terms'])) &&
        (row.proof === null ||
          (fields(row.proof, ['name', 'data']) &&
            typeof row.proof.data === 'string' &&
            row.proof.data.length <= 350000 &&
            /^data:application\/pdf;base64,JVBERi0[A-Za-z0-9+/=]*$/.test(row.proof.data))),
    ) &&
    rows(
      value.students,
      (row) =>
        fields(row, ['id', 'institutionId', 'name']) &&
        (row.age === undefined ||
          (money(row.age) && Number(row.age) > 0 && Number(row.age) <= 120)) &&
        ['gender', 'form', 'stream', 'admissionNumber'].every(
          (key) => row[key] === undefined || typeof row[key] === 'string',
        ) &&
        (row.profileDraft === undefined ||
          fields(row.profileDraft, ['headline', 'about', 'skills'])),
    ) &&
    rows(
      value.groups,
      (row) =>
        fields(row, ['id', 'institutionId', 'name']) &&
        rows(row.studentIds, (id) => typeof id === 'string'),
    ) &&
    rows(
      value.classes,
      (row) =>
        fields(row, ['id', 'groupId', 'date', 'challenge']) &&
        (row.groupIds === undefined || rows(row.groupIds, (id) => typeof id === 'string')) &&
        rows(row.attendance, (id) => typeof id === 'string'),
    ) &&
    (value.cohorts === undefined ||
      rows(
        value.cohorts,
        (row) =>
          fields(row, ['id', 'institutionId', 'name', 'startsOn', 'endsOn']) &&
          rows(row.incubationIds, (id) => typeof id === 'string'),
      )) &&
    (value.certificateRequests === undefined ||
      rows(
        value.certificateRequests,
        (row) =>
          fields(row, ['incubationId', 'learnerId', 'kind', 'requestedBy', 'requestedAt']) &&
          (isStage(row.kind) || row.kind === 'venture') &&
          (row.status === undefined ||
            row.status === 'pending' ||
            (row.status === 'rejected' &&
              Array.isArray(row.rejections) &&
              row.rejections.length > 0)) &&
          (row.rejections === undefined ||
            rows(
              row.rejections,
              (entry) =>
                fields(entry, ['reason', 'reviewedBy', 'reviewedAt']) &&
                typeof entry.reason === 'string' &&
                entry.reason.trim().length >= 5 &&
                entry.reason.length <= 3000,
            )),
      )) &&
    (value.yerhSignIn === undefined || typeof value.yerhSignIn === 'boolean') &&
    record(value.affiliations) &&
    Object.values(value.affiliations).every((id) => typeof id === 'string')
  );
}

export function validTrainingReferences(p: PlatformState, accounts: DemoAccount[]) {
  const t = p.training;
  const accountIds = new Set(accounts.map((account) => account.id));
  const paths = new Map(p.incubations.map((path) => [path.id, path]));
  const products = new Map(p.products.map((product) => [product.id, product]));
  const institutions = new Map(t.institutions.map((institution) => [institution.id, institution]));
  return (
    unique((t.cohorts ?? []).map((row) => row.id)) &&
    (t.cohorts ?? []).every(
      (row) =>
        institutions.has(row.institutionId) &&
        unique(row.incubationIds) &&
        (!row.startsOn || date(row.startsOn)) &&
        (!row.endsOn || date(row.endsOn)) &&
        row.incubationIds.every((id) => {
          const path = paths.get(id);
          const venture = p.ventures.find((venture) => venture.id === path?.ventureId);
          return (
            !!path &&
            (!!venture?.groupId
              ? schoolForVenture(p, venture)?.id === row.institutionId
              : institutions.get(row.institutionId)?.kind === 'university')
          );
        }),
    ) &&
    unique((t.certificateRequests ?? []).map(certificateKey)) &&
    (t.certificateRequests ?? []).every((row) => {
      const path = paths.get(row.incubationId);
      return (
        path &&
        incubationLearners(p, path).includes(row.learnerId) &&
        accountIds.has(row.requestedBy) &&
        date(row.requestedAt) &&
        (!row.rejections ||
          row.rejections.every(
            (entry) => accountIds.has(entry.reviewedBy) && date(entry.reviewedAt),
          ))
      );
    }) &&
    [t.stages, t.payments, t.credentials, t.institutions, t.students, t.groups].every(
      (collection) => unique(collection.map((row) => row.id)),
    ) &&
    unique(t.productReviews.map((row) => row.productId)) &&
    t.institutions.every(
      (institution) =>
        accountIds.has(institution.adminId) &&
        unique((institution.agreements ?? []).map((row) => row.id)) &&
        (institution.agreements ?? []).every(
          (row) =>
            (!row.addedBy || accountIds.has(row.addedBy)) && (!row.addedAt || date(row.addedAt)),
        ) &&
        [institution.contactIds ?? [], institution.staffIds ?? []].every(
          (ids) => unique(ids) && ids.every((id) => accountIds.has(id)),
        ),
    ) &&
    unique(t.institutions.map((institution) => institution.adminId)) &&
    t.students.every(
      (student) => institutions.get(student.institutionId)?.kind === 'high-school',
    ) &&
    t.groups.every(
      (group) =>
        group.studentIds.length >= 2 &&
        unique(group.studentIds) &&
        group.studentIds.every((id) =>
          t.students.some(
            (student) => student.id === id && student.institutionId === group.institutionId,
          ),
        ),
    ) &&
    unique(t.classes.map((entry) => entry.id)) &&
    t.classes.every((entry) => {
      const ids = entry.groupIds ?? [entry.groupId];
      const groups = t.groups.filter((group) => ids.includes(group.id));
      return (
        date(entry.date) &&
        ids[0] === entry.groupId &&
        unique(ids) &&
        groups.length === ids.length &&
        groups.every((group) => group.institutionId === groups[0]?.institutionId) &&
        unique(entry.attendance) &&
        entry.attendance.every((id) => groups.some((group) => group.studentIds.includes(id)))
      );
    }) &&
    p.ventures.every(
      (venture) =>
        !venture.cohortId ||
        (t.cohorts ?? []).some(
          (cohort) =>
            cohort.id === venture.cohortId &&
            cohort.institutionId === schoolForVenture(p, venture)?.id,
        ),
    ) &&
    p.ventures.every(
      (venture) =>
        !venture.groupId ||
        t.groups.some(
          (group) =>
            group.id === venture.groupId &&
            institutions.get(group.institutionId)?.adminId === venture.ownerId,
        ),
    ) &&
    p.incubations.every((path) =>
      (path.productIds ?? []).every((id) => products.get(id)?.ventureId === path.ventureId),
    ) &&
    t.stages.every((work) => {
      const path = paths.get(work.incubationId);
      if (!path || work.id !== `${path.id}:${work.stage}`) return false;
      const learners = incubationLearners(p, path);
      const school = p.ventures.some((venture) => venture.id === path.ventureId && venture.groupId);
      return (
        [work.reviewRequestedAt, work.meetingAt, work.examOpenedAt].every(
          (value) => !value || date(value),
        ) &&
        (!work.examOpenedAt || school || (!!work.reviewRequestedAt && !!work.meetingAt)) &&
        (!!work.examOpenedAt || work.attempts.length === 0) &&
        unique(work.steps.map((step) => step.id)) &&
        unique(work.attempts.map((attempt) => attempt.id)) &&
        work.attempts.every(
          (attempt) =>
            learners.includes(attempt.learnerId) &&
            accountIds.has(attempt.recordedBy) &&
            date(attempt.submittedAt) &&
            (!attempt.corrections ||
              (school &&
                attempt.corrections.every(
                  (entry) => accountIds.has(entry.correctedBy) && date(entry.correctedAt),
                ))),
        )
      );
    }) &&
    t.payments.every(
      (payment) =>
        date(payment.submittedAt) &&
        (payment.purpose === 'marketplace'
          ? products.get(payment.targetId)?.ownerId
          : paths.get(payment.targetId)?.ownerId) === payment.accountId,
    ) &&
    t.productReviews.every(
      (row) =>
        products.has(row.productId) &&
        paths.get(row.incubationId)?.ventureId === products.get(row.productId)?.ventureId,
    ) &&
    t.credentials.every((row) => {
      const path = paths.get(row.incubationId);
      return (
        path &&
        incubationLearners(p, path).includes(row.learnerId) &&
        accountIds.has(row.issuedBy) &&
        date(row.issuedAt) &&
        (row.schoolScore === undefined || institutionForPath(p, path)?.kind === 'high-school')
      );
    }) &&
    Object.entries(t.affiliations).every(
      ([accountId, institutionId]) =>
        accountIds.has(accountId) && (institutionId === 'yerh' || institutions.has(institutionId)),
    )
  );
}
