export type CookieConsentType = 'all' | 'essential';
export const COOKIE_STORAGE_KEY = 'yerh_cookie_consent';
export const COOKIE_DATE_KEY = 'yerh_cookie_consent_date';
export const CONSENT_CHANGED = 'yerh-cookie-consent-changed';
export const OPEN_CONSENT = 'yerh-open-cookie-modal';
export function parseCookieConsent(value: unknown): CookieConsentType | null {
  return value === 'all' || value === 'essential' ? value : null;
}
export function getCookieConsent(): CookieConsentType | null {
  try {
    return parseCookieConsent(localStorage.getItem(COOKIE_STORAGE_KEY));
  } catch {
    return null;
  }
}
export function setCookieConsent(type: CookieConsentType): boolean {
  try {
    localStorage.setItem(COOKIE_STORAGE_KEY, type);
  } catch {
    return false;
  }
  try {
    localStorage.setItem(COOKIE_DATE_KEY, new Date().toISOString());
  } catch {
    /* Optional timestamp must not hide a successful preference write. */
  }
  window.dispatchEvent(new Event(CONSENT_CHANGED));
  return true;
}
export function resetCookieConsent(): boolean {
  try {
    localStorage.removeItem(COOKIE_STORAGE_KEY);
  } catch {
    return false;
  }
  try {
    localStorage.removeItem(COOKIE_DATE_KEY);
  } catch {
    /* Nonessential metadata. */
  }
  window.dispatchEvent(new Event(CONSENT_CHANGED));
  openCookieModal();
  return true;
}
export function openCookieModal() {
  window.dispatchEvent(new Event(OPEN_CONSENT));
}
export function subscribeCookieConsent(listener: () => void) {
  const storage = (event: StorageEvent) => {
    if (event.key === null || event.key === COOKIE_STORAGE_KEY) listener();
  };
  window.addEventListener(CONSENT_CHANGED, listener);
  window.addEventListener('storage', storage);
  return () => {
    window.removeEventListener(CONSENT_CHANGED, listener);
    window.removeEventListener('storage', storage);
  };
}
