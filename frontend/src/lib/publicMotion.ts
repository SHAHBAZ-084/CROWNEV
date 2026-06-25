export const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0 },
};

export const fadeIn = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

export const scaleIn = {
  hidden: { opacity: 0, scale: 0.92 },
  visible: { opacity: 1, scale: 1 },
};

export const staggerContainer = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.1, delayChildren: 0.06 },
  },
};

export const defaultViewport = { once: true, amount: 0.15 } as const;

export const easeOut = [0.22, 1, 0.36, 1] as const;

export const motionTransition = {
  duration: 0.5,
  ease: easeOut,
};

/** Tailwind classes for CTA arrow icons inside a `group` hover target. */
export const ctaArrowClass = 'transition-transform group-hover:translate-x-1';
