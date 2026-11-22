import { useEffect, useState } from 'react';
/** Rotation policy independent of the slide design and record shape. */
export function useCarousel(count: number, delay = 5000) {
  const [index, setIndex] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  const [keyboardFocused, setKeyboardFocused] = useState(false);
  const [visible, setVisible] = useState(!document.hidden);
  useEffect(() => {
    const visibility = () => setVisible(!document.hidden);
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const changed = () => setReducedMotion(motion.matches);
    document.addEventListener('visibilitychange', visibility);
    motion.addEventListener('change', changed);
    return () => {
      document.removeEventListener('visibilitychange', visibility);
      motion.removeEventListener('change', changed);
    };
  }, []);
  const rotating = !reducedMotion && !keyboardFocused && visible && count > 1;
  useEffect(() => {
    if (!rotating) return;
    const timer = window.setTimeout(() => setIndex((i) => (i + 1) % count), delay);
    return () => window.clearTimeout(timer);
  }, [rotating, index, count, delay]);
  return {
    index: count ? index % count : 0,
    rotating,
    setKeyboardFocused,
    move: (direction: number) => {
      setIndex((i) => (count ? (i + direction + count) % count : 0));
    },
    goTo: (i: number) => setIndex(i),
  };
}
