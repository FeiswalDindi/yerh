import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  CheckSquare,
  ChevronDown,
  ChevronUp,
  Copy,
  Edit3,
  Eye,
  FileText,
  Filter,
  History,
  Inbox,
  Link2,
  Mail,
  Plus,
  Send,
  Sparkles,
  Trash2,
  Users,
} from 'lucide-react';
import { roleLabels, type Role } from '../../../domain/roles';
import { StatusIndicator } from '../../../shared/StatusIndicator';
import {
  communicationsRepository,
  type AudienceFilterParams,
  type AudienceMember,
  type AudiencePayload,
  type CommunicationDispatch,
  type DispatchDetailPayload,
  type EmailTemplate,
  type EmailTemplateCategory,
  type SentEmailDetail,
  type SentEmailSummary,
} from '../../../services/laravel-communications-repository';
import {
  laravelWorkspace,
  type ContactMessage,
} from '../../../services/laravel-workspace-repository';
import { errorText, fieldValue, RecordsFeedback, WorkspaceAction } from './WorkspaceActions';
import './communications.css';

type CommTab = 'enquiries' | 'broadcast' | 'templates' | 'history';
type HistorySubTab = 'outbox' | 'campaigns';
type HistoryPeriod = 'all' | 'today' | 'yesterday' | '7d' | '30d';
type HistoryTimeSlot = 'all' | 'morning' | 'afternoon' | 'evening' | 'night';

const TEMPLATE_VARIABLES = [
  ['{{first_name}}', 'First name'],
  ['{{name}}', 'Full name'],
  ['{{email}}', 'Email address'],
  ['{{role}}', 'User role'],
  ['{{institution}}', 'Institution'],
  ['{{platform_name}}', 'Platform name'],
] as const;

const TEMPLATE_CATEGORY_LABELS: Record<EmailTemplateCategory, string> = {
  onboarding: 'Onboarding',
  events: 'Events',
  incubation: 'Incubation',
  requests: 'Requests',
  enquiries: 'Enquiries',
  announcements: 'Announcements',
  general: 'General',
};

const SUGGESTED_BUTTON_ROUTES = [
  ['/dashboard', 'Open Dashboard'],
  ['/events', 'Events Page'],
  ['/opportunities', 'Opportunities Page'],
  ['/dashboard/workspace?tab=incubation', 'Incubation Pathway'],
  ['/dashboard/profile', 'User Profile'],
  ['/contact', 'Contact Page'],
  ['/marketplace', 'Shop Page'],
  ['/learn', 'Courses Page'],
] as const;

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

const EMPTY_FILTERS: AudienceFilterParams = {
  search: '',
  role: 'all',
  institution_id: 'all',
  verified: 'all',
  status: 'active',
  venture: 'all',
  incubation: 'all',
  event_id: 'all',
  location: 'all',
};

function interpolatePreview(
  text: string,
  sample?: {
    name?: string;
    email?: string;
    role?: string;
    institution_name?: string | null;
    topic?: string;
  },
): string {
  const name = sample?.name || 'Amina Ochieng';
  const vars: Record<string, string> = {
    name,
    first_name: name.split(/\s+/)[0] || name,
    email: sample?.email || 'amina@example.com',
    role:
      sample?.role && Object.hasOwn(roleLabels, sample.role)
        ? roleLabels[sample.role as Role]
        : sample?.role || 'Youth Entrepreneur',
    institution: sample?.institution_name || 'Independent',
    topic: sample?.topic || 'Programme Enquiry',
    platform_name: 'Youth Entrepreneurship Resource Hub',
  };
  return text.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key: string) => {
    const k = key.toLowerCase();
    return Object.hasOwn(vars, k) ? vars[k]! : match;
  });
}

function parseUtcDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const normalized = value.includes('T') ? value : value.replace(' ', 'T') + 'Z';
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDateTime(value: string | null | undefined): string {
  const date = parseUtcDate(value);
  if (!date) return value || '—';
  return date.toLocaleString('en-KE', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Africa/Nairobi',
  });
}

function nairobiDateParts(date: Date): { ymd: string; weekday: string; hour: number } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Nairobi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const map = new Map(parts.map((part) => [part.type, part.value]));
  const y = map.get('year') ?? '1970';
  const m = map.get('month') ?? '01';
  const d = map.get('day') ?? '01';
  const hourRaw = Number(map.get('hour') ?? '0');

  return {
    ymd: `${y}-${m}-${d}`,
    weekday: (map.get('weekday') ?? '').slice(0, 3),
    hour: hourRaw === 24 ? 0 : hourRaw,
  };
}

