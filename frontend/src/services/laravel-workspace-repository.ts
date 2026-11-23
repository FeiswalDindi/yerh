import type { InstitutionChoice } from './laravel-identity-repository';
import { laravelRequest } from './laravel-api';

export interface AffiliationApplication {
  id: number;
  applicant: string;
  institution: string;
  status: 'pending' | 'approved' | 'rejected' | 'withdrawn';
  location: string;
  details: string;
  decision_note: string | null;
}

export type VentureInput = { name: string; sector: string; location: string; description: string };
export interface Venture extends VentureInput {
  id: number;
  institution: string;
  owner: string;
  status: 'pending' | 'approved' | 'rejected';
  decision_note: string | null;
}

export interface InstitutionRecord extends InstitutionChoice {
  status: string;
  agreement_reference: string | null;
  administrator: string | null;
  agreements: number;
}

export interface InstitutionPortalData {
  access: 'view' | 'manage';
  agreement: string | null;
  paths: { id: number; venture_id: number; graduated_at: string | null }[];
  stages: { path_id: number; stage: string; graded_at: string | null }[];
  payments: { path_id: number; purpose: string; status: string }[];
  credentials: { path_id: number; kind: string; issued_at: string }[];
  members: { id: number; name: string; location: string; created_at: string }[];
  ventures: {
    id: number;
    owner_id: number;
    name: string;
    sector: string;
    status: Venture['status'];
  }[];
  invitations: {
    id: number;
    name: string;
    email: string;
    expires_at: string;
    accepted_at: string | null;
    revoked_at: string | null;
  }[];
}

async function get<T>(path: string, signal?: AbortSignal) {
  return (await laravelRequest<{ data: T }>('/workspace/' + path, { signal })).data;
}

function post(path: string, data: object, method = 'POST') {
  return laravelRequest('/workspace/' + path, { method, data });
}

const institutionPath = (slug: string) => 'institutions/' + encodeURIComponent(slug);

export type WorkspaceSummary = {
  metrics: Record<string, number>;
  portals: Record<string, Record<string, number>>;
};
export const laravelWorkspace = {
  activity: (signal?: AbortSignal, institution?: string) =>
    get<{ id: number; actor: string | null; action: string; target: string; created_at: string }[]>(
      'activity' + (institution ? '?' + new URLSearchParams({ institution }) : ''),
      signal,
    ),
  summary: (signal?: AbortSignal) => get<WorkspaceSummary>('summary', signal),
  updateAccess: (id: number, role: string, suspended: boolean) =>
    post('users/' + id, { role, suspended }, 'PATCH'),
  users: (signal?: AbortSignal) =>
    get<
      {
        id: number;
        name: string;
        email: string;
        role: import('../domain/roles').Role;
        email_verified_at: string | null;
        suspended_at: string | null;
      }[]
    >('users', signal),
  applications: (signal?: AbortSignal) => get<AffiliationApplication[]>('applications', signal),
  apply: (data: { institution: string; location: string; details: string; consent: boolean }) =>
    post('applications', data),
  ventures: (signal?: AbortSignal) => get<Venture[]>('ventures', signal),
  institutionVentures: (signal?: AbortSignal) =>
    get<
      {
        id: number;
        name: string;
        description: string;
        sector: string;
        institution: string;
        slug: string;
        cohort: string;
        cohort_id: number;
      }[]
    >('institution-ventures', signal),
  setVentureStatus: (venture: Venture, decision: string, note: string) =>
    post('ventures/' + venture.id + '/review', { decision, note, expected_status: venture.status }),
  saveVenture: (data: VentureInput, id?: number) =>
    id === undefined ? post('ventures', data) : post('ventures/' + id, data, 'PATCH'),
  review: (kind: 'applications' | 'ventures', id: number, decision: string, note: string) =>
    post(`${kind}/${id}/review`, { decision, note }),
  institutions: (signal?: AbortSignal) => get<InstitutionRecord[]>('institutions', signal),
  addInstitution: (data: { name: string; kind: string }) => post('institutions', data),
  activate: (slug: string) => post(institutionPath(slug) + '/activate', {}),
  renameInstitution: (slug: string, name: string) => post(institutionPath(slug), { name }, 'PATCH'),
  staff: (slug: string, signal?: AbortSignal) =>
    get<{ id: number; name: string; access: string; suspended_at: string | null }[]>(
      institutionPath(slug) + '/staff',
      signal,
    ),
  staffCandidates: (slug: string, q: string, signal?: AbortSignal) =>
    get<{ id: number; name: string }[]>(
      institutionPath(slug) + '/staff-candidates?' + new URLSearchParams({ q }),
      signal,
    ),
  assignStaff: (slug: string, user_id: number, access: string) =>
    post(institutionPath(slug) + '/staff', { user_id, access }),
  institution: (slug: string, signal?: AbortSignal) =>
    get<InstitutionPortalData>(institutionPath(slug) + '/members', signal),
};
