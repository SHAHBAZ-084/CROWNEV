import type { ReactNode } from 'react';

const PAGE_BACKGROUNDS = {
  trackOrder:
    'https://images.unsplash.com/photo-1571068316344-75bc76f77861?auto=format&fit=crop&w=960&q=60',
  bookService:
    'https://images.unsplash.com/photo-1620714223087-87170369e725?auto=format&fit=crop&w=960&q=60',
  shop:
    'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=960&q=60',
  contact:
    'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=960&q=60',
} as const;

export type PageHeroPage = keyof typeof PAGE_BACKGROUNDS;

export function PageHero({
  page,
  title,
  subtitle,
  eyebrow,
  compact = false,
  align = 'center',
  children,
}: {
  page: PageHeroPage;
  title: string;
  subtitle?: string;
  eyebrow?: string;
  compact?: boolean;
  align?: 'center' | 'left';
  children?: ReactNode;
}) {
  const isCenter = align === 'center';

  return (
    <section className="relative overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${PAGE_BACKGROUNDS[page]})` }}
        aria-hidden
      />
      <div className="absolute inset-0 bg-gradient-to-b from-brand/88 via-brand/78 to-surface-alt/95" aria-hidden />

      <div
        className={`relative mx-auto max-w-7xl px-4 lg:px-8 ${
          compact ? 'py-8 lg:py-10' : 'py-14 lg:py-16'
        }`}
      >
        <div className={`max-w-2xl ${isCenter ? 'mx-auto text-center' : 'text-left'}`}>
          {eyebrow && (
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/80">{eyebrow}</p>
          )}
          <h1
            className={`font-display font-bold text-white ${
              compact ? 'mt-1 text-2xl lg:text-3xl' : 'mt-2 text-3xl lg:text-4xl'
            }`}
          >
            {title}
          </h1>
          {subtitle && (
            <p
              className={`mt-2 leading-relaxed text-white/90 ${
                compact ? 'text-sm' : 'text-sm lg:text-base'
              }`}
            >
              {subtitle}
            </p>
          )}
        </div>

        {children && (
          <div className={`mt-6 max-w-lg ${isCenter ? 'mx-auto' : ''}`}>
            <div className="rounded-[var(--radius-card)] border border-white/20 bg-white/95 p-6 shadow-[var(--shadow-card-hover)] backdrop-blur-sm">
              {children}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
