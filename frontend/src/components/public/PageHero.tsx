import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { fadeUp, motionTransition, staggerContainer } from '../../lib/publicMotion';

type PageBackground =
  | string
  | {
      src: string;
      srcMobile?: string;
      overlay?: string;
      mobilePosition?: string;
    };

const PAGE_BACKGROUNDS: Record<string, PageBackground> = {
  trackOrder: {
    src: '/images/shop-hero.webp',
    overlay: 'from-black/55 via-black/25 to-subtle/98',
  },
  bookService: {
    src: '/images/book-service-hero.webp',
    srcMobile: '/images/book-service-hero-sm.webp',
    overlay: 'from-black/50 via-black/15 to-subtle/98',
  },
  about: {
    src: '/images/about-hero.webp',
    srcMobile: '/images/about-hero-sm.webp',
  },
  shop: {
    src: '/images/shop-hero.webp',
    overlay: 'from-black/55 via-black/20 to-subtle/98',
    mobilePosition: 'center 35%',
  },
  compare: {
    src: '/images/shop-hero.webp',
    overlay: 'from-black/55 via-black/20 to-subtle/98',
    mobilePosition: 'center 35%',
  },
  contact: {
    src: '/images/contact-hero.webp',
    srcMobile: '/images/contact-hero-sm.webp',
  },
};

export type PageHeroPage = keyof typeof PAGE_BACKGROUNDS;

const DEFAULT_OVERLAY = 'from-black/50 via-black/20 to-surface-alt/96';

/** Shared hero dimensions — keep About, Shop, Book Service, Contact aligned */
const HERO_MIN_H = 'min-h-[252px] lg:min-h-[288px]';
const HERO_MIN_H_WITH_CHILDREN = 'min-h-[320px] lg:min-h-[352px]';
const HERO_PAD = 'py-14 lg:py-16';

function resolveBackground(page: PageHeroPage) {
  const bg = PAGE_BACKGROUNDS[page];
  if (typeof bg === 'string') {
    return { src: bg, srcMobile: bg, overlay: DEFAULT_OVERLAY, mobilePosition: 'center' as const };
  }
  return {
    src: bg.src,
    srcMobile: bg.srcMobile ?? bg.src,
    overlay: bg.overlay ?? DEFAULT_OVERLAY,
    mobilePosition: bg.mobilePosition ?? 'center',
  };
}

export function PageHero({
  page,
  title,
  subtitle,
  eyebrow,
  align = 'center',
  children,
}: {
  page: PageHeroPage;
  title: string;
  subtitle?: string;
  eyebrow?: string;
  align?: 'center' | 'left';
  children?: ReactNode;
}) {
  const isCenter = align === 'center';
  const { src, srcMobile, overlay, mobilePosition } = resolveBackground(page);
  const minH = children ? HERO_MIN_H_WITH_CHILDREN : HERO_MIN_H;

  return (
    <section className={`relative w-full overflow-hidden ${minH}`}>
      <div
        className="absolute inset-0 hidden bg-cover bg-center bg-no-repeat md:block"
        style={{ backgroundImage: `url(${src})` }}
        aria-hidden
      />
      <div
        className="absolute inset-0 bg-cover bg-no-repeat md:hidden"
        style={{ backgroundImage: `url(${srcMobile})`, backgroundPosition: mobilePosition }}
        aria-hidden
      />
      <div className={`absolute inset-0 bg-gradient-to-b ${overlay}`} aria-hidden />

      <div
        className={`relative mx-auto flex w-full max-w-7xl flex-col justify-center px-4 lg:px-8 ${HERO_PAD} ${minH}`}
      >
        <motion.div
          className={`w-full max-w-2xl ${isCenter ? 'mx-auto text-center' : 'text-left'}`}
          initial="hidden"
          animate="visible"
          variants={staggerContainer}
        >
          {eyebrow && (
            <motion.p
              variants={fadeUp}
              transition={motionTransition}
              className="text-xs font-semibold uppercase tracking-[0.2em] text-white/80 drop-shadow-sm"
            >
              {eyebrow}
            </motion.p>
          )}
          <motion.h1
            variants={fadeUp}
            transition={motionTransition}
            className="mt-2 font-display text-2xl font-bold text-white drop-shadow-md sm:text-3xl lg:text-4xl"
          >
            {title}
          </motion.h1>
          {subtitle && (
            <motion.p
              variants={fadeUp}
              transition={motionTransition}
              className="mt-3 text-sm leading-relaxed text-white/95 drop-shadow-sm lg:text-base"
            >
              {subtitle}
            </motion.p>
          )}
        </motion.div>

        {children && (
          <motion.div
            className={`mt-6 w-full max-w-lg ${isCenter ? 'mx-auto' : ''}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...motionTransition, delay: 0.25 }}
          >
            <div className="rounded-[var(--radius-card)] border border-border-light bg-elevated/95 p-4 shadow-[var(--shadow-elevated)] backdrop-blur-sm sm:p-6">
              {children}
            </div>
          </motion.div>
        )}
      </div>
    </section>
  );
}
