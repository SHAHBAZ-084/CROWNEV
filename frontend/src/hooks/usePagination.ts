import { useEffect, useMemo, useState } from 'react';

export const DEFAULT_PAGE_SIZE = 10;

function getPaginationItemKey(item: unknown, index: number): string {
  const row = item as Record<string, unknown>;
  if (row.id != null && row.id !== '') return String(row.id);
  if (row.voucherNo != null && row.date != null) {
    return `${String(row.voucherNo)}|${String(row.date)}|${String(row.description ?? '')}`;
  }
  return `row-${index}`;
}

export function usePagination<T>(items: T[], pageSize = DEFAULT_PAGE_SIZE) {
  const [page, setPage] = useState(1);

  const itemsKey = useMemo(
    () => items.map((item, index) => getPaginationItemKey(item, index)).join('\n'),
    [items],
  );

  useEffect(() => {
    setPage(1);
  }, [itemsKey]);

  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(page, totalPages);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const paginatedItems = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, safePage, pageSize]);

  const rangeStart = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const rangeEnd = Math.min(safePage * pageSize, totalItems);

  return {
    page: safePage,
    setPage,
    pageSize,
    paginatedItems,
    totalPages,
    totalItems,
    rangeStart,
    rangeEnd,
    hasMultiplePages: totalPages > 1,
  };
}
