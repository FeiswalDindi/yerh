import { useMemo, useState, type DragEvent } from 'react';
import {
  BookmarkCheck,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  ImagePlus,
  LibraryBig,
  Trash2,
} from 'lucide-react';
import { useCatalog } from '../../../../app/useCatalog';
import { cmsRepository, type CmsMediaAsset } from '../../../../services/laravel-cms-repository';
import { PhotoDownloadButton } from '../../../../shared/PhotoFrame';
import { SmartImage } from '../../../../shared/SmartImage';
import { collectSiteLibrary } from './site-library';

const uploadedFolderFilters = [
  ['all', 'All folders'],
  ['general', 'General'],
  ['hero', 'Hero'],
  ['editorial', 'Editorial'],
  ['team', 'Team'],
  ['partners', 'Partners'],
  ['events', 'Events'],
  ['site_library', 'In Site Library'],
] as const;

export function MediaLibraryView({
  media,
  onUploaded,
  onDeleted,
  onUpdated,
}: {
  media: CmsMediaAsset[];
  onUploaded: (asset: CmsMediaAsset) => void;
  onDeleted: (id: number) => void;
  onUpdated: (
    id: number,
    patch: Partial<Pick<CmsMediaAsset, 'alt_text' | 'folder' | 'in_site_library'>>,
  ) => void;
}) {
  const catalog = useCatalog();
  const [libraryTab, setLibraryTab] = useState<'uploaded' | 'site'>('uploaded');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [folderFilter, setFolderFilter] = useState<string>('all');
  const [siteFilter, setSiteFilter] = useState<'all' | 'uploaded' | 'builtin'>('all');
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [folder, setFolder] = useState('general');
  const [addToSiteOnUpload, setAddToSiteOnUpload] = useState(false);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [error, setError] = useState('');

  const siteLibrary = useMemo(() => collectSiteLibrary(catalog, media), [catalog, media]);

  async function uploadFiles(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    setError('');
    try {
      for (const file of Array.from(files)) {
        const asset = await cmsRepository.uploadMedia(file, '', folder, addToSiteOnUpload);
        onUploaded(asset);
      }
      setUploadOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Upload failed.');
    } finally {
      setUploading(false);
    }
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragging(false);
    void uploadFiles(event.dataTransfer.files);
  }

  async function copyUrl(key: string, url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1800);
    } catch {
      setError(`URL: ${url}`);
    }
  }

  async function toggleSiteLibrary(id: number, nextValue: boolean) {
    setTogglingId(id);
    setError('');
    try {
      await cmsRepository.updateMedia(id, { in_site_library: nextValue });
      onUpdated(id, { in_site_library: nextValue });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update Site Library status.');
    } finally {
      setTogglingId(null);
    }
  }

  const normalizedQuery = query.trim().toLowerCase();

  const filteredUploaded = media.filter((item) => {
    const matchesFolder =
      folderFilter === 'all'
        ? true
        : folderFilter === 'site_library'
          ? Boolean(item.in_site_library)
          : item.folder === folderFilter;
    if (!matchesFolder) return false;
    if (!normalizedQuery) return true;
    return [item.original_name, item.alt_text, item.folder]
      .join(' ')
      .toLowerCase()
      .includes(normalizedQuery);
  });

  const filteredSite = siteLibrary.filter((item) => {
    if (siteFilter !== 'all' && item.source !== siteFilter) return false;
    if (!normalizedQuery) return true;
    return [item.name, item.alt, item.category, item.url]
      .join(' ')
      .toLowerCase()
      .includes(normalizedQuery);
  });

  return (
    <div className="cms-editor-stack">
      <section className="cms-card">
        <div className="cms-card-header">
          <div className="cms-subtabs" role="tablist" aria-label="Library view">
            <button
              type="button"
              role="tab"
              className="cms-subtab-btn"
              aria-selected={libraryTab === 'uploaded'}
              onClick={() => setLibraryTab('uploaded')}
            >
              Uploaded media ({media.length})
            </button>
            <button
              type="button"
              role="tab"
              className="cms-subtab-btn"
              aria-selected={libraryTab === 'site'}
              onClick={() => setLibraryTab('site')}
            >
              Site library ({siteLibrary.length})
            </button>
          </div>

          <button
            type="button"
            className="button button-small"
            aria-expanded={uploadOpen}
            onClick={() => setUploadOpen((v) => !v)}
          >
            <ImagePlus size={14} aria-hidden="true" />
            Upload media
            {uploadOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>

        {uploadOpen && (
          <div className="cms-collapsible-panel">
            <div className="cms-filter-bar">
              <label
                className="cms-field-label"
                style={{
                  display: 'inline-flex',
                  flexDirection: 'row',
                  gap: '0.5rem',
                  alignItems: 'center',
                }}
              >
                <span>Folder</span>
                <select value={folder} onChange={(e) => setFolder(e.target.value)}>
                  <option value="general">General</option>
                  <option value="hero">Homepage hero</option>
                  <option value="editorial">Articles &amp; stories</option>
                  <option value="team">Team portraits</option>
                  <option value="partners">Partner logos</option>
                  <option value="events">Events</option>
                </select>
              </label>
              <label className="inline-checkbox">
                <input
                  type="checkbox"
                  checked={addToSiteOnUpload}
                  onChange={(e) => setAddToSiteOnUpload(e.target.checked)}
                />{' '}
                Add to Site Library automatically
              </label>
            </div>

            <label
              className={`cms-media-dropzone${dragging ? ' is-dragging' : ''}`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
            >
              <ImagePlus size={22} aria-hidden="true" />
              <strong>
                {uploading
                  ? 'Uploading files…'
                  : 'Drag and drop images or PDFs here, or click to browse'}
              </strong>
              <small>JPG, PNG, WebP, GIF, or PDF up to 8 MB</small>
              <input
                type="file"
                multiple
                hidden
                disabled={uploading}
                accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
                onChange={(e) => {
                  const files = e.target.files;
                  void uploadFiles(files);
                  e.target.value = '';
                }}
              />
            </label>
          </div>
        )}

        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}

        <div className="cms-filter-bar">
          {libraryTab === 'uploaded' ? (
            <select
              aria-label="Filter uploaded media by folder"
              value={folderFilter}
              onChange={(e) => setFolderFilter(e.target.value)}
            >
              {uploadedFolderFilters.map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          ) : (
            <select
              aria-label="Filter Site Library source"
              value={siteFilter}
              onChange={(e) => setSiteFilter(e.target.value as 'all' | 'uploaded' | 'builtin')}
            >
              <option value="all">All sources</option>
              <option value="uploaded">Added from uploads</option>
              <option value="builtin">Built-in assets</option>
            </select>
          )}
          <input
            type="search"
            placeholder={
              libraryTab === 'uploaded'
                ? 'Search uploads by filename, alt text, or folder…'
                : 'Search site library by filename, category, or URL…'
            }
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <small className="cms-helper-text">
            {libraryTab === 'uploaded'
              ? `${filteredUploaded.length} ${filteredUploaded.length === 1 ? 'asset' : 'assets'}`
              : `${filteredSite.length} ${filteredSite.length === 1 ? 'item' : 'items'}`}
          </small>
        </div>

        {libraryTab === 'uploaded' ? (
          <div className="cms-media-grid-studio">
            {filteredUploaded.map((asset) => {
              const isPromoted = Boolean(asset.in_site_library);
              return (
                <article key={asset.id} className="cms-media-tile">
                  {asset.mime_type.startsWith('image/') ? (
                    <div className="cms-media-thumb-wrap">
                      <SmartImage
                        src={asset.url}
                        alt={asset.alt_text || asset.original_name}
                        targetWidth={320}
                      />
                      <PhotoDownloadButton src={asset.url} label={asset.original_name} compact />
                    </div>
                  ) : (
                    <div className="cms-thumb-empty" style={{ width: '100%', height: '112px' }}>
                      PDF Document
                    </div>
                  )}
                  <span className="cms-media-tile-name" title={asset.original_name}>
                    {asset.original_name}
                  </span>
                  <small className="cms-helper-text">
                    {asset.folder} · {Math.max(1, Math.round(asset.size_bytes / 1024))} KB
                  </small>
                  <input
                    className="cms-media-alt-input"
                    aria-label={`Alt text for ${asset.original_name}`}
                    defaultValue={asset.alt_text}
                    placeholder="Alt text…"
                    maxLength={240}
                    onBlur={(e) => {
                      const next = e.target.value.trim();
                      if (next !== asset.alt_text) {
                        void cmsRepository
                          .updateMedia(asset.id, { alt_text: next })
                          .then(() => onUpdated(asset.id, { alt_text: next }))
                          .catch((cause) =>
                            setError(cause instanceof Error ? cause.message : 'Update failed.'),
                          );
                      }
                    }}
                  />
                  <div className="cms-icon-row">
                    <button
                      type="button"
                      className={`cms-icon-btn${isPromoted ? ' is-active' : ''}`}
                      disabled={togglingId === asset.id}
                      title={
                        isPromoted ? 'In Site Library — click to remove' : 'Add to Site Library'
                      }
                      onClick={() => void toggleSiteLibrary(asset.id, !isPromoted)}
                    >
                      {isPromoted ? <BookmarkCheck size={13} /> : <LibraryBig size={13} />}
                      {isPromoted ? 'In Site Library' : 'Add to Site Library'}
                    </button>
                    <button
                      type="button"
                      className="cms-icon-btn"
                      onClick={() => void copyUrl(`upload-${asset.id}`, asset.url)}
                    >
                      {copiedKey === `upload-${asset.id}` ? (
                        <Check size={13} />
                      ) : (
                        <Copy size={13} />
                      )}
                      {copiedKey === `upload-${asset.id}` ? 'Copied' : 'Copy'}
                    </button>
                    <button
                      type="button"
                      className="cms-icon-btn is-danger"
                      aria-label={`Delete ${asset.original_name}`}
                      onClick={() => {
                        if (!window.confirm(`Delete "${asset.original_name}" permanently?`)) return;
                        void cmsRepository
                          .deleteMedia(asset.id)
                          .then(() => onDeleted(asset.id))
                          .catch((cause) =>
                            setError(cause instanceof Error ? cause.message : 'Delete failed.'),
                          );
                      }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </article>
              );
            })}
            {filteredUploaded.length === 0 && (
              <p className="cms-helper-text">No uploaded assets match your current filter.</p>
            )}
          </div>
        ) : (
          <div className="cms-media-grid-studio">
            {filteredSite.map((item) => (
              <article key={item.key} className="cms-media-tile">
                {item.mimeType.startsWith('image/') ? (
                  <div className="cms-media-thumb-wrap">
                    <SmartImage src={item.url} alt={item.alt || item.name} targetWidth={320} />
                    <PhotoDownloadButton src={item.url} label={item.name} compact />
                  </div>
                ) : (
                  <div className="cms-thumb-empty" style={{ width: '100%', height: '112px' }}>
                    PDF Document
                  </div>
                )}
                <span className="cms-media-tile-name" title={item.name}>
                  {item.name}
                </span>
                <span
                  className={`cms-source-badge${item.source === 'uploaded' ? ' is-uploaded' : ''}`}
                >
                  {item.source === 'uploaded'
                    ? `Upload · ${item.category}`
                    : `Built-in · ${item.category}`}
                </span>
                <div className="cms-icon-row">
                  <button
                    type="button"
                    className="cms-icon-btn"
                    onClick={() => void copyUrl(item.key, item.url)}
                  >
                    {copiedKey === item.key ? <Check size={13} /> : <Copy size={13} />}
                    {copiedKey === item.key ? 'Copied' : 'Copy'}
                  </button>
                  {item.source === 'uploaded' && item.assetId !== undefined && (
                    <button
                      type="button"
                      className="cms-icon-btn is-danger"
                      disabled={togglingId === item.assetId}
                      onClick={() => void toggleSiteLibrary(item.assetId!, false)}
                    >
                      Remove
                    </button>
                  )}
                </div>
              </article>
            ))}
            {filteredSite.length === 0 && (
              <p className="cms-helper-text">No Site Library items match your current filter.</p>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
