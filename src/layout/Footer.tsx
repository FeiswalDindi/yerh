import { WhatsAppIcon } from '../shared/WhatsAppIcon';
import { Link } from 'react-router-dom';
import { Facebook, Instagram, Youtube, Rss, ArrowRight } from 'lucide-react';
import { useCatalog } from '../app/useCatalog';

export function Footer({ onTerms }: { onTerms?: () => void }) {
  const { site, media } = useCatalog();
  const socialLinks = Object.fromEntries(site.socials.map((s) => [s.label.toLowerCase(), s.href]));
  return (
    <footer className="site-footer">
      <div className="container">
        {/* Top Callout Strip */}
        <div className="footer-top">
          <div>
            <p className="eyebrow">YOUR NEXT CHAPTER STARTS HERE</p>
            <h2>Big ideas. Real possibilities.</h2>
          </div>
          <Link className="button button-gold" to="/resources">
            Find your next step
            <ArrowRight size={18} />
          </Link>
        </div>

        {/* 4-Column Footer Grid matching screenshot */}
        <div className="footer-grid four-columns">
          {/* Col 1: Brand & Slogan */}
          <div className="footer-brand">
            <Link to="/" className="footer-logo-link" aria-label="YERH home">
              <img src={media.wordmark} alt={site.name} className="footer-logo-img" />
            </Link>
            <p className="footer-slogan">{site.slogan}</p>
          </div>

          {/* Col 2: About Us */}
          <div className="footer-col">
            <h3>About Us</h3>
            <ul className="footer-links-list">
              <li>
                <Link to="/forums">Forum</Link>
              </li>
              <li>
                <Link to="/webinars">Webinars</Link>
              </li>
              <li>
                <Link to="/yem/mentors">Mentorship</Link>
              </li>
              <li>
                <Link to="/learn">Our Courses</Link>
              </li>
              <li>
                <Link to="/workshops">Workshop</Link>
              </li>
              <li>
                <Link to="/network">Groups</Link>
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
                <Link to="/preferences">Cookie Preferences</Link>
              </li>
              <li>
                <Link to="/cookies">Cookies</Link>
              </li>
              <li>
                <Link to="/publications/stories">Success Stories</Link>
              </li>
            </ul>
          </div>

          {/* Col 4: Follow Us */}
          <div className="footer-col">
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
                <Facebook size={18} />
              </a>
              <a
                href={socialLinks.youtube}
                target="_blank"
                rel="noreferrer"
                aria-label="YouTube"
                title="YouTube"
                className="social-icon-btn youtube"
              >
                <Youtube size={18} />
              </a>
              <a
                href={socialLinks.whatsapp}
                target="_blank"
                rel="noreferrer"
                aria-label="WhatsApp"
                title="WhatsApp"
                className="social-icon-btn whatsapp"
              >
                <WhatsAppIcon size={18} />
              </a>
              <a
                href={socialLinks.instagram}
                target="_blank"
                rel="noreferrer"
                aria-label="Instagram"
                title="Instagram"
                className="social-icon-btn instagram"
              >
                <Instagram size={18} />
              </a>
              <Link
                to="/publications"
                aria-label="Publications"
                title="Publications"
                className="social-icon-btn rss"
              >
                <Rss size={18} />
              </Link>
            </div>
          </div>
        </div>

        {/* Bottom Copyright Bar */}
        <div className="footer-bottom">
          <small>
            © {new Date().getFullYear()} {site.name}. All rights reserved. No parts of this site may
            be copied without our written permission.
          </small>
        </div>
      </div>
    </footer>
  );
}
