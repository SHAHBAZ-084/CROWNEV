import { useEffect, useMemo, useState } from 'react';
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

  useEffect(() => {
    setActive(0);
  }, [sorted]);

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

  return (
    <div className="space-y-3">
      <div className="group relative aspect-square overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[var(--shadow-card)]">
        <AnimatePresence mode="wait" initial={false}>
          <motion.img
            key={current.url}
            src={current.url}
            alt={alt}
            initial={{ opacity: 0, scale: 1.02 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="h-full w-full object-cover"
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
            <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-brand/75 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">
              {active + 1} / {sorted.length}
            </div>
          </>
        )}
      </div>

      {hasMultiple && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {sorted.map((img, index) => {
            const selected = index === active;
            return (
              <button
                key={img.id ?? img.url}
                type="button"
                onClick={() => setActive(index)}
                aria-label={`View image ${index + 1}`}
                aria-current={selected}
                className={`relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border-2 transition-all ${
                  selected
                    ? 'border-orange-500 ring-2 ring-orange-500/25 shadow-[var(--shadow-card)]'
                    : 'border-slate-200 opacity-75 hover:border-orange-300 hover:opacity-100'
                }`}
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
