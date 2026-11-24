import type { LucideIcon } from 'lucide-react';
import {
  Archive,
  Ban,
  CircleAlert,
  CircleCheck,
  CircleDot,
  CircleX,
  Clock,
  EyeOff,
  FilePenLine,
  Lock,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { resolveStatusMeta, type StatusIconKey } from './status-meta.ts';
import './status-indicator.css';

const ICONS: Record<StatusIconKey, LucideIcon> = {
  check: CircleCheck,
  draft: FilePenLine,
  clock: Clock,
  progress: CircleDot,
  star: Sparkles,
  archive: Archive,
  lock: Lock,
  closed: EyeOff,
  ban: Ban,
  undo: RotateCcw,
  x: CircleX,
  alert: CircleAlert,
};

export function StatusIndicator({
  status,
  label,
  iconOnly = false,
  size = 15,
  className,
  title,
}: {
  status: string;
  label?: string;
  iconOnly?: boolean;
  size?: number;
  className?: string;
  title?: string;
}) {
  const meta = resolveStatusMeta(status);
  const Icon = ICONS[meta.icon];
  const displayLabel = label ?? meta.label;
  const classes = ['status-indicator', className ?? ''].filter(Boolean).join(' ');

  return (
    <span
      className={classes}
      data-tone={meta.tone}
      data-status={meta.key}
      title={title ?? displayLabel}
    >
      <Icon size={size} strokeWidth={2.2} className="status-indicator__icon" aria-hidden="true" />
      {iconOnly ? (
        <span className="sr-only">{displayLabel}</span>
      ) : (
        <span className="status-indicator__label">{displayLabel}</span>
      )}
    </span>
  );
}
