import { Link } from 'react-router-dom';
import type { CmsSnapshot } from '../../domain/platform';
import { OpportunityCard } from '../benefits/OpportunitiesPage';
import { SessionCard } from '../community/CommunityCards';
import { DiscoverySidebar } from '../discovery/DiscoverySidebar';
import { TermsSummary } from '../legal/TermsDialog';

/** Uses the public components and draft catalog without changing the published provider. */
export function CmsPreview({
  module,
  snapshot: s,
  selected,
}: {
  module: string;
  snapshot: CmsSnapshot;
  selected: number;
}) {
  const c = s.catalog;
  if (module === 'opportunities')
    return s.opportunities[selected] ? (
      <OpportunityCard opportunity={s.opportunities[selected]!} />
    ) : (
      <p>Select an opportunity.</p>
    );
  if (module === 'sessions')
    return s.sessions[selected] ? (
      <SessionCard session={s.sessions[selected]!} />
    ) : (
      <p>Select an event.</p>
    );
  if (module === 'terms') return <TermsSummary />;
  if (module === 'sidebar') return <DiscoverySidebar variant="reading" />;
  if (module === 'media')
    return (
      <div className="cms-media-grid">
        {[
          c.media.logo,
          c.media.wordmark,
          c.media.team,
          c.media.business,
          ...c.media.partners.map((p) => p.image),
        ].map((url, i) => (
          <img src={url} key={`${url}-${i}`} alt="Draft media preview" />
        ))}
      </div>
    );
  if (module === 'site')
    return (
      <>
        <nav className="section-tabs" aria-label="Draft navigation">
          {c.site.navigation.map((n) => (
            <Link to={n.href} key={n.id}>
              {n.label}
            </Link>
          ))}
        </nav>
        <h2>{c.site.name}</h2>
        <p>{c.site.slogan}</p>
        {Object.entries(c.site.pages).map(([path, page]) => (
          <article className="profile-panel" key={path}>
            <span className="eyebrow">
              {page.eyebrow} · {path}
            </span>
            <h2>{page.title}</h2>
            <p>{page.description}</p>
            {page.sections.map((part, i) => (
              <section key={i}>
                <h3>{part.title}</h3>
                <p className="cms-preserve-lines">{part.body}</p>
              </section>
            ))}
          </article>
        ))}
      </>
    );
  if (module === 'courses') {
    const course = c.courses[selected];
    return course ? (
      <article className="collection-card">
        <span className="eyebrow">{course.level}</span>
        <h2>{course.title}</h2>
        <p>{course.description}</p>
        <ol>
          {course.lessonIds.map((id) => (
            <li key={id}>{c.lessons.find((l) => l.id === id)?.title}</li>
          ))}
        </ol>
      </article>
    ) : null;
  }
  if (module === 'lessons') {
    const l = c.lessons[selected];
    return l ? (
      <article className="collection-card">
        <span className="eyebrow">{l.track}</span>
        <h2>{l.title}</h2>
        <a href={l.href} target="_blank" rel="noreferrer">
          Open lesson media →
        </a>
      </article>
    ) : null;
  }
  if (module === 'topics') {
    const t = c.topics[selected];
    return t ? (
      <article className="collection-card">
        <h2>{t.title}</h2>
        <p>{t.description}</p>
        <ul>
          {t.checklist.map((v, i) => (
            <li key={i}>{v}</li>
          ))}
        </ul>
      </article>
    ) : null;
  }
  if (module === 'faqs') {
    const f = c.faqs[selected];
    return f ? (
      <details open className="profile-panel">
        <summary>{f.question}</summary>
        <p>{f.answer}</p>
      </details>
    ) : null;
  }
  if (module === 'community')
    return (
      <div className="benefit-grid">
        {s.community?.groups.map((g) => (
          <article className="collection-card" key={g.id}>
            <span className="eyebrow">{g.category}</span>
            <h2>{g.name}</h2>
            <p>{g.description}</p>
          </article>
        ))}
        {s.community?.forums.map((f) => (
          <article className="collection-card" key={f.id}>
            <h2>{f.name}</h2>
            <p>{f.description}</p>
          </article>
        ))}
      </div>
    );
  return <p>Select a content module to preview its draft.</p>;
}
