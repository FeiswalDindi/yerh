import { INLINE_YERH_LOGO } from '../config/brand-inline';

export function SiteLoader({ screen = false }: { screen?: boolean }) {
  return (
    <div
      className={screen ? 'yerh-loader yerh-loader--screen' : 'yerh-loader'}
      role="status"
      aria-label="Loading YERH"
    >
      <span className="yerh-loader__emblem" aria-hidden="true">
        <img
          src={INLINE_YERH_LOGO}
          width={80}
          height={80}
          decoding="sync"
          fetchPriority="high"
          alt=""
        />
      </span>
    </div>
  );
}
