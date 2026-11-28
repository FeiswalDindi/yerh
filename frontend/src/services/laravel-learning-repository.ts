import { apiUrl, laravelRequest } from './laravel-api';
import type { PaymentInstructions } from './laravel-programme-repository';

export interface CourseOffer {
  slug: string;
  title: string;
  description: string;
  level: string;
  price: number;
  discount: number;
  featured?: boolean;
  cover_image?: string | null;
  moodle_course_id?: number | null;
  enrolment_status?: PaymentStatus | null;
  enrolment_progress?: number | null;
  enrolment_completed?: boolean;
}

export type CoursePlacement = string;

export interface CoursePlacementConfig {
  key: string;
  label: string;
  description: string;
  visible_on_public_learn: boolean;
  auto_attach_incubation: boolean;
  institution_scoped: boolean;
  is_draft: boolean;
  system: boolean;
}

type PaymentStatus = 'pending' | 'confirmed' | 'rejected';

export type CourseOverviewSection = {
  title: string;
  summary: string;
  activities: { name: string; type: string }[];
};

export type CourseDetail = {
  course: CourseOffer;
  enrolment: {
    id?: number;
    payment_status: PaymentStatus;
    payment_reference?: string | null;
    has_receipt?: boolean;
    payment_note: string | null;
    completed_at: string | null;
    certificate_id: string | null;
    moodle_enrolled_at?: string | null;
    moodle_progress?: number | null;
    moodle_synced_at?: string | null;
    moodle_launch_url?: string | null;
  } | null;
  lessons: { id: number; title: string; content?: string | null; url?: string | null }[];
  completed: number[];
  overview?: {
    estimated_duration: string;
    module_count: number;
    activity_count: number;
    format: string;
    sections: CourseOverviewSection[];
  };
  payment_instructions?: PaymentInstructions | null;
};

export type CourseDraft = CourseOffer & {
  id: number;
  status: 'proposed' | 'approved' | 'rejected' | 'published';
  review_notes: string | null;
  royalty_rate: number;
  author_id?: number | null;
  author_name?: string | null;
  author_role?: string | null;
  has_attachment: boolean;
  moodle_course_id?: number | null;
  moodle_shortname?: string | null;
  placement?: CoursePlacement;
  featured?: boolean;
  institution_id?: number | null;
  moodle_synced_at?: string | null;
};

export interface CourseRoyaltySummary {
  course_id: number;
  enrolments: number;
  gross_revenue?: string | number;
  accrued: string | number;
  pending_enrolments?: number;
  pending_accrued?: string | number;
}

export interface RoyaltyLedgerEntry {
  id: number;
  course_id: number;
  course_title: string;
  author_id: number | null;
  author_name: string | null;
  learner_name: string;
  payment_status: PaymentStatus;
  price_paid: number;
  royalty_rate: number;
  royalty_amount: number;
  created_at: string;
  updated_at: string;
}

export interface EarningsSummary {
  total_courses: number;
  published_courses: number;
  confirmed_enrolments: number;
  pending_enrolments: number;
  gross_revenue: number;
  accrued_royalties: number;
  pending_royalties: number;
}

export interface MentorOption {
  id: number;
  name: string;
  email: string;
}

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

type MoodleLaunchParams = {
  slug?: string | null;
  path?: string | null;
  school_guide?: boolean | string | null;
  format?: 'json';
};

const moodleLaunchQuery = (params?: MoodleLaunchParams) => {
  const query = new URLSearchParams();
  if (params?.slug) query.set('slug', params.slug);
  if (params?.path) query.set('path', params.path);
  if (params?.school_guide && params.school_guide !== '0' && params.school_guide !== 'false') {
    query.set('school_guide', '1');
  }
  if (params?.format) query.set('format', params.format);
  const qs = query.toString();
  return qs ? `?${qs}` : '';
};

export const learningRepository = {
  moodleApiLaunchUrl: (params?: MoodleLaunchParams) =>
    apiUrl('/learning/moodle/launch' + moodleLaunchQuery(params)),
  moodleLaunchUrl: (params?: Omit<MoodleLaunchParams, 'format'>) =>
    '/moodle/launch' + moodleLaunchQuery(params),
  toMoodleHandoffUrl: (rawUrl?: string | null) => {
    if (!rawUrl) return '/moodle/launch';
    try {
      const parsed = new URL(rawUrl, 'https://yerh.invalid');
      return learningRepository.moodleLaunchUrl({
        slug: parsed.searchParams.get('slug'),
        path: parsed.searchParams.get('path'),
        school_guide: parsed.searchParams.get('school_guide'),
      });
    } catch {
      return '/moodle/launch';
    }
  },
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
  syncProgress: async (slug: string) =>
    (
      await (write(coursePath(slug) + '/sync-progress') as Promise<{
        data: {
          progress: number;
          completed: boolean;
          score: number | null;
          completed_at: string | null;
        };
      }>)
    ).data,
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
      royalties: CourseRoyaltySummary[];
      ledger?: RoyaltyLedgerEntry[];
      earnings_summary?: EarningsSummary;
      mentors?: MentorOption[];
      placements?: CoursePlacementConfig[];
      moodle?: { configured: boolean; url: string };
    }>('/authoring', signal),
  updatePlacements: async (placements: CoursePlacementConfig[]) =>
    (
      await (write('/placements', { placements }, 'PUT') as Promise<{
        data: CoursePlacementConfig[];
      }>)
    ).data,
  syncMoodle: async () =>
    (
      await (write('/moodle/sync') as Promise<{
        data: { synced: number; created: number; updated: number };
      }>)
    ).data,
  propose: (form: FormData) => write('/authoring', form),
  review: (id: number, decision: string, note: string) =>
    write('/authoring/' + id + '/review', { decision, note }),
  addLesson: (id: number, data: object) => write('/authoring/' + id + '/lessons', data),
  publish: (id: number, data: object) => write('/authoring/' + id + '/publish', data),
  attachment: (id: number) => apiUrl('/learning/authoring/' + id + '/attachment'),
};
