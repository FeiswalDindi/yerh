import { useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { FolderOpen, ImagePlus, Upload } from 'lucide-react';
import { useCatalog } from '../../../../app/useCatalog';
import { CloseButton } from '../../../../shared/CloseButton';
import { PhotoDownloadButton } from '../../../../shared/PhotoFrame';
import { SmartImage } from '../../../../shared/SmartImage';
import { cmsRepository, type CmsMediaAsset } from '../../../../services/laravel-cms-repository';
import { collectSiteLibrary } from './site-library';

export function ImageField({
  label,
  value,
  onChange,
  alt,
  onAltChange,
  folder = 'general',
  media,
  onUploaded,
  acceptPdf = false,
}: {
  label: string;
  value: string;
  onChange: (url: string) => void;
  alt?: string;
  onAltChange?: (alt: string) => void;
  folder?: string;
  media: CmsMediaAsset[];
  onUploaded: (asset: CmsMediaAsset) => void;
  acceptPdf?: boolean;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);

  async function quickUpload(file: File) {
    setUploading(true);
    setError('');
    try {
      const asset = await cmsRepository.uploadMedia(file, alt ?? '', folder);
      onUploaded(asset);
      onChange(asset.url);
      if (onAltChange && !alt && asset.alt_text) {
        onAltChange(asset.alt_text);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Upload failed.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="cms-image-field">
      <span className="cms-field-label">{label}</span>
      <div className="cms-image-preview-row">
        {value && !/\.pdf(\?|$)/i.test(value) ? (
          <div className="cms-thumb-wrap">
            <SmartImage className="cms-thumb" src={value} alt={alt || label} targetWidth={320} />
            <PhotoDownloadButton src={value} label={alt || label} compact className="is-mini" />
          </div>
        ) : (
          <div className="cms-thumb-empty">{value ? 'File' : 'No file'}</div>
        )}
        <div style={{ flex: 1, minWidth: '12rem', display: 'grid', gap: '0.4rem' }}>
          <input
            className="cms-image-input"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="/media/... or https://..."
          />
          <div className="cms-icon-row">
            <button type="button" className="cms-icon-btn" onClick={() => setPickerOpen(true)}>
              <FolderOpen size={14} aria-hidden="true" />
              Media library
            </button>
            <button
              type="button"
              className="cms-icon-btn"
              disabled={uploading}
              onClick={() => fileInput.current?.click()}
            >
              <Upload size={14} aria-hidden="true" />
              {uploading ? 'Uploading…' : 'Upload new'}
            </button>
            {value && (
              <button type="button" className="cms-icon-btn is-danger" onClick={() => onChange('')}>
                Clear
              </button>
            )}
          </div>
          <input
            ref={fileInput}
            type="file"
            hidden
            accept={
              acceptPdf
                ? 'image/jpeg,image/png,image/webp,image/gif,application/pdf'
                : 'image/jpeg,image/png,image/webp,image/gif'
            }
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) void quickUpload(file);
            }}
          />
        </div>
      </div>
      {onAltChange && (
        <label className="cms-field-label">
          <span>Image description (alt text)</span>
          <input
            value={alt ?? ''}
            onChange={(e) => onAltChange(e.target.value)}
            placeholder="Describe this image for accessibility"
            maxLength={240}
          />
        </label>
      )}
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {pickerOpen && (
        <MediaPickerModal
          media={media}
          folder={folder}
          onUploaded={onUploaded}
          onSelect={(url, selectedAlt) => {
            onChange(url);
            if (onAltChange && !alt && selectedAlt) onAltChange(selectedAlt);
            setPickerOpen(false);
          }}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  );
}

export function MediaPickerModal({
  media,
  folder = 'general',
  onUploaded,
  onSelect,
  onClose,
}: {
  media: CmsMediaAsset[];
  folder?: string;
  onUploaded: (asset: CmsMediaAsset) => void;
  onSelect: (url: string, alt?: string) => void;
  onClose: () => void;
}) {
  const titleId = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const catalog = useCatalog();
  const [tab, setTab] = useState<'uploaded' | 'builtin'>('uploaded');
  const [query, setQuery] = useState('');
  const [uploading, setUploading] = useState(false);
  const [addToSiteOnUpload, setAddToSiteOnUpload] = useState(false);
  const [error, setError] = useState('');

  useLayoutEffect(() => {
    const node = dialog.current;
    if (node && !node.open) node.showModal();
    return () => node?.close();
  }, []);

  const siteLibraryItems = useMemo(() => collectSiteLibrary(catalog, media), [catalog, media]);

  async function handleFile(file: File) {
    setUploading(true);
    setError('');
    try {
      const asset = await cmsRepository.uploadMedia(file, '', folder, addToSiteOnUpload);
      onUploaded(asset);
      onSelect(asset.url, asset.alt_text);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Upload failed.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <dialog
      ref={dialog}
      className="workspace-dialog"
      style={{ width: 'min(54rem, 96vw)' }}
      aria-labelledby={titleId}
      onClose={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <header className="workspace-dialog-heading">
        <h2 id={titleId}>Choose media</h2>
        <CloseButton aria-label="Close media picker" iconSize={19} onClick={onClose} />
      </header>
      <div className="workspace-dialog-body" style={{ display: 'grid', gap: '0.85rem' }}>
        <div className="cms-filter-bar">
          <div className="cms-subtabs" role="tablist" aria-label="Media source">
            <button
              type="button"
              role="tab"
              className="cms-subtab-btn"
              aria-selected={tab === 'uploaded'}
              onClick={() => setTab('uploaded')}
            >
              Uploaded media ({media.length})
            </button>
            <button
              type="button"
              role="tab"
              className="cms-subtab-btn"
              aria-selected={tab === 'builtin'}
              onClick={() => setTab('builtin')}
            >
              Site library ({siteLibraryItems.length})
            </button>
          </div>
          <input
            type="search"
            aria-label="Filter files"
            placeholder="Filter files…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <label className="cms-media-dropzone">
          <ImagePlus size={22} aria-hidden="true" />
          <strong>{uploading ? 'Uploading file…' : 'Upload a new image or PDF'}</strong>
          <small>JPG, PNG, WebP, GIF, or PDF up to 8 MB</small>
          <input
            type="file"
            hidden
            disabled={uploading}
            accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) void handleFile(file);
            }}
          />
        </label>

        <label className="inline-checkbox">
          <input
            type="checkbox"
            checked={addToSiteOnUpload}
            onChange={(e) => setAddToSiteOnUpload(e.target.checked)}
          />{' '}
          Also add uploaded file to Site Library
        </label>

        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}

        {tab === 'uploaded' ? (
          <div className="cms-media-grid-studio">
            {media
              .filter((m) =>
                [m.original_name, m.alt_text, m.folder]
                  .join(' ')
                  .toLowerCase()
                  .includes(query.trim().toLowerCase()),
              )
              .map((asset) => (
                <div key={asset.id} className="cms-media-tile cms-media-tile-selectable">
                  <div className="cms-media-thumb-wrap">
                    <button
                      type="button"
                      className="cms-media-select-btn"
                      onClick={() => onSelect(asset.url, asset.alt_text)}
                      aria-label={`Select ${asset.original_name}`}
                    >
                      {asset.mime_type.startsWith('image/') ? (
                        <SmartImage
                          src={asset.url}
                          alt={asset.alt_text || asset.original_name}
                          targetWidth={320}
                        />
                      ) : (
                        <div className="cms-thumb-empty" style={{ width: '100%', height: '112px' }}>
                          PDF Document
                        </div>
                      )}
                    </button>
                    {asset.mime_type.startsWith('image/') && (
                      <PhotoDownloadButton src={asset.url} label={asset.original_name} compact />
                    )}
                  </div>
                  <button
                    type="button"
                    className="cms-media-meta-btn"
                    onClick={() => onSelect(asset.url, asset.alt_text)}
                  >
                    <span className="cms-media-tile-name">{asset.original_name}</span>
                    <small>
                      {asset.folder}
                      {asset.in_site_library ? ' · In Site Library' : ''}
                    </small>
                  </button>
                </div>
              ))}
            {media.length === 0 && (
              <p>No uploaded assets yet. Upload a file above to get started.</p>
            )}
          </div>
        ) : (
          <div className="cms-media-grid-studio">
            {siteLibraryItems
              .filter((item) =>
                [item.name, item.alt, item.category, item.url]
                  .join(' ')
                  .toLowerCase()
                  .includes(query.trim().toLowerCase()),
              )
              .map((item) => (
                <div key={item.key} className="cms-media-tile cms-media-tile-selectable">
                  <div className="cms-media-thumb-wrap">
                    <button
                      type="button"
                      className="cms-media-select-btn"
                      onClick={() => onSelect(item.url, item.alt)}
                      aria-label={`Select ${item.name}`}
                    >
                      {item.mimeType.startsWith('image/') ? (
                        <SmartImage src={item.url} alt={item.alt || item.name} targetWidth={320} />
                      ) : (
                        <div className="cms-thumb-empty" style={{ width: '100%', height: '112px' }}>
                          PDF Document
                        </div>
                      )}
                    </button>
                    {item.mimeType.startsWith('image/') && (
                      <PhotoDownloadButton src={item.url} label={item.name} compact />
                    )}
                  </div>
                  <button
                    type="button"
                    className="cms-media-meta-btn"
                    onClick={() => onSelect(item.url, item.alt)}
                  >
                    <span className="cms-media-tile-name">{item.name}</span>
                    <span
                      className={`cms-source-badge${item.source === 'uploaded' ? ' is-uploaded' : ''}`}
                    >
                      {item.source === 'uploaded'
                        ? `Uploaded · ${item.category}`
                        : `Built-in · ${item.category}`}
                    </span>
                  </button>
                </div>
              ))}
          </div>
        )}
      </div>
    </dialog>
  );
}
