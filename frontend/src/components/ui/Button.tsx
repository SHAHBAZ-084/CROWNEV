import { motion, type HTMLMotionProps } from 'framer-motion';
import { forwardRef } from 'react';

type Variant = 'primary' | 'secondary' | 'accent' | 'ghost' | 'danger';

interface ButtonProps extends HTMLMotionProps<'button'> {
  variant?: Variant;
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

const variants: Record<Variant, string> = {
  primary: 'bg-brand text-white hover:bg-brand/90 shadow-sm',
  secondary: 'border-2 border-brand text-brand bg-transparent hover:bg-brand/5',
  accent: 'bg-brand text-white font-semibold hover:bg-brand/90 shadow-sm',
  ghost: 'text-brand bg-transparent hover:text-accent',
  danger: 'bg-warning text-white hover:bg-warning/90',
};

const sizes = {
  sm: 'px-3 py-1.5 text-sm rounded-lg',
  md: 'px-5 py-2.5 text-sm rounded-xl',
  lg: 'px-8 py-3.5 text-base rounded-xl',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading, className = '', children, disabled, ...props }, ref) => (
    <motion.button
      ref={ref}
      whileHover={{ scale: disabled || loading ? 1 : 1.03, boxShadow: disabled || loading ? undefined : 'var(--shadow-card-hover)' }}
      whileTap={{ scale: disabled || loading ? 1 : 0.98 }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 font-medium transition-colors outline-none focus:outline-none focus-visible:outline-none disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {loading ? 'Please wait…' : children}
    </motion.button>
  )
);
Button.displayName = 'Button';
