import { useEffect, useState } from 'react';
/** Rotation policy independent of the slide design and record shape. */
export function useCarousel(count: number, delay = 5000) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [visible, setVisible] = useState(!document.hidden);
  useEffect(() => {
    const visibility = () => setVisible(!document.hidden);
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const changed = () => {
      if (motion.matches) setPaused(true);
    };
    document.addEventListener('visibilitychange', visibility);
    motion.addEventListener('change', changed);
    return () => {
      document.removeEventListener('visibilitychange', visibility);
      motion.removeEventListener('change', changed);
    };
  }, []);
  const rotating = !paused && !hovered && !focused && visible && count > 1;
  useEffect(() => {
    if (!rotating) return;
    const timer = window.setTimeout(() => setIndex((i) => (i + 1) % count), delay);
    return () => window.clearTimeout(timer);
  }, [rotating, index, count, delay]);
  return {
    index: count ? index % count : 0,
    paused,
    rotating,
    setPaused,
    setHovered,
    setFocused,
    move: (direction: number) => {
      setPaused(true);
      setIndex((i) => (count ? (i + direction + count) % count : 0));
    },
    goTo: (i: number) => {
      setPaused(true);
      setIndex(i);
    },
  };
}
