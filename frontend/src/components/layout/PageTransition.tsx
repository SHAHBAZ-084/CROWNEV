import { Suspense } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import { ProductGridSkeleton } from '../ui/Skeleton';

export function PageTransition({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const isInitialLoad = location.key === 'default';

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        initial={isInitialLoad ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

export function PageSuspense({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={
      <div className="p-8">
        <ProductGridSkeleton count={4} />
      </div>
    }>
      {children}
    </Suspense>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="font-display text-xl font-bold text-ink sm:text-2xl lg:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-muted sm:text-base">{subtitle}</p>}
      </div>
      {action && <div className="flex w-full shrink-0 flex-wrap gap-2 sm:w-auto sm:justify-end">{action}</div>}
    </div>
  );
}
