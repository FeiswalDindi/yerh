import { youtubeEmbedUrl } from '../../domain/media';
import { useCookieConsent } from '../privacy/useCookieConsent';
import { openCookieModal } from '../../services/cookie-consent';
export function VideoPlayer({
  url,
  title,
  className,
  onPreferences,
}: {
  url: string;
  title: string;
  className?: string;
  onPreferences?: () => void;
}) {
  const consent = useCookieConsent();
  const src = youtubeEmbedUrl(url);
  if (!src) return <p role="status">This video source is unavailable.</p>;
  if (consent !== 'all')
    return (
      <div className="video-consent-placeholder">
        <p>Allow multimedia in cookie preferences to load this YouTube video.</p>
        <button
          type="button"
          className="button button-gold"
          onClick={() => {
            onPreferences?.();
            openCookieModal();
          }}
        >
          Manage preferences
        </button>
        <a
          href={src
            .replace('/embed/', '/watch?v=')
            .replace('www.youtube-nocookie.com', 'www.youtube.com')}
          target="_blank"
          rel="noreferrer"
        >
          Watch on YouTube instead
        </a>
      </div>
    );
  return (
    <iframe
      src={src}
      title={title}
      className={className}
      loading="lazy"
      allow="encrypted-media; picture-in-picture"
      allowFullScreen
      referrerPolicy="strict-origin-when-cross-origin"
    />
  );
}
