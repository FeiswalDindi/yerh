import { useCookieConsent } from './useCookieConsent';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Cookie, RefreshCw, Shield, Sliders } from 'lucide-react';
import { PageIntro } from '../../shared/PageIntro';
import { usePageTitle } from '../../shared/usePageTitle';
import {
  setCookieConsent,
  resetCookieConsent,
  type CookieConsentType,
} from '../../services/cookie-consent';

export function CookiePolicyPage() {
  usePageTitle('Cookie Policy');
  const consent = useCookieConsent();
  const [error, setError] = useState('');
  const handleUpdate = (type: CookieConsentType) => {
    setError(setCookieConsent(type) ? '' : 'Your browser could not save this preference.');
  };

  const handleReset = () => {
    setError(resetCookieConsent() ? '' : 'Your browser could not reset this preference.');
  };

  return (
    <>
      <PageIntro
        eyebrow="TRANSPARENCY & PRIVACY"
        title="Cookie Policy"
        description="Learn how the Youth Entrepreneurship Resource Hub uses cookies and local storage to power your experience."
      />

      <section className="container section cookie-policy-page">
        {/* Interactive Consent Controller */}
        <div className="cookie-control-panel">
          <div className="control-header">
            <div className="control-icon">
              <Sliders size={24} />
            </div>
            <div>
              <span className="eyebrow">YOUR ACTIVE SETTING</span>
              <h3>Manage Your Cookie Preferences</h3>
            </div>
          </div>
          <p>
            Your current consent choice is stored locally in your browser. You can change your
            preference or reset your choice at any time:
          </p>

          {error && <p role="alert">{error}</p>}
          <div className="consent-status-box">
            <strong>Current status:</strong>{' '}
            {consent === 'all' && (
              <span className="status-badge status-all">
                <Check size={14} /> All Cookies & Features Accepted
              </span>
            )}
            {consent === 'essential' && (
              <span className="status-badge status-essential">
                <Shield size={14} /> Essential Cookies Only
              </span>
            )}
            {!consent && (
              <span className="status-badge status-none">
                <Cookie size={14} /> Default / Not Yet Specified
              </span>
            )}
          </div>

          <div className="consent-action-row">
            <button
              type="button"
              className={`button ${consent === 'all' ? 'button-gold' : 'button-outline'}`}
              onClick={() => handleUpdate('all')}
            >
              {consent === 'all' ? '✓ All Accepted' : 'Accept All Cookies'}
            </button>
            <button
              type="button"
              className={`button ${consent === 'essential' ? 'button-gold' : 'button-outline'}`}
              onClick={() => handleUpdate('essential')}
            >
              {consent === 'essential' ? '✓ Essential Active' : 'Essential Only'}
            </button>
            <button
              type="button"
              className="button button-outline"
              onClick={handleReset}
              title="Reset preferences and view consent modal again"
            >
              <RefreshCw size={14} /> Reset & Show Popup
            </button>
          </div>
        </div>

        <div className="cookie-policy-content">
          <h2>1. What Are Cookies and Local Storage?</h2>
          <p>
            Cookies are small text files placed on your device by websites you visit. They are
            widely used to make websites work efficiently, remember your preferences, and provide
            reporting information.
          </p>
          <p>
            Modern web applications also utilize browser local storage (<code>localStorage</code>),
            which functions similarly to cookies by persisting state directly on your device without
            transferring data to remote servers on every request.
          </p>

          <h2>2. How YERH Uses Cookies and Browser Storage</h2>
          <div className="cookie-table-container">
            <table className="cookie-table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Purpose</th>
                  <th>Examples</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <strong>Essential & Functional</strong>
                  </td>
                  <td>
                    Required for core navigation, maintaining demo account role simulations, saving
                    bookmarked resources in your browser, and recording your cookie consent.
                  </td>
                  <td>
                    <code>yerh_cookie_consent</code>, <code>yerh.demo.v1</code>,{' '}
                    <code>yerh.saved-items.v1</code>
                  </td>
                </tr>
                <tr>
                  <td>
                    <strong>Multimedia & Embedded Content</strong>
                  </td>
                  <td>
                    Allows you to view YouTube video lessons, webinar recordings, and social feeds
                    embedded directly inside the hub.
                  </td>
                  <td>
                    YouTube embeds load only after multimedia consent; external links open
                    separately.
                  </td>
                </tr>
                <tr>
                  <td>
                    <strong>Accessibility & Preferences</strong>
                  </td>
                  <td>
                    Reads your device’s reduced-motion preference. No theme or layout preference is
                    currently stored.
                  </td>
                  <td>
                    <code>prefers-reduced-motion</code> detection, user display preferences
                  </td>
                </tr>
                <tr>
                  <td>
                    <strong>Platform Metrics</strong>
                  </td>
                  <td>
                    No analytics or visit tracking is installed. The sidebar counters are mock
                    figures, not live measurements.
                  </td>
                  <td>Development fixtures only</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h2>3. Third-Party Integrations</h2>
          <p>
            When you interact with third-party components on YERH—such as watching embedded YouTube
            video lessons or following external partner links to KCA University, the Youth
            Enterprise Development Fund, or the British Council—those external services may set
            their own cookies subject to their independent privacy policies.
          </p>

          <h2>4. Managing Cookies in Your Web Browser</h2>
          <p>
            You can modify your browser settings to accept, reject, or delete cookies at any time.
            Please note that disabling cookies or clearing browser storage may impact your ability
            to retain saved resources and demo simulations.
          </p>
          <ul className="browser-list">
            <li>
              <strong>Google Chrome:</strong> Settings → Privacy and Security → Third-party cookies
            </li>
            <li>
              <strong>Mozilla Firefox:</strong> Settings → Privacy & Security → Enhanced Tracking
              Protection
            </li>
            <li>
              <strong>Apple Safari:</strong> Preferences → Privacy → Manage Website Data
            </li>
            <li>
              <strong>Microsoft Edge:</strong> Settings → Cookies and site permissions → Manage and
              delete cookies
            </li>
          </ul>

          <h2>5. Inquiries and Contact</h2>
          <p>
            If you have questions regarding this Cookie Policy or how we handle data on the Youth
            Entrepreneurship Resource Hub, please reach out via our{' '}
            <Link to="/contact">Contact Page</Link> or email us at{' '}
            <a href="mailto:yerhdev@gmail.com">yerhdev@gmail.com</a>.
          </p>
          <p>
            You may also review our <Link to="/privacy">Privacy Policy</Link> and{' '}
            <Link to="/terms">Terms & Conditions</Link>.
          </p>
        </div>
      </section>
    </>
  );
}
