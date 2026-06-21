import { Badge } from './Badge';

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
  className?: string;
}

export function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  keyField = 'id' as keyof T,
  onRowClick,
  emptyMessage = 'No records found',
}: {
  columns: Column<T>[];
  data: T[];
  keyField?: keyof T;
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
}) {
  if (data.length === 0) {
    return (
      <div className="rounded-[var(--radius-card)] border border-border bg-white py-12 text-center text-text-muted">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-[var(--radius-card)] border border-border bg-white shadow-[var(--shadow-card)]">
      <table className="w-full text-sm">
        <thead className="sticky top-0 z-10">
          <tr className="border-b border-border bg-surface-alt">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`px-4 py-3 text-left font-semibold text-brand ${col.className ?? ''}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr
              key={String(row[keyField])}
              onClick={() => onRowClick?.(row)}
              className={`border-b border-border last:border-0 transition-colors hover:bg-accent/5 ${onRowClick ? 'cursor-pointer' : ''} ${i % 2 === 1 ? 'bg-surface-alt/80' : ''}`}
            >
              {columns.map((col) => (
                <td key={col.key} className={`px-4 py-3 text-text ${col.className ?? ''}`}>
                  {col.render ? col.render(row) : String(row[col.key] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
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
