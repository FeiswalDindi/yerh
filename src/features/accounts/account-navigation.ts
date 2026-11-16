const origin = 'https://yerh.invalid';

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
