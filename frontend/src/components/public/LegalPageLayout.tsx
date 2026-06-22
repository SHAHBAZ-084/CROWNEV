import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

export function LegalPageLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-[60vh] bg-surface-alt py-16 lg:py-24">
      <div className="mx-auto max-w-4xl px-4 lg:px-8">
        <motion.header
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-12 text-center"
        >
          <h1 className="font-display text-3xl font-bold text-brand lg:text-4xl">{title}</h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-text-muted lg:text-base">
            {subtitle}
          </p>
        </motion.header>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
        >
          {children}
        </motion.div>
      </div>
    </div>
  );
}
