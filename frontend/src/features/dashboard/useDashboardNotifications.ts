import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import type { DemoAccount, DemoState } from '../../domain/demo';
import {
  loadReadNotifications,
  notificationReadKey,
  saveReadNotifications,
} from '../../services/notification-read-state';
import {
  dashboardBadges,
  dashboardUpdateKeys,
  dashboardUpdates,
  updatesForDestination,
} from './dashboard-notifications';

export function useDashboardNotifications(state: DemoState, account: DemoAccount) {
  const { pathname, search } = useLocation();
  const storageKey = notificationReadKey(account.id);
  const [seen, setSeen] = useState(() => loadReadNotifications(storageKey));
  const updates = useMemo(() => dashboardUpdates(state, account), [state, account]);
  const currentKeys = useMemo(() => dashboardUpdateKeys(updates), [updates]);

  const markSeen = useCallback(
    (keys: string[]) => {
      const stored = loadReadNotifications(storageKey);
      const next = currentKeys.filter(
        (key) => seen.has(key) || stored.has(key) || keys.includes(key),
      );
      if (next.length === seen.size && next.every((key) => seen.has(key))) return;
      setSeen(new Set(next));
      saveReadNotifications(storageKey, next);
    },
    [currentKeys, seen, storageKey],
  );

  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key === storageKey || event.key === null)
        setSeen(loadReadNotifications(storageKey));
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, [storageKey]);

  useEffect(() => {
    markSeen(dashboardUpdateKeys(updatesForDestination(updates, pathname + search)));
  }, [pathname, search, updates, markSeen]);

  return {
    groups: updates.map((update) => ({
      ...update,
      unread: dashboardUpdateKeys([update]).filter((key) => !seen.has(key)).length,
    })),
    unread: currentKeys.filter((key) => !seen.has(key)).length,
    badges: dashboardBadges(updates, seen),
    markSeen,
    markAllSeen: () => markSeen(currentKeys),
  };
}

export type DashboardNotificationState = ReturnType<typeof useDashboardNotifications>;
