import { createContext, useCallback, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';

export type BreadcrumbLink = { label: string; to: string };
type BreadcrumbDetails = { label: string; parents?: BreadcrumbLink[] };

type Page = {
  key: string;
  pathname: string;
  to: string;
  title?: string;
  details?: BreadcrumbDetails;
  previous?: BreadcrumbLink & { key: string };
};

export const BreadcrumbPageContext = createContext<Page | null>(null);
export const BreadcrumbRegistrationContext = createContext<
  ((details: BreadcrumbDetails, isPageTitle?: boolean) => void) | null
>(null);

export function BreadcrumbProvider({
  children,
  identifyPage,
}: {
  children: ReactNode;
  identifyPage: (pathname: string, search: string) => string;
}) {
  const location = useLocation();
  const pathname = location.pathname.replace(/\/+$/, '') || '/';
  const key = identifyPage(pathname, location.search);
  const to = location.pathname + location.search + location.hash;
  const [page, setPage] = useState<Page>({ key, pathname, to });

  if (page.key !== key) {
    const label = page.title ?? page.details?.label;
    const previous = label ? { label, to: page.to, key: page.key } : page.previous;
    setPage({
      key,
      pathname,
      to,
      previous: previous && previous.key !== '/' && previous.key !== key ? previous : undefined,
    });
  } else if (page.to !== to) {
    setPage({ ...page, to });
  }

  const register = useCallback(
    (details: BreadcrumbDetails, isPageTitle = false) => {
      setPage((current) => {
        if (current.key !== key) return current;
        if (isPageTitle) {
          return current.title === details.label ? current : { ...current, title: details.label };
        }
        return { ...current, details };
      });
    },
    [key],
  );

  return (
    <BreadcrumbRegistrationContext.Provider value={register}>
      <BreadcrumbPageContext.Provider value={page}>{children}</BreadcrumbPageContext.Provider>
    </BreadcrumbRegistrationContext.Provider>
  );
}
