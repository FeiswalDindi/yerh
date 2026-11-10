import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Cookie, ShieldCheck, X } from 'lucide-react';

import { getCookieConsent, setCookieConsent, OPEN_CONSENT } from '../../services/cookie-consent';
import { useCookieConsent } from './useCookieConsent';
export function CookieConsentModal() {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const consent = useCookieConsent();
  useEffect(() => {
    if (consent) setOpen(false);
  }, [consent]);

  useEffect(() => {
    // Check initial consent status
    const consent = getCookieConsent();
    if (!consent) {
      // Delay slightly for smooth page entrance
      const timer = window.setTimeout(() => setOpen(true), 800);
      return () => window.clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    const handleOpen = () => setOpen(true);
    window.addEventListener(OPEN_CONSENT, handleOpen);
    return () => window.removeEventListener(OPEN_CONSENT, handleOpen);
  }, []);

  if (!open) return null;

  const handleAcceptAll = () => {
    if (setCookieConsent('all')) {
      setOpen(false);
      setError('');
    } else setError('Your browser could not save this preference.');
  };

  const handleEssentialOnly = () => {
    if (setCookieConsent('essential')) {
      setOpen(false);
      setError('');
    } else setError('Your browser could not save this preference.');
  };

  return (
    <aside className="cookie-floating-banner" role="region" aria-label="Cookie consent banner">
      <button
        className="cookie-banner-close"
        type="button"
        aria-label="Dismiss cookie notice with essential cookies"
        onClick={handleEssentialOnly}
      >
        <X size={16} />
      </button>

      <div className="cookie-banner-content">
        <div className="cookie-banner-icon">
          <Cookie size={22} />
        </div>
        <div className="cookie-banner-text">
          <h4 className="cookie-banner-title">Cookie Consent & Preferences</h4>
          <p className="cookie-banner-desc">
            We use cookies and browser storage to optimize site functionality, remember your saved
            resources, and deliver multimedia lessons. Choose <strong>Accept All</strong> or proceed
            with <strong>Essential Only</strong>.
          </p>
        </div>
      </div>

      {error && <p role="alert">{error}</p>}
      <div className="cookie-banner-actions">
        <Link to="/cookies" className="cookie-banner-link" onClick={() => setOpen(false)}>
          <ShieldCheck size={14} />
          Cookie Policy
        </Link>
        <div className="cookie-banner-buttons">
          <button
            type="button"
            className="button button-outline cookie-btn-sm"
            onClick={handleEssentialOnly}
          >
            Essential Only
          </button>
          <button
            type="button"
            className="button button-gold cookie-btn-sm"
            onClick={handleAcceptAll}
          >
            Accept All
          </button>
        </div>
      </div>
    </aside>
  );
}
