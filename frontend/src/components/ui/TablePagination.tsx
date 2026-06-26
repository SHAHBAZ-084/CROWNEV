import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './Button';

export function TablePagination({
  page,
  totalPages,
  totalItems,
  rangeStart,
  rangeEnd,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  totalItems: number;
  rangeStart: number;
  rangeEnd: number;
  onPageChange: (page: number) => void;
}) {
  if (totalItems <= 0 || totalPages <= 1) return null;

  return (
    <div
      className="flex flex-col gap-3 border-t border-border-light bg-subtle/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
      onMouseDown={(e) => e.stopPropagation()}
    >
      <p className="text-sm text-ink-muted">
        Showing <span className="font-medium text-ink">{rangeStart}</span>
        {' – '}
        <span className="font-medium text-ink">{rangeEnd}</span>
        {' of '}
        <span className="font-medium text-ink">{totalItems}</span>
      </p>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
          Previous
        </Button>
        <span className="min-w-[5.5rem] text-center text-sm text-ink-muted">
          Page {page} of {totalPages}
        </span>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          aria-label="Next page"
        >
          Next
          <ChevronRight className="h-4 w-4" aria-hidden />
        </Button>
      </div>
    </div>
  );
}
