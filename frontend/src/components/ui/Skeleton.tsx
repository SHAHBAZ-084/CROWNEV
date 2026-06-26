export function Skeleton({ className = 'h-4 w-full' }: { className?: string }) {
  return <div className={`skeleton-shimmer rounded-lg ${className}`} aria-hidden />;
}

/** Mirrors ProductCard layout to prevent layout shift when shop data loads. */
export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex h-full flex-col overflow-hidden rounded-[var(--radius-card)] border border-border-light bg-elevated shadow-[var(--shadow-elevated)]"
          aria-hidden
        >
          <Skeleton className="aspect-[5/4] w-full rounded-none" />
          <div className="flex min-h-[7.5rem] flex-1 flex-col p-5">
            <Skeleton className="mt-1 h-5 w-[92%]" />
            <Skeleton className="mt-2 h-5 w-[70%]" />
            <div className="mt-auto flex items-end justify-between gap-2 pt-4">
              <Skeleton className="h-7 w-28" />
              <Skeleton className="h-9 w-9 shrink-0 rounded-xl" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      <Skeleton className="h-10 w-full" />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}
