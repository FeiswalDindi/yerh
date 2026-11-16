import { useCarousel } from '../../shared/useCarousel';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useCatalog } from '../../app/useCatalog';

export function FeatureCarousel() {
  const { homepage } = useCatalog();
  const slides = homepage.slides;
  const { index, rotating, setKeyboardFocused, move, goTo } = useCarousel(slides.length);
  const slide = slides[index];
  if (!slide) return null;

  const isGreenBanner = slide.theme === 'green';
  return (
    <section
      className={`hero-slider-container ${isGreenBanner ? 'is-green-theme' : 'is-photo-theme'}`}
      aria-roledescription="carousel"
      aria-label="Homepage Slider"
      onFocusCapture={(e) => setKeyboardFocused(e.target.matches(':focus-visible'))}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setKeyboardFocused(false);
      }}
      aria-live={rotating ? 'off' : 'polite'}
    >
      {/* Background or Slide Container */}
      {isGreenBanner ? (
        <div className="green-slider-slide">
          <div className="green-slide-content">
            <h1 className="green-slide-title">
              {slide.title} {slide.accent}
            </h1>
            <p className="green-slide-text">{slide.text}</p>
            <Link to={slide.href} className="green-slide-btn">
              {slide.action}
            </Link>
          </div>
          <div className="green-slide-media">
            <img
              src={slide.image}
              alt={slide.alt}
              className="green-slide-illustration"
              loading="eager"
            />
          </div>
        </div>
      ) : (
        <div className="photo-slider-slide">
          <img src={slide.image} alt={slide.alt} className="photo-slide-bg" loading="eager" />
          <div className="photo-slide-shade" />
          <div className="photo-slide-content">
            <h1 className="photo-slide-title">
              {slide.title} {slide.secondLine} <em>{slide.accent}</em>
            </h1>
            <p className="photo-slide-text">{slide.text}</p>
            <Link to={slide.href} className="button button-gold">
              {slide.action}
            </Link>
          </div>
        </div>
      )}

      {/* Edge Arrows */}
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
              className={`slider-bullet ${i === index ? 'active' : ''}`}
              aria-label={`Go to slide ${i + 1}`}
              aria-pressed={i === index}
              onClick={() => goTo(i)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
