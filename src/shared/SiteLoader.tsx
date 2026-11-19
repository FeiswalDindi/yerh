export function SiteLoader({ screen = false }: { screen?: boolean }) {
  return (
    <div
      className={screen ? 'yerh-loader yerh-loader--screen' : 'yerh-loader'}
      role="status"
      aria-label="Loading YERH"
    >
      <span className="yerh-loader__emblem" aria-hidden="true">
        <img src="/favicon.svg" width="80" height="80" alt="" />
      </span>
    </div>
  );
}
