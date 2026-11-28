import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { CloseButton } from '../../shared/CloseButton';
import { VideoPlayer } from './VideoPlayer';
export function VideoDialog({
  url,
  title,
  onClose,
}: {
  url: string;
  title?: string;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const label = title?.trim() || 'Video preview';
  useEffect(() => {
    const node = dialog.current;
    node?.showModal();
    return () => node?.close();
  }, []);
  return createPortal(
    <dialog
      ref={dialog}
      className="story-video-modal-backdrop"
      aria-label={label}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="story-video-modal-content">
        <div className="story-video-modal-header">
          <p className="story-video-modal-title">{label}</p>
          <CloseButton
            className="story-video-modal-close"
            onClick={onClose}
            aria-label="Close video"
            iconSize={20}
          />
        </div>
        <div className="story-video-iframe-wrap">
          <VideoPlayer onPreferences={onClose} url={url} title={label} userInitiated autoplay />
        </div>
      </div>
    </dialog>,
    document.body,
  );
}
