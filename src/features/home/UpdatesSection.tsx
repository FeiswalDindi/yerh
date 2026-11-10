import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useCatalog } from '../../app/useCatalog';
import { contentPath } from '../../domain/content';
export function UpdatesSection() {
  const { items } = useCatalog();
  const [showAllUpdates, setShowAllUpdates] = useState(false);
  const allReports = items.filter((item) => item.kind === 'publication');
  const displayedReports = showAllUpdates ? allReports : allReports.slice(0, 2);
  return (
    <>
      {/* 4. Updates Section */}
      <section className="home-section updates-section" aria-labelledby="updates-title">
        <h2 id="updates-title" className="home-section-title">
          Updates
        </h2>

        <div className="updates-card-grid">
          {displayedReports.map((report) => (
            <article key={report.id} className="update-item-card">
              <div className="update-badge-pill">Publications</div>
              {report.publishedAt && (
                <time className="update-date" dateTime={report.publishedAt}>
                  {new Date(report.publishedAt + 'T12:00:00').toLocaleDateString('en-KE', {
                    dateStyle: 'long',
                  })}
                </time>
              )}
              <h3 className="update-title">
                <Link to={contentPath(report)}>{report.title}</Link>
              </h3>
              {report.commentCount !== undefined && (
                <div className="update-comments-count">{report.commentCount} comments</div>
              )}
              <Link to={contentPath(report)} className="update-read-more-btn">
                Read More
              </Link>
            </article>
          ))}
        </div>

        {/* Action Buttons underneath */}
        <div className="updates-actions-row">
          {!showAllUpdates && allReports.length > 2 && (
            <button
              type="button"
              className="button button-gold"
              onClick={() => setShowAllUpdates(true)}
            >
              Load More
            </button>
          )}
          <Link to="/publications" className="button button-navy-outline">
            See All
          </Link>
        </div>
      </section>
    </>
  );
}
