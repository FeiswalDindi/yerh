import { useState } from 'react';
import { ArrowUpRight, BookOpen, Play, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useCatalog } from '../../app/useCatalog';
import { usePageTitle } from '../../shared/usePageTitle';
import { PageIntro } from '../../shared/PageIntro';
import { SectionHeading } from '../../shared/SectionHeading';
import { ContentCard } from '../content/ContentCard';
export function ResourcesPage() {
  const { lessons, items, homepage } = useCatalog();
  const [query, setQuery] = useState('');
  usePageTitle('Learning resources');
  const filtered = lessons.filter(
    (l) => l.track === 'startups' && l.title.toLowerCase().includes(query.toLowerCase().trim()),
  );
  const guides = homepage.featuredGuides.flatMap((id) => items.filter((item) => item.id === id));
  return (
    <>
      <PageIntro
        eyebrow="Learning resources"
        title="Build your knowledge. Build your future."
        description="A practical starting point for your business journey. Explore lessons, guides, and ideas from the YERH collection."
      />
      <section className="container section">
        <nav className="section-tabs" aria-label="Resource topics">
          <Link to="/entrepreneurship/startups">New Start-Ups</Link>
          <Link to="/entrepreneurship/advanced">Intermediate / Advanced</Link>
          <Link to="/entrepreneurship/wellbeing">General & Well-Being</Link>
          <Link to="/entrepreneurship/funding">Funding</Link>
          <Link to="/learn">Learn</Link>
        </nav>
        <div className="resources-overview">
          <div>
            <p className="eyebrow">START WITH THE FOUNDATIONS</p>
            <h2>
              Small lessons.
              <br />
              Lasting confidence.
            </h2>
            <p>
              From finding a business idea to reaching your first customers, work through these six
              essential topics at your own pace.
            </p>
            <div className="resource-note">
              <BookOpen size={20} />
              <span>
                Original YERH learning collection
                <br />
                <small>Videos open on YouTube.</small>
              </span>
            </div>
          </div>
          <div>
            <label className="search-input">
              <Search size={18} />
              <input
                aria-label="Search learning topics"
                type="search"
                placeholder="Find a learning topic…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <div className="lesson-list">
              {filtered.map((lesson) => (
                <a key={lesson.id} href={lesson.href} target="_blank" rel="noreferrer">
                  <span className="lesson-number">
                    {String(lessons.indexOf(lesson) + 1).padStart(2, '0')}
                  </span>
                  <div>
                    <small>BUSINESS ESSENTIALS · VIDEO</small>
                    <h3>{lesson.title}</h3>
                  </div>
                  <span className="play-button">
                    <Play size={15} />
                  </span>
                </a>
              ))}
            </div>
            {!filtered.length && (
              <p className="empty-state" role="status">
                No topics match. Try “business” or “marketing”.
              </p>
            )}
          </div>
        </div>
      </section>
      <section className="business-section">
        <div className="container">
          <SectionHeading
            eyebrow="PRACTICAL PERSPECTIVES"
            title="A little guidance goes a long way."
            link="/publications/blogs"
            label="More blogs"
          />
          <div className="content-grid">
            {guides.map((item) => (
              <ContentCard item={item} key={item.id} />
            ))}
          </div>
        </div>
      </section>
      <section className="container section">
        <div className="resource-callout">
          <div>
            <p className="eyebrow">THE POWER OF CONNECTION</p>
            <h2>You don’t have to figure it out alone.</h2>
            <p>Find out how mentorship and community can support your next step.</p>
          </div>
          <Link className="button" to="/community">
            Explore the community
            <ArrowUpRight size={18} />
          </Link>
        </div>
      </section>
    </>
  );
}
