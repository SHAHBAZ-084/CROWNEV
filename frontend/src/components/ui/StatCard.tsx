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
}: {
  label: string;
  value: number;
  icon: LucideIcon;
  trend?: string;
  trendDirection?: 'up' | 'down';
  prefix?: string;
  suffix?: string;
}) {
  const animated = useAnimatedNumber(value);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      whileHover={{ boxShadow: 'var(--shadow-elevated-hover)' }}
      className="rounded-[var(--radius-card)] border border-border-light bg-elevated p-6 shadow-[var(--shadow-elevated)] transition-colors hover:border-accent/30"
    >
      <div className="flex items-start justify-between">
        <div className="rounded-xl bg-brand/10 p-2.5">
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
    </motion.div>
  );
}
