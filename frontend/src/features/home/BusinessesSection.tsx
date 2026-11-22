import { Link } from 'react-router-dom';
import { Star } from 'lucide-react';
import { useCatalog } from '../../app/useCatalog';
import { contentPath } from '../../domain/content';
export function BusinessesSection() {
  const { items, homepage } = useCatalog();
  const businesses = homepage.featuredBusinesses.flatMap((id) =>
    items.filter((item) => item.id === id),
  );
  return (
    <>
      {/* 3. Featured Businesses Section */}
      <section
        className="home-section featured-businesses-section"
        aria-labelledby="businesses-title"
      >
        <h2 id="businesses-title" className="home-section-title">
          Featured Businesses
        </h2>

        <div className="businesses-card-grid">
          {businesses.map((biz) => {
            return (
              <article key={biz.id} className="business-item-card">
                <div className="business-thumb-wrap">
                  {biz.image && (
                    <img
                      src={biz.image}
                      alt={biz.title}
                      className="business-thumb"
                      loading="lazy"
                    />
                  )}
                </div>

                <div className="business-card-body">
                  <h3 className="business-title">{biz.title}</h3>

                  {biz.contactLinks?.map((contact) => (
                    <p className="business-contact-line" key={contact.href}>
                      <strong>{contact.label} </strong>
                      <a
                        href={contact.href}
                        rel="noreferrer"
                        target={contact.href.startsWith('https:') ? '_blank' : undefined}
                      >
                        {contact.text}
                      </a>
                    </p>
                  ))}
                  {/* Excerpt text */}
                  <p className="business-excerpt">{biz.excerpt}</p>

                  {biz.socialLabels && (
                    <p className="business-social-tags">
                      {biz.socialLabels.map((label) => (
                        <span key={label}>
                          {label}
                          <br />
                        </span>
                      ))}
                    </p>
                  )}
                  <div className="business-card-action">
                    <Link to={contentPath(biz)} className="business-read-more">
                      Read More
                    </Link>
                  </div>

                  <div
                    className="business-star-rating"
                    aria-label={
                      biz.rating === undefined
                        ? 'Not yet rated'
                        : `Rating: ${biz.rating} out of 5 stars`
                    }
                  >
                    <Star size={14} className="star-icon filled" />
                    <span className="rating-num">{biz.rating ?? 'Not yet rated'}</span>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </>
  );
}
