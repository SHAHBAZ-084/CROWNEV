import { DEFAULT_PAGE_SIZE, usePagination } from '../../hooks/usePagination';
import { TablePagination } from './TablePagination';
import { Badge } from './Badge';

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
  className?: string;
  align?: 'left' | 'right';
  /** Hide column on small screens (still shown in mobile cards) */
  hideOnMobile?: boolean;
}

export function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  keyField = 'id' as keyof T,
  onRowClick,
  emptyMessage = 'No records found',
  compact = false,
  stackOnMobile = true,
  pageSize = DEFAULT_PAGE_SIZE,
  paginate = true,
}: {
  columns: Column<T>[];
  data: T[];
  keyField?: keyof T;
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
  compact?: boolean;
  stackOnMobile?: boolean;
  pageSize?: number;
  paginate?: boolean;
}) {
  const {
    page,
    setPage,
    paginatedItems,
    totalPages,
    totalItems,
    rangeStart,
    rangeEnd,
    hasMultiplePages,
  } = usePagination(data, paginate ? pageSize : data.length || 1);

  const rows = paginate ? paginatedItems : data;

  if (data.length === 0) {
    return (
      <div className="rounded-[var(--radius-card)] border border-border bg-white py-12 text-center text-text-muted">
        {emptyMessage}
      </div>
    );
  }

  const headPad = compact ? 'px-3 py-2' : 'px-4 py-3';
  const cellPad = compact ? 'px-3 py-1.5' : 'px-4 py-3';
  const actionsCol = columns.find((c) => c.key === 'actions');
  const dataCols = columns.filter((c) => c.key !== 'actions');

  const tableView = (
    <div className={`overflow-hidden rounded-[var(--radius-card)] border border-border bg-white shadow-[var(--shadow-card)] ${stackOnMobile ? 'hidden md:block' : ''}`}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-max table-auto text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="border-b border-border bg-surface-alt">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`${headPad} font-semibold text-brand whitespace-nowrap ${col.align === 'right' ? 'text-right' : 'text-left'} ${col.hideOnMobile ? 'hidden lg:table-cell' : ''} ${col.className ?? ''}`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={String(row[keyField])}
                onClick={() => onRowClick?.(row)}
                className={`border-b border-border last:border-0 transition-colors hover:bg-accent/5 ${onRowClick ? 'cursor-pointer' : ''} ${i % 2 === 1 ? 'bg-surface-alt/80' : ''}`}
              >
                {columns.map((col) => {
                  const cell = col.render ? col.render(row) : String(row[col.key] ?? '');
                  return (
                    <td
                      key={col.key}
                      className={`${cellPad} text-text ${col.align === 'right' ? 'text-right' : 'text-left'} ${col.hideOnMobile ? 'hidden lg:table-cell' : ''} ${col.className ?? ''}`}
                    >
                      {col.align === 'right' ? <div className="flex justify-end">{cell}</div> : cell}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {paginate && hasMultiplePages && (
        <TablePagination
          page={page}
          totalPages={totalPages}
          totalItems={totalItems}
          rangeStart={rangeStart}
          rangeEnd={rangeEnd}
          onPageChange={setPage}
        />
      )}
    </div>
  );

  const cardView = stackOnMobile ? (
    <div className="space-y-3 md:hidden">
      {rows.map((row) => (
        <div
          key={String(row[keyField])}
          onClick={() => onRowClick?.(row)}
          className={`rounded-[var(--radius-card)] border border-border bg-white p-4 shadow-[var(--shadow-card)] ${onRowClick ? 'cursor-pointer active:bg-accent/5' : ''}`}
        >
          <dl className="space-y-2">
            {dataCols
              .filter((col) => !col.hideOnMobile || col.header)
              .map((col) => {
                const value = col.render ? col.render(row) : String(row[col.key] ?? '');
                if (!col.header && col.key === 'actions') return null;
                return (
                  <div key={col.key} className="flex items-start justify-between gap-3 text-sm">
                    {col.header ? (
                      <dt className="shrink-0 text-text-muted">{col.header}</dt>
                    ) : null}
                    <dd className={`min-w-0 text-right font-medium text-text ${col.header ? '' : 'w-full text-left'}`}>
                      {value}
                    </dd>
                  </div>
                );
              })}
          </dl>
          {actionsCol && (
            <div className="mt-3 flex justify-end border-t border-border/60 pt-3">
              {actionsCol.render ? actionsCol.render(row) : null}
            </div>
          )}
        </div>
      ))}
      {paginate && hasMultiplePages && (
        <TablePagination
          page={page}
          totalPages={totalPages}
          totalItems={totalItems}
          rangeStart={rangeStart}
          rangeEnd={rangeEnd}
          onPageChange={setPage}
        />
      )}
    </div>
  ) : null;

  return (
    <>
      {cardView}
      {tableView}
    </>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, 'success' | 'warning' | 'info' | 'danger' | 'default'> = {
    PENDING: 'warning',
    CONFIRMED: 'info',
    DELIVERED: 'success',
    DONE: 'success',
    CANCELLED: 'danger',
    PAID: 'success',
    APPROVED: 'success',
    REJECTED: 'danger',
  };
  return <Badge variant={map[status] ?? 'default'}>{status}</Badge>;
}
