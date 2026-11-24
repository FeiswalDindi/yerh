import { useEffect, useRef, useState, type ImgHTMLAttributes } from 'react';
import { buildMediaSrcSet, getMediaDimensions, resolveMediaUrl } from './mediaUrl';

export type SmartImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> & {
  src?: string | null;
  priority?: boolean;
  targetWidth?: number;
  responsiveWidths?: number[];
  preferOriginal?: boolean;
};

export function SmartImage({
  src,
  priority = false,
  targetWidth,
  responsiveWidths,
  preferOriginal = false,
  className,
  loading,
  decoding,
  fetchPriority,
  sizes,
  srcSet,
  width,
  height,
  onLoad,
  onError,
  alt = '',
  ...rest
}: SmartImageProps) {
  const imgRef = useRef<HTMLImageElement>(null);
  const resolvedSrc = resolveMediaUrl(src, { width: targetWidth, preferOriginal });
  const computedSrcSet = srcSet ?? (sizes ? buildMediaSrcSet(src, responsiveWidths) : undefined);
  const dims = width === undefined && height === undefined ? getMediaDimensions(src) : undefined;
  const immediate = Boolean(priority) || resolvedSrc.startsWith('data:');
  const [loaded, setLoaded] = useState(immediate);

  useEffect(() => {
    const el = imgRef.current;
    if (immediate || (el?.complete && el.naturalWidth > 0)) {
      setLoaded(true);
    } else {
      setLoaded(false);
    }
  }, [resolvedSrc, immediate]);

  const classes = ['yerh-img', !loaded && !immediate ? 'is-loading' : '', className ?? '']
    .filter(Boolean)
    .join(' ');

  return (
    <img
      ref={imgRef}
      src={resolvedSrc || undefined}
      srcSet={computedSrcSet}
      sizes={sizes}
      alt={alt}
      width={width ?? dims?.width}
      height={height ?? dims?.height}
      className={classes}
      loading={priority ? 'eager' : (loading ?? 'lazy')}
      decoding={decoding ?? (priority ? 'sync' : 'async')}
      fetchPriority={priority ? 'high' : fetchPriority}
      onLoad={(event) => {
        setLoaded(true);
        onLoad?.(event);
      }}
      onError={(event) => {
        setLoaded(true);
        onError?.(event);
      }}
      {...rest}
    />
  );
}
