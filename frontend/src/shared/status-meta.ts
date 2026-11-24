export type StatusTone = 'success' | 'warning' | 'pending' | 'info' | 'muted' | 'danger';

export type StatusIconKey =
  | 'check'
  | 'draft'
  | 'clock'
  | 'progress'
  | 'star'
  | 'archive'
  | 'lock'
  | 'closed'
  | 'ban'
  | 'undo'
  | 'x'
  | 'alert';

export interface StatusMeta {
  key: string;
  tone: StatusTone;
  icon: StatusIconKey;
  label: string;
}

const STATUS_MAP: Readonly<Record<string, { tone: StatusTone; icon: StatusIconKey }>> = {
  published: { tone: 'success', icon: 'check' },
  live: { tone: 'success', icon: 'check' },
  approved: { tone: 'success', icon: 'check' },
  active: { tone: 'success', icon: 'check' },
  confirmed: { tone: 'success', icon: 'check' },
  completed: { tone: 'success', icon: 'check' },
  passed: { tone: 'success', icon: 'check' },
  accepted: { tone: 'success', icon: 'check' },
  open: { tone: 'success', icon: 'check' },
  graduated: { tone: 'success', icon: 'check' },
  'ready to graduate': { tone: 'success', icon: 'check' },
  verified: { tone: 'success', icon: 'check' },

  draft: { tone: 'warning', icon: 'draft' },
  'saved draft': { tone: 'warning', icon: 'draft' },
  'unsaved edits': { tone: 'warning', icon: 'draft' },

  pending: { tone: 'pending', icon: 'clock' },
  new: { tone: 'pending', icon: 'clock' },
  review: { tone: 'pending', icon: 'clock' },
  'review requested': { tone: 'pending', icon: 'clock' },
  proposed: { tone: 'pending', icon: 'clock' },
  submitted: { tone: 'pending', icon: 'clock' },
  'opening soon': { tone: 'pending', icon: 'clock' },
  awaiting: { tone: 'pending', icon: 'clock' },

  'in progress': { tone: 'info', icon: 'progress' },
  read: { tone: 'info', icon: 'progress' },
  shortlisted: { tone: 'info', icon: 'star' },
  resolved: { tone: 'success', icon: 'check' },

  archived: { tone: 'muted', icon: 'archive' },
  private: { tone: 'muted', icon: 'lock' },
  closed: { tone: 'muted', icon: 'closed' },
  disabled: { tone: 'muted', icon: 'ban' },
  inactive: { tone: 'muted', icon: 'ban' },
  deactivated: { tone: 'muted', icon: 'ban' },
  revoked: { tone: 'muted', icon: 'ban' },
  withdrawn: { tone: 'muted', icon: 'undo' },

  rejected: { tone: 'danger', icon: 'x' },
  declined: { tone: 'danger', icon: 'x' },
  failed: { tone: 'danger', icon: 'x' },
  suspended: { tone: 'danger', icon: 'ban' },
  'resit available': { tone: 'danger', icon: 'alert' },
};

export function resolveStatusMeta(status: string): StatusMeta {
  const key = status.trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
  const matched = STATUS_MAP[key] ?? { tone: 'muted' as const, icon: 'clock' as const };
  const label = key ? key.charAt(0).toUpperCase() + key.slice(1) : 'Unknown';

  return {
    key: key || 'unknown',
    tone: matched.tone,
    icon: matched.icon,
    label,
  };
}
