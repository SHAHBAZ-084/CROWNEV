import { type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { defaultViewport, fadeIn, fadeUp, motionTransition } from '../../lib/publicMotion';

type MotionSectionProps = {
  children: ReactNode;
  className?: string;
  as?: 'section' | 'div' | 'article';
  delay?: number;
  /** Use for above-the-fold blocks (hero) */
  immediate?: boolean;
};

export function MotionSection({
  children,
  className = '',
  as = 'section',
  delay = 0,
  immediate = false,
}: MotionSectionProps) {
  const Comp = motion[as];
  const variants = immediate ? fadeIn : fadeUp;

  return (
    <Comp
      initial="hidden"
      {...(immediate ? { animate: 'visible' } : { whileInView: 'visible' })}
      viewport={immediate ? undefined : defaultViewport}
      variants={variants}
      transition={{ ...motionTransition, delay }}
      className={className}
    >
      {children}
    </Comp>
  );
}

export function MotionStagger({
  children,
  className = '',
  immediate = false,
}: {
  children: ReactNode;
  className?: string;
  immediate?: boolean;
}) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      {...(immediate ? { animate: 'visible' } : { whileInView: 'visible' })}
      viewport={immediate ? undefined : defaultViewport}
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: 0.1, delayChildren: 0.08 } },
      }}
    >
      {children}
    </motion.div>
  );
}

export function MotionItem({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div variants={fadeUp} transition={motionTransition} className={className}>
      {children}
    </motion.div>
  );
}
