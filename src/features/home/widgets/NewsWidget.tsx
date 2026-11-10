import { Link } from 'react-router-dom';
import { contentPath } from '../../../domain/content';
import { useCatalog } from '../../../app/useCatalog';
export function NewsWidget() {
  const { items, homepage } = useCatalog();
  const newsBlogs = homepage.featuredBlogs.flatMap((id) => items.filter((item) => item.id === id));
  return (
    <>
      {/* 1. Entrepreneurship News Feed */}
      <section className="sidebar-widget widget-news-feed">
        <h3 className="sidebar-heading headline-news-feed">
          <span>Entrepreneurship</span> <span className="highlight-text">News Feed</span>
        </h3>
        <ol className="news-feed-list">
          {newsBlogs.slice(0, 4).map((blog, idx) => (
            <li key={blog.id} className="news-feed-item">
              <span className="feed-badge">{idx + 1}</span>
              <div className="feed-content">
                <Link to={contentPath(blog)} className="feed-title">
                  {blog.title}
                </Link>
                <span className="feed-source">YERH - KENYA</span>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}
