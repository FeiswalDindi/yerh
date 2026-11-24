import { apiUrl, laravelRequest } from './laravel-api';

export interface CourseOffer {
  slug: string;
  title: string;
  description: string;
  level: string;
  price: number;
  discount: number;
}

type PaymentStatus = 'pending' | 'confirmed' | 'rejected';
export type CourseDetail = {
  course: CourseOffer;
  enrolment: {
    payment_status: PaymentStatus;
    payment_note: string | null;
    completed_at: string | null;
    certificate_id: string | null;
  } | null;
  lessons: { id: number; title: string; content?: string | null; url?: string | null }[];
  completed: number[];
};

export type CourseDraft = CourseOffer & {
  id: number;
  status: 'proposed' | 'approved' | 'rejected' | 'published';
  review_notes: string | null;
  royalty_rate: number;
  has_attachment: boolean;
};

type CourseRegistryEntry = {
  id: number;
  learner: string;
  course: string;
  payment_reference: string | null;
  has_receipt?: boolean;
  receipt_name?: string | null;
  price_paid: number;
  payment_status: PaymentStatus;
  payment_note: string | null;
  completed_at: string | null;
  certificate_id: string | null;
};

const route = '/learning';
const coursePath = (slug: string) => '/courses/' + encodeURIComponent(slug);
async function get<T>(path: string, signal?: AbortSignal) {
  return (await laravelRequest<{ data: T }>(route + path, { signal })).data;
}
function write(path: string, data?: object, method = 'POST') {
  return laravelRequest(route + path, { method, data });
}

export const learningRepository = {
  catalogue: (signal?: AbortSignal) => get<CourseOffer[]>('', signal),
  show: (slug: string, signal?: AbortSignal) => get<CourseDetail>(coursePath(slug), signal),
  enrol: (slug: string, reference?: string, receipt?: File | null) => {
    if (receipt && receipt.size > 0) {
      const form = new FormData();
      if (reference) form.append('reference', reference);
      form.append('receipt', receipt);
      return write(coursePath(slug) + '/enrolments', form);
    }
    return write(coursePath(slug) + '/enrolments', { reference });
  },
  complete: (slug: string, lesson: number) =>
    write(coursePath(slug) + '/lessons/' + lesson, undefined, 'PUT'),
  registry: (signal?: AbortSignal) => get<CourseRegistryEntry[]>('/registry', signal),
  receiptUrl: (id: number) => apiUrl('/learning/registry/' + id + '/receipt'),
  reviewPayment: (id: number, decision: string, note: string) =>
    write('/registry/' + id + '/payment', { decision, note }),
  issue: (id: number) => write('/registry/' + id + '/certificate'),
  certificate: (uuid: string) => apiUrl('/learning/certificates/' + uuid),
  authoring: (signal?: AbortSignal) =>
    get<{
      rows: CourseDraft[];
      lessons: { id: number; course_id: number; title: string }[];
      royalties: { course_id: number; enrolments: number; accrued: string | number }[];
    }>('/authoring', signal),
  propose: (form: FormData) => write('/authoring', form),
  review: (id: number, decision: string, note: string) =>
    write('/authoring/' + id + '/review', { decision, note }),
  addLesson: (id: number, data: object) => write('/authoring/' + id + '/lessons', data),
  publish: (id: number, data: object) => write('/authoring/' + id + '/publish', data),
  attachment: (id: number) => apiUrl('/learning/authoring/' + id + '/attachment'),
};