function addDaysYmd(ymd: string, delta: number): string {
  const date = new Date(`${ymd}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

function matchesHistoryFilters(
  timestamp: string | null | undefined,
  searchText: string,
  searchableFields: string[],
  period: HistoryPeriod,
  exactDate: string,
  weekday: string,
  timeSlot: HistoryTimeSlot,
  todayYmd: string,
): boolean {
  const q = searchText.trim().toLowerCase();
  if (q) {
    const haystack = searchableFields.join(' ').toLowerCase();
    if (!haystack.includes(q)) return false;
  }

  const parsed = parseUtcDate(timestamp);
  if (!parsed) {
    return period === 'all' && !exactDate && weekday === 'all' && timeSlot === 'all';
  }

  const { ymd, weekday: rowDay, hour } = nairobiDateParts(parsed);

  if (exactDate && ymd !== exactDate) {
    return false;
  }

  if (period === 'today' && ymd !== todayYmd) {
    return false;
  }
  if (period === 'yesterday' && ymd !== addDaysYmd(todayYmd, -1)) {
    return false;
  }
  if (period === '7d' && ymd < addDaysYmd(todayYmd, -6)) {
    return false;
  }
  if (period === '30d' && ymd < addDaysYmd(todayYmd, -29)) {
    return false;
  }

  if (weekday !== 'all' && rowDay.toLowerCase() !== weekday.toLowerCase()) {
    return false;
  }

  if (timeSlot === 'morning' && !(hour >= 6 && hour < 12)) return false;
  if (timeSlot === 'afternoon' && !(hour >= 12 && hour < 17)) return false;
  if (timeSlot === 'evening' && !(hour >= 17 && hour < 21)) return false;
  if (timeSlot === 'night' && !(hour >= 21 || hour < 6)) return false;

  return true;
}

export function CommunicationsWorkspace() {
  const [tab, setTab] = useState<CommTab>('enquiries');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [enquiries, setEnquiries] = useState<ContactMessage[]>([]);
  const [audienceData, setAudienceData] = useState<AudiencePayload | null>(null);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [history, setHistory] = useState<CommunicationDispatch[]>([]);
  const [outbox, setOutbox] = useState<SentEmailSummary[]>([]);

  // Enquiries tab state
  const [enquiryStatusFilter, setEnquiryStatusFilter] = useState<'all' | ContactMessage['status']>(
    'all',
  );
  const [enquirySearch, setEnquirySearch] = useState('');
  const [replyingTo, setReplyingTo] = useState<ContactMessage | null>(null);
  const [replySubject, setReplySubject] = useState('');
  const [replyBody, setReplyBody] = useState('');
  const [replyTemplateId, setReplyTemplateId] = useState<number | null>(null);
  const [replyStatusAfter, setReplyStatusAfter] = useState<'resolved' | 'read'>('resolved');
  const [replyBusy, setReplyBusy] = useState(false);

  // Broadcast & simplified collapsible filters state
  const [filters, setFilters] = useState<AudienceFilterParams>(EMPTY_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filteredUsers, setFilteredUsers] = useState<AudienceMember[]>([]);
  const [audienceLoading, setAudienceLoading] = useState(false);
  const [selectionMode, setSelectionMode] = useState<'selected' | 'filtered' | 'all'>('selected');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [channel, setChannel] = useState<'both' | 'email' | 'notification'>('both');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [sendingBroadcast, setSendingBroadcast] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  // Template Library state
  const [templateCategoryFilter, setTemplateCategoryFilter] = useState<string>('all');
  const [templateSearch, setTemplateSearch] = useState('');
  const [editingTemplate, setEditingTemplate] = useState<Partial<EmailTemplate> | null>(null);
  const [templateBusy, setTemplateBusy] = useState(false);

  // Sent History + UI Email Outbox state
  const [historySubTab, setHistorySubTab] = useState<HistorySubTab>('outbox');
  const [historySearch, setHistorySearch] = useState('');
  const [historyPeriod, setHistoryPeriod] = useState<HistoryPeriod>('all');
  const [historyDate, setHistoryDate] = useState('');
  const [historyDay, setHistoryDay] = useState('all');
  const [historyTimeSlot, setHistoryTimeSlot] = useState<HistoryTimeSlot>('all');
  const [selectedDispatch, setSelectedDispatch] = useState<DispatchDetailPayload | null>(null);
  const [selectedEmail, setSelectedEmail] = useState<SentEmailDetail | null>(null);
  const [emailViewMode, setEmailViewMode] = useState<'html' | 'text'>('html');

  const todayYmd = useMemo(() => nairobiDateParts(new Date()).ymd, []);

  const loadAll = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError('');
    try {
      const [msgs, aud, tpls, dispatches, sentEmails] = await Promise.all([
        laravelWorkspace.contactMessages(signal),
        communicationsRepository.audience(EMPTY_FILTERS, signal),
        communicationsRepository.templates(signal),
        communicationsRepository.history(signal),
        communicationsRepository.outbox(signal),
      ]);
      if (signal?.aborted) return;
      setEnquiries(msgs);
      setAudienceData(aud);
      setFilteredUsers(aud.users);
      setTemplates(tpls);
      setHistory(dispatches);
      setOutbox(sentEmails);
    } catch (failure) {
      if (!signal?.aborted) setError(errorText(failure));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void loadAll(controller.signal);
    return () => controller.abort();
  }, [loadAll]);

  const reloadAudienceFilters = useCallback(async (nextFilters: AudienceFilterParams) => {
    setAudienceLoading(true);
    try {
      const aud = await communicationsRepository.audience(nextFilters);
      setAudienceData(aud);
      setFilteredUsers(aud.users);
    } catch (failure) {
      setError(errorText(failure));
    } finally {
      setAudienceLoading(false);
    }
  }, []);

  function applyFilters(next: AudienceFilterParams) {
    setFilters(next);
    if (selectionMode === 'all') setSelectionMode('filtered');
    void reloadAudienceFilters(next);
  }

  function resetAllFilters() {
    setFilters(EMPTY_FILTERS);
    void reloadAudienceFilters(EMPTY_FILTERS);
  }

  const accountComboValue = useMemo(() => {
    if (filters.status === 'suspended') return 'suspended';
    if (filters.status === 'all' && filters.verified === 'all') return 'all';
    if (filters.verified === 'verified') return 'verified';
    if (filters.verified === 'unverified') return 'unverified';
    return 'active';
  }, [filters.status, filters.verified]);

  const journeyComboValue = useMemo(() => {
    if (filters.incubation === 'active') return 'incubation_active';
    if (filters.incubation === 'graduated') return 'incubation_graduated';
    if (filters.venture === 'approved') return 'venture_approved';
    if (filters.venture === 'pending') return 'venture_pending';
    if (filters.venture === 'none') return 'venture_none';
    return 'all';
  }, [filters.venture, filters.incubation]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.role && filters.role !== 'all') count++;
    if (filters.institution_id && filters.institution_id !== 'all') count++;
    if (accountComboValue !== 'active') count++;
    if (journeyComboValue !== 'all') count++;
    if (filters.event_id && filters.event_id !== 'all') count++;
    return count;
  }, [
    filters.role,
    filters.institution_id,
    filters.event_id,
    accountComboValue,
    journeyComboValue,
  ]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const allFilteredSelected =
    filteredUsers.length > 0 && filteredUsers.every((u) => selectedSet.has(u.id));

  function toggleUserSelection(id: number) {
    setSelectionMode('selected');
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  }

  function toggleAllFilteredCheckboxes() {
    setSelectionMode('selected');
    if (allFilteredSelected) {
      const filteredSet = new Set(filteredUsers.map((u) => u.id));
      setSelectedIds((prev) => prev.filter((id) => !filteredSet.has(id)));
    } else {
      const merged = new Set([...selectedIds, ...filteredUsers.map((u) => u.id)]);
      setSelectedIds([...merged]);
    }
  }

  function applyTemplateToComposer(template: EmailTemplate) {
    setSubject(template.subject);
    setBody(template.body);
    setSelectedTemplateId(template.id);
    setTab('broadcast');
    setNotice(`Loaded "${template.name}" into the composer. Edit it as needed before sending.`);
  }

  function insertVariableIntoBody(token: string) {
    const el = bodyRef.current;
    if (!el) {
      setBody((prev) => (prev ? `${prev} ${token}` : token));
      return;
    }
    const start = el.selectionStart ?? body.length;
    const end = el.selectionEnd ?? body.length;
    const next = body.slice(0, start) + token + body.slice(end);
    setBody(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  }

  async function saveCurrentAsTemplate() {
    if (!subject.trim() || !body.trim()) {
      setError('Enter a subject and message before saving as a template.');
      return;
    }
    const name = window.prompt(
      'Name for this reusable email template:',
      subject.trim().slice(0, 60),
    );
    if (!name || !name.trim()) return;
    setError('');
    try {
      const activeTpl = templates.find((item) => item.id === selectedTemplateId);
      const saved = await communicationsRepository.saveTemplate({
        name: name.trim(),
        category: activeTpl?.category ?? 'general',
        subject: subject.trim(),
        body: body.trim(),
        action_label: activeTpl?.action_label ?? null,
        action_url: activeTpl?.action_url ?? null,
      });
      setTemplates((prev) => [saved, ...prev]);
      setSelectedTemplateId(saved.id);
      setNotice(`Saved "${saved.name}" to your Template Library.`);
    } catch (failure) {
      setError(errorText(failure));
    }
  }

  async function refreshDispatchesAndOutbox() {
    const [dispatches, sentEmails, aud] = await Promise.all([
      communicationsRepository.history(),
      communicationsRepository.outbox(),
      communicationsRepository.audience(filters),
    ]);
    setHistory(dispatches);
    setOutbox(sentEmails);
    setAudienceData(aud);
  }

  async function handleSendBroadcast(event: FormEvent) {
    event.preventDefault();
    setError('');
    setNotice('');

    if (selectionMode === 'selected' && selectedIds.length === 0) {
      setError('Select at least one recipient before sending.');
      return;
    }

    setSendingBroadcast(true);
    try {
      const res = await communicationsRepository.broadcast({
        subject: subject.trim(),
        body: body.trim(),
        channel,
        selection_mode: selectionMode,
        user_ids: selectionMode === 'selected' ? selectedIds : undefined,
        filters: selectionMode === 'filtered' ? filters : undefined,
        template_id: selectedTemplateId,
      });
      setNotice(
        `Dispatch #${res.dispatch_id} completed: ${res.sent_count} of ${res.recipient_count} recipients processed` +
          (res.failed_count > 0
            ? ` (${res.failed_count} failed).`
            : '. View the full email under Sent History.'),
      );
      window.dispatchEvent(new Event('yerh:workspace-updated'));
      await refreshDispatchesAndOutbox();
    } catch (failure) {
      setError(errorText(failure));
    } finally {
      setSendingBroadcast(false);
    }
  }

  function startEnquiryReply(row: ContactMessage) {
    setReplyingTo(row);
    setReplySubject(`Re: ${row.topic} — YERH Support`);
    setReplyBody(
      `Hello ${row.name.split(/\s+/)[0] || row.name},\n\nThank you for reaching out regarding "${row.topic}".\n\n`,
    );
    setReplyTemplateId(null);
    setReplyStatusAfter('resolved');
  }

  async function submitEnquiryReply(event: FormEvent) {
    event.preventDefault();
    if (!replyingTo) return;
    setReplyBusy(true);
    setError('');
    setNotice('');
    try {
      await communicationsRepository.replyToEnquiry(replyingTo.id, {
        subject: replySubject.trim(),
        body: replyBody.trim(),
        template_id: replyTemplateId,
        mark_status: replyStatusAfter,
      });
      setNotice(
        `Reply captured and queued for ${replyingTo.email}; enquiry marked ${replyStatusAfter}.`,
      );
      setReplyingTo(null);
      window.dispatchEvent(new Event('yerh:workspace-updated'));
      const [msgs] = await Promise.all([
        laravelWorkspace.contactMessages(),
        refreshDispatchesAndOutbox(),
      ]);
      setEnquiries(msgs);
    } catch (failure) {
      setError(errorText(failure));
    } finally {
      setReplyBusy(false);
    }
  }

  async function submitTemplateForm(event: FormEvent) {
    event.preventDefault();
    if (!editingTemplate) return;
    setTemplateBusy(true);
    setError('');
    setNotice('');
    try {
      const saved = await communicationsRepository.saveTemplate(
        {
          name: String(editingTemplate.name ?? '').trim(),
          category: (editingTemplate.category as EmailTemplateCategory) || 'general',
          subject: String(editingTemplate.subject ?? '').trim(),
          body: String(editingTemplate.body ?? '').trim(),
          action_label: String(editingTemplate.action_label ?? '').trim() || null,
          action_url: String(editingTemplate.action_url ?? '').trim() || null,
        },
        editingTemplate.id,
      );
      setTemplates((prev) =>
        editingTemplate.id
          ? prev.map((item) => (item.id === saved.id ? saved : item))
          : [saved, ...prev],
      );
      setEditingTemplate(null);
      setNotice(`Saved template "${saved.name}".`);
    } catch (failure) {
      setError(errorText(failure));
    } finally {
      setTemplateBusy(false);
    }
  }

  async function removeTemplate(tpl: EmailTemplate) {
    if (!window.confirm(`Delete template "${tpl.name}"?`)) return;
    setError('');
    try {
      await communicationsRepository.deleteTemplate(tpl.id);
      setTemplates((prev) => prev.filter((item) => item.id !== tpl.id));
      if (selectedTemplateId === tpl.id) setSelectedTemplateId(null);
      setNotice(`Deleted template "${tpl.name}".`);
    } catch (failure) {
      setError(errorText(failure));
    }
  }

  const visibleEnquiries = useMemo(() => {
    const q = enquirySearch.trim().toLowerCase();
    return enquiries.filter((row) => {
      if (enquiryStatusFilter !== 'all' && row.status !== enquiryStatusFilter) return false;
      if (!q) return true;
      return [row.name, row.email, row.topic, row.message, row.admin_notes ?? '']
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }, [enquiries, enquiryStatusFilter, enquirySearch]);

  const visibleTemplates = useMemo(() => {
    const q = templateSearch.trim().toLowerCase();
    return templates.filter((tpl) => {
      if (templateCategoryFilter !== 'all' && tpl.category !== templateCategoryFilter) {
        return false;
      }
      if (!q) return true;
      return [
        tpl.name,
        tpl.category,
        tpl.subject,
        tpl.body,
        tpl.action_label ?? '',
        tpl.action_url ?? '',
      ]
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }, [templates, templateCategoryFilter, templateSearch]);

  const visibleOutbox = useMemo(
    () =>
      outbox.filter((row) =>
        matchesHistoryFilters(
          row.created_at,
          historySearch,
          [row.subject, row.to_email, row.to_name ?? '', row.text_preview],
          historyPeriod,
          historyDate,
          historyDay,
          historyTimeSlot,
          todayYmd,
        ),
      ),
    [outbox, historySearch, historyPeriod, historyDate, historyDay, historyTimeSlot, todayYmd],
  );

  const visibleDispatches = useMemo(
    () =>
      history.filter((row) =>
        matchesHistoryFilters(
          row.created_at,
          historySearch,
          [
            row.subject,
            row.template_name ?? '',
            row.sender_name ?? '',
            row.enquiry_email ?? '',
            row.enquiry_name ?? '',
          ],
          historyPeriod,
          historyDate,
          historyDay,
          historyTimeSlot,
          todayYmd,
        ),
      ),
    [history, historySearch, historyPeriod, historyDate, historyDay, historyTimeSlot, todayYmd],
  );

  const hasHistoryFilters = Boolean(
    historySearch.trim() ||
    historyPeriod !== 'all' ||
    historyDate ||
    historyDay !== 'all' ||
    historyTimeSlot !== 'all',
  );

  const selectedTemplate = useMemo(
    () => templates.find((tpl) => tpl.id === selectedTemplateId) ?? null,
    [templates, selectedTemplateId],
  );

  const activeAudienceCount =
    selectionMode === 'all'
      ? (audienceData?.total_users ?? 0)
      : selectionMode === 'filtered'
        ? filteredUsers.length
        : selectedIds.length;

  const previewSample = useMemo(() => {
    if (selectionMode === 'selected' && selectedIds.length > 0) {
      return filteredUsers.find((u) => selectedSet.has(u.id)) ?? filteredUsers[0];
    }
    return filteredUsers[0];
  }, [selectionMode, selectedIds.length, filteredUsers, selectedSet]);

  if (loading && !audienceData) {
    return <RecordsFeedback loading error={error} />;
  }

  const stats = audienceData?.stats;

  return (
    <div className="comm-workspace">
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="comm-notice-ok">
          {notice}
        </p>
      )}

      <div className="comm-tabs" role="tablist" aria-label="Emails sections">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'enquiries'}
          className={`comm-tab-btn${tab === 'enquiries' ? ' is-active' : ''}`}
          onClick={() => setTab('enquiries')}
        >
          <Inbox size={15} aria-hidden="true" />
          Enquiries &amp; Requests
          <span className="comm-tab-badge">{stats?.new_enquiries ?? 0}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'broadcast'}
          className={`comm-tab-btn${tab === 'broadcast' ? ' is-active' : ''}`}
          onClick={() => setTab('broadcast')}
        >
          <Send size={15} aria-hidden="true" />
          Broadcast &amp; Outreach
          <span className="comm-tab-badge">{audienceData?.total_users ?? 0}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'templates'}
          className={`comm-tab-btn${tab === 'templates' ? ' is-active' : ''}`}
          onClick={() => setTab('templates')}
        >
          <FileText size={15} aria-hidden="true" />
          Template Library
          <span className="comm-tab-badge">{templates.length}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'history'}
          className={`comm-tab-btn${tab === 'history' ? ' is-active' : ''}`}
          onClick={() => setTab('history')}
        >
          <History size={15} aria-hidden="true" />
          Sent History
          <span className="comm-tab-badge">{outbox.length}</span>
        </button>
      </div>

      {tab === 'enquiries' && (
        <div className="comm-panel">
          <div className="comm-collapsible-filter-bar">
            <div className="comm-btn-row">
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                Status:
                <select
                  aria-label="Filter enquiries by status"
                  className="comm-inline-control"
                  style={{ width: 'auto' }}
                  value={enquiryStatusFilter}
                  onChange={(e) =>
                    setEnquiryStatusFilter(e.target.value as 'all' | ContactMessage['status'])
                  }
                >
                  <option value="all">All ({enquiries.length})</option>
                  <option value="new">
                    New ({enquiries.filter((e) => e.status === 'new').length})
                  </option>
                  <option value="read">
                    Read ({enquiries.filter((e) => e.status === 'read').length})
                  </option>
                  <option value="resolved">
                    Resolved ({enquiries.filter((e) => e.status === 'resolved').length})
                  </option>
                </select>
              </label>
            </div>
            <div className="comm-search-inline">
              <input
                type="search"
                aria-label="Search enquiries"
                placeholder="Search sender, email, topic, message…"
                value={enquirySearch}
                onChange={(e) => setEnquirySearch(e.target.value)}
              />
            </div>
            <button
              type="button"
              className="button button-outline button-small"
              onClick={() => setTab('broadcast')}
            >
              <Users size={14} aria-hidden="true" /> Message platform users →
            </button>
          </div>

          {replyingTo && (
            <form
              className="comm-panel"
              style={{ borderColor: 'var(--yerh-gold)' }}
              onSubmit={(e) => void submitEnquiryReply(e)}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '0.5rem',
                }}
              >
                <div>
                  <h3 style={{ margin: 0 }}>
                    Reply by email to {replyingTo.name} ({replyingTo.email})
                  </h3>
                  <small style={{ color: 'var(--yerh-muted)' }}>
                    Original topic: {replyingTo.topic}
                  </small>
                </div>
                <button
                  type="button"
                  className="button button-outline button-small"
                  onClick={() => setReplyingTo(null)}
                >
                  Close reply
                </button>
              </div>

              <div className="comm-filter-grid">
                <label>
                  Load template into reply
                  <select
                    value={replyTemplateId ?? ''}
                    onChange={(e) => {
                      const id = Number(e.target.value);
                      const chosen = templates.find((t) => t.id === id);
                      if (chosen) {
                        setReplyTemplateId(chosen.id);
                        setReplySubject(
                          interpolatePreview(chosen.subject, {
                            name: replyingTo.name,
                            email: replyingTo.email,
                            topic: replyingTo.topic,
                          }),
                        );
                        setReplyBody(
                          interpolatePreview(chosen.body, {
                            name: replyingTo.name,
                            email: replyingTo.email,
                            topic: replyingTo.topic,
                          }),
                        );
                      } else {
                        setReplyTemplateId(null);
                      }
                    }}
                  >
                    <option value="">Choose a template to insert…</option>
                    {templates.map((tpl) => (
                      <option key={tpl.id} value={tpl.id}>
                        [{TEMPLATE_CATEGORY_LABELS[tpl.category]}] {tpl.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Mark enquiry status after sending
                  <select
                    value={replyStatusAfter}
                    onChange={(e) => setReplyStatusAfter(e.target.value as 'resolved' | 'read')}
                  >
                    <option value="resolved">Resolved</option>
                    <option value="read">Read (awaiting further follow-up)</option>
                  </select>
                </label>
              </div>

              <label className="comm-field">
                Email subject
                <input
                  value={replySubject}
                  onChange={(e) => setReplySubject(e.target.value)}
                  maxLength={180}
                  required
                />
              </label>

              <label className="comm-field">
                Email reply message (editable before sending)
                <textarea
                  rows={6}
                  value={replyBody}
                  onChange={(e) => setReplyBody(e.target.value)}
                  maxLength={8000}
                  required
                />
              </label>

              <div className="comm-btn-row">
                <button type="submit" className="button" disabled={replyBusy}>
                  <Send size={15} aria-hidden="true" />{' '}
                  {replyBusy ? 'Sending email…' : 'Send email reply'}
                </button>
                <button
                  type="button"
                  className="button button-outline"
                  onClick={() => setReplyingTo(null)}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          <div className="comm-table-wrap">
            <table className="comm-table">
              <thead>
                <tr>
                  <th>Sender</th>
                  <th>Topic</th>
                  <th>Message &amp; notes</th>
                  <th>Status</th>
                  <th>Replies</th>
                  <th>Handled</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleEnquiries.length === 0 ? (
                  <tr>
                    <td colSpan={7}>No enquiries match your current filter.</td>
                  </tr>
                ) : (
                  visibleEnquiries.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <strong>{row.name}</strong>
                        <div>
                          <small>{row.email}</small>
                        </div>
                      </td>
                      <td>{row.topic}</td>
                      <td>
                        <div>{row.message}</div>
                        {row.admin_notes && (
                          <small style={{ color: 'var(--yerh-muted)' }}>
                            Note: {row.admin_notes}
                          </small>
                        )}
                      </td>
                      <td>
                        <StatusIndicator status={row.status} />
                      </td>
                      <td>
                        {row.reply_count ? (
                          <div>
                            <strong>{row.reply_count}</strong> sent
                            <div>
                              <small>{formatDateTime(row.replied_at)}</small>
                            </div>
                          </div>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>
                        {row.handler_name ? (
                          <div>
                            {row.handler_name}
                            <div>
                              <small>{formatDateTime(row.handled_at)}</small>
                            </div>
                          </div>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>
                        <div className="comm-btn-row">
                          <button
                            type="button"
                            className="button button-small"
                            onClick={() => startEnquiryReply(row)}
                          >
                            <Mail size={13} aria-hidden="true" /> Reply
                          </button>
                          <WorkspaceAction
                            action="Update"
                            title={`${row.topic} · ${row.name}`}
                            submit="Save"
                            save={async (data) => {
                              await laravelWorkspace.updateContactMessage(
                                row.id,
                                fieldValue(data, 'status') as ContactMessage['status'],
                                fieldValue(data, 'admin_notes'),
                              );
                              const msgs = await laravelWorkspace.contactMessages();
                              setEnquiries(msgs);
                            }}
                          >
                            <label>
                              Status
                              <select name="status" defaultValue={row.status}>
                                <option value="new">New</option>
                                <option value="read">Read</option>
                                <option value="resolved">Resolved</option>
                              </select>
                            </label>
                            <label>
                              Internal notes (optional)
                              <textarea
                                name="admin_notes"
                                defaultValue={row.admin_notes ?? ''}
                                maxLength={2000}
                                rows={3}
                              />
                            </label>
                          </WorkspaceAction>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'broadcast' && audienceData && (
        <>
          <div className="comm-panel">
            <div className="comm-collapsible-filter-bar">
              <div className="comm-search-inline">
                <input
                  type="search"
                  aria-label="Search recipients"
                  placeholder="Search recipients by name, email, venture, or location…"
                  value={filters.search ?? ''}
                  onChange={(e) => applyFilters({ ...filters, search: e.target.value })}
                />
              </div>
              <div className="comm-btn-row">
                <button
                  type="button"
                  className="button button-outline button-small"
                  aria-expanded={filtersOpen}
                  onClick={() => setFiltersOpen((open) => !open)}
                >
                  <Filter size={14} aria-hidden="true" /> Filter
                  {activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
                  {filtersOpen ? (
                    <ChevronUp size={14} aria-hidden="true" />
                  ) : (
                    <ChevronDown size={14} aria-hidden="true" />
                  )}
                </button>
                {(activeFilterCount > 0 || (filters.search ?? '').trim()) && (
                  <button
                    type="button"
                    className="button button-outline button-small"
                    onClick={resetAllFilters}
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>

            {filtersOpen && (
              <div className="comm-filter-grid">
                <label>
                  Role
                  <select
                    value={filters.role ?? 'all'}
                    onChange={(e) => applyFilters({ ...filters, role: e.target.value })}
                  >
                    <option value="all">All roles</option>
                    <option value="entrepreneur">Youth Entrepreneur</option>
                    <option value="mentor">Mentor</option>
                    <option value="guest">Guest</option>
                    <option value="school_admin">Institutional Admin</option>
                    <option value="content_manager">Content Manager</option>
                    <option value="admin">Platform Admin</option>
                    <option value="partner">Partner</option>
                    <option value="investor">Investor</option>
                  </select>
                </label>

                <label>
                  Institution
                  <select
                    value={filters.institution_id ?? 'all'}
                    onChange={(e) => applyFilters({ ...filters, institution_id: e.target.value })}
                  >
                    <option value="all">All institutions</option>
                    <option value="none">Independent</option>
                    {audienceData.filters.institutions.map((inst) => (
                      <option key={inst.id} value={String(inst.id)}>
                        {inst.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Account
                  <select
                    value={accountComboValue}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === 'verified') {
                        applyFilters({ ...filters, status: 'active', verified: 'verified' });
                      } else if (val === 'unverified') {
                        applyFilters({ ...filters, status: 'active', verified: 'unverified' });
                      } else if (val === 'suspended') {
                        applyFilters({ ...filters, status: 'suspended', verified: 'all' });
                      } else if (val === 'all') {
                        applyFilters({ ...filters, status: 'all', verified: 'all' });
                      } else {
                        applyFilters({ ...filters, status: 'active', verified: 'all' });
                      }
                    }}
                  >
                    <option value="active">Active accounts</option>
                    <option value="verified">Verified email only</option>
                    <option value="unverified">Unverified email only</option>
                    <option value="suspended">Suspended only</option>
                    <option value="all">All accounts</option>
                  </select>
                </label>

                <label>
                  Venture &amp; Incubation
                  <select
                    value={journeyComboValue}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === 'venture_approved') {
                        applyFilters({ ...filters, venture: 'approved', incubation: 'all' });
                      } else if (val === 'venture_pending') {
                        applyFilters({ ...filters, venture: 'pending', incubation: 'all' });
                      } else if (val === 'venture_none') {
                        applyFilters({ ...filters, venture: 'none', incubation: 'all' });
                      } else if (val === 'incubation_active') {
                        applyFilters({ ...filters, venture: 'all', incubation: 'active' });
                      } else if (val === 'incubation_graduated') {
                        applyFilters({ ...filters, venture: 'all', incubation: 'graduated' });
                      } else {
                        applyFilters({ ...filters, venture: 'all', incubation: 'all' });
                      }
                    }}
                  >
                    <option value="all">All stages</option>
                    <option value="venture_approved">Approved venture</option>
                    <option value="venture_pending">Pending venture</option>
                    <option value="venture_none">No venture yet</option>
                    <option value="incubation_active">Active in incubation</option>
                    <option value="incubation_graduated">Graduated incubation</option>
                  </select>
                </label>

                <label>
                  Event
                  <select
                    value={filters.event_id ?? 'all'}
                    onChange={(e) => applyFilters({ ...filters, event_id: e.target.value })}
                  >
                    <option value="all">Any / all events</option>
                    {audienceData.filters.events.map((ev) => (
                      <option key={ev.id} value={String(ev.id)}>
                        {ev.title}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}
          </div>

          <div className="comm-broadcast-split">
            <div className="comm-panel">
              <div className="comm-selection-bar">
                <div>
                  <strong>
                    {audienceLoading
                      ? 'Filtering users…'
                      : `Showing ${filteredUsers.length} of ${audienceData.total_users} users`}
                  </strong>
                  <div>
                    <small>
                      Target mode:{' '}
                      <strong>
                        {selectionMode === 'all'
                          ? `All ${audienceData.total_users} active platform users`
                          : selectionMode === 'filtered'
                            ? `All ${filteredUsers.length} filtered users`
                            : `${selectedIds.length} individually selected`}
                      </strong>
                    </small>
                  </div>
                </div>
                <div className="comm-btn-row">
                  <button
                    type="button"
                    className={`button button-small${selectionMode === 'filtered' ? '' : ' button-outline'}`}
                    disabled={filteredUsers.length === 0}
                    onClick={() => {
                      setSelectionMode('filtered');
                      setSelectedIds(filteredUsers.map((u) => u.id));
                    }}
                  >
                    <CheckSquare size={14} aria-hidden="true" /> Select all filtered (
                    {filteredUsers.length})
                  </button>
                  <button
                    type="button"
                    className={`button button-small${selectionMode === 'all' ? '' : ' button-outline'}`}
                    onClick={() => setSelectionMode('all')}
                  >
                    Select all users ({audienceData.total_users})
                  </button>
                  {(selectedIds.length > 0 || selectionMode !== 'selected') && (
                    <button
                      type="button"
                      className="button button-outline button-small"
                      onClick={() => {
                        setSelectionMode('selected');
                        setSelectedIds([]);
                      }}
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              <div className="comm-table-wrap">
                <table className="comm-table">
                  <thead>
                    <tr>
                      <th style={{ width: '36px' }}>
                        <input
                          type="checkbox"
                          aria-label="Toggle all visible filtered users"
                          checked={allFilteredSelected}
                          onChange={toggleAllFilteredCheckboxes}
                        />
                      </th>
                      <th>User</th>
                      <th>Role &amp; Institution</th>
                      <th>Journey</th>
                      <th>Quick</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={5}>No users match these filter criteria.</td>
                      </tr>
                    ) : (
                      filteredUsers.map((user) => {
                        const checked =
                          selectionMode === 'all' ||
                          selectionMode === 'filtered' ||
                          selectedSet.has(user.id);
                        return (
                          <tr key={user.id} className={checked ? 'is-selected' : undefined}>
                            <td>
                              <input
                                type="checkbox"
                                aria-label={`Select ${user.name}`}
                                checked={checked}
                                onChange={() => toggleUserSelection(user.id)}
                              />
                            </td>
                            <td>
                              <strong>{user.name}</strong>
                              <div>
                                <small>{user.email}</small>
                              </div>
                              {!user.email_verified_at && (
                                <StatusIndicator status="pending" label="Unverified" />
                              )}
                              {user.suspended_at && <StatusIndicator status="suspended" />}
                            </td>
                            <td>
                              <div>
                                {Object.hasOwn(roleLabels, user.role)
                                  ? roleLabels[user.role as Role]
                                  : user.role}
                              </div>
                              <small style={{ color: 'var(--yerh-muted)' }}>
                                {user.institution_name || 'Independent'}
                                {user.location ? ` · ${user.location}` : ''}
                              </small>
                            </td>
                            <td>
                              <small>
                                Ventures: {user.venture_count} ({user.venture_status})
                                <br />
                                Incubation: {user.incubation_status} · Events:{' '}
                                {user.event_ids.length}
                              </small>
                            </td>
                            <td>
                              <button
                                type="button"
                                className="button button-outline button-small"
                                onClick={() => {
                                  setSelectionMode('selected');
                                  setSelectedIds([user.id]);
                                }}
                              >
                                Target
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <form className="comm-panel" onSubmit={(e) => void handleSendBroadcast(e)}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.5rem',
                  flexWrap: 'wrap',
                }}
              >
                <h2 style={{ margin: 0 }}>Compose Message / Request</h2>
                <button
                  type="button"
                  className="button button-outline button-small"
                  onClick={() => void saveCurrentAsTemplate()}
                >
                  <Sparkles size={14} aria-hidden="true" /> Save as template
                </button>
              </div>

              <label className="comm-field">
                Load template from Library (pastes straight into editor)
                <select
                  value={selectedTemplateId ?? ''}
                  onChange={(e) => {
                    const id = Number(e.target.value);
                    const chosen = templates.find((t) => t.id === id);
                    if (chosen) {
                      setSubject(chosen.subject);
                      setBody(chosen.body);
                      setSelectedTemplateId(chosen.id);
                    } else {
                      setSelectedTemplateId(null);
                    }
                  }}
                >
                  <option value="">Write from scratch or pick a template…</option>
                  {templates.map((tpl) => (
                    <option key={tpl.id} value={tpl.id}>
                      [{TEMPLATE_CATEGORY_LABELS[tpl.category]}] {tpl.name}
                    </option>
                  ))}
                </select>
              </label>

              {selectedTemplate?.action_url && (
                <div className="comm-template-cta-badge">
                  <Link2 size={13} aria-hidden="true" />
                  Template button: <strong>
                    {selectedTemplate.action_label || 'Open YERH'}
                  </strong> → <code>{selectedTemplate.action_url}</code>
                </div>
              )}

              <label className="comm-field">
                Delivery channel
                <select
                  value={channel}
                  onChange={(e) => setChannel(e.target.value as 'both' | 'email' | 'notification')}
                >
                  <option value="both">Email + In-App Notification (Recommended)</option>
                  <option value="email">Email only</option>
                  <option value="notification">In-App Notification only</option>
                </select>
              </label>

              <label className="comm-field">
                Subject line
                <input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g. Action required or upcoming session update"
                  maxLength={180}
                  required
                />
              </label>

              <div className="comm-field">
                <span>Message body (supports personalization variables)</span>
                <div className="comm-chip-bar" style={{ marginBottom: '0.35rem' }}>
                  <small style={{ color: 'var(--yerh-muted)' }}>Insert:</small>
                  {TEMPLATE_VARIABLES.map(([token, label]) => (
                    <button
                      type="button"
                      key={token}
                      title={`Insert ${label}`}
                      className="comm-var-chip"
                      onClick={() => insertVariableIntoBody(token)}
                    >
                      {token}
                    </button>
                  ))}
                </div>
                <textarea
                  ref={bodyRef}
                  rows={8}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Write your email or request message here…"
                  maxLength={8000}
                  required
                />
              </div>

              <div className="comm-btn-row">
                <button
                  type="button"
                  className="button button-outline"
                  onClick={() => setShowPreview((v) => !v)}
                >
                  <Eye size={15} aria-hidden="true" />{' '}
                  {showPreview ? 'Hide preview' : 'Preview message'}
                </button>
                <button
                  type="submit"
                  className="button"
                  disabled={sendingBroadcast || activeAudienceCount === 0}
                >
                  <Send size={15} aria-hidden="true" />{' '}
                  {sendingBroadcast
                    ? 'Sending…'
                    : `Send to ${activeAudienceCount} user${activeAudienceCount === 1 ? '' : 's'}`}
                </button>
              </div>

              {showPreview && (
                <div className="comm-email-preview" aria-label="Rendered email preview">
                  <small style={{ color: 'var(--yerh-muted)' }}>
                    Sample preview for: <strong>{previewSample?.name || 'Sample User'}</strong> (
                    {previewSample?.email || 'member@example.com'})
                  </small>
                  <strong>
                    Subject: {interpolatePreview(subject || '(No subject)', previewSample)}
                  </strong>
                  <div style={{ whiteSpace: 'pre-line', fontSize: '0.9rem' }}>
                    {interpolatePreview(body || '(Empty message)', previewSample)}
                  </div>
                  {selectedTemplate?.action_url && (
                    <div className="comm-preview-cta-wrap">
                      <span className="comm-preview-cta">
                        {selectedTemplate.action_label || 'Open YERH'}
                      </span>
                      <small style={{ color: 'var(--yerh-muted)' }}>
                        Links to <code>{selectedTemplate.action_url}</code>
                      </small>
                    </div>
                  )}
                </div>
              )}
            </form>
          </div>
        </>
      )}

      {tab === 'templates' && (
        <div className="comm-panel">
          <div className="comm-collapsible-filter-bar">
            <div className="comm-btn-row">
              <select
                aria-label="Filter templates by category"
                className="comm-inline-control"
                style={{ width: 'auto' }}
                value={templateCategoryFilter}
                onChange={(e) => setTemplateCategoryFilter(e.target.value)}
              >
                <option value="all">All categories</option>
                {Object.entries(TEMPLATE_CATEGORY_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="comm-search-inline">
              <input
                type="search"
                aria-label="Search templates"
                placeholder="Search templates…"
                value={templateSearch}
                onChange={(e) => setTemplateSearch(e.target.value)}
              />
            </div>
            <button
              type="button"
              className="button"
              onClick={() =>
                setEditingTemplate({
                  name: '',
                  category: 'general',
                  subject: '',
                  body: 'Hello {{first_name}},\n\n',
                  action_label: '',
                  action_url: '',
                })
              }
            >
              <Plus size={15} aria-hidden="true" /> New email template
            </button>
          </div>

          {editingTemplate && (
            <form
              className="comm-panel"
              style={{ borderColor: 'var(--yerh-gold)' }}
              onSubmit={(e) => void submitTemplateForm(e)}
            >
              <h3 style={{ margin: 0 }}>
                {editingTemplate.id
                  ? `Edit template: ${editingTemplate.name}`
                  : 'Create email template'}
              </h3>
              <div className="comm-filter-grid">
                <label>
                  Template name
                  <input
                    value={editingTemplate.name ?? ''}
                    onChange={(e) =>
                      setEditingTemplate((prev) => ({ ...prev, name: e.target.value }))
                    }
                    maxLength={120}
                    required
                  />
                </label>
                <label>
                  Category
                  <select
                    value={editingTemplate.category ?? 'general'}
                    onChange={(e) =>
                      setEditingTemplate((prev) => ({
                        ...prev,
                        category: e.target.value as EmailTemplateCategory,
                      }))
                    }
                  >
                    {Object.entries(TEMPLATE_CATEGORY_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Button label (optional)
                  <input
                    value={editingTemplate.action_label ?? ''}
                    onChange={(e) =>
                      setEditingTemplate((prev) => ({ ...prev, action_label: e.target.value }))
                    }
                    placeholder="e.g. View Upcoming Events"
                    maxLength={80}
                  />
                </label>
                <label>
                  Button link (optional)
                  <input
                    list="comm-template-routes"
                    value={editingTemplate.action_url ?? ''}
                    onChange={(e) =>
                      setEditingTemplate((prev) => ({ ...prev, action_url: e.target.value }))
                    }
                    placeholder="/events or https://..."
                    maxLength={300}
                  />
                </label>
              </div>
              <datalist id="comm-template-routes">
                {SUGGESTED_BUTTON_ROUTES.map(([route, label]) => (
                  <option key={route} value={route}>
                    {label}
                  </option>
                ))}
              </datalist>

              <label className="comm-field">
                Subject line
                <input
                  value={editingTemplate.subject ?? ''}
                  onChange={(e) =>
                    setEditingTemplate((prev) => ({ ...prev, subject: e.target.value }))
                  }
                  maxLength={180}
                  required
                />
              </label>
              <label className="comm-field">
                Body (supports {TEMPLATE_VARIABLES.map(([v]) => v).join(', ')})
                <textarea
                  rows={6}
                  value={editingTemplate.body ?? ''}
                  onChange={(e) =>
                    setEditingTemplate((prev) => ({ ...prev, body: e.target.value }))
                  }
                  maxLength={8000}
                  required
                />
              </label>

              <div className="comm-email-preview">
                <small style={{ color: 'var(--yerh-muted)' }}>Live template email preview</small>
                <strong>
                  {interpolatePreview(editingTemplate.subject || '(Subject preview)')}
                </strong>
                <div style={{ whiteSpace: 'pre-line', fontSize: '0.88rem' }}>
                  {interpolatePreview(editingTemplate.body || '')}
                </div>
                {editingTemplate.action_url?.trim() && (
                  <div className="comm-preview-cta-wrap">
                    <span className="comm-preview-cta">
                      {editingTemplate.action_label?.trim() || 'Open YERH'}
                    </span>
                    <small style={{ color: 'var(--yerh-muted)' }}>
                      Links to <code>{editingTemplate.action_url.trim()}</code>
                    </small>
                  </div>
                )}
              </div>

              <div className="comm-btn-row">
                <button type="submit" className="button" disabled={templateBusy}>
                  {templateBusy ? 'Saving…' : 'Save template'}
                </button>
                <button
                  type="button"
                  className="button button-outline"
                  onClick={() => setEditingTemplate(null)}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          <div className="comm-template-grid">
            {visibleTemplates.map((tpl) => (
              <article className="comm-template-card" key={tpl.id}>
                <span className="comm-category-pill">
                  {TEMPLATE_CATEGORY_LABELS[tpl.category] ?? tpl.category}
                </span>
                <h3 style={{ margin: 0, fontSize: '1.05rem' }}>{tpl.name}</h3>
                <div style={{ fontSize: '0.86rem', fontWeight: 600 }}>{tpl.subject}</div>
                <p
                  style={{
                    margin: 0,
                    fontSize: '0.84rem',
                    color: 'var(--yerh-muted)',
                    whiteSpace: 'pre-line',
                    display: '-webkit-box',
                    WebkitLineClamp: 4,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {tpl.body}
                </p>
                {tpl.action_url && (
                  <div className="comm-template-cta-badge">
                    <Link2 size={12} aria-hidden="true" />
                    <span>
                      <strong>{tpl.action_label || 'Open YERH'}</strong> ({tpl.action_url})
                    </span>
                  </div>
                )}
                <div className="comm-btn-row" style={{ marginTop: '0.35rem' }}>
                  <button
                    type="button"
                    className="button button-small"
                    onClick={() => applyTemplateToComposer(tpl)}
                  >
                    <Send size={13} aria-hidden="true" /> Use in Broadcast
                  </button>
                  <button
                    type="button"
                    className="button button-outline button-small"
                    onClick={() => setEditingTemplate(tpl)}
                  >
                    <Edit3 size={13} aria-hidden="true" /> Edit
                  </button>
                  <button
                    type="button"
                    className="button button-outline button-small"
                    onClick={() =>
                      setEditingTemplate({
                        name: `${tpl.name} (Copy)`,
                        category: tpl.category,
                        subject: tpl.subject,
                        body: tpl.body,
                        action_label: tpl.action_label ?? '',
                        action_url: tpl.action_url ?? '',
                      })
                    }
                  >
                    <Copy size={13} aria-hidden="true" /> Duplicate
                  </button>
                  <button
                    type="button"
                    className="button button-outline button-small"
                    aria-label={`Delete ${tpl.name}`}
                    onClick={() => void removeTemplate(tpl)}
                  >
                    <Trash2 size={13} aria-hidden="true" />
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}

      {tab === 'history' && (
        <>
          {stats && (
            <div className="comm-stats-row">
              <div className="comm-stat-card">
                <small>New enquiries</small>
                <strong>{stats.new_enquiries}</strong>
              </div>
              <div className="comm-stat-card">
                <small>Total users</small>
                <strong>{stats.total_users}</strong>
              </div>
              <div className="comm-stat-card">
                <small>Verified emails</small>
                <strong>{stats.verified_users}</strong>
              </div>
              <div className="comm-stat-card">
                <small>Saved templates</small>
                <strong>{templates.length}</strong>
              </div>
              <div className="comm-stat-card">
                <small>Sent dispatches</small>
                <strong>{history.length}</strong>
              </div>
            </div>
          )}

          <div className="comm-panel">
            <div className="comm-subtabs" role="tablist" aria-label="Sent history views">
              <button
                type="button"
                role="tab"
                aria-selected={historySubTab === 'outbox'}
                className={`comm-subtab-btn${historySubTab === 'outbox' ? ' is-active' : ''}`}
                onClick={() => setHistorySubTab('outbox')}
              >
                <Mail size={14} aria-hidden="true" />
                System Emails ({visibleOutbox.length})
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={historySubTab === 'campaigns'}
                className={`comm-subtab-btn${historySubTab === 'campaigns' ? ' is-active' : ''}`}
                onClick={() => setHistorySubTab('campaigns')}
              >
                <Send size={14} aria-hidden="true" />
                Broadcast Campaigns ({visibleDispatches.length})
              </button>
            </div>

            <div className="comm-history-filter-row" aria-label="Filter sent history">
              <label>
                Search
                <input
                  type="search"
                  placeholder="Subject or email…"
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                />
              </label>
              <label>
                Period
                <select
                  value={historyPeriod}
                  onChange={(e) => setHistoryPeriod(e.target.value as HistoryPeriod)}
                >
                  <option value="all">All dates</option>
                  <option value="today">Today</option>
                  <option value="yesterday">Yesterday</option>
                  <option value="7d">Last 7 days</option>
                  <option value="30d">Last 30 days</option>
                </select>
              </label>
              <label>
                Date
                <input
                  type="date"
                  value={historyDate}
                  onChange={(e) => setHistoryDate(e.target.value)}
                />
              </label>
              <label>
                Day
                <select value={historyDay} onChange={(e) => setHistoryDay(e.target.value)}>
                  <option value="all">Any day</option>
                  {WEEKDAYS.map((dayName) => (
                    <option key={dayName} value={dayName}>
                      {dayName}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Time
                <select
                  value={historyTimeSlot}
                  onChange={(e) => setHistoryTimeSlot(e.target.value as HistoryTimeSlot)}
                >
                  <option value="all">Any time</option>
                  <option value="morning">Morning (06–12)</option>
                  <option value="afternoon">Afternoon (12–17)</option>
                  <option value="evening">Evening (17–21)</option>
                  <option value="night">Night (21–06)</option>
                </select>
              </label>
              {hasHistoryFilters && (
                <button
                  type="button"
                  className="button button-outline button-small"
                  onClick={() => {
                    setHistorySearch('');
                    setHistoryPeriod('all');
                    setHistoryDate('');
                    setHistoryDay('all');
                    setHistoryTimeSlot('all');
                  }}
                >
                  Clear
                </button>
              )}
            </div>

            {historySubTab === 'outbox' && (
              <>
                {selectedEmail && (
                  <div className="comm-email-viewer">
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '0.5rem',
                      }}
                    >
                      <h3 style={{ margin: 0 }}>{selectedEmail.subject}</h3>
                      <div className="comm-btn-row">
                        {selectedEmail.html_body && selectedEmail.text_body && (
                          <button
                            type="button"
                            className="button button-outline button-small"
                            onClick={() =>
                              setEmailViewMode((mode) => (mode === 'html' ? 'text' : 'html'))
                            }
                          >
                            {emailViewMode === 'html' ? 'Plain text' : 'HTML view'}
                          </button>
                        )}
                        <button
                          type="button"
                          className="button button-outline button-small"
                          onClick={() => setSelectedEmail(null)}
                        >
                          Close email
                        </button>
                      </div>
                    </div>

                    <div className="comm-email-viewer-meta">
                      <div>
                        <strong>To:</strong>{' '}
                        {selectedEmail.to_name
                          ? `${selectedEmail.to_name} <${selectedEmail.to_email}>`
                          : selectedEmail.to_email}
                      </div>
                      <div>
                        <strong>From:</strong> {selectedEmail.from_email || 'System'}
                      </div>
                      <div>
                        <strong>Sent:</strong> {formatDateTime(selectedEmail.created_at)}
                      </div>
                    </div>

                    {selectedEmail.html_body && emailViewMode === 'html' ? (
                      <iframe
                        title={`Email preview: ${selectedEmail.subject}`}
                        className="comm-email-viewer-frame"
                        sandbox="allow-popups allow-popups-to-escape-sandbox"
                        srcDoc={selectedEmail.html_body}
                      />
                    ) : (
                      <pre className="comm-email-viewer-text">
                        {selectedEmail.text_body || '(Empty email body)'}
                      </pre>
                    )}
                  </div>
                )}

                <div className="comm-table-wrap">
                  <table className="comm-table">
                    <thead>
                      <tr>
                        <th>Sent (EAT)</th>
                        <th>Recipient</th>
                        <th>Subject &amp; snippet</th>
                        <th>Email</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleOutbox.length === 0 ? (
                        <tr>
                          <td colSpan={4}>
                            No captured system emails match your filters yet. Any email sent by
                            Laravel (account verification, event bookings, enquiry replies, or
                            broadcasts) appears here automatically.
                          </td>
                        </tr>
                      ) : (
                        visibleOutbox.map((item) => (
                          <tr key={item.id}>
                            <td>{formatDateTime(item.created_at)}</td>
                            <td>
                              {item.to_name && <strong>{item.to_name}</strong>}
                              <div>
                                <small>{item.to_email}</small>
                              </div>
                            </td>
                            <td>
                              <strong>{item.subject}</strong>
                              {item.text_preview && (
                                <div>
                                  <small style={{ color: 'var(--yerh-muted)' }}>
                                    {item.text_preview}
                                  </small>
                                </div>
                              )}
                            </td>
                            <td>
                              <button
                                type="button"
                                className="button button-outline button-small"
                                onClick={async () => {
                                  try {
                                    const full = await communicationsRepository.outboxDetail(
                                      item.id,
                                    );
                                    setEmailViewMode(full.html_body ? 'html' : 'text');
                                    setSelectedEmail(full);
                                  } catch (failure) {
                                    setError(errorText(failure));
                                  }
                                }}
                              >
                                <Eye size={13} aria-hidden="true" /> View email
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {historySubTab === 'campaigns' && (
              <>
                {selectedDispatch && (
                  <div className="comm-panel" style={{ borderColor: 'var(--yerh-gold)' }}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '0.5rem',
                      }}
                    >
                      <div>
                        <h3 style={{ margin: 0 }}>{selectedDispatch.dispatch.subject}</h3>
                        <small style={{ color: 'var(--yerh-muted)' }}>
                          {selectedDispatch.dispatch.channel} ·{' '}
                          {formatDateTime(selectedDispatch.dispatch.created_at)}
                        </small>
                      </div>
                      <button
                        type="button"
                        className="button button-outline button-small"
                        onClick={() => setSelectedDispatch(null)}
                      >
                        Close log
                      </button>
                    </div>
                    <div className="comm-table-wrap" style={{ maxHeight: '260px' }}>
                      <table className="comm-table">
                        <thead>
                          <tr>
                            <th>Recipient</th>
                            <th>Email</th>
                            <th>Status</th>
                            <th>Note</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedDispatch.recipients.map((rec) => (
                            <tr key={rec.id}>
                              <td>{rec.name}</td>
                              <td>{rec.email}</td>
                              <td>
                                <StatusIndicator
                                  status={
                                    rec.status === 'failed'
                                      ? 'rejected'
                                      : rec.status === 'notified'
                                        ? 'read'
                                        : 'approved'
                                  }
                                  label={
                                    rec.status === 'sent'
                                      ? 'Delivered'
                                      : rec.status === 'notified'
                                        ? 'In-app alert'
                                        : 'Failed'
                                  }
                                />
                              </td>
                              <td>{rec.error_message || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <div className="comm-table-wrap">
                  <table className="comm-table">
                    <thead>
                      <tr>
                        <th>Sent (EAT)</th>
                        <th>Type</th>
                        <th>Subject &amp; Template</th>
                        <th>Channel</th>
                        <th>Delivery</th>
                        <th>Sent by</th>
                        <th>Log</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleDispatches.length === 0 ? (
                        <tr>
                          <td colSpan={7}>No broadcasts or email replies match your filters.</td>
                        </tr>
                      ) : (
                        visibleDispatches.map((item) => (
                          <tr key={item.id}>
                            <td>{formatDateTime(item.created_at)}</td>
                            <td>
                              <StatusIndicator
                                status={item.kind === 'enquiry_reply' ? 'read' : 'published'}
                                label={
                                  item.kind === 'enquiry_reply' ? 'Enquiry reply' : 'Broadcast'
                                }
                              />
                            </td>
                            <td>
                              <strong>{item.subject}</strong>
                              {item.template_name && (
                                <div>
                                  <small>Template: {item.template_name}</small>
                                </div>
                              )}
                              {item.enquiry_email && (
                                <div>
                                  <small>Enquirer: {item.enquiry_email}</small>
                                </div>
                              )}
                            </td>
                            <td>{item.channel}</td>
                            <td>
                              <strong>{item.sent_count}</strong> / {item.recipient_count}
                              {item.failed_count > 0 && (
                                <div>
                                  <small style={{ color: 'var(--yerh-danger, #b91c1c)' }}>
                                    {item.failed_count} failed
                                  </small>
                                </div>
                              )}
                            </td>
                            <td>{item.sender_name || 'System'}</td>
                            <td>
                              <button
                                type="button"
                                className="button button-outline button-small"
                                onClick={async () => {
                                  try {
                                    setSelectedDispatch(
                                      await communicationsRepository.dispatchDetail(item.id),
                                    );
                                  } catch (failure) {
                                    setError(errorText(failure));
                                  }
                                }}
                              >
                                Recipients
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
