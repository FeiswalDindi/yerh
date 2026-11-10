import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Eye, Link2, Play } from 'lucide-react';
import { contentPath, type ContentItem } from '../../domain/content';

export function StoryPortrait({
  story,
  onPlay,
}: {
  story: ContentItem;
  onPlay: (url: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const card = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const overlayId = useId();
  const lines = story.displayLines ?? { line1: story.title, line2: story.excerpt };
  const video = story.videos[0];
  useEffect(() => {
    if (!open) return;
    const dismissOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !card.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', dismissOutside);
    return () => document.removeEventListener('pointerdown', dismissOutside);
  }, [open]);
  return (
    <div
      ref={card}
      className="my-story-card"
      data-revealed={open}
      onPointerEnter={(event) => {
        if (event.pointerType === 'mouse') setOpen(true);
      }}
      onPointerLeave={(event) => {
        if (event.pointerType === 'mouse') {
          const active = document.activeElement;
          if (!(
            active instanceof HTMLElement &&
            card.current?.contains(active) &&
            active.matches(':focus-visible')
          ))
            setOpen(false);
        }
      }}
      onFocusCapture={(event) => {
        if (event.target.matches(':focus-visible')) setOpen(true);
      }}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          event.preventDefault();
          trigger.current?.focus();
          setOpen(false);
        }
      }}
    >
      <div className="story-card-image-wrap">
        {story.image ? (
          <img src={story.image} alt={story.title} className="story-card-img" loading="lazy" />
        ) : (
          <div className="story-card-placeholder">
            <Eye size={32} aria-hidden="true" />
            <span className="sr-only">{story.title}</span>
          </div>
        )}
        <button
          ref={trigger}
          type="button"
          className="story-reveal-trigger"
          aria-label={`${open ? 'Hide' : 'Show'} actions for ${story.title}`}
          aria-expanded={open}
          aria-controls={overlayId}
          onClick={() => setOpen(!open)}
        />
        <div
          id={overlayId}
          className="story-card-overlay"
          aria-hidden={!open}
          onClick={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <div className="story-card-center-actions">
            <Link
              to={contentPath(story)}
              className="story-action-btn"
              aria-label={`Read story of ${story.title}`}
              tabIndex={open ? 0 : -1}
            >
              <Link2 size={18} />
            </Link>
            {video ? (
              <button
                type="button"
                className="story-action-btn"
                aria-label={`Watch video about ${story.title}`}
                tabIndex={open ? 0 : -1}
                onClick={() => onPlay(video)}
              >
                <Play size={16} fill="currentColor" />
              </button>
            ) : (
              <Link
                to={contentPath(story)}
                className="story-action-btn"
                aria-label={`View story of ${story.title}`}
                tabIndex={open ? 0 : -1}
              >
                <Eye size={18} />
              </Link>
            )}
          </div>
          <div className="story-card-caption">
            <Link to={contentPath(story)} className="story-caption-title" tabIndex={open ? 0 : -1}>
              {lines.line1}
            </Link>
            <p className="story-caption-subtitle">{lines.line2}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
