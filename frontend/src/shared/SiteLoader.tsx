import { INLINE_YERH_LOGO } from '../config/brand-inline';

/**
 * Renders a label followed by four dots that illuminate sequentially in a 1 -> 4 loop.
 */
export function LoadingDots({
  label = 'Loading',
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <span className={className ? `yerh-loading-dots ${className}` : 'yerh-loading-dots'}>
      <span>{label}</span>
      <span className="yerh-dots" aria-hidden="true">
        <span>.</span>
        <span>.</span>
        <span>.</span>
        <span>.</span>
      </span>
    </span>
  );
}

export function SiteLoader({
  screen = false,
  heartbeat = false,
  message,
}: {
  screen?: boolean;
  heartbeat?: boolean;
  message?: string;
}) {
  const classes = [
    'yerh-loader',
    screen ? 'yerh-loader--screen' : '',
    heartbeat ? 'yerh-loader--heartbeat' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes} role="status" aria-label={message || 'Please Wait, loading YERH'}>
      <div className="yerh-loader__stack">
        <p className="yerh-loader__wait">
          <LoadingDots label="Please Wait" />
        </p>
        <span className="yerh-loader__emblem" aria-hidden="true">
          {heartbeat && <span className="yerh-loader__pulse" aria-hidden="true" />}
          <img
            src={INLINE_YERH_LOGO}
            width={80}
            height={80}
            decoding="sync"
            fetchPriority="high"
            alt=""
          />
        </span>
        {message && <p className="yerh-loader__message">{message}</p>}
      </div>
    </div>
  );
}
