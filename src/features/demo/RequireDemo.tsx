import type { ReactNode } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { useDemo } from '../../app/useDemo';
import { can, type Capability } from '../../domain/roles';
import { AccountEntryRedirect } from '../accounts/AccountLink';
import { guestPublicDestination } from '../accounts/account-navigation';
import { institutionAccess } from '../../domain/incubation';
export function RequireDemo({
  children,
  capabilities,
  workspace = false,
}: {
  children: ReactNode;
  capabilities?: Capability[];
  workspace?: boolean;
}) {
  const { enabled, account, state } = useDemo();
  const { pathname, search, hash } = useLocation();
  const query = new URLSearchParams({ redirect: pathname + search + hash });
  if (!enabled || !account || account.suspended)
    return <AccountEntryRedirect search={`?${query}`} />;
  if (workspace && account.role === 'guest') {
    const id = new URLSearchParams(search).get('institution');
    const school = state.platform.training.institutions.find((row) => row.id === id);
    if (
      pathname.replace(/\/$/, '') !== '/dashboard/workspace' ||
      !school ||
      !institutionAccess(school, account)
    )
      return <Navigate to={guestPublicDestination(pathname.replace(/\/$/, ''), search)} replace />;
  }
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
