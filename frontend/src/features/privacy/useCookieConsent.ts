import { useSyncExternalStore } from 'react';
import { getCookieConsent, subscribeCookieConsent } from '../../services/cookie-consent';
export function useCookieConsent() {
  return useSyncExternalStore(subscribeCookieConsent, getCookieConsent, () => null);
}
