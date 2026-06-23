const styles: Record<string, string> = {
  default: 'bg-subtle text-ink-muted',
  success: 'bg-success/10 text-success',
  warning: 'bg-amber-100 text-amber-700',
  danger: 'bg-warning/10 text-warning',
  info: 'bg-brand/10 text-brand',
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
