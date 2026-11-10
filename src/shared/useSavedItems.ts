import { useSyncExternalStore } from 'react';
const key = 'yerh.saved-items.v1';
let cached: string[] = [];
let previous: string | null | undefined;
function snapshot(): string[] {
  try {
    const raw = localStorage.getItem(key);
    if (raw !== previous) {
      previous = raw;
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      cached = Array.isArray(parsed)
        ? parsed.filter((id): id is string => typeof id === 'string')
        : [];
    }
  } catch {
    /* Private browsing: retain this session's choices. */
  }
  return cached;
}
function subscribe(callback: () => void) {
  window.addEventListener('storage', callback);
  window.addEventListener('yerh:saved', callback);
  return () => {
    window.removeEventListener('storage', callback);
    window.removeEventListener('yerh:saved', callback);
  };
}
export function useSavedItems() {
  const ids = useSyncExternalStore(subscribe, snapshot, () => cached);
  function toggle(id: string) {
    const current = snapshot();
    cached = current.includes(id) ? current.filter((value) => value !== id) : [...current, id];
    previous = JSON.stringify(cached);
    try {
      localStorage.setItem(key, previous);
    } catch {
      /* Session-only fallback. */
    }
    window.dispatchEvent(new Event('yerh:saved'));
  }
  return { ids, toggle };
}
