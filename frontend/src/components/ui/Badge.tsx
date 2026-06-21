const styles: Record<string, string> = {
  default: 'bg-surface-alt text-text-muted',
  success: 'bg-green-100 text-success',
  warning: 'bg-orange-100 text-brand',
  danger: 'bg-red-100 text-warning',
  info: 'bg-orange-50 text-brand-light',
  brand: 'bg-brand/10 text-brand',
};

export function Badge({
  children,
  variant = 'default',
  className = '',
}: {
  children: React.ReactNode;
  variant?: keyof typeof styles;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[variant]} ${className}`}>
      {children}
    </span>
  );
}
