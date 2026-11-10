import { isDemoState, migrateDemoState } from '../domain/demo-validation';
import accounts from '../mocks/data/accounts.json';
import community from '../mocks/data/community.json';
import sessions from '../mocks/data/community-events.json';
import platform from '../mocks/data/platform.json';
import type { DemoState } from '../domain/demo';
export const DEMO_STORAGE_KEY = 'yerh.demo.v1';
export interface DemoRepository {
  load(): DemoState;
  save(state: DemoState): void;
  reset(): DemoState;
}
export function createDemoSeed(): DemoState {
  return structuredClone({
    version: 2,
    activeAccountId: null,
    accounts,
    ...community,
    sessions,
    platform,
    progress: {},
    interests: {},
    submissions: [],
  } as DemoState);
}
export const browserDemoRepository: DemoRepository = {
  load() {
    try {
      const raw = localStorage.getItem(DEMO_STORAGE_KEY);
      if (raw) {
        const value: unknown = migrateDemoState(JSON.parse(raw), createDemoSeed());
        if (isDemoState(value, accounts as DemoState['accounts'])) return value;
      }
    } catch {
      /* Fall back to a valid fixture, never break the UI on damaged storage. */
    }
    return createDemoSeed();
  },
  save(state) {
    localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(state));
  },
  reset() {
    localStorage.removeItem(DEMO_STORAGE_KEY);
    return createDemoSeed();
  },
};
