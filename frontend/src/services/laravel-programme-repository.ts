import { laravelRequest } from './laravel-api';

export type StageKey = 'getting-started' | 'advanced' | 'funding';
export type CredentialKind = StageKey | 'venture';
export type FeePurpose = 'getting-started' | 'advanced' | 'marketplace';
export type PaymentStatus = 'pending' | 'confirmed' | 'declined';
export type ReviewStatus = 'pending' | 'approved' | 'rejected';

export interface Pathway {
  graded_stages?: number;
  id: number;
  venture_id: number;
  mentor_id: number | null;
  venture: string;
  owner: string;
  mentor: string | null;
  graduated_at: string | null;
}

export interface Stage {
  definition: {
    id: StageKey;
    title: string;
    steps: { id: string; title: string; instruction: string }[];
    examPrompt: string;
  };
  work: {
    review_requested_at: string | null;
    meeting_at: string | null;
    meeting_location: string | null;
    meeting_note: string | null;
    exam_opened_at: string | null;
    submitted_at: string | null;
    answer: string | null;
    score: number | null;
    grade_note: string | null;
    graded_at: string | null;
  } | null;
  evidence: {
    step_key: string;
    body: string;
    feedback_requested: boolean | number;
    feedback: string | null;
  }[];
}

type ProductInput = { name: string; description: string; price: string; venture_id?: number };
export interface PublicProduct {
  sector: string;
  slug: string;
  name: string;
  description: string;
  price: string | number;
  venture: string;
}
export interface Product extends PublicProduct {
  owner: string;
  id: number;
  venture_id: number;
  venture_status: ReviewStatus;
  included_path_id: number | null;
  path_id: number | null;
  graduated_at: string | null;
  moderation: ReviewStatus;
  moderation_note: string | null;
  evidence: string | null;
  evidence_status: ReviewStatus | null;
  evidence_note: string | null;
  payment_status: PaymentStatus | null;
  payment_note: string | null;
  published: boolean;
}

interface FeeSetting {
  purpose: FeePurpose;
  amount: number;
  enabled: boolean;
}

interface Payment {
  id: number;
  purpose: FeePurpose;
  amount: number;
  payer: string;
  venture: string | null;
  product: string | null;
  reference: string;
  status: PaymentStatus;
  decision_note: string | null;
}

interface Certificate {
  path_id: number;
  kind: CredentialKind;
  title: string;
  venture: string;
  recipient: string;
  fee: number;
  eligible: boolean;
  payment_status: PaymentStatus | null;
  payment_note: string | null;
  document_id: string | null;
}

async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  return (await laravelRequest<{ data: T }>('/workspace/' + path, { signal })).data;
}

function write(path: string, data: object, method = 'POST') {
  return laravelRequest('/workspace/' + path, { method, data });
}

export const laravelProgramme = {
  paths: (signal?: AbortSignal) => get<Pathway[]>('incubation', signal),
  path: (id: number, signal?: AbortSignal) =>
    get<{ path: Pathway; stages: Stage[] }>('incubation/' + id, signal),
  launch: (ventureId: number, product_ids: number[]) =>
    write(`ventures/${ventureId}/launch`, { product_ids }),
  mentors: (signal?: AbortSignal) =>
    get<{ id: number; name: string; email: string }[]>('mentors', signal),
  mentorCandidates: (q: string, signal?: AbortSignal) =>
    get<{ id: number; name: string }[]>('mentors/candidates?' + new URLSearchParams({ q }), signal),
  addMentor: (user_id: number) => write('mentors', { user_id }),
  assignMentor: (id: number, mentor_id: number) => write(`incubation/${id}/mentor`, { mentor_id }),
  updateStage: (id: number, stage: StageKey, action: string, data: object = {}) =>
    write(`incubation/${id}/stages/${stage}/${action}`, data),
  products: (signal?: AbortSignal) => get<Product[]>('products', signal),
  saveProduct: (data: ProductInput, id?: number) =>
    id === undefined ? write('products', data) : write('products/' + id, data, 'PATCH'),
  submitProductEvidence: (id: number, evidence: string) =>
    write(`products/${id}/evidence`, { evidence }),
  reviewProduct: (
    id: number,
    review: 'listing' | 'evidence',
    decision: string,
    note: string,
    expected_status?: ReviewStatus,
  ) => write(`products/${id}/review/${review}`, { decision, note, expected_status }),
  fees: (signal?: AbortSignal) => get<FeeSetting[]>('programme-fees', signal),
  updateFee: (purpose: FeePurpose, amount: number, enabled: boolean) =>
    write(`programme-fees/${purpose}`, { amount, enabled }, 'PUT'),
  payments: (signal?: AbortSignal) => get<Payment[]>('programme-payments', signal),
  recordPayment: (purpose: FeePurpose, target_id: number, reference: string) =>
    write('programme-payments', { purpose, target_id, reference }),
  reviewPayment: (id: number, decision: string, note: string) =>
    write(`programme-payments/${id}/review`, { decision, note }),
  certificates: (signal?: AbortSignal) => get<Certificate[]>('venture-certificates', signal),
  issueCertificate: (id: number, kind: CredentialKind) =>
    write(`incubation/${id}/certificates/${kind}`, {}),
};

export async function publicMarketplace(signal?: AbortSignal, category?: string | null) {
  return (
    await laravelRequest<{ data: PublicProduct[] }>(
      '/marketplace' + (category ? '?' + new URLSearchParams({ category }) : ''),
      { signal },
    )
  ).data;
}

export async function publicProduct(slug: string, signal?: AbortSignal) {
  return (
    await laravelRequest<{ data: PublicProduct }>('/marketplace/' + encodeURIComponent(slug), {
      signal,
    })
  ).data;
}
