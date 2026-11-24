import { useEffect, useState } from 'react';
import { blogHeroMedia } from '../../config/media';
import { resolveMediaUrl } from '../../shared/mediaUrl';
import { SmartImage } from '../../shared/SmartImage';

export function BlogHeroMedia() {
  const [motionAllowed, setMotionAllowed] = useState(false);
  const [posterReady, setPosterReady] = useState(false);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    function syncMotion() {
      setMotionAllowed(!preference.matches);
      if (preference.matches) setPlaying(false);
    }
    syncMotion();
    preference.addEventListener('change', syncMotion);
    return () => preference.removeEventListener('change', syncMotion);
  }, []);

  useEffect(() => {
    if (!motionAllowed || posterReady) return;
    const timer = window.setTimeout(() => setPosterReady(true), 250);
    return () => window.clearTimeout(timer);
  }, [motionAllowed, posterReady]);

  return (
    <div className="blog-hero-media" aria-hidden="true" data-playing={playing}>
      <SmartImage
        src={blogHeroMedia.poster}
        alt=""
        priority
        targetWidth={1200}
        onLoad={() => setPosterReady(true)}
        onError={() => setPosterReady(true)}
      />
      {motionAllowed && posterReady && (
        <video
          src={resolveMediaUrl(blogHeroMedia.video)}
          preload="metadata"
          autoPlay
          muted
          loop
          playsInline
          onPlaying={() => setPlaying(true)}
        />
      )}
    </div>
  );
}
