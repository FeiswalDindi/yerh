import { useEffect, useState, type HTMLAttributeReferrerPolicy } from 'react';
import { Check, Download } from 'lucide-react';
import { downloadPhoto } from './downloadPhoto';
import { SmartImage } from './SmartImage';

export function PhotoDownloadButton({
  src,
  label,
  compact = false,
  className,
}: {
  src: string;
  label?: string;
  compact?: boolean;
  className?: string;
}) {
  const [downloaded, setDownloaded] = useState(false);

  useEffect(() => {
    if (!downloaded) return;
    const timer = window.setTimeout(() => setDownloaded(false), 1600);
    return () => window.clearTimeout(timer);
  }, [downloaded]);

  async function handleDownload() {
    await downloadPhoto(src, label);
    setDownloaded(true);
  }

  const classes = ['photo-download-btn', compact ? 'is-compact' : '', className ?? '']
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type="button"
      className={classes}
      aria-label={`Download ${label || 'photo'}`}
      title="Download photo"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void handleDownload();
      }}
    >
      {downloaded ? (
        <Check size={15} aria-hidden="true" />
      ) : (
        <Download size={15} aria-hidden="true" />
      )}
      {!compact && <span>{downloaded ? 'Saved' : 'Download'}</span>}
    </button>
  );
}

export function PhotoFrame({
  src,
  alt,
  downloadLabel,
  className,
  imgClassName,
  compact = false,
  loading,
  decoding,
  fetchPriority,
  referrerPolicy,
  targetWidth,
  sizes,
  onError,
}: {
  src: string;
  alt: string;
  downloadLabel?: string;
  className?: string;
  imgClassName?: string;
  compact?: boolean;
  loading?: 'eager' | 'lazy';
  decoding?: 'sync' | 'async' | 'auto';
  fetchPriority?: 'high' | 'low' | 'auto';
  referrerPolicy?: HTMLAttributeReferrerPolicy;
  targetWidth?: number;
  sizes?: string;
  onError?: () => void;
}) {
  return (
    <div className={['photo-frame', className ?? ''].filter(Boolean).join(' ')}>
      <SmartImage
        src={src}
        alt={alt}
        className={imgClassName}
        loading={loading}
        decoding={decoding}
        fetchPriority={fetchPriority}
        referrerPolicy={referrerPolicy}
        targetWidth={targetWidth}
        sizes={sizes}
        onError={onError}
      />
      <PhotoDownloadButton src={src} label={downloadLabel || alt} compact={compact} />
    </div>
  );
}
