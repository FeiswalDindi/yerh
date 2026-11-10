import { ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useCatalog } from '../../app/useCatalog';
import { contentPath } from '../../domain/content';
export function BlogFeed() {
  const { items, homepage } = useCatalog();
  const news = homepage.featuredBlogs.flatMap((id) => items.filter((item) => item.id === id));
  return (
    <aside className="blog-feed">
      <div className="news-heading">
        <span className="eyebrow">FROM THE HUB</span>
        <span className="feed-dot" />
      </div>
      <h2>
        From the blogs<span>.</span>
      </h2>
      <ol>
        {news.map((item, i) => (
          <li key={item.id}>
            <span className="feed-number">0{i + 1}</span>
            <Link to={contentPath(item)}>
              <small>{item.category}</small>
              <h3>{item.title}</h3>
              <ArrowUpRight size={17} />
            </Link>
          </li>
        ))}
      </ol>
      <Link className="feed-all" to="/publications/blogs">
        Explore all blogs
        <ArrowRightIcon />
      </Link>
    </aside>
  );
}
function ArrowRightIcon() {
  return <ArrowUpRight size={18} />;
}
