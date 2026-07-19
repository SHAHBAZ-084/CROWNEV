import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import { useAnimatedNumber } from '../../hooks/useAnimatedNumber';

export function StatCard({
  label,
  value,
  icon: Icon,
  trend,
  trendDirection = 'up',
  prefix = '',
  suffix = '',
  embedded = false,
}: {
  label: string;
  value: number;
  icon: LucideIcon;
  trend?: string;
  trendDirection?: 'up' | 'down';
  prefix?: string;
  suffix?: string;
  /** When true, skip built-in entry motion (for parent stagger wrappers). */
  embedded?: boolean;
}) {
  const animated = useAnimatedNumber(value);

  const content = (
    <>
      <div className="flex items-start justify-between">
        <div className="rounded-xl border border-border-light/60 bg-surface-alt/50 p-2.5 transition-colors duration-300 group-hover:border-brand/15 group-hover:bg-brand/[0.06]">
          <Icon className="h-5 w-5 text-brand" />
        </div>
        {trend && (
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              trendDirection === 'down'
                ? 'bg-warning/10 text-warning'
                : 'bg-success/10 text-success'
            }`}
          >
            {trend}
          </span>
        )}
      </div>
      <p className="mt-4 text-sm text-ink-muted">{label}</p>
      <p className="mt-1 font-display text-3xl font-bold tabular-nums text-ink">
        {prefix}{animated.toLocaleString()}{suffix}
      </p>
    </>
  );

  const className =
    'group rounded-[var(--radius-card)] border border-border-light/80 bg-elevated p-6 shadow-[var(--shadow-elevated)] transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-0.5 hover:border-border-light hover:shadow-[var(--shadow-elevated-hover)]';

  if (embedded) {
    return <div className={className}>{content}</div>;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className={className}
    >
      {content}
    </motion.div>
  );
}
