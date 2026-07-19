import { type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { defaultViewport, fadeUp, motionTransition } from '../../lib/publicMotion';

export const dashboardPanelClass =
  'group relative overflow-hidden rounded-[var(--radius-card)] border border-border-light/80 bg-elevated p-6 shadow-[var(--shadow-elevated)] transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-0.5 hover:border-border-light hover:shadow-[var(--shadow-elevated-hover)]';

export const dashboardSectionTitleClass = 'font-display text-lg font-semibold tracking-tight text-ink';

export const stockChipClass =
  'inline-flex items-center gap-1.5 rounded-lg border border-border-light/70 bg-surface-alt/60 px-3 py-1.5 text-xs font-medium text-ink transition-colors duration-200 hover:border-brand/25 hover:bg-brand/[0.04]';

export function DashboardReveal({
  children,
  className = '',
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={defaultViewport}
      variants={fadeUp}
      transition={{ ...motionTransition, delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function DashboardStagger({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={defaultViewport}
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: 0.08, delayChildren: 0.04 } },
      }}
    >
      {children}
    </motion.div>
  );
}

export function DashboardStaggerItem({
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

export function StockModelChip({ name, quantity }: { name: string; quantity: number }) {
  return (
    <motion.span
      variants={fadeUp}
      transition={motionTransition}
      className={stockChipClass}
    >
      <span className="truncate">{name}</span>
      <span className="text-ink-muted">·</span>
      <span className="tabular-nums font-semibold text-brand">{quantity}</span>
    </motion.span>
  );
}

export function StockTotals({ bikeUnits, partUnits }: { bikeUnits: number; partUnits: number }) {
  return (
    <div className="mt-5 flex flex-wrap gap-3 border-t border-border-light/60 pt-4">
      <div className="rounded-lg border border-border-light/60 bg-surface-alt/40 px-3 py-2">
        <p className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">Bike units</p>
        <p className="mt-0.5 font-display text-lg font-semibold tabular-nums text-ink">{bikeUnits}</p>
      </div>
      <div className="rounded-lg border border-border-light/60 bg-surface-alt/40 px-3 py-2">
        <p className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">Part units</p>
        <p className="mt-0.5 font-display text-lg font-semibold tabular-nums text-ink">{partUnits}</p>
      </div>
    </div>
  );
}
