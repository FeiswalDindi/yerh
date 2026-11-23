import { laravelRequest } from './laravel-api';

export const schoolStages = {
  'getting-started': 'Getting Started',
  advanced: 'Intermediate / Advanced',
  funding: 'Funding (Aid)',
} as const;
export const schoolCredentials = { ...schoolStages, venture: 'Venture Incubation' } as const;
export type SchoolStage = keyof typeof schoolStages;
export type SchoolCredentialKind = keyof typeof schoolCredentials;

export type SchoolStudent = {
  id: number;
  name: string;
  reference: string;
  grade: string;
  age: number | null;
  gender: string | null;
};
export type SchoolCohort = { id: number; name: string; starts_on: string; ends_on: string };
export type SchoolResult = {
  student_id: number;
  venture_id: number;
  stage: SchoolStage;
  score: number | string;
  notes: string | null;
};
export type SchoolCredential = {
  id: number;
  student_id: number;
  venture_id: number;
  kind: SchoolCredentialKind;
  status: 'pending' | 'issued' | 'rejected';
  score: number | string;
  classification: string;
  review_notes: string | null;
  document_id: string | null;
};
export type SchoolCohortDetail = {
  cohort: SchoolCohort;
  teams: { id: number; name: string; sector: string; description: string }[];
  members: { id: number; name: string; grade: string; venture_id: number }[];
  classes: { id: number; title: string; class_date: string; notes: string | null }[];
  classTeams: { class_id: number; venture_id: number }[];
  results: SchoolResult[];
  credentials: SchoolCredential[];
};
type SchoolAdminCredential = SchoolCredential & {
  institution: string;
  cohort: string;
  venture: string;
  student: string;
  assessment_notes: string | null;
};

const school = (slug: string) => '/workspace/schools/' + encodeURIComponent(slug);
const cohort = (slug: string, id: number) => school(slug) + '/cohorts/' + id;

async function read<T>(path: string, signal?: AbortSignal) {
  return (await laravelRequest<{ data: T }>(path, { signal })).data;
}

function write(path: string, data: object, method = 'POST') {
  return laravelRequest(path, { method, data });
}

export const schoolRepository = {
  directory: (slug: string, signal?: AbortSignal) =>
    read<{ access: 'view' | 'manage'; students: SchoolStudent[]; cohorts: SchoolCohort[] }>(
      school(slug),
      signal,
    ),
  cohort: (slug: string, id: number, signal?: AbortSignal) =>
    read<SchoolCohortDetail>(cohort(slug, id), signal),
  saveStudent: (slug: string, data: object, id?: number) =>
    write(school(slug) + '/students' + (id ? '/' + id : ''), data, id ? 'PATCH' : 'POST'),
  addCohort: (slug: string, data: object) => write(school(slug) + '/cohorts', data),
  addTeam: (slug: string, id: number, data: object) => write(cohort(slug, id) + '/teams', data),
  addClass: (slug: string, id: number, data: object) => write(cohort(slug, id) + '/classes', data),
  recordResult: (slug: string, id: number, student: number, stage: SchoolStage, data: object) =>
    write(cohort(slug, id) + '/results/' + student + '/' + stage, data, 'PUT'),
  requestCertificate: (slug: string, id: number, kind: SchoolCredentialKind, student?: number) =>
    write(cohort(slug, id) + '/certificates/' + kind, { student_id: student }),
  queue: (signal?: AbortSignal) =>
    read<SchoolAdminCredential[]>('/workspace/school-certificates', signal),
  review: (id: number, decision: string, note: string) =>
    write('/workspace/school-certificates/' + id + '/review', { decision, note }),
  document: (id: string) => '/api/v1/workspace/school-certificates/' + id + '/document',
};
