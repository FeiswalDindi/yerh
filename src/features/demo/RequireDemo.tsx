import type { ReactNode } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { useDemo } from '../../app/useDemo';
import { can, type Capability } from '../../domain/roles';
export function RequireDemo({
  children,
  capabilities,
}: {
  children: ReactNode;
  capabilities?: Capability[];
}) {
  const { enabled, account } = useDemo();
  const { pathname, search, hash } = useLocation();
  const query = new URLSearchParams({ redirect: pathname + search + hash });
  if (!enabled || !account || account.suspended) return <Navigate to={`/login?${query}`} replace />;
  if (capabilities && !capabilities.some((capability) => can(account, capability)))
    return (
      <section className="container status-page">
        <h1>This workspace belongs to a different role.</h1>
        <Link className="button" to={`/demo?${query}`}>
          Switch demo account
        </Link>
      </section>
    );
  return children;
}
