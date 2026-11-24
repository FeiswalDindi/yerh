import { useCarousel } from '../../shared/useCarousel';
import { useEffect } from 'react';
import { preload } from 'react-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useCatalog } from '../../app/useCatalog';
import type { HeroSlideTheme } from '../../domain/hub';
import { resolveMediaUrl } from '../../shared/mediaUrl';
import { SmartImage } from '../../shared/SmartImage';

function isSplitTheme(theme: HeroSlideTheme | undefined): boolean {
  return theme === 'green' || theme === 'split-navy' || theme === 'split-gold';
}

function slideThemeClass(theme: HeroSlideTheme | undefined): string {
  const current = theme ?? 'photo';
  if (isSplitTheme(current)) {
    return current === 'green'
      ? 'is-green-theme is-split-theme'
      : `is-${current}-theme is-split-theme`;
  }
  return current === 'photo' ? 'is-photo-theme' : `is-photo-theme is-${current}-theme`;
}

export function FeatureCarousel({ previewSlideIndex }: { previewSlideIndex?: number } = {}) {
  const { homepage } = useCatalog();
  const previewMode = previewSlideIndex !== undefined;
  const slides = previewMode ? homepage.slides : homepage.slides.filter((s) => !s.archived);
  const { index, rotating, setKeyboardFocused, move, goTo } = useCarousel(
    previewMode ? 0 : slides.length,
  );
  const displayIndex = previewMode
    ? Math.min(Math.max(0, previewSlideIndex), Math.max(0, slides.length - 1))
    : index;
  const slide = slides[displayIndex];
  const nextImage =
    slides.length > 1 ? slides[(displayIndex + 1) % slides.length]?.image : undefined;

  useEffect(() => {
    if (previewMode || slides.length <= 1) return;
    const resolvedNext = resolveMediaUrl(nextImage, { width: 1200 });
    const resolvedCurrent = resolveMediaUrl(slide?.image, { width: 1200 });
    if (resolvedNext && resolvedNext !== resolvedCurrent) {
      preload(resolvedNext, { as: 'image', fetchPriority: 'low' });
    }
  }, [previewMode, slides.length, nextImage, slide?.image]);

  if (!slide) return null;

  const theme = slide.theme ?? 'photo';
  const splitLayout = isSplitTheme(theme);

  return (
    <section
      className={`hero-slider-container ${slideThemeClass(theme)}`}
      aria-roledescription="carousel"
      aria-label="Homepage Slider"
      onFocusCapture={(e) => setKeyboardFocused(e.target.matches(':focus-visible'))}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setKeyboardFocused(false);
      }}
      aria-live={rotating ? 'off' : 'polite'}
    >
      {previewMode && slide.archived && (
        <span className="hero-slide-archived-badge">Archived — hidden on live homepage</span>
      )}

      {/* Background or Slide Container */}
      {splitLayout ? (
        <div className="green-slider-slide">
          <div className="green-slide-content">
            {slide.eyebrow?.trim() && <span className="green-pill-badge">{slide.eyebrow}</span>}
            <h1 className="green-slide-title">
              {slide.title} {slide.secondLine ? `${slide.secondLine} ` : ''}
              {slide.accent}
            </h1>
            <p className="green-slide-text">{slide.text}</p>
            <Link to={slide.href || '/'} className="green-slide-btn">
              {slide.action}
            </Link>
          </div>
          <div className="green-slide-media">
            <SmartImage
              src={slide.image}
              alt={slide.alt || slide.title || ''}
              className="green-slide-illustration"
              priority
              targetWidth={1200}
              sizes="(max-width: 900px) 100vw, 960px"
            />
          </div>
        </div>
      ) : (
        <div className="photo-slider-slide">
          <SmartImage
            src={slide.image}
            alt={slide.alt || slide.title || ''}
            className="photo-slide-bg"
            priority
            targetWidth={1200}
            sizes="(max-width: 900px) 100vw, 960px"
          />
          <div className="photo-slide-shade" />
          <div className="photo-slide-content">
            {slide.eyebrow?.trim() && <span className="photo-pill-badge">{slide.eyebrow}</span>}
            <h1 className="photo-slide-title">
              {slide.title} {slide.secondLine ?? ''} <em>{slide.accent}</em>
            </h1>
            <p className="photo-slide-text">{slide.text}</p>
            <Link to={slide.href || '/'} className="button button-gold">
              {slide.action}
            </Link>
          </div>
        </div>
      )}

      {!previewMode && slides.length > 1 && (
        <>
          <button
            type="button"
            className="slider-nav-arrow arrow-left"
            aria-label="Previous slide"
            onClick={() => move(-1)}
          >
            <ChevronLeft size={24} />
          </button>
          <button
            type="button"
            className="slider-nav-arrow arrow-right"
            aria-label="Next slide"
            onClick={() => move(1)}
          >
            <ChevronRight size={24} />
          </button>

          <div className="slider-bottom-bar">
            <div className="slider-bullets" role="group" aria-label="Slide indicators">
              {slides.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  className={`slider-bullet ${i === displayIndex ? 'active' : ''}`}
                  aria-label={`Go to slide ${i + 1}`}
                  aria-pressed={i === displayIndex}
                  onClick={() => goTo(i)}
                />
              ))}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
