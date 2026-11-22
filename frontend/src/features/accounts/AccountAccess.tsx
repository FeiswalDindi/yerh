import { lazy, Suspense, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AccountAccessContext } from './AccountLink';
import type { AccountRequest } from './account-navigation';

const AccountDialog = lazy(() =>
  import('./AccountDialog').then((module) => ({ default: module.AccountDialog })),
);

export function AccountAccess() {
  const location = useLocation();
  const navigate = useNavigate();
  const incoming: AccountRequest | null = location.state?.accountRequest ?? null;
  const [active, setActive] = useState({ key: location.key, request: incoming });
  if (active.key !== location.key) setActive({ key: location.key, request: incoming });

  function setRequest(request: AccountRequest | null) {
    setActive({ key: location.key, request });
  }

  function close() {
    setRequest(null);
    if (incoming)
      navigate(`${location.pathname}${location.search}${location.hash}`, { replace: true });
  }

  return (
    <AccountAccessContext.Provider value={setRequest}>
      <Outlet />
      {active.request && (
        <Suspense fallback={null}>
          <AccountDialog
            key={location.key}
            mode={active.request.mode}
            search={active.request.search}
            onClose={close}
          />
        </Suspense>
      )}
    </AccountAccessContext.Provider>
  );
}
