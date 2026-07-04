import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Zap } from 'lucide-react';

type ProductImage = { id?: number; url: string; isPrimary: boolean; sortOrder?: number };

export function sortProductImages(images?: ProductImage[]) {
  if (!images?.length) return [];
  return [...images].sort((a, b) => {
    if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
    return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
  });
}

export function getPrimaryProductImage(images?: ProductImage[]) {
  return sortProductImages(images)[0]?.url;
}

export function ProductImageGallery({
  images,
  alt,
}: {
  images?: ProductImage[];
  alt: string;
}) {
  const sorted = useMemo(() => sortProductImages(images), [images]);
  const [active, setActive] = useState(0);
  const thumbsRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  // Reset to first image when product changes
  useEffect(() => {
    setActive(0);
  }, [sorted]);

  // Auto-scroll active thumbnail into center view
  useEffect(() => {
    const container = thumbsRef.current;
    if (!container) return;
    const thumb = container.children[active] as HTMLElement | undefined;
    if (!thumb) return;
    const containerCenter = container.offsetWidth / 2;
    const thumbCenter = thumb.offsetLeft + thumb.offsetWidth / 2;
    container.scrollTo({
      left: thumbCenter - containerCenter,
      behavior: 'smooth',
    });
  }, [active]);

  if (!sorted.length) {
    return (
      <div className="flex aspect-square items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
        <Zap className="h-24 w-24 text-orange-200" />
      </div>
    );
  }

  const current = sorted[active] ?? sorted[0];
  const hasMultiple = sorted.length > 1;

  function goPrev() {
    setActive((i) => (i - 1 + sorted.length) % sorted.length);
  }

  function goNext() {
    setActive((i) => (i + 1) % sorted.length);
  }

  // Touch swipe handlers for main image
  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    // Only trigger if horizontal swipe is more dominant than vertical
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 40) {
      if (dx < 0) goNext();
      else goPrev();
    }
    touchStartX.current = null;
    touchStartY.current = null;
  }

  return (
    <div className="w-full space-y-3">
      {/* Main image — 4:3 on mobile so the full bike fits, square on desktop */}
      <div
        className="group relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-[var(--shadow-card)] sm:aspect-square"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.img
            key={current.url}
            src={current.url}
            alt={alt}
            initial={{ opacity: 0, scale: 1.02 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="h-full w-full object-contain"
          />
        </AnimatePresence>

        {hasMultiple && (
          <>
            <button
              type="button"
              onClick={goPrev}
              aria-label="Previous image"
              className="absolute left-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white/90 text-slate-700 opacity-100 shadow-md backdrop-blur-sm transition-all hover:bg-white focus:opacity-100 sm:left-3 sm:h-10 sm:w-10 md:opacity-0 md:group-hover:opacity-100"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={goNext}
              aria-label="Next image"
              className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white/90 text-slate-700 opacity-100 shadow-md backdrop-blur-sm transition-all hover:bg-white focus:opacity-100 sm:right-3 sm:h-10 sm:w-10 md:opacity-0 md:group-hover:opacity-100"
            >
              <ChevronRight className="h-5 w-5" />
            </button>

            {/* Counter badge */}
            <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-brand/75 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">
              {active + 1} / {sorted.length}
            </div>
          </>
        )}
      </div>

      {/* Thumbnail strip — edge-to-edge on mobile, auto-scrolls active into center */}
      {hasMultiple && (
        <div
          ref={thumbsRef}
          className={[
            // Layout — no negative margins to prevent viewport overflow
            'flex gap-2 overflow-x-auto',
            // Snap scrolling
            'snap-x snap-mandatory',
            // Hide scrollbar across all browsers
            '[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden',
            // Bottom padding so ring shadow isn't clipped
            'pb-1',
          ].join(' ')}
        >
          {sorted.map((img, index) => {
            const selected = index === active;
            return (
              <button
                key={img.id ?? img.url}
                type="button"
                onClick={() => setActive(index)}
                aria-label={`View image ${index + 1}`}
                aria-current={selected}
                className={[
                  // Smaller on mobile, standard on sm+
                  'relative h-16 w-16 sm:h-20 sm:w-20',
                  'shrink-0 snap-start overflow-hidden rounded-xl border-2 transition-all duration-200',
                  selected
                    ? 'border-orange-500 ring-2 ring-orange-500/25 shadow-[var(--shadow-card)] scale-100 opacity-100'
                    : 'border-slate-200 opacity-60 hover:border-orange-300 hover:opacity-100',
                ].join(' ')}
              >
                <img src={img.url} alt="" className="h-full w-full object-cover" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
