import { motion } from 'framer-motion';

export function Card({
  children,
  className = '',
  hover = false,
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  onClick?: () => void;
}) {
  const Comp = hover || onClick ? motion.div : 'div';
  const motionProps =
    hover || onClick
      ? {
          whileHover: { scale: 1.02, boxShadow: 'var(--shadow-card-hover)' },
          whileTap: { scale: 0.99 },
          transition: { duration: 0.2, ease: 'easeOut' as const },
          onClick,
          className: `rounded-[var(--radius-card)] bg-elevated p-6 shadow-[var(--shadow-elevated)] border border-border-light cursor-pointer ${className}`,
        }
      : {
          className: `rounded-[var(--radius-card)] bg-elevated p-6 shadow-[var(--shadow-elevated)] border border-border-light ${className}`,
        };

  return <Comp {...motionProps}>{children}</Comp>;
}

export function CardSkeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton-shimmer rounded-[var(--radius-card)] ${className}`} />;
}
