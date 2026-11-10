import { useEffect, useState, type ReactNode } from 'react';
import type { Catalog } from '../domain/content';
import { localContentRepository, type ContentRepository } from '../services/content-repository';

import { ContentContext } from './useCatalog';
export function ContentProvider({
  children,
  repository = localContentRepository,
}: {
  children: ReactNode;
  repository?: ContentRepository;
}) {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setFailed(false);
    repository
      .loadCatalog(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setCatalog(data);
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });
    return () => controller.abort();
  }, [repository, attempt]);
  if (failed)
    return (
      <main className="status-page">
        <h1>We couldn’t load the hub.</h1>
        <p>Please try again.</p>
        <button className="button" onClick={() => setAttempt((n) => n + 1)}>
          Try again
        </button>
      </main>
    );
  if (!catalog)
    return (
      <main className="status-page" role="status">
        <span className="loading-mark">Y</span>
        <p>Opening your resource hub…</p>
      </main>
    );
  return <ContentContext.Provider value={catalog}>{children}</ContentContext.Provider>;
}
