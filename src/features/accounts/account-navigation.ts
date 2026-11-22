const origin = 'https://yerh.invalid';
export const guestAccountPath = '/account';

export function guestPublicDestination(path: string, search = '') {
  if (path.startsWith('/dashboard/learning/'))
    return path.replace('/dashboard/learning/', '/learn/');
  if (path.startsWith('/dashboard/events/'))
    return path.replace('/dashboard/events/', '/sessions/');
  if (path === '/dashboard/learning') return '/learn';
  if (path === '/dashboard/events')
    return new URLSearchParams(search).get('view') === 'mine' ? '/account#reservations' : '/events';
  if (path.startsWith('/dashboard/marketplace')) return path.slice('/dashboard'.length) + search;
  if (path === '/dashboard/certificates') return '/account/certificates';
  return guestAccountPath;
}

export interface AccountRequest {
  mode: 'login' | 'register';
  search: string;
}

export function accountDestination(search: string, fallback: string) {
  const redirect = new URLSearchParams(search).get('redirect');
  if (!redirect?.startsWith('/') || redirect.startsWith('//') || /[\\\s]/.test(redirect))
    return fallback;

  const destination = new URL(redirect, origin);
  if (
    destination.origin !== origin ||
    destination.pathname.startsWith('//') ||
    /^\/(login|register|demo)(\/|$)/i.test(destination.pathname)
  )
    return fallback;

  return destination.pathname + destination.search + destination.hash;
}
