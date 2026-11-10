import { createContext, useContext } from 'react';
import type { Catalog } from '../domain/content';
export const ContentContext = createContext<Catalog | null>(null);
export function useCatalog(): Catalog {
  const value = useContext(ContentContext);
  if (!value) throw new Error('useCatalog must be used inside ContentProvider');
  return value;
}
