import { createContext, useContext } from 'react';
import type { LaravelProfile } from '../services/laravel-identity-repository';

interface LaravelSession {
  profile: LaravelProfile | null;
  loading: boolean;
  signingOut: boolean;
  error: string;
  setProfile: (profile: LaravelProfile | null) => void;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

export const LaravelSessionContext = createContext<LaravelSession | null>(null);

export function useLaravelSession() {
  return useContext(LaravelSessionContext);
}
