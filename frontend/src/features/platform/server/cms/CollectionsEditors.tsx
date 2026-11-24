import { useState } from 'react';
import { ArrowDown, ArrowUp, ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';
import type { Faq } from '../../../../domain/hub';
import type { TeamContent, TeamMember } from '../../../../domain/site';
import type { CmsMediaAsset } from '../../../../services/laravel-cms-repository';
import { SmartImage } from '../../../../shared/SmartImage';
import { CardActionBar, type CardActions } from './CardActionBar';
import { ImageField } from './MediaPickerModal';

function move<T>(items: T[], from: number, to: number): T[] {
  if (to < 0 || to >= items.length) return items;
  const copy = [...items];
  const [picked] = copy.splice(from, 1);
  if (picked === undefined) return items;
  copy.splice(to, 0, picked);
  return copy;
}

export function FaqsEditor({
  faqs,
  baselineFaqs,
  onChange,
  cardActions,
}: {
  faqs: Faq[];
  baselineFaqs?: Faq[];
  onChange: (next: Faq[]) => void;
  cardActions?: CardActions;
}) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  const dirty = Boolean(baselineFaqs && JSON.stringify(faqs) !== JSON.stringify(baselineFaqs));

  const q = query.trim().toLowerCase();
  const visibleFaqs = faqs
    .map((faq, index) => ({ faq, index }))
    .filter(
      ({ faq }) =>
        !q || faq.question.toLowerCase().includes(q) || faq.answer.toLowerCase().includes(q),
    );

  return (
    <div className="cms-editor-stack">
      <section className={`cms-card${dirty ? ' is-dirty' : ''}`}>
        <div className="cms-card-header">
          <h2>Frequently asked questions ({faqs.length})</h2>
          <button
            type="button"
            className="button button-small"
            onClick={() => {
              const next = [
                ...faqs,
                { question: 'New question?', answer: 'Provide a clear, helpful answer.' },
              ];
              onChange(next);
              setExpandedIndex(next.length - 1);
              setQuery('');
            }}
          >
            <Plus size={14} /> Add FAQ
          </button>
        </div>

        <div className="cms-filter-bar">
          <input
            type="search"
            aria-label="Search FAQs"
            placeholder="Search questions or answers…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div className="cms-accordion-list">
          {visibleFaqs.map(({ faq, index }) => {
            const isOpen = expandedIndex === index;
            return (
              <div className={`cms-accordion-item${isOpen ? ' is-open' : ''}`} key={index}>
                <div className="cms-accordion-row">
                  <div className="cms-accordion-main">
                    <div className="cms-accordion-text">
                      <strong>
                        #{index + 1} · {faq.question || 'Untitled question'}
                      </strong>
                      <small>{faq.answer || 'No answer entered'}</small>
                    </div>
                  </div>
                  <div className="cms-icon-row">
                    <button
                      type="button"
                      className="cms-icon-btn"
                      onClick={() => setExpandedIndex(isOpen ? null : index)}
                    >
                      {isOpen ? (
                        <>
                          <ChevronUp size={13} /> Done
                        </>
                      ) : (
                        <>
                          <ChevronDown size={13} /> Edit
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      className="cms-icon-btn"
                      disabled={index === 0}
                      onClick={() => {
                        onChange(move(faqs, index, index - 1));
                        if (expandedIndex === index) setExpandedIndex(index - 1);
                      }}
                    >
                      <ArrowUp size={13} />
                    </button>
                    <button
                      type="button"
                      className="cms-icon-btn"
                      disabled={index >= faqs.length - 1}
                      onClick={() => {
                        onChange(move(faqs, index, index + 1));
                        if (expandedIndex === index) setExpandedIndex(index + 1);
                      }}
                    >
                      <ArrowDown size={13} />
                    </button>
                    <button
                      type="button"
                      className="cms-icon-btn is-danger"
                      onClick={() => {
                        onChange(faqs.filter((_, i) => i !== index));
                        if (expandedIndex === index) setExpandedIndex(null);
                      }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {isOpen && (
                  <div className="cms-accordion-body">
                    <label className="cms-field-label">
                      Question
                      <input
                        value={faq.question}
                        maxLength={240}
                        onChange={(e) =>
                          onChange(
                            faqs.map((item, i) =>
                              i === index ? { ...item, question: e.target.value } : item,
                            ),
                          )
                        }
                      />
                    </label>
                    <label className="cms-field-label">
                      Answer
                      <textarea
                        value={faq.answer}
                        maxLength={2000}
                        rows={3}
                        onChange={(e) =>
                          onChange(
                            faqs.map((item, i) =>
                              i === index ? { ...item, answer: e.target.value } : item,
                            ),
                          )
                        }
                      />
                    </label>
                  </div>
                )}
              </div>
            );
          })}
          {visibleFaqs.length === 0 && (
            <p className="cms-helper-text" style={{ padding: '0.75rem' }}>
              No FAQs match &ldquo;{query}&rdquo;.
            </p>
          )}
        </div>

        <CardActionBar
          dirty={dirty}
          section="faqs"
          actions={cardActions}
          summaryHint="Updated FAQs"
          showWhenServerDraft
          onDiscard={baselineFaqs ? () => onChange(structuredClone(baselineFaqs)) : undefined}
        />
      </section>
    </div>
  );
}

export function TeamEditor({
  team,
  baselineTeam,
  onChange,
  media,
  onUploaded,
  cardActions,
}: {
  team: TeamContent;
  baselineTeam?: TeamContent;
  onChange: (next: TeamContent) => void;
  media: CmsMediaAsset[];
  onUploaded: (asset: CmsMediaAsset) => void;
  cardActions?: CardActions;
}) {
  const [headerOpen, setHeaderOpen] = useState(false);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [query, setQuery] = useState('');

  const headerDirty = Boolean(
    baselineTeam &&
    JSON.stringify({
      title: team.title,
      intro: team.intro,
      groupPhoto: team.groupPhoto,
    }) !==
      JSON.stringify({
        title: baselineTeam.title,
        intro: baselineTeam.intro,
        groupPhoto: baselineTeam.groupPhoto,
      }),
  );
  const membersDirty = Boolean(
    baselineTeam && JSON.stringify(team.members) !== JSON.stringify(baselineTeam.members),
  );

  function addMember() {
    const fresh: TeamMember = {
      id: `member-${crypto.randomUUID().slice(0, 8)}`,
      name: 'New Team Member',
      role: 'Role title',
      positioning: '',
      bio: '',
      image: '',
      linkedinUrl: '',
    };
    const next = [...team.members, fresh];
    onChange({ ...team, members: next });
    setExpandedIndex(next.length - 1);
    setQuery('');
  }

  const q = query.trim().toLowerCase();
  const visibleMembers = team.members
    .map((member, index) => ({ member, index }))
    .filter(
      ({ member }) =>
        !q ||
        member.name.toLowerCase().includes(q) ||
        member.role.toLowerCase().includes(q) ||
        member.positioning.toLowerCase().includes(q),
    );

  return (
    <div className="cms-editor-stack">
      <section className={`cms-card${headerDirty ? ' is-dirty' : ''}`}>
        <div className="cms-card-header">
          <div>
            <h2>Team section header &amp; group photo</h2>
            {!headerOpen && (
              <p className="cms-helper-text">
                {team.title} · Group photo: {team.groupPhoto.image ? 'Set' : 'None'}
              </p>
            )}
          </div>
          <button
            type="button"
            className="cms-icon-btn"
            aria-expanded={headerOpen}
            onClick={() => setHeaderOpen((v) => !v)}
          >
            {headerOpen ? (
              <>
                <ChevronUp size={14} /> Collapse
              </>
            ) : (
              <>
                <ChevronDown size={14} /> Edit
              </>
            )}
          </button>
        </div>

        {headerOpen && (
          <>
            <label className="cms-field-label">
              Section heading
              <input
                value={team.title}
                maxLength={100}
                onChange={(e) => onChange({ ...team, title: e.target.value })}
              />
            </label>
            <label className="cms-field-label">
              Introduction
              <textarea
                value={team.intro}
                maxLength={500}
                rows={2}
                onChange={(e) => onChange({ ...team, intro: e.target.value })}
              />
            </label>
            <ImageField
              label="Team group photo"
              value={team.groupPhoto.image}
              onChange={(image) => onChange({ ...team, groupPhoto: { ...team.groupPhoto, image } })}
              alt={team.groupPhoto.alt}
              onAltChange={(alt) => onChange({ ...team, groupPhoto: { ...team.groupPhoto, alt } })}
              folder="team"
              media={media}
              onUploaded={onUploaded}
            />
          </>
        )}

        <CardActionBar
          dirty={headerDirty}
          section="team"
          actions={cardActions}
          summaryHint="Updated team header and group photo"
          onDiscard={
            baselineTeam
              ? () =>
                  onChange({
                    ...team,
                    title: baselineTeam.title,
                    intro: baselineTeam.intro,
                    groupPhoto: structuredClone(baselineTeam.groupPhoto),
                  })
              : undefined
          }
        />
      </section>

      <section className={`cms-card${membersDirty ? ' is-dirty' : ''}`}>
        <div className="cms-card-header">
          <h2>Team members ({team.members.length})</h2>
          <button type="button" className="button button-small" onClick={addMember}>
            <Plus size={14} /> Add member
          </button>
        </div>

        <div className="cms-filter-bar">
          <input
            type="search"
            aria-label="Search team members"
            placeholder="Search members by name or role…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div className="cms-accordion-list">
          {visibleMembers.map(({ member, index }) => {
            const isOpen = expandedIndex === index;
            return (
              <div
                className={`cms-accordion-item${isOpen ? ' is-open' : ''}`}
                key={member.id || index}
              >
                <div className="cms-accordion-row">
                  <div className="cms-accordion-main">
                    {member.image && (
                      <SmartImage
                        className="cms-avatar-sm"
                        src={member.image}
                        alt=""
                        targetWidth={120}
                      />
                    )}
                    <div className="cms-accordion-text">
                      <strong>{member.name || `Member ${index + 1}`}</strong>
                      <small>{member.role || 'No role title'}</small>
                    </div>
                  </div>
                  <div className="cms-icon-row">
                    <button
                      type="button"
                      className="cms-icon-btn"
                      onClick={() => setExpandedIndex(isOpen ? null : index)}
                    >
                      {isOpen ? (
                        <>
                          <ChevronUp size={13} /> Done
                        </>
                      ) : (
                        <>
                          <ChevronDown size={13} /> Edit
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      className="cms-icon-btn"
                      disabled={index === 0}
                      onClick={() => {
                        onChange({ ...team, members: move(team.members, index, index - 1) });
                        if (expandedIndex === index) setExpandedIndex(index - 1);
                      }}
                    >
                      <ArrowUp size={13} />
                    </button>
                    <button
                      type="button"
                      className="cms-icon-btn"
                      disabled={index >= team.members.length - 1}
                      onClick={() => {
                        onChange({ ...team, members: move(team.members, index, index + 1) });
                        if (expandedIndex === index) setExpandedIndex(index + 1);
                      }}
                    >
                      <ArrowDown size={13} />
                    </button>
                    <button
                      type="button"
                      className="cms-icon-btn is-danger"
                      onClick={() => {
                        onChange({
                          ...team,
                          members: team.members.filter((_, i) => i !== index),
                        });
                        if (expandedIndex === index) setExpandedIndex(null);
                      }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {isOpen && (
                  <div className="cms-accordion-body">
                    <div className="cms-field-grid">
                      <label className="cms-field-label">
                        Full name
                        <input
                          value={member.name}
                          maxLength={100}
                          onChange={(e) =>
                            onChange({
                              ...team,
                              members: team.members.map((m, i) =>
                                i === index ? { ...m, name: e.target.value } : m,
                              ),
                            })
                          }
                        />
                      </label>
                      <label className="cms-field-label">
                        Role / Title
                        <input
                          value={member.role}
                          maxLength={140}
                          onChange={(e) =>
                            onChange({
                              ...team,
                              members: team.members.map((m, i) =>
                                i === index ? { ...m, role: e.target.value } : m,
                              ),
                            })
                          }
                        />
                      </label>
                      <label className="cms-field-label">
                        Positioning subtitle
                        <input
                          value={member.positioning}
                          maxLength={160}
                          onChange={(e) =>
                            onChange({
                              ...team,
                              members: team.members.map((m, i) =>
                                i === index ? { ...m, positioning: e.target.value } : m,
                              ),
                            })
                          }
                        />
                      </label>
                      <label className="cms-field-label">
                        LinkedIn URL (optional)
                        <input
                          value={member.linkedinUrl}
                          maxLength={300}
                          onChange={(e) =>
                            onChange({
                              ...team,
                              members: team.members.map((m, i) =>
                                i === index ? { ...m, linkedinUrl: e.target.value } : m,
                              ),
                            })
                          }
                        />
                      </label>
                    </div>
                    <label className="cms-field-label">
                      Bio
                      <textarea
                        value={member.bio}
                        maxLength={1200}
                        rows={3}
                        onChange={(e) =>
                          onChange({
                            ...team,
                            members: team.members.map((m, i) =>
                              i === index ? { ...m, bio: e.target.value } : m,
                            ),
                          })
                        }
                      />
                    </label>
                    <ImageField
                      label="Portrait photo"
                      value={member.image}
                      onChange={(image) =>
                        onChange({
                          ...team,
                          members: team.members.map((m, i) => (i === index ? { ...m, image } : m)),
                        })
                      }
                      folder="team"
                      media={media}
                      onUploaded={onUploaded}
                    />
                  </div>
                )}
              </div>
            );
          })}
          {visibleMembers.length === 0 && (
            <p className="cms-helper-text" style={{ padding: '0.75rem' }}>
              No team members match &ldquo;{query}&rdquo;.
            </p>
          )}
        </div>

        <CardActionBar
          dirty={membersDirty}
          section="team"
          actions={cardActions}
          summaryHint="Updated team members"
          onDiscard={
            baselineTeam
              ? () => onChange({ ...team, members: structuredClone(baselineTeam.members) })
              : undefined
          }
        />
      </section>
    </div>
  );
}

export function PartnersEditor({
  partners,
  baselinePartners,
  onChange,
  media,
  onUploaded,
  cardActions,
}: {
  partners: { name: string; image: string; url: string }[];
  baselinePartners?: { name: string; image: string; url: string }[];
  onChange: (next: { name: string; image: string; url: string }[]) => void;
  media: CmsMediaAsset[];
  onUploaded: (asset: CmsMediaAsset) => void;
  cardActions?: CardActions;
}) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  const dirty = Boolean(
    baselinePartners && JSON.stringify(partners) !== JSON.stringify(baselinePartners),
  );

  const q = query.trim().toLowerCase();
  const visiblePartners = partners
    .map((partner, index) => ({ partner, index }))
    .filter(
      ({ partner }) =>
        !q || partner.name.toLowerCase().includes(q) || partner.url.toLowerCase().includes(q),
    );

  return (
    <div className="cms-editor-stack">
      <section className={`cms-card${dirty ? ' is-dirty' : ''}`}>
        <div className="cms-card-header">
          <h2>Partner logos ({partners.length})</h2>
          <button
            type="button"
            className="button button-small"
            onClick={() => {
              const next = [
                ...partners,
                { name: 'New Partner', image: '/media/yerh-logo-224.webp', url: 'https://' },
              ];
              onChange(next);
              setExpandedIndex(next.length - 1);
              setQuery('');
            }}
          >
            <Plus size={14} /> Add partner
          </button>
        </div>

        <div className="cms-filter-bar">
          <input
            type="search"
            aria-label="Search partners"
            placeholder="Search partners…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div className="cms-accordion-list">
          {visiblePartners.map(({ partner, index }) => {
            const isOpen = expandedIndex === index;
            return (
              <div className={`cms-accordion-item${isOpen ? ' is-open' : ''}`} key={index}>
                <div className="cms-accordion-row">
                  <div className="cms-accordion-main">
                    {partner.image && (
                      <SmartImage
                        className="cms-logo-sm"
                        src={partner.image}
                        alt=""
                        targetWidth={120}
                      />
                    )}
                    <div className="cms-accordion-text">
                      <strong>{partner.name || `Partner ${index + 1}`}</strong>
                      <small>{partner.url || 'No link set'}</small>
                    </div>
                  </div>
                  <div className="cms-icon-row">
                    <button
                      type="button"
                      className="cms-icon-btn"
                      onClick={() => setExpandedIndex(isOpen ? null : index)}
                    >
                      {isOpen ? (
                        <>
                          <ChevronUp size={13} /> Done
                        </>
                      ) : (
                        <>
                          <ChevronDown size={13} /> Edit
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      className="cms-icon-btn"
                      disabled={index === 0}
                      onClick={() => {
                        onChange(move(partners, index, index - 1));
                        if (expandedIndex === index) setExpandedIndex(index - 1);
                      }}
                    >
                      <ArrowUp size={13} />
                    </button>
                    <button
                      type="button"
                      className="cms-icon-btn"
                      disabled={index >= partners.length - 1}
                      onClick={() => {
                        onChange(move(partners, index, index + 1));
                        if (expandedIndex === index) setExpandedIndex(index + 1);
                      }}
                    >
                      <ArrowDown size={13} />
                    </button>
                    <button
                      type="button"
                      className="cms-icon-btn is-danger"
                      onClick={() => {
                        onChange(partners.filter((_, i) => i !== index));
                        if (expandedIndex === index) setExpandedIndex(null);
                      }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {isOpen && (
                  <div className="cms-accordion-body">
                    <div className="cms-field-grid">
                      <label className="cms-field-label">
                        Partner name
                        <input
                          value={partner.name}
                          maxLength={120}
                          onChange={(e) =>
                            onChange(
                              partners.map((p, i) =>
                                i === index ? { ...p, name: e.target.value } : p,
                              ),
                            )
                          }
                        />
                      </label>
                      <label className="cms-field-label">
                        Website URL
                        <input
                          value={partner.url}
                          maxLength={300}
                          onChange={(e) =>
                            onChange(
                              partners.map((p, i) =>
                                i === index ? { ...p, url: e.target.value } : p,
                              ),
                            )
                          }
                        />
                      </label>
                    </div>
                    <ImageField
                      label="Partner logo"
                      value={partner.image}
                      onChange={(image) =>
                        onChange(partners.map((p, i) => (i === index ? { ...p, image } : p)))
                      }
                      folder="partners"
                      media={media}
                      onUploaded={onUploaded}
                    />
                  </div>
                )}
              </div>
            );
          })}
          {visiblePartners.length === 0 && (
            <p className="cms-helper-text" style={{ padding: '0.75rem' }}>
              No partners match &ldquo;{query}&rdquo;.
            </p>
          )}
        </div>

        <CardActionBar
          dirty={dirty}
          section="partners"
          actions={cardActions}
          summaryHint="Updated partner logos"
          showWhenServerDraft
          onDiscard={
            baselinePartners ? () => onChange(structuredClone(baselinePartners)) : undefined
          }
        />
      </section>
    </div>
  );
}
