import { createContext, useContext } from 'react';
import { Link, Navigate, useLocation, type LinkProps } from 'react-router-dom';
import type { AccountRequest } from './account-navigation';

export const AccountAccessContext = createContext<((request: AccountRequest) => void) | null>(null);

export function AccountLink({
  mode = 'login',
  search = '',
  to,
  onClick,
  ...props
}: Omit<LinkProps, 'to'> & Partial<AccountRequest> & { to?: LinkProps['to'] }) {
  const open = useContext(AccountAccessContext);
  return (
    <Link
      {...props}
      to={to ?? `/${mode}${search}`}
      aria-haspopup={to == null ? 'dialog' : undefined}
      onClick={(event) => {
        onClick?.(event);
        if (
          to != null ||
          !open ||
          event.defaultPrevented ||
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.altKey ||
          event.shiftKey ||
          (props.target && props.target !== '_self') ||
          props.reloadDocument
        )
          return;
        event.preventDefault();
        open({ mode, search });
      }}
    />
  );
}

export function AccountEntryRedirect({ mode = 'login', search }: Partial<AccountRequest>) {
  const location = useLocation();
  return (
    <Navigate
      to="/"
      replace
      state={{ accountRequest: { mode, search: search ?? location.search } }}
    />
  );
}
