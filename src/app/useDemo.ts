import { createContext, useContext } from 'react';
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
export const DemoContext = createContext<DemoContextValue | null>(null);
export function useDemo() {
  const value = useContext(DemoContext);
  if (!value) throw new Error('DemoProvider is required');
  return value;
}
