import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import { useAnimatedNumber } from '../../hooks/useAnimatedNumber';

export function StatCard({
  label,
  value,
  icon: Icon,
  trend,
  prefix = '',
  suffix = '',
}: {
  label: string;
  value: number;
  icon: LucideIcon;
  trend?: string;
  prefix?: string;
  suffix?: string;
}) {
  const animated = useAnimatedNumber(value);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="rounded-[var(--radius-card)] border border-border bg-white p-6 shadow-[var(--shadow-card)]"
    >
      <div className="flex items-start justify-between">
        <div className="rounded-xl bg-accent/10 p-2.5">
          <Icon className="h-5 w-5 text-accent" />
        </div>
        {trend && <span className="text-xs text-success font-medium">{trend}</span>}
      </div>
      <p className="mt-4 text-sm text-text-muted">{label}</p>
      <p className="mt-1 font-display text-3xl font-bold tabular-nums text-brand">
        {prefix}{animated.toLocaleString()}{suffix}
      </p>
    </motion.div>
  );
}
