import { Link } from 'react-router-dom';
export function NotFoundPage() {
  return (
    <section className="container status-page">
      <p className="eyebrow">404 · A SMALL DETOUR</p>
      <h1>Let’s get you back on track.</h1>
      <p>We couldn’t find this page. There’s still plenty to discover.</p>
      <Link className="button" to="/">
        Back to the hub
      </Link>
      <Link className="text-link" to="/search">
        Search the collection
      </Link>
    </section>
  );
}
