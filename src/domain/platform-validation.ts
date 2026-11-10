import type { PlatformState } from './platform';
const record = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const fields = (v: unknown, keys: string[]): v is Record<string, unknown> =>
  record(v) && keys.every((k) => typeof v[k] === 'string');
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
        ['entrepreneur', 'mentor', 'partner', 'investor'].includes(a.role) &&
        ['pending', 'approved', 'rejected'].includes(a.status),
    ) &&
    p.ventures.every((a) => ['pending', 'approved', 'rejected'].includes(a.status)) &&
    p.products.every(
      (a) =>
        ['pending', 'approved', 'rejected'].includes(a.status) &&
        Number.isFinite(a.price) &&
        a.price >= 0,
    ) &&
    p.incubations.every(
      (i) =>
        ['pending', 'active', 'completed', 'rejected'].includes(i.status) &&
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
