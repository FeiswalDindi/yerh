import { laravelRequest } from './laravel-api';

export type AudienceFilterParams = {
  search?: string;
  role?: string;
  institution_id?: string;
  verified?: string;
  status?: string;
  venture?: string;
  incubation?: string;
  event_id?: string;
  location?: string;
};

export interface AudienceMember {
  id: number;
  name: string;
  email: string;
  role: string;
  location: string | null;
  headline: string | null;
  email_verified_at: string | null;
  suspended_at: string | null;
  created_at: string | null;
  institution_id: number | null;
  institution_name: string | null;
  venture_count: number;
  venture_status: 'none' | 'pending' | 'approved' | 'rejected';
  venture_names: string[];
  incubation_status: 'none' | 'active' | 'graduated';
  event_ids: number[];
  course_count: number;
}

export interface AudiencePayload {
  users: AudienceMember[];
  total_users: number;
  filters: {
    institutions: { id: number; name: string; kind: string; status: string }[];
    events: {
      id: number;
      title: string;
      starts_at: string;
      venue_type: string;
      status: string;
    }[];
    locations: string[];
  };
  stats: {
    new_enquiries: number;
    total_enquiries: number;
    total_users: number;
    verified_users: number;
    templates: number;
    dispatches: number;
    outbox_count?: number;
  };
  mail_status: {
    mailer: string;
    from_address: string;
    from_name: string;
    mail_notifications: boolean;
    live_delivery: boolean;
  };
}

export type EmailTemplateCategory =
  'onboarding' | 'events' | 'incubation' | 'enquiries' | 'announcements' | 'requests' | 'general';

export interface EmailTemplate {
  id: number;
  name: string;
  category: EmailTemplateCategory;
  subject: string;
  body: string;
  action_label?: string | null;
  action_url?: string | null;
  is_system: boolean | number;
  updated_by_name?: string | null;
  updated_at: string | null;
  created_at: string | null;
}

export interface CommunicationDispatch {
  id: number;
  kind: 'broadcast' | 'enquiry_reply' | 'direct';
  subject: string;
  body: string;
  channel: 'both' | 'email' | 'notification';
  recipient_count: number;
  sent_count: number;
  failed_count: number;
  filter_summary: Record<string, unknown> | null;
  created_at: string;
  sender_name: string | null;
  template_name: string | null;
  enquiry_name: string | null;
  enquiry_email: string | null;
  enquiry_topic: string | null;
}

export interface DispatchDetailPayload {
  dispatch: CommunicationDispatch;
  recipients: {
    id: number;
    user_id: number | null;
    name: string;
    email: string;
    status: 'sent' | 'notified' | 'failed';
    error_message: string | null;
    created_at: string;
  }[];
}

export interface SentEmailSummary {
  id: number;
  to_email: string;
  to_name: string | null;
  from_email: string | null;
  subject: string;
  text_preview: string;
  has_html: boolean;
  mailer: string;
  created_at: string;
}

export interface SentEmailDetail {
  id: number;
  to_email: string;
  to_name: string | null;
  from_email: string | null;
  subject: string;
  html_body: string | null;
  text_body: string | null;
  mailer: string;
  created_at: string;
}

function queryString(filters?: AudienceFilterParams): string {
  if (!filters) return '';
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value && value !== 'all') {
      params.set(key, value);
    }
  }
  const encoded = params.toString();
  return encoded ? `?${encoded}` : '';
}

export const communicationsRepository = {
  audience: async (filters?: AudienceFilterParams, signal?: AbortSignal) =>
    (
      await laravelRequest<{ data: AudiencePayload }>(
        `/workspace/communications/audience${queryString(filters)}`,
        { signal },
      )
    ).data,

  broadcast: async (payload: {
    subject: string;
    body: string;
    channel: 'both' | 'email' | 'notification';
    selection_mode: 'selected' | 'filtered' | 'all';
    user_ids?: number[];
    filters?: AudienceFilterParams;
    template_id?: number | null;
    action_label?: string;
    action_url?: string;
  }) =>
    (
      await laravelRequest<{
        data: {
          dispatch_id: number;
          recipient_count: number;
          sent_count: number;
          failed_count: number;
          channel: string;
        };
      }>('/workspace/communications/broadcast', { method: 'POST', data: payload })
    ).data,

  replyToEnquiry: async (
    enquiryId: number,
    payload: {
      subject: string;
      body: string;
      template_id?: number | null;
      mark_status?: 'read' | 'resolved';
      admin_notes?: string;
    },
  ) =>
    (
      await laravelRequest<{ data: { dispatch_id: number; sent: boolean; status: string } }>(
        `/workspace/communications/enquiries/${enquiryId}/reply`,
        { method: 'POST', data: payload },
      )
    ).data,

  templates: async (signal?: AbortSignal) =>
    (
      await laravelRequest<{ data: EmailTemplate[] }>('/workspace/communications/templates', {
        signal,
      })
    ).data,

  saveTemplate: async (
    payload: {
      name: string;
      category: EmailTemplateCategory;
      subject: string;
      body: string;
      action_label?: string | null;
      action_url?: string | null;
    },
    id?: number,
  ) =>
    (
      await laravelRequest<{ data: EmailTemplate }>(
        id ? `/workspace/communications/templates/${id}` : '/workspace/communications/templates',
        { method: id ? 'PATCH' : 'POST', data: payload },
      )
    ).data,

  deleteTemplate: async (id: number) =>
    laravelRequest<{ data: { id: number; deleted: boolean } }>(
      `/workspace/communications/templates/${id}`,
      { method: 'DELETE' },
    ),

  history: async (signal?: AbortSignal) =>
    (
      await laravelRequest<{ data: CommunicationDispatch[] }>('/workspace/communications/history', {
        signal,
      })
    ).data,

  dispatchDetail: async (id: number, signal?: AbortSignal) =>
    (
      await laravelRequest<{ data: DispatchDetailPayload }>(
        `/workspace/communications/history/${id}`,
        { signal },
      )
    ).data,

  outbox: async (signal?: AbortSignal) =>
    (
      await laravelRequest<{ data: SentEmailSummary[] }>('/workspace/communications/outbox', {
        signal,
      })
    ).data,

  outboxDetail: async (id: number, signal?: AbortSignal) =>
    (
      await laravelRequest<{ data: SentEmailDetail }>(`/workspace/communications/outbox/${id}`, {
        signal,
      })
    ).data,
};
