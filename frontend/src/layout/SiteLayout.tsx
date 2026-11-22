import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Header } from './Header';
import { Footer } from './Footer';
import { CookieConsentModal } from '../features/privacy/CookieConsentModal';
import { TermsDialog } from '../features/legal/TermsDialog';
import { ManagedSections } from '../features/cms/ManagedSections';
export function SiteLayout() {
  const { pathname, hash } = useLocation();
  const [termsOpen, setTermsOpen] = useState(false);
  useEffect(() => {
    setTermsOpen(false);
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView();
    else window.scrollTo({ top: 0, behavior: 'instant' });
    document.getElementById('main-content')?.focus({ preventScroll: true });
  }, [pathname, hash]);
  return (
    <>
      <Header />
      <main id="main-content" tabIndex={-1}>
        <Outlet />
        <ManagedSections />
      </main>
      <Footer onTerms={() => setTermsOpen(true)} />
      <CookieConsentModal />
      {termsOpen && <TermsDialog onClose={() => setTermsOpen(false)} />}
    </>
  );
}
