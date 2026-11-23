import { laravelRequest } from './laravel-api';

export type Presenter = {
  name: string;
  profession: string;
  role: 'host' | 'facilitator';
  photo?: string;
};
export type EventCategory = { id: number; name: string };
export type EventRecord = {
  id: number;
  slug: string;
  title: string;
  summary: string;
  venue: string;
  category: string;
  category_id: number;
  starts_at: string;
  ends_at: string;
  deadline: string | null;
  capacity: number | null;
  bookings: number;
  presenters: Presenter[];
  status: 'draft' | 'published';
  archived: boolean;
  booked?: boolean;
};
export type EventFeed = { events: EventRecord[]; categories: EventCategory[] };
export type OpportunityRecord = {
  id: number;
  slug: string;
  title: string;
  category: string;
  organiser: string;
  description: string;
  opens_at: string | null;
  deadline: string | null;
  external_url: string | null;
  status: 'draft' | 'published' | 'closed';
  open: boolean;
};
export type ApplicationRecord = {
  id: number;
  slug: string;
  opportunity: string;
  applicant: string;
  venture: string;
  motivation: string;
  status: 'submitted' | 'shortlisted' | 'accepted' | 'rejected' | 'withdrawn';
  review_notes: string | null;
};

async function read<T>(path: string, signal?: AbortSignal) {
  return (await laravelRequest<{ data: T }>('/engagement' + path, { signal })).data;
}
function write(path: string, data?: object, method = 'POST') {
  return laravelRequest('/engagement' + path, { method, data });
}
const item = (resource: string, id?: number) =>
  '/manage/' + resource + (id === undefined ? '' : '/' + id);

export const engagementRepository = {
  events: (signal?: AbortSignal) => read<EventFeed>('/events', signal),
  manageEvents: (signal?: AbortSignal) => read<EventFeed>('/manage/events', signal),
  event: (slug: string, signal?: AbortSignal) =>
    read<EventRecord>('/events/' + encodeURIComponent(slug), signal),
  saveEvent: (data: object, id?: number) => write(item('events', id), data, id ? 'PATCH' : 'POST'),
  saveCategory: (name: string, id?: number) =>
    write(item('event-categories', id), { name }, id ? 'PATCH' : 'POST'),
  reserve: (slug: string, cancel = false) =>
    write(
      '/events/' + encodeURIComponent(slug) + '/booking',
      undefined,
      cancel ? 'DELETE' : 'POST',
    ),
  opportunities: (signal?: AbortSignal) => read<OpportunityRecord[]>('/opportunities', signal),
  manageOpportunities: (signal?: AbortSignal) =>
    read<OpportunityRecord[]>('/manage/opportunities', signal),
  opportunity: (slug: string, signal?: AbortSignal) =>
    read<OpportunityRecord>('/opportunities/' + encodeURIComponent(slug), signal),
  saveOpportunity: (data: object, id?: number) =>
    write(item('opportunities', id), data, id ? 'PATCH' : 'POST'),
  apply: (slug: string, data: object) =>
    write('/opportunities/' + encodeURIComponent(slug) + '/applications', data),
  applications: (signal?: AbortSignal) => read<ApplicationRecord[]>('/applications', signal),
  decide: (id: number, decision: string, note?: string) =>
    write('/applications/' + id + '/decision', { decision, note }),
};
