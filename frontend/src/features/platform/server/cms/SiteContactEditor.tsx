import { useState } from 'react';
import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';
import type { SiteContent } from '../../../../domain/site';
import { CardActionBar, type CardActions } from './CardActionBar';

function normalizeBrandSlice(site: SiteContent) {
  const announcement = site.announcement ?? {
    enabled: false,
    text: '',
    linkLabel: 'Learn more',
    linkHref: '/opportunities',
  };
  return {
    name: site.name,
    slogan: site.slogan,
    announcement: {
      enabled: Boolean(announcement.enabled),
      text: announcement.text,
      linkLabel: announcement.linkLabel,
      linkHref: announcement.linkHref,
    },
  };
}

function normalizeFooterSlice(site: SiteContent) {
  const footerCta = site.footerCta ?? {
    eyebrow: 'YOUR NEXT CHAPTER STARTS HERE',
    heading: 'Big ideas. Real possibilities.',
    buttonLabel: 'Find your next step',
    buttonHref: '/resources',
  };
  return {
    footerCta: {
      eyebrow: footerCta.eyebrow,
      heading: footerCta.heading,
      buttonLabel: footerCta.buttonLabel,
      buttonHref: footerCta.buttonHref,
    },
    copyrightNote:
      site.copyrightNote ??
      'All rights reserved. No parts of this site may be copied without our written permission.',
  };
}

function CollapseToggle({ open, onClick }: { open: boolean; onClick: () => void }) {
  return (
    <button type="button" className="cms-icon-btn" aria-expanded={open} onClick={onClick}>
      {open ? (
        <>
          <ChevronUp size={14} /> Collapse
        </>
      ) : (
        <>
          <ChevronDown size={14} /> Edit
        </>
      )}
    </button>
  );
}

