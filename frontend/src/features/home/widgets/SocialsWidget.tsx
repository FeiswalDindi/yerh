import { useState } from 'react';
import { Facebook, Instagram } from 'lucide-react';
import { WhatsAppIcon } from '../../../shared/WhatsAppIcon';
import { VideoPlayer } from '../../media/VideoPlayer';
import { useCatalog } from '../../../app/useCatalog';
export function SocialsWidget() {
  const { homepage, site } = useCatalog();
  const socialLinks = Object.fromEntries(site.socials.map((s) => [s.label.toLowerCase(), s.href]));
  const [socialTab, setSocialTab] = useState<'youtube' | 'whatsapp' | 'facebook' | 'instagram'>(
    'youtube',
  );
  return (
    <>
      {/* 5. Visit our Socials (Twitter removed, replaced with WhatsApp) */}
      <section className="sidebar-widget widget-visit-socials">
        <h3 className="sidebar-heading">Visit our Socials</h3>

        {/* Social Tabs */}
        <div className="social-tabs-nav" role="group" aria-label="Social channels">
          <button
            type="button"

            aria-pressed={socialTab === 'youtube'}
            className={`social-tab-btn ${socialTab === 'youtube' ? 'active' : ''}`}
            onClick={() => setSocialTab('youtube')}
          >
            YouTube
          </button>
          <button
            type="button"

            aria-pressed={socialTab === 'whatsapp'}
            className={`social-tab-btn ${socialTab === 'whatsapp' ? 'active' : ''}`}
            onClick={() => setSocialTab('whatsapp')}
          >
            WhatsApp
          </button>
          <button
            type="button"

            aria-pressed={socialTab === 'facebook'}
            className={`social-tab-btn ${socialTab === 'facebook' ? 'active' : ''}`}
            onClick={() => setSocialTab('facebook')}
          >
            Facebook
          </button>
          <button
            type="button"

            aria-pressed={socialTab === 'instagram'}
            className={`social-tab-btn ${socialTab === 'instagram' ? 'active' : ''}`}
            onClick={() => setSocialTab('instagram')}
          >
            Instagram
          </button>
        </div>

        {/* Tab Content */}
        <div className="social-tab-pane">
          {socialTab === 'youtube' && (
            <div className="social-embed youtube-embed">
              <VideoPlayer
                url={homepage.socialVideo.url}
                title={homepage.socialVideo.title}
                className="youtube-iframe"
              />
              <div className="embed-caption">
                <small>{homepage.socialVideo.title}</small>
                <a
                  href={socialLinks.youtube}
                  target="_blank"
                  rel="noreferrer"
                  className="watch-link"
                >
                  Watch on YouTube →
                </a>
              </div>
            </div>
          )}

          {socialTab === 'whatsapp' && (
            <div className="social-card-pane whatsapp-pane">
              <div className="wa-brand-icon">
                <WhatsAppIcon size={38} />
              </div>
              <h4>Chat with YERH on WhatsApp</h4>
              <p>
                Have questions about programs, events, or mentorship? Connect with our team
                directly.
              </p>
              <a
                href={socialLinks.whatsapp}
                target="_blank"
                rel="noreferrer"
                className="button wa-direct-button"
              >
                <WhatsAppIcon size={18} />
                Open WhatsApp (+254 768 980 297)
              </a>
            </div>
          )}

          {socialTab === 'facebook' && (
            <div className="social-card-pane facebook-pane">
              <div className="fb-brand-icon">
                <Facebook size={36} />
              </div>
              <h4>Follow us on Facebook</h4>
              <p>
                Stay updated with community highlights, live announcements, and workshop recaps.
              </p>
              <a
                href={socialLinks.facebook}
                target="_blank"
                rel="noreferrer"
                className="button fb-direct-button"
              >
                <Facebook size={16} />
                Visit YERH Facebook Page
              </a>
            </div>
          )}

          {socialTab === 'instagram' && (
            <div className="social-card-pane instagram-pane">
              <div className="ig-brand-icon">
                <Instagram size={36} />
              </div>
              <h4>Connect on Instagram</h4>
              <p>
                Discover inspiring stories of young entrepreneurs making real impact across Kenya.
              </p>
              <a
                href={socialLinks.instagram}
                target="_blank"
                rel="noreferrer"
                className="button ig-direct-button"
              >
                <Instagram size={16} />
                Follow @copyek on Instagram
              </a>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
