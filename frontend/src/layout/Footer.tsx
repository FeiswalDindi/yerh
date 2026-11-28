import { WhatsAppIcon } from '../shared/WhatsAppIcon';
import { useId } from 'react';
import { Link } from 'react-router-dom';
import { Facebook, Instagram, Youtube, Rss, ArrowRight } from 'lucide-react';
import { laravelModeEnabled } from '../config/laravel';
import { useCatalog } from '../app/useCatalog';
import { SmartImage } from '../shared/SmartImage';

export function Footer({ onTerms }: { onTerms?: () => void }) {
  const { site, media } = useCatalog();
  const wordmarkFilter = useId();
  const socialLinks = Object.fromEntries(site.socials.map((s) => [s.label.toLowerCase(), s.href]));
  const footerCta = {
    eyebrow: site.footerCta?.eyebrow?.trim() || 'YOUR NEXT CHAPTER STARTS HERE',
    heading: site.footerCta?.heading?.trim() || 'Big ideas. Real possibilities.',
    buttonLabel: site.footerCta?.buttonLabel?.trim() || 'Find your next step',
    buttonHref: site.footerCta?.buttonHref?.trim() || '/resources',
  };
  const copyrightNote =
    site.copyrightNote?.trim() ||
    'All rights reserved. No parts of this site may be copied without our written permission.';
  return (
    <footer className="site-footer">
      <svg width={0} height={0} aria-hidden="true" style={{ position: 'absolute' }}>
        <defs>
          <filter id={wordmarkFilter} colorInterpolationFilters="sRGB">
            <feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 1 0" result="white" />
            {/* Gold has more red than blue. Keep those pixels from the original artwork. */}
            <feColorMatrix
              in="SourceGraphic"
              values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  4 0 -4 0 0"
              result="goldMask"
            />
            <feComposite in="SourceGraphic" in2="goldMask" operator="in" result="gold" />
            <feComposite in="white" in2="goldMask" operator="out" result="whiteDetails" />
            <feComposite in="gold" in2="whiteDetails" operator="arithmetic" k2={1} k3={1} />
          </filter>
        </defs>
      </svg>
      <div className="container">
        {/* Top Callout Strip */}
        <div className="footer-top">
          <div>
            <p className="eyebrow">{footerCta.eyebrow}</p>
            <h2>{footerCta.heading}</h2>
          </div>
          {/^https?:\/\//i.test(footerCta.buttonHref) ? (
            <a
              className="button button-gold"
              href={footerCta.buttonHref}
              target="_blank"
              rel="noreferrer"
            >
              {footerCta.buttonLabel}
              <ArrowRight size={18} />
            </a>
          ) : (
            <Link className="button button-gold" to={footerCta.buttonHref}>
              {footerCta.buttonLabel}
              <ArrowRight size={18} />
            </Link>
          )}
        </div>

        {/* 4-Column Footer Grid matching screenshot */}
        <div className="footer-grid">
          {/* Col 1: Brand & Slogan */}
          <div className="footer-brand">
            <Link to="/" className="footer-logo-link" aria-label="YERH home">
              <SmartImage
                src={media.wordmark}
                alt={site.name}
                className="footer-logo-img"
                loading="lazy"
                width={197}
                height={40}
                style={{ filter: `url(#${wordmarkFilter})` }}
              />
            </Link>
            <p className="footer-slogan">{site.slogan}</p>
          </div>

          {/* Col 2: About Us */}
          <div className="footer-col">
            <h3>About Us</h3>
            <ul className="footer-links-list">
              <li>
                <Link to="/forums">Forums</Link>
              </li>
              <li>
                <Link to="/events">Events</Link>
              </li>
              <li>
                <Link to={laravelModeEnabled ? '/join?role=mentor' : '/yem/mentors'}>
                  {laravelModeEnabled ? 'Become a Mentor' : 'Mentorship'}
                </Link>
              </li>
              <li>
                <Link to={laravelModeEnabled ? '/groups' : '/network'}>Groups</Link>
              </li>
              <li>
                <Link to="/learn">Our Courses</Link>
              </li>
            </ul>
          </div>

          {/* Col 3: Quick Links */}
          <div className="footer-col">
            <h3>Quick Links</h3>
            <ul className="footer-links-list">
              <li>
                <Link to="/privacy">Privacy Policy</Link>
              </li>
              <li>
                {onTerms ? (
                  <button type="button" className="footer-link-button" onClick={onTerms}>
                    Terms & Conditions
                  </button>
                ) : (
                  <Link to="/terms">Terms & Conditions</Link>
                )}
              </li>
              <li>
                <Link to="/cookies">Cookies & Preferences</Link>
              </li>
              <li>
                <Link to="/publications/stories">Success Stories</Link>
              </li>
            </ul>
          </div>

          {/* Col 4: Follow Us */}
          <div className="footer-col footer-social">
            <h3>Follow Us</h3>
            <div className="footer-social-icons">
              <a
                href={socialLinks.facebook}
                target="_blank"
                rel="noreferrer"
                aria-label="Facebook"
                title="Facebook"
                className="social-icon-btn facebook"
              >
                <Facebook size={23} aria-hidden="true" />
              </a>
              <a
                href={socialLinks.youtube}
                target="_blank"
                rel="noreferrer"
                aria-label="YouTube"
                title="YouTube"
                className="social-icon-btn youtube"
              >
                <Youtube size={23} aria-hidden="true" />
              </a>
              <a
                href={socialLinks.whatsapp}
                target="_blank"
                rel="noreferrer"
                aria-label="WhatsApp"
                title="WhatsApp"
                className="social-icon-btn whatsapp"
              >
                <WhatsAppIcon size={24} />
              </a>
              <a
                href={socialLinks.instagram}
                target="_blank"
                rel="noreferrer"
                aria-label="Instagram"
                title="Instagram"
                className="social-icon-btn instagram"
              >
                <Instagram size={23} aria-hidden="true" />
              </a>
              <Link
                to="/publications"
                aria-label="Publications"
                title="Publications"
                className="social-icon-btn rss"
              >
                <Rss size={23} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </div>

        {/* Bottom Copyright Bar */}
        <div className="footer-bottom">
          <small>
            © {new Date().getFullYear()} {site.name}. {copyrightNote}
          </small>
        </div>
      </div>
    </footer>
  );
}
