import { useEffect, useState } from 'react';
import { blogHeroMedia } from '../../config/media';

export function BlogHeroMedia() {
  const [motionAllowed, setMotionAllowed] = useState(false);
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

  return (
    <div className="blog-hero-media" aria-hidden="true" data-playing={playing}>
      <img src={blogHeroMedia.poster} alt="" fetchPriority="high" />
      {motionAllowed && (
        <video
          src={blogHeroMedia.video}
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
