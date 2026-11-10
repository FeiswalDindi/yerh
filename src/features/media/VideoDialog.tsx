import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { VideoPlayer } from './VideoPlayer';
export function VideoDialog({ url, onClose }: { url: string; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const node = dialog.current;
    node?.showModal();
    return () => node?.close();
  }, []);
  return createPortal(
    <dialog
      ref={dialog}
      className="story-video-modal-backdrop"
      aria-label="Story Video Player"
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="story-video-modal-content">
        <button
          type="button"
          className="story-video-modal-close"
          onClick={onClose}
          aria-label="Close video"
        >
          <X size={20} />
        </button>
        <div className="story-video-iframe-wrap">
          <VideoPlayer onPreferences={onClose} url={url} title="Story Video Player" />
        </div>
      </div>
    </dialog>,
    document.body,
  );
}
