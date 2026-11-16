export const notificationReadKey = (accountId: string) => `yerh.notifications.read.v1.${accountId}`;

export function loadReadNotifications(key: string): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(key) ?? '[]');
    if (Array.isArray(value)) return new Set(value.filter((id) => typeof id === 'string'));
  } catch {
    // Unavailable or invalid browser data behaves like a new session.
  }
  return new Set();
}

export function saveReadNotifications(key: string, ids: string[]) {
  try {
    window.localStorage.setItem(key, JSON.stringify(ids));
  } catch {
    // The open dashboard still retains these read markers in memory.
  }
}