export function SiteContactEditor({
  site,
  baselineSite,
  onChange,
  cardActions,
}: {
  site: SiteContent;
  baselineSite?: SiteContent;
  onChange: (next: SiteContent) => void;
  cardActions?: CardActions;
}) {
  const [brandOpen, setBrandOpen] = useState(true);
  const [contactOpen, setContactOpen] = useState(false);
  const [socialsOpen, setSocialsOpen] = useState(false);
  const [footerOpen, setFooterOpen] = useState(false);

  const announcement = site.announcement ?? {
    enabled: false,
    text: '',
    linkLabel: 'Learn more',
    linkHref: '/opportunities',
  };
  const footerCta = site.footerCta ?? {
    eyebrow: 'YOUR NEXT CHAPTER STARTS HERE',
    heading: 'Big ideas. Real possibilities.',
    buttonLabel: 'Find your next step',
    buttonHref: '/resources',
  };

  const brandDirty = Boolean(
    baselineSite &&
    JSON.stringify(normalizeBrandSlice(site)) !== JSON.stringify(normalizeBrandSlice(baselineSite)),
  );
  const contactDirty = Boolean(
    baselineSite && JSON.stringify(site.contact) !== JSON.stringify(baselineSite.contact),
  );
  const socialsDirty = Boolean(
    baselineSite && JSON.stringify(site.socials) !== JSON.stringify(baselineSite.socials),
  );
  const footerDirty = Boolean(
    baselineSite &&
    JSON.stringify(normalizeFooterSlice(site)) !==
      JSON.stringify(normalizeFooterSlice(baselineSite)),
  );

  return (
    <div className="cms-editor-stack">
      <section className={`cms-card${brandDirty ? ' is-dirty' : ''}`}>
        <div className="cms-card-header">
          <div>
            <h2>Brand &amp; top announcement</h2>
            {!brandOpen && (
              <p className="cms-helper-text">
                {site.name} · Announcement {announcement.enabled ? 'On' : 'Off'}
              </p>
            )}
          </div>
          <CollapseToggle open={brandOpen} onClick={() => setBrandOpen((v) => !v)} />
        </div>

        {brandOpen && (
          <>
            <div className="cms-field-grid">
              <label className="cms-field-label">
                Platform name
                <input
                  value={site.name}
                  maxLength={120}
                  onChange={(e) => onChange({ ...site, name: e.target.value })}
                />
              </label>
              <label className="cms-field-label">
                Slogan
                <input
                  value={site.slogan}
                  maxLength={200}
                  onChange={(e) => onChange({ ...site, slogan: e.target.value })}
                />
              </label>
            </div>

            <label className="inline-checkbox">
              <input
                type="checkbox"
                checked={announcement.enabled}
                onChange={(e) =>
                  onChange({
                    ...site,
                    announcement: { ...announcement, enabled: e.target.checked },
                  })
                }
              />{' '}
              Show top announcement bar
            </label>

            {announcement.enabled && (
              <div className="cms-field-grid">
                <label className="cms-field-label">
                  Announcement message
                  <input
                    value={announcement.text}
                    maxLength={180}
                    placeholder="Applications open for Cohort 2026!"
                    onChange={(e) =>
                      onChange({
                        ...site,
                        announcement: { ...announcement, text: e.target.value },
                      })
                    }
                  />
                </label>
                <label className="cms-field-label">
                  Link label
                  <input
                    value={announcement.linkLabel}
                    maxLength={60}
                    onChange={(e) =>
                      onChange({
                        ...site,
                        announcement: { ...announcement, linkLabel: e.target.value },
                      })
                    }
                  />
                </label>
                <label className="cms-field-label">
                  Link destination
                  <input
                    value={announcement.linkHref}
                    maxLength={240}
                    placeholder="/opportunities"
                    onChange={(e) =>
                      onChange({
                        ...site,
                        announcement: { ...announcement, linkHref: e.target.value },
                      })
                    }
                  />
                </label>
              </div>
            )}
          </>
        )}

        <CardActionBar
          dirty={brandDirty}
          section="site"
          actions={cardActions}
          summaryHint="Updated brand and top announcement"
          onDiscard={
            baselineSite
              ? () =>
                  onChange({
                    ...site,
                    name: baselineSite.name,
                    slogan: baselineSite.slogan,
                    announcement: structuredClone(baselineSite.announcement),
                  })
              : undefined
          }
        />
      </section>

      <section className={`cms-card${contactDirty ? ' is-dirty' : ''}`}>
        <div className="cms-card-header">
          <div>
            <h2>Contact information</h2>
            {!contactOpen && (
              <p className="cms-helper-text">
                {[site.contact.email, site.contact.phone, site.contact.address]
                  .filter(Boolean)
                  .join(' · ') || 'No contact details set'}
              </p>
            )}
          </div>
          <CollapseToggle open={contactOpen} onClick={() => setContactOpen((v) => !v)} />
        </div>

        {contactOpen && (
          <div className="cms-field-grid">
            <label className="cms-field-label">
              Contact email
              <input
                type="email"
                value={site.contact.email}
                maxLength={160}
                onChange={(e) =>
                  onChange({ ...site, contact: { ...site.contact, email: e.target.value } })
                }
              />
            </label>
            <label className="cms-field-label">
              Phone number
              <input
                value={site.contact.phone}
                maxLength={40}
                onChange={(e) =>
                  onChange({ ...site, contact: { ...site.contact, phone: e.target.value } })
                }
              />
            </label>
            <label className="cms-field-label">
              WhatsApp number
              <input
                value={site.contact.whatsapp}
                maxLength={40}
                onChange={(e) =>
                  onChange({ ...site, contact: { ...site.contact, whatsapp: e.target.value } })
                }
              />
            </label>
            <label className="cms-field-label">
              Location / address
              <input
                value={site.contact.address}
                maxLength={160}
                onChange={(e) =>
                  onChange({ ...site, contact: { ...site.contact, address: e.target.value } })
                }
              />
            </label>
          </div>
        )}

        <CardActionBar
          dirty={contactDirty}
          section="site"
          actions={cardActions}
          summaryHint="Updated contact information"
          onDiscard={
            baselineSite
              ? () =>
                  onChange({
                    ...site,
                    contact: structuredClone(baselineSite.contact),
                  })
              : undefined
          }
        />
      </section>

      <section className={`cms-card${socialsDirty ? ' is-dirty' : ''}`}>
        <div className="cms-card-header">
          <div>
            <h2>Social links ({site.socials.length})</h2>
            {!socialsOpen && (
              <p className="cms-helper-text">
                {site.socials.map((s) => s.label).join(', ') || 'No social links added'}
              </p>
            )}
          </div>
          <div className="cms-icon-row">
            {socialsOpen && (
              <button
                type="button"
                className="cms-icon-btn"
                onClick={() =>
                  onChange({
                    ...site,
                    socials: [...site.socials, { label: 'LinkedIn', href: 'https://' }],
                  })
                }
              >
                <Plus size={14} /> Add link
              </button>
            )}
            <CollapseToggle open={socialsOpen} onClick={() => setSocialsOpen((v) => !v)} />
          </div>
        </div>

        {socialsOpen &&
          site.socials.map((social, index) => (
            <div className="cms-inline-row" key={index}>
              <label className="cms-field-label">
                Platform
                <input
                  value={social.label}
                  maxLength={60}
                  onChange={(e) =>
                    onChange({
                      ...site,
                      socials: site.socials.map((s, i) =>
                        i === index ? { ...s, label: e.target.value } : s,
                      ),
                    })
                  }
                />
              </label>
              <label className="cms-field-label">
                URL
                <input
                  value={social.href}
                  maxLength={300}
                  onChange={(e) =>
                    onChange({
                      ...site,
                      socials: site.socials.map((s, i) =>
                        i === index ? { ...s, href: e.target.value } : s,
                      ),
                    })
                  }
                />
              </label>
              <button
                type="button"
                className="cms-icon-btn is-danger"
                aria-label={`Remove ${social.label || 'social link'}`}
                onClick={() =>
                  onChange({ ...site, socials: site.socials.filter((_, i) => i !== index) })
                }
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}

        <CardActionBar
          dirty={socialsDirty}
          section="site"
          actions={cardActions}
          summaryHint="Updated social links"
          onDiscard={
            baselineSite
              ? () =>
                  onChange({
                    ...site,
                    socials: structuredClone(baselineSite.socials),
                  })
              : undefined
          }
        />
      </section>

      <section className={`cms-card${footerDirty ? ' is-dirty' : ''}`}>
        <div className="cms-card-header">
          <div>
            <h2>Footer callout &amp; legal</h2>
            {!footerOpen && <p className="cms-helper-text">{footerCta.heading}</p>}
          </div>
          <CollapseToggle open={footerOpen} onClick={() => setFooterOpen((v) => !v)} />
        </div>

        {footerOpen && (
          <>
            <div className="cms-field-grid">
              <label className="cms-field-label">
                Callout eyebrow
                <input
                  value={footerCta.eyebrow}
                  maxLength={100}
                  onChange={(e) =>
                    onChange({ ...site, footerCta: { ...footerCta, eyebrow: e.target.value } })
                  }
                />
              </label>
              <label className="cms-field-label">
                Callout heading
                <input
                  value={footerCta.heading}
                  maxLength={120}
                  onChange={(e) =>
                    onChange({ ...site, footerCta: { ...footerCta, heading: e.target.value } })
                  }
                />
              </label>
              <label className="cms-field-label">
                Button label
                <input
                  value={footerCta.buttonLabel}
                  maxLength={60}
                  onChange={(e) =>
                    onChange({ ...site, footerCta: { ...footerCta, buttonLabel: e.target.value } })
                  }
                />
              </label>
              <label className="cms-field-label">
                Button link
                <input
                  value={footerCta.buttonHref}
                  maxLength={200}
                  onChange={(e) =>
                    onChange({ ...site, footerCta: { ...footerCta, buttonHref: e.target.value } })
                  }
                />
              </label>
            </div>
            <label className="cms-field-label">
              Copyright notice
              <input
                value={
                  site.copyrightNote ??
                  'All rights reserved. No parts of this site may be copied without our written permission.'
                }
                maxLength={240}
                onChange={(e) => onChange({ ...site, copyrightNote: e.target.value })}
              />
            </label>
          </>
        )}

        <CardActionBar
          dirty={footerDirty}
          section="site"
          actions={cardActions}
          summaryHint="Updated footer callout and copyright"
          onDiscard={
            baselineSite
              ? () =>
                  onChange({
                    ...site,
                    footerCta: structuredClone(baselineSite.footerCta),
                    copyrightNote: baselineSite.copyrightNote,
                  })
              : undefined
          }
        />
      </section>
    </div>
  );
}
