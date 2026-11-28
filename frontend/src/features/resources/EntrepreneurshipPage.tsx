import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowUpRight, Play } from 'lucide-react';
import { useCatalog } from '../../app/useCatalog';
import { laravelModeEnabled } from '../../config/laravel';
import { PageIntro } from '../../shared/PageIntro';
import { ContentCard } from '../content/ContentCard';
import { NotFoundPage } from '../info/NotFoundPage';
import { usePageTitle } from '../../shared/usePageTitle';
import { VideoDialog } from '../media/VideoDialog';
export function EntrepreneurshipPage() {
  const { topic } = useParams();
  const { topics, lessons, items, homepage } = useCatalog();
  const [activeVideo, setActiveVideo] = useState<{ url: string; title: string } | null>(null);
  const current = topics.find((t) => t.id === topic);
  usePageTitle(current?.title ?? 'Entrepreneurship');
  if (!current) return <NotFoundPage />;
  const videos = lessons.filter((l) =>
    current.lessonTrack === 'funding'
      ? l.title.toLowerCase().includes('financing')
      : l.track === current.lessonTrack,
  );
  return (
    <>
      <PageIntro
        eyebrow="Entrepreneurship"
        title={current.title}
        description={current.description}
      />
      <section className="container section">
        <nav className="section-tabs" aria-label="Entrepreneurship topics">
          {topics.map((t) => (
            <Link
              aria-current={t.id === topic ? 'page' : undefined}
              key={t.id}
              to={`/entrepreneurship/${t.id}`}
            >
              {t.title}
            </Link>
          ))}
        </nav>
        <div className="resource-track-grid">
          <div>
            <h2>Your next steps</h2>
            <ul className="checklist">
              {current.checklist.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <p className="source-note">{current.sourceNote}</p>
            <Link className="text-link" to="/learn">
              {laravelModeEnabled ? 'Explore courses on YERH' : 'Track your learning in the demo'}
              <ArrowUpRight size={17} />
            </Link>
          </div>
          <div>
            {videos.length > 0 ? (
              <div className="lesson-list">
                {videos.map((lesson, i) => (
                  <button
                    key={lesson.id}
                    type="button"
                    className="lesson-list-item"
                    onClick={() => setActiveVideo({ url: lesson.href, title: lesson.title })}
                  >
                    <span className="lesson-number">{String(i + 1).padStart(2, '0')}</span>
                    <div>
                      <small>ORIGINAL YERH VIDEO</small>
                      <h3>{lesson.title}</h3>
                    </div>
                    <span className="play-button">
                      <Play size={15} />
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="resource-callout">
                <div>
                  <h2>Build a support network.</h2>
                  <p>Share experiences and make time for the people who support your journey.</p>
                  <Link className="button" to={laravelModeEnabled ? '/forums' : '/network'}>
                    {laravelModeEnabled ? 'Explore the forums' : 'Explore the network'}
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
        {current.guideIds.length > 0 && (
          <div className="content-grid section">
            {items
              .filter((i) => current.guideIds.includes(i.id))
              .map((i) => (
                <ContentCard key={i.id} item={i} />
              ))}
          </div>
        )}
        {topic === 'funding' && (
          <div className="important-links">
            <h2>Explore official resources</h2>
            {homepage.importantLinks
              .filter((l) => l.label.includes('Fund'))
              .map((l) => (
                <a key={l.href} href={l.href} target="_blank" rel="noreferrer">
                  {l.label}
                  <ArrowUpRight size={17} />
                </a>
              ))}
          </div>
        )}
      </section>
      {activeVideo && (
        <VideoDialog
          url={activeVideo.url}
          title={activeVideo.title}
          onClose={() => setActiveVideo(null)}
        />
      )}
    </>
  );
}
