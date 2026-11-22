import { useContext, useEffect } from 'react';
import { BreadcrumbRegistrationContext } from './BreadcrumbProvider';

export function usePageTitle(title: string) {
  const register = useContext(BreadcrumbRegistrationContext);
  useEffect(() => {
    document.title = `${title} | YERH`;
    register?.({ label: title }, true);
  }, [title, register]);
}
