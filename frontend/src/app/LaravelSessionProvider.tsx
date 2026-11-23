import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { LaravelSessionContext } from './useLaravelSession';
import { localLaravelIdentity, type LaravelProfile } from '../services/laravel-identity-repository';

export function LaravelSessionProvider({ children }: { children: ReactNode }) {
  const [profile, setAccount] = useState<LaravelProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const pending = useRef<AbortController | null>(null);

  const setProfile = useCallback((next: LaravelProfile | null) => {
    pending.current?.abort();
    setAccount(next);
    setLoading(false);
    setError('');
  }, []);

  const refresh = useCallback(async () => {
    pending.current?.abort();
    const request = new AbortController();
    pending.current = request;
    try {
      const next = await localLaravelIdentity.profile(request.signal);
      if (!request.signal.aborted) setProfile(next);
    } catch (cause) {
      if (request.signal.aborted) return;
      setAccount(null);
      setError(cause instanceof Error ? cause.message : 'Could not check your session.');
      setLoading(false);
    }
  }, [setProfile]);

  useEffect(() => {
    void refresh();
    const visible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    document.addEventListener('visibilitychange', visible);
    return () => {
      pending.current?.abort();
      document.removeEventListener('visibilitychange', visible);
    };
  }, [refresh]);

  async function signOut() {
    try {
      await localLaravelIdentity.logout();
      setProfile(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not sign out.');
    }
  }

  return (
    <LaravelSessionContext.Provider
      value={{ profile, loading, error, setProfile, refresh, signOut }}
    >
      {children}
    </LaravelSessionContext.Provider>
  );
}
