import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { LaravelSessionContext } from './useLaravelSession';
import { LaravelRequestError } from '../services/laravel-api';
import { localLaravelIdentity, type LaravelProfile } from '../services/laravel-identity-repository';

export function LaravelSessionProvider({ children }: { children: ReactNode }) {
  const [profile, setAccount] = useState<LaravelProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef<AbortController | null>(null);
  const signingOutRef = useRef(false);

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

  const signOut = useCallback(async () => {
    if (signingOutRef.current) return;
    signingOutRef.current = true;
    pending.current?.abort();
    setSigningOut(true);
    setError('');
    try {
      await localLaravelIdentity.logout();
      setProfile(null);
    } catch (cause) {
      if (cause instanceof LaravelRequestError && (cause.status === 401 || cause.status === 419)) {
        setProfile(null);
      } else {
        setError(cause instanceof Error ? cause.message : 'Could not sign out.');
      }
    } finally {
      signingOutRef.current = false;
      setSigningOut(false);
    }
  }, [setProfile]);

  return (
    <LaravelSessionContext.Provider
      value={{ profile, loading, signingOut, error, setProfile, refresh, signOut }}
    >
      {children}
    </LaravelSessionContext.Provider>
  );
}
