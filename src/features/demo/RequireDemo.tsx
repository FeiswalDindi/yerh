import type { ReactNode } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useDemo } from '../../app/useDemo';
import type { DemoRole } from '../../domain/demo';
export function RequireDemo({ children, roles }: { children: ReactNode; roles?: DemoRole[] }) {
  const { enabled, account } = useDemo();
  if (!enabled || !account) return <Navigate to="/login" replace />;
  if (account.suspended) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(account.role))
    return (
      <section className="container status-page">
        <h1>This workspace belongs to a different role.</h1>
        <Link className="button" to="/login">
          Switch demo account
        </Link>
      </section>
    );
  return children;
}
