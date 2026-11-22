import { DemoContext } from './useDemo';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { demoAccountsEnabled } from '../config/demo';
import { applyDemoAction, currentAccount, type DemoAction, type DemoState } from '../domain/demo';
import { isDemoState } from '../domain/demo-validation';
import {
  browserDemoRepository,
  createDemoSeed,
  DEMO_STORAGE_KEY,
  type DemoRepository,
} from '../services/demo-repository';

const demoEnabled = demoAccountsEnabled(
  {
    DEV: import.meta.env.DEV,
    MODE: import.meta.env.MODE,
    VITE_ENABLE_DEMO_ACCOUNTS: import.meta.env.VITE_ENABLE_DEMO_ACCOUNTS,
  },
  typeof window === 'undefined' ? undefined : window.location,
);
export function DemoProvider({
  children,
  repository = browserDemoRepository,
}: {
  children: ReactNode;
  repository?: DemoRepository;
}) {
  const [state, setState] = useState<DemoState>(() =>
    demoEnabled ? repository.load() : createDemoSeed(),
  );
  const [error, setError] = useState('');
  const current = useRef(state);
  function replace(next: DemoState) {
    current.current = next;
    setState(next);
  }
  useEffect(() => {
    if (!demoEnabled) return;
    const update = (event: StorageEvent) => {
      if (event.key === DEMO_STORAGE_KEY || event.key === null) replace(repository.load());
    };
    window.addEventListener('storage', update);
    return () => window.removeEventListener('storage', update);
  }, [repository]);
  function execute(action: DemoAction) {
    if (!demoEnabled) {
      setError('Demo actions are disabled on this site.');
      return false;
    }
    try {
      const next = applyDemoAction(current.current, action);
      if (!isDemoState(next, createDemoSeed().accounts))
        throw new Error(
          'This change would produce an invalid record. Check the fields and try again.',
        );
      repository.save(next);
      replace(next);
      setError('');
      return true;
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Unable to save this demo change. Browser storage may be unavailable.',
      );
      return false;
    }
  }
  function reset() {
    if (!demoEnabled) return;
    try {
      replace(repository.reset());
      setError('');
    } catch {
      setError('Your browser could not reset demo storage.');
    }
  }
  return (
    <DemoContext.Provider
      value={{
        state,
        account: currentAccount(state),
        enabled: demoEnabled,
        error,
        execute,
        reset,
        clearError: () => setError(''),
      }}
    >
      {children}
    </DemoContext.Provider>
  );
}
