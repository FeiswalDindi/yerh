import { FilePenLine, RotateCcw, Save, UploadCloud } from 'lucide-react';
import type { CmsSectionKey } from '../../../../services/laravel-cms-repository';

export interface CardActions {
  busy: boolean;
  sectionHasDraft: (section: CmsSectionKey) => boolean;
  onSaveDraft: (section: CmsSectionKey) => Promise<void>;
  onPublish: (section: CmsSectionKey, defaultSummary?: string) => Promise<void>;
}

export function CardActionBar({
  dirty,
  section,
  actions,
  onDiscard,
  summaryHint,
  showWhenServerDraft = false,
}: {
  dirty: boolean;
  section: CmsSectionKey;
  actions?: CardActions;
  onDiscard?: () => void;
  summaryHint?: string;
  showWhenServerDraft?: boolean;
}) {
  if (!actions) return null;
  const serverDraft = Boolean(showWhenServerDraft && actions.sectionHasDraft(section));
  if (!dirty && !serverDraft) return null;

  return (
    <div className="cms-card-actionbar">
      <span className="cms-card-actionbar-status">
        <FilePenLine size={14} aria-hidden="true" />
        {dirty ? 'Unsaved edits in this card' : 'Saved draft ready to publish'}
      </span>
      <div className="cms-icon-row">
        {dirty && onDiscard && (
          <button
            type="button"
            className="cms-icon-btn is-danger"
            disabled={actions.busy}
            onClick={onDiscard}
          >
            <RotateCcw size={13} /> Discard
          </button>
        )}
        {dirty && (
          <button
            type="button"
            className="button button-outline button-small"
            disabled={actions.busy}
            onClick={() => void actions.onSaveDraft(section)}
          >
            <Save size={14} /> Save draft
          </button>
        )}
        <button
          type="button"
          className="button button-small"
          disabled={actions.busy}
          onClick={() => void actions.onPublish(section, summaryHint)}
        >
          <UploadCloud size={14} /> {actions.busy ? 'Publishing…' : 'Publish live'}
        </button>
      </div>
    </div>
  );
}
