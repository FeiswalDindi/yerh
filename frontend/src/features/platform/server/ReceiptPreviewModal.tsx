import { useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { WorkspaceDialog } from '../workspace/WorkspaceControls';

export function ReceiptPreviewModal({
  url,
  label = 'View receipt',
  title = 'Payment receipt',
  reference,
}: {
  url: string;
  label?: string;
  title?: string;
  reference?: string | null;
}) {
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <WorkspaceDialog
      action={label}
      title={title}
      renderTrigger={(open) => (
        <button type="button" className="receipt-trigger-link" onClick={open}>
          {label}
        </button>
      )}
    >
      {() => (
        <>
          <div className="receipt-modal-bar">
            {reference ? <span className="receipt-modal-ref">Ref: {reference}</span> : <span />}
            <a href={url} target="_blank" rel="noreferrer" className="receipt-open-external">
              Open in new page
              <ArrowUpRight size={15} aria-hidden="true" />
            </a>
          </div>
          <div className="receipt-preview-frame">
            {!imageFailed ? (
              <img
                key={url}
                src={url}
                alt={title}
                className="receipt-preview-image"
                onError={() => setImageFailed(true)}
              />
            ) : (
              <iframe key={url} src={url} title={title} className="receipt-preview-pdf" />
            )}
          </div>
        </>
      )}
    </WorkspaceDialog>
  );
}
