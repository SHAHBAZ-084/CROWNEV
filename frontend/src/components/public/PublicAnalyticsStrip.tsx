import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { publicApi } from '../../api/client';
import { useAnimatedNumber } from '../../hooks/useAnimatedNumber';
import { defaultViewport, motionTransition, scaleIn } from '../../lib/publicMotion';

type Stats = {
  branches: number;
  products: number;
  ordersDelivered: number;
};

function StatCell({
  value,
  label,
  compact,
}: {
  value: number;
  label: string;
  compact?: boolean;
}) {
  const n = useAnimatedNumber(value);

  return (
    <motion.div
      variants={scaleIn}
      transition={motionTransition}
      className="text-center"
    >
      <p
        className={`font-display font-bold tabular-nums text-white ${
          compact ? 'text-xl lg:text-2xl' : 'text-2xl lg:text-3xl'
        }`}
      >
        {n}
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
  const items = [
    { label: 'Branches Nationwide', value: stats.branches },
    { label: 'Products Available', value: stats.products },
    { label: 'Orders Delivered', value: stats.ordersDelivered },
  ];

  return (
    <motion.section
      initial="hidden"
      whileInView="visible"
      viewport={defaultViewport}
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: 0.12, delayChildren: 0.05 } },
      }}
      className={`bg-gradient-to-r from-brand via-brand-light to-accent ${
        compact ? 'py-4 lg:py-5' : 'py-6 lg:py-7'
      } ${className}`}
      aria-label="Crown Ev at a glance"
    >
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-4 px-4 sm:grid-cols-3 sm:gap-6 lg:px-8">
        {items.map((s) => (
          <StatCell key={s.label} value={s.value} label={s.label} compact={compact} />
        ))}
      </div>
    </motion.section>
  );
}
