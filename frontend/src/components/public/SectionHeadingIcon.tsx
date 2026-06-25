import { type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { defaultViewport, easeOut } from '../../lib/publicMotion';

export function SectionHeadingIcon({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      initial={{ rotate: 0, scale: 1 }}
      whileInView={{ rotate: [0, -10, 10, 0], scale: [1, 1.1, 1] }}
      viewport={defaultViewport}
      transition={{ duration: 0.6, ease: easeOut }}
    >
      {children}
    </motion.div>
  );
}
