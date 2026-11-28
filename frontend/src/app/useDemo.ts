import { createContext, useContext } from 'react';
import { laravelModeEnabled } from '../config/laravel';
import type { DemoState, DemoAccount, DemoAction } from '../domain/demo';

interface DemoContextValue {
  state: DemoState;
  account: DemoAccount | null;
  enabled: boolean;
  error: string;
  execute(action: DemoAction): boolean;
  reset(): void;
  clearError(): void;
}

const INERT_LARAVEL_DEMO: DemoContextValue = {
  state: {
    platform: {
      training: {
        curriculum: [],
        stages: [],
        fees: { 'getting-started': 0, advanced: 0, marketplace: 0 },
        bypassEnabled: false,
        payments: [],
        credentials: [],
        productReviews: [],
        institutions: [],
        students: [],
        cohorts: [],
        certificateRequests: [],
        groups: [],
        classes: [],
        affiliations: {},
        yerhSignIn: true,
      },
      certificates: [],
      courseLessons: {},
      applications: [],
      opportunities: [],
      opportunityApplications: [],
      ventures: [],
      products: [],
      incubations: [],
      mentors: [],
      organisations: [],
      enrollments: {},
      audit: [],
      cmsDrafts: [],
      cmsReleases: [],
      cmsRevision: 0,
    },
    version: 2,
    connections: [],
    sessions: [],
    registrations: [],
    pointRules: { topic: 0, reply: 0, blog: 0, lesson: 0, attendance: 0 },
    activeAccountId: null,
    accounts: [],
    forums: [],
    threads: [],
    groups: [],
    requests: [],
    activity: [],
    progress: {},
    interests: {},
    submissions: [],
  },
  account: null,
  enabled: false,
  error: '',
  execute: () => false,
  reset: () => {},
  clearError: () => {},
};

export const DemoContext = createContext<DemoContextValue | null>(null);

export function useDemo() {
  const value = useContext(DemoContext);
  if (!value) {
    if (laravelModeEnabled) return INERT_LARAVEL_DEMO;
    throw new Error('DemoProvider is required');
  }
  return value;
}
