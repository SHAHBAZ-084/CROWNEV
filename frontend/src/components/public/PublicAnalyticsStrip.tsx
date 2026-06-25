import { useEffect, useRef, useState } from 'react';
import { motion, useInView } from 'framer-motion';
import { Building2, Package, Truck, type LucideIcon } from 'lucide-react';
import { publicApi } from '../../api/client';
import { useAnimatedNumber } from '../../hooks/useAnimatedNumber';
import { defaultViewport, easeOut } from '../../lib/publicMotion';

type Stats = {
  branches: number;
  products: number;
  ordersDelivered: number;
};

function StatCell({
  value,
  label,
  icon: Icon,
  compact,
  index,
}: {
  value: number;
  label: string;
  icon: LucideIcon;
  compact?: boolean;
  index: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, defaultViewport);
  const [iconPulse, setIconPulse] = useState(false);

  const n = useAnimatedNumber(value, {
    enabled: inView,
    onComplete: () => setIconPulse(true),
  });

  useEffect(() => {
    if (!inView) setIconPulse(false);
  }, [inView, value]);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={defaultViewport}
      transition={{ duration: 0.5, delay: index * 0.1, ease: easeOut }}
      className="flex flex-col items-center text-center"
    >
      <motion.div
        animate={iconPulse ? { scale: [1, 1.08, 1] } : { scale: 1 }}
        transition={{ duration: 0.35, ease: easeOut }}
        className={`mb-2 flex items-center justify-center rounded-full bg-white/15 ${
          compact ? 'h-9 w-9' : 'h-11 w-11'
        }`}
        aria-hidden
      >
        <Icon className={compact ? 'h-4 w-4 text-white' : 'h-5 w-5 text-white'} strokeWidth={2} />
      </motion.div>
      <p
        className={`font-display font-bold tabular-nums text-white ${
          compact ? 'text-xl lg:text-2xl' : 'text-2xl lg:text-3xl'
        }`}
      >
        {n.toLocaleString()}
      </p>
      <p className={`mt-0.5 font-medium text-white/85 ${compact ? 'text-[11px] sm:text-xs' : 'text-xs sm:text-sm'}`}>
        {label}
      </p>
    </motion.div>
  );
}

export function PublicAnalyticsStrip({
  variant = 'full',
  className = '',
}: {
  variant?: 'full' | 'compact';
  className?: string;
}) {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    publicApi
      .landing()
      .then((data) => setStats(data.stats))
      .catch(() => {});
  }, []);

  if (!stats) return null;

  const compact = variant === 'compact';
  const items: { label: string; value: number; icon: LucideIcon }[] = [
    { label: 'Branches Nationwide', value: stats.branches, icon: Building2 },
    { label: 'Products Available', value: stats.products, icon: Package },
    { label: 'Orders Delivered', value: stats.ordersDelivered, icon: Truck },
  ];

  return (
    <section
      className={`bg-gradient-to-r from-brand via-brand-light to-accent ${
        compact ? 'py-4 lg:py-5' : 'py-6 lg:py-7'
      } ${className}`}
      aria-label="Crown Ev at a glance"
    >
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-4 px-4 sm:grid-cols-3 sm:gap-6 lg:px-8">
        {items.map((s, index) => (
          <StatCell
            key={s.label}
            value={s.value}
            label={s.label}
            icon={s.icon}
            compact={compact}
            index={index}
          />
        ))}
      </div>
    </section>
  );
}
