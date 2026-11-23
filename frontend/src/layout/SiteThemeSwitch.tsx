import { useSyncExternalStore } from 'react';
import { Moon, Sun } from 'lucide-react';

const themeKey = 'yerh.dashboard.theme';
const listeners = new Set<() => void>();
let selected: 'light' | 'dark' = 'light';

function readTheme() {
  try {
    return window.localStorage.getItem(themeKey) === 'dark' ? 'dark' : 'light';
  } catch {
    return selected;
  }
}

function applyTheme() {
  document.documentElement.dataset.dashboardTheme = selected;
}

function setTheme(theme: 'light' | 'dark') {
  selected = theme;
  try {
    window.localStorage.setItem(themeKey, theme);
  } catch {
    /* In-memory preference still works. */
  }
  applyTheme();
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  function sync(event: StorageEvent) {
    if (event.key === themeKey || event.key === null) {
      selected = readTheme();
      applyTheme();
      listener();
    }
  }
  window.addEventListener('storage', sync);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', sync);
  };
}

if (typeof window !== 'undefined') {
  selected = readTheme();
  applyTheme();
}

export function SiteThemeSwitch() {
  const theme = useSyncExternalStore(
    subscribe,
    () => selected,
    () => 'light',
  );
  const dark = theme === 'dark';
  const label = dark ? 'Switch to light mode' : 'Switch to dark mode';
  return (
    <button
      className="icon-button site-theme-toggle"
      type="button"
      title={label}
      aria-label={label}
      onClick={() => setTheme(dark ? 'light' : 'dark')}
    >
      {dark ? <Sun size={19} aria-hidden="true" /> : <Moon size={19} aria-hidden="true" />}
    </button>
  );
}
