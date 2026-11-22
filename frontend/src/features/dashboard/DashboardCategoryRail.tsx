import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, LayoutGrid, type LucideIcon } from 'lucide-react';

export function DashboardCategoryRail({
  entries,
  category,
  icon: Icon,
  onChange,
}: {
  entries: readonly { category: string; image?: string | null }[];
  category: string;
  icon: LucideIcon;
  onChange: (category: string) => void;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const [scroll, setScroll] = useState({ previous: false, next: false });
  const categories = new Map<string, { count: number; image?: string | null }>();
  for (const entry of entries) {
    const group = categories.get(entry.category);
    categories.set(entry.category, {
      count: (group?.count ?? 0) + 1,
      image: group?.image || entry.image,
    });
  }

  function updateScroll() {
    const el = viewport.current;
    if (!el) return;
    const previous = el.scrollLeft > 1;
    const next = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
    setScroll((current) =>
      current.previous === previous && current.next === next ? current : { previous, next },
    );
  }

  useEffect(() => {
    const elements = [viewport.current, track.current];
    if (!elements[0]) return;
    const observer = new ResizeObserver(updateScroll);
    for (const el of elements) if (el) observer.observe(el);
    updateScroll();
    return () => observer.disconnect();
  }, [categories.size]);

  function move(direction: number) {
    const el = viewport.current;
    el?.scrollBy({ left: el.clientWidth * direction * 0.75 });
  }

  if (!entries.length && !category) return null;

  const filters = [
    { value: '', label: 'All categories', count: entries.length, image: null, Icon: LayoutGrid },
    ...[...categories]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([value, group]) => ({ value, label: value, ...group, Icon })),
  ];
  return (
    <div className="dashboard-category-rail" role="group" aria-label="Categories">
      <div className="dashboard-category-viewport" ref={viewport} onScroll={updateScroll}>
        <div className="dashboard-category-track" ref={track}>
          {filters.map(({ value, label, count, image, Icon: FilterIcon }) => (
            <button
              type="button"
              key={value}
              aria-pressed={category === value}
              onClick={() => onChange(value)}
            >
              <span className="dashboard-category-icon">
                {image ? (
                  <img src={image} alt="" loading="lazy" />
                ) : (
                  <FilterIcon size={22} aria-hidden="true" />
                )}
              </span>
              <span>{label}</span>
              <small>{count}</small>
            </button>
          ))}
        </div>
      </div>
      {(scroll.previous || scroll.next) && (
        <div className="dashboard-category-controls">
          <button
            type="button"
            aria-label="Scroll categories left"
            disabled={!scroll.previous}
            onClick={() => move(-1)}
          >
            <ChevronLeft size={18} aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Scroll categories right"
            disabled={!scroll.next}
            onClick={() => move(1)}
          >
            <ChevronRight size={18} aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}
