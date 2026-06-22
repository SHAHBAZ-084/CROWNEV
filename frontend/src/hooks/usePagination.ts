import { useEffect, useMemo, useState } from 'react';

export const DEFAULT_PAGE_SIZE = 10;

export function usePagination<T>(items: T[], pageSize = DEFAULT_PAGE_SIZE) {
  const [page, setPage] = useState(1);

  const itemsKey = useMemo(
    () =>
      items
        .map((item, index) => String((item as Record<string, unknown>).id ?? index))
        .join(','),
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
