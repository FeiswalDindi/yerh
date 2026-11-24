import { apiUrl, laravelRequest } from './laravel-api';

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
    attempt?: number;
    review_requested_at: string | null;
    meeting_at: string | null;
    meeting_location: string | null;
    meeting_note: string | null;
    exam_opened_at: string | null;
    submitted_at: string | null;
    answer: string | null;
    has_answer_attachment?: boolean;
    answer_attachment_name?: string | null;
    score: number | null;
    passed?: boolean | number | null;
    grade_note: string | null;
    graded_at: string | null;
  } | null;
  evidence: {
    step_key: string;
    body: string;
    feedback_requested: boolean | number;
    feedback: string | null;
    has_attachment?: boolean;
    attachment_name?: string | null;
  }[];
}

export type ProductInput = {
  name: string;
  description: string;
  price: string;
  venture_id?: number;
  photo?: File | null;
  remove_photo?: boolean;
  contact_email?: string;
  contact_phone?: string;
  whatsapp?: string;
};
export interface PublicProduct {
  sector: string;
  slug: string;
  name: string;
  description: string;
  price: string | number;
  venture: string;
  location?: string | null;
  institution?: string | null;
  seller_name?: string | null;
  seller_email?: string | null;
  seller_phone?: string | null;
  whatsapp?: string | null;
  image_url?: string | null;
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
  has_image?: boolean;
  contact_email?: string | null;
  contact_phone?: string | null;
  whatsapp?: string | null;
}

interface FeeSetting {
  purpose: FeePurpose;
  amount: number;
  enabled: boolean;
}

export interface PaymentInstructions {
  provider: string;
  paybill_number: string;
  account_number: string;
  recipient_name: string;
  instructions: string;
}

interface Payment {
  id: number;
  purpose: FeePurpose;
  amount: number;
  payer: string;
  venture: string | null;
  product: string | null;
  reference: string;
  has_receipt?: boolean;
  receipt_name?: string | null;
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
  updateStage: (id: number, stage: StageKey, action: string, data: object | FormData = {}) =>
    write(`incubation/${id}/stages/${stage}/${action}`, data),
  evidenceAttachmentUrl: (id: number, stage: StageKey, step: string) =>
    apiUrl(
      `/workspace/incubation/${id}/stages/${encodeURIComponent(stage)}/evidence/${encodeURIComponent(step)}/attachment`,
    ),
  examAttachmentUrl: (id: number, stage: StageKey) =>
    apiUrl(`/workspace/incubation/${id}/stages/${encodeURIComponent(stage)}/exam-attachment`),
  products: (signal?: AbortSignal) => get<Product[]>('products', signal),
  saveProduct: (data: ProductInput, id?: number) => {
    const usesMultipart = Boolean((data.photo && data.photo.size > 0) || data.remove_photo);
    if (usesMultipart) {
      const form = new FormData();
      form.append('name', data.name);
      form.append('description', data.description);
      form.append('price', data.price);
      if (data.venture_id !== undefined) form.append('venture_id', String(data.venture_id));
      if (data.contact_email !== undefined) form.append('contact_email', data.contact_email);
      if (data.contact_phone !== undefined) form.append('contact_phone', data.contact_phone);
      if (data.whatsapp !== undefined) form.append('whatsapp', data.whatsapp);
      if (data.photo && data.photo.size > 0) form.append('photo', data.photo);
      if (data.remove_photo) form.append('remove_photo', '1');
      return write(id === undefined ? 'products' : 'products/' + id, form, 'POST');
    }
    const payload = {
      name: data.name,
      description: data.description,
      price: data.price,
      ...(data.venture_id !== undefined ? { venture_id: data.venture_id } : {}),
      ...(data.contact_email !== undefined ? { contact_email: data.contact_email || null } : {}),
      ...(data.contact_phone !== undefined ? { contact_phone: data.contact_phone || null } : {}),
      ...(data.whatsapp !== undefined ? { whatsapp: data.whatsapp || null } : {}),
    };
    return id === undefined
      ? write('products', payload)
      : write('products/' + id, payload, 'PATCH');
  },
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
  paymentInstructions: (signal?: AbortSignal) =>
    get<PaymentInstructions>('payment-instructions', signal),
  updatePaymentInstructions: (data: PaymentInstructions) =>
    write('payment-instructions', data, 'PUT'),
  payments: (signal?: AbortSignal) => get<Payment[]>('programme-payments', signal),
  recordPayment: (
    purpose: FeePurpose,
    target_id: number,
    reference: string,
    receipt?: File | null,
  ) => {
    if (receipt && receipt.size > 0) {
      const form = new FormData();
      form.append('purpose', purpose);
      form.append('target_id', String(target_id));
      form.append('reference', reference);
      form.append('receipt', receipt);
      return write('programme-payments', form);
    }
    return write('programme-payments', { purpose, target_id, reference });
  },
  paymentReceiptUrl: (id: number) => apiUrl(`/workspace/programme-payments/${id}/receipt`),
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
