import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { ArrowUpRight, FileText, X } from 'lucide-react';
import { useCatalog } from '../../app/useCatalog';

export function TermsSummary() {
  const { terms } = useCatalog();
  return (
    <>
      <p className="terms-dialog-intro">A quick overview of using the YERH community.</p>
      <ul className="terms-summary">
        {terms.summary.map((point) => (
          <li key={point}>{point}</li>
        ))}
      </ul>
    </>
  );
}
export function TermsDialog({ onClose }: { onClose: () => void }) {
  const { terms } = useCatalog();
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const node = dialog.current;
    if (node && !node.open) node.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      node?.close();
      document.body.style.overflow = previousOverflow;
    };
  }, []);
  function close() {
    dialog.current?.close();
    onClose();
  }
  return createPortal(
    <dialog
      ref={dialog}
      className="terms-dialog"
      aria-labelledby="terms-dialog-title"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div className="terms-dialog-content">
        <div className="terms-dialog-header">
          <span className="terms-dialog-icon" aria-hidden="true">
            <FileText size={24} />
          </span>
          <button
            type="button"
            className="terms-dialog-close"
            aria-label="Close terms and conditions"
            onClick={close}
          >
            <X size={20} />
          </button>
        </div>
        <p className="eyebrow">YERH COMMUNITY</p>
        <h2 id="terms-dialog-title">Terms & conditions</h2>
        <p className="terms-effective">
          Effective{' '}
          {new Date(`${terms.effectiveDate}T12:00:00Z`).toLocaleDateString('en-KE', {
            dateStyle: 'long',
            timeZone: 'Africa/Nairobi',
          })}
        </p>
        <div className="terms-dialog-body">
          <TermsSummary />
        </div>
        <div className="terms-dialog-actions">
          <button type="button" className="button button-outline" onClick={close}>
            Close
          </button>
          <Link className="button" to="/terms" onClick={close}>
            Read more <ArrowUpRight size={16} />
          </Link>
        </div>
      </div>
    </dialog>,
    document.body,
  );
}
