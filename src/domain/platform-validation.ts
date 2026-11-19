import type { PlatformState } from './platform';
import { applicationRoles, roleLabels } from './roles.ts';
import { isTrainingState } from './incubation-validation.ts';
import { validCourseDocuments, type Proposal } from './courses.ts';
import { isSessionType } from './events.ts';
const record = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const fields = (v: unknown, keys: string[]): v is Record<string, unknown> =>
  record(v) && keys.every((k) => typeof v[k] === 'string');
const amount = (v: unknown) => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
const records = (v: unknown, check: (row: unknown) => boolean) =>
  Array.isArray(v) && v.every(check);

function validCourses(value: unknown) {
  return (
    value === undefined ||
    (record(value) &&
      record(value.prices) &&
      Object.values(value.prices).every(
        (price) =>
          record(price) &&
          amount(price.price) &&
          amount(price.discount) &&
          Number(price.discount) <= Number(price.price),
      ) &&
      records(
        value.proposals,
        (row) =>
          fields(row, [
            'id',
            'mentorId',
            'title',
            'description',
            'audience',
            'status',
            'feedback',
          ]) &&
          ['pending', 'approved', 'rejected', 'published'].includes(String(row.status)) &&
          amount(row.royaltyPercent) &&
          Number(row.royaltyPercent) <= 100 &&
          records(row.documents, (document) => fields(document, ['name', 'data'])) &&
          validCourseDocuments(row.documents as Proposal['documents']) &&
          records(row.modules, (module) => fields(module, ['id', 'title', 'body'])),
      ) &&
      records(
        value.purchases,
        (row) =>
          fields(row, ['courseId', 'accountId', 'paidAt']) &&
          amount(row.amount) &&
          amount(row.royaltyCents) &&
          Number(row.royaltyCents) <= Number(row.amount) * 100,
      ))
  );
}
export function isPlatformState(v: unknown): v is PlatformState {
  if (!record(v)) return false;
  const lists: Record<string, string[]> = {
    certificates: ['id', 'accountId', 'courseId', 'issuedAt', 'issuedBy'],
    applications: [
      'id',
      'accountId',
      'role',
      'motivation',
      'organisation',
      'expertise',
      'status',
      'createdAt',
    ],
    opportunities: [
      'id',
      'slug',
      'ownerId',
      'title',
      'summary',
      'description',
      'category',
      'organiser',
      'type',
      'mode',
      'location',
      'eligibility',
      'benefits',
      'status',
      'image',
      'externalUrl',
    ],
    opportunityApplications: [
      'id',
      'accountId',
      'opportunityId',
      'ventureId',
      'motivation',
      'status',
      'createdAt',
    ],
    ventures: ['id', 'ownerId', 'name', 'description', 'sector', 'stage', 'location', 'status'],
    products: ['id', 'ownerId', 'ventureId', 'name', 'description', 'status'],
    incubations: ['id', 'ownerId', 'ventureId', 'mentorId', 'goal', 'status'],
    mentors: ['accountId', 'expertise', 'availability', 'bio'],
    organisations: ['accountId', 'name', 'type', 'sectors', 'contact', 'website', 'status'],
    audit: ['id', 'actorId', 'action', 'targetId', 'createdAt'],
    cmsDrafts: ['id', 'ownerId', 'title', 'updatedAt'],
    cmsReleases: ['id', 'actorId', 'title', 'createdAt'],
  };
  if (
    !Object.entries(lists).every(
      ([key, keys]) =>
        Array.isArray(v[key]) && (v[key] as unknown[]).every((row) => fields(row, keys)),
    )
  )
    return false;
  const p = v as unknown as PlatformState;
  return (
    isTrainingState(p.training) &&
    validCourses(p.courseCommerce) &&
    (p.eventCategories === undefined ||
      (records(
        p.eventCategories,
        (category) => fields(category, ['id', 'label', 'type']) && isSessionType(category.type),
      ) &&
        new Set(p.eventCategories.map((category) => category.id)).size ===
          p.eventCategories.length)) &&
    record(p.courseLessons) &&
    Object.values(p.courseLessons).every(
      (ids) => Array.isArray(ids) && ids.every((id) => typeof id === 'string'),
    ) &&
    record(p.enrollments) &&
    Object.values(p.enrollments).every(
      (ids) => Array.isArray(ids) && ids.every((id) => typeof id === 'string'),
    ) &&
    Number.isInteger(p.cmsRevision) &&
    p.cmsRevision >= 0 &&
    p.applications.every(
      (a) =>
        applicationRoles.includes(a.role) &&
        (a.fromRole === undefined ||
          (typeof a.fromRole === 'string' &&
            Object.hasOwn(roleLabels, a.fromRole) &&
            a.fromRole !== a.role)) &&
        ['pending', 'approved', 'rejected'].includes(a.status),
    ) &&
    p.ventures.every(
      (a) =>
        ['pending', 'approved', 'rejected'].includes(a.status) &&
        (a.cohortId === undefined || typeof a.cohortId === 'string') &&
        (a.groupId === undefined || typeof a.groupId === 'string'),
    ) &&
    p.products.every(
      (a) =>
        ['pending', 'approved', 'rejected'].includes(a.status) &&
        Number.isFinite(a.price) &&
        a.price >= 0,
    ) &&
    p.incubations.every(
      (i) =>
        ['pending', 'active', 'completed', 'rejected'].includes(i.status) &&
        (i.productIds === undefined ||
          (Array.isArray(i.productIds) && i.productIds.every((id) => typeof id === 'string'))) &&
        Array.isArray(i.milestones) &&
        i.milestones.every(
          (m) => fields(m, ['id', 'title', 'note']) && typeof m.validated === 'boolean',
        ),
    ) &&
    p.opportunityApplications.every((a) =>
      ['submitted', 'shortlisted', 'accepted', 'rejected', 'withdrawn'].includes(a.status),
    ) &&
    p.opportunities.every(
      (o) =>
        Array.isArray(o.sectors) &&
        Array.isArray(o.stages) &&
        Array.isArray(o.documents) &&
        typeof o.rolling === 'boolean' &&
        typeof o.featured === 'boolean' &&
        ['draft', 'review', 'published', 'closed', 'archived'].includes(o.status),
    ) &&
    p.cmsDrafts.every(
      (d) => record(d.snapshot) && record(d.snapshot.catalog) && Number.isInteger(d.baseRevision),
    ) &&
    p.cmsReleases.every(
      (d) => record(d.snapshot) && record(d.snapshot.catalog) && Number.isInteger(d.revision),
    )
  );
}
