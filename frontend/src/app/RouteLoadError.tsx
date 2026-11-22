export function RouteLoadError() {
  return (
    <main className="status-page">
      <h1>We couldn’t open this page.</h1>
      <p>Reload the page to try again.</p>
      <button type="button" className="button" onClick={() => window.location.reload()}>
        Reload page
      </button>
      <a className="text-link" href="/">
        Return to home
      </a>
    </main>
  );
}
