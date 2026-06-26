import { DEFAULT_PAGE_SIZE, usePagination } from '../../hooks/usePagination';
import { TablePagination } from './TablePagination';
import { Badge } from './Badge';

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T, meta?: { rowIndex: number; serial: number }) => React.ReactNode;
  className?: string;
  align?: 'left' | 'right';
  /** Hide column on small screens (still shown in mobile cards) */
  hideOnMobile?: boolean;
}

function readCell<T extends object>(row: T, key: string): unknown {
  return (row as Record<string, unknown>)[key];
}

export function DataTable<T extends object>({
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
      <div className="rounded-[var(--radius-card)] border border-border-light bg-elevated py-12 text-center text-ink-muted">
        {emptyMessage}
      </div>
    );
  }

  const headPad = compact ? 'px-3 py-2' : 'px-4 py-3';
  const cellPad = compact ? 'px-3 py-1.5' : 'px-4 py-3';
  const actionsCol = columns.find((c) => c.key === 'actions');
  const dataCols = columns.filter((c) => c.key !== 'actions');

  const tableView = (
    <div className={`overflow-hidden rounded-[var(--radius-card)] border border-border-light bg-elevated shadow-[var(--shadow-elevated)] ${stackOnMobile ? 'hidden md:block' : ''}`}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-max table-auto text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="border-b border-border-light bg-subtle">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`${headPad} text-xs font-medium uppercase tracking-wide text-ink-muted whitespace-nowrap ${col.align === 'right' ? 'text-right' : 'text-left'} ${col.hideOnMobile ? 'hidden lg:table-cell' : ''} ${col.className ?? ''}`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const serial = paginate ? rangeStart + i : i + 1;
              return (
              <tr
                key={String(row[keyField])}
                onClick={() => onRowClick?.(row)}
                className={`border-b border-border-light bg-elevated text-ink transition-colors last:border-0 hover:bg-brand/5 ${onRowClick ? 'cursor-pointer' : ''} ${i % 2 === 1 ? 'bg-subtle/50' : ''}`}
              >
                {columns.map((col) => {
                  const cell = col.render
                    ? col.render(row, { rowIndex: i, serial })
                    : String(readCell(row, col.key) ?? '');
                  return (
                    <td
                      key={col.key}
                      className={`${cellPad} ${col.align === 'right' ? 'text-right' : 'text-left'} ${col.hideOnMobile ? 'hidden lg:table-cell' : ''} ${col.className ?? ''}`}
                    >
                      {col.align === 'right' ? <div className="flex justify-end">{cell}</div> : cell}
                    </td>
                  );
                })}
              </tr>
            );
            })}
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
          className={`rounded-[var(--radius-card)] border border-border-light bg-elevated p-4 shadow-[var(--shadow-elevated)] ${onRowClick ? 'cursor-pointer active:bg-brand/5' : ''}`}
        >
          <dl className="space-y-2">
            {dataCols
              .filter((col) => !col.hideOnMobile || col.header)
              .map((col) => {
                const value = col.render ? col.render(row) : String(readCell(row, col.key) ?? '');
                if (!col.header && col.key === 'actions') return null;
                return (
                  <div key={col.key} className="flex items-start justify-between gap-3 text-sm">
                    {col.header ? (
                      <dt className="shrink-0 text-ink-muted">{col.header}</dt>
                    ) : null}
                    <dd className={`min-w-0 text-right font-medium text-ink ${col.header ? '' : 'w-full text-left'}`}>
                      {value}
                    </dd>
                  </div>
                );
              })}
          </dl>
          {actionsCol && (
            <div className="mt-3 flex justify-end border-t border-border-light pt-3">
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
    AWAITING_BILTY_CHARGES: 'warning',
    AWAITING_PAYMENT: 'warning',
    PAYMENT_SUBMITTED: 'info',
    PENDING: 'warning',
    SCHEDULED: 'success',
    CONFIRMED: 'success',
    DELIVERED: 'success',
    DONE: 'success',
    CANCELLED: 'danger',
    PAID: 'success',
    APPROVED: 'success',
    REJECTED: 'danger',
  };
  const labels: Record<string, string> = {
    AWAITING_BILTY_CHARGES: 'Awaiting bilty charges',
    AWAITING_PAYMENT: 'Awaiting payment',
    PAYMENT_SUBMITTED: 'Awaiting verification',
    DELIVERED: 'Completed',
    SCHEDULED: 'Scheduled',
  };
  return <Badge variant={map[status] ?? 'default'}>{labels[status] ?? status.replace(/_/g, ' ')}</Badge>;
}
