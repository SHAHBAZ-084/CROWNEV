import { useCallback, useEffect, useRef, useState } from 'react';
import { useDebounce } from './useDebounce';

export type PaginatedResult<T> = {
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
};

export type PaginatedFetchFn<T> = (params: {
  search: string;
  page: number;
  limit: number;
}) => Promise<PaginatedResult<T>>;

export const DEFAULT_PAGE_SIZE = 20;

export function usePaginatedSearch<T>(
  fetchFn: PaginatedFetchFn<T>,
  options?: {
    enabled?: boolean;
    limit?: number;
    debounceMs?: number;
  },
) {
  const enabled = options?.enabled ?? true;
  const limit = options?.limit ?? DEFAULT_PAGE_SIZE;
  const debounceMs = options?.debounceMs ?? 300;

  const [searchInput, setSearchInput] = useState('');
  const search = useDebounce(searchInput.trim(), debounceMs);
  const [items, setItems] = useState<T[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchFnRef = useRef(fetchFn);
  fetchFnRef.current = fetchFn;

  useEffect(() => {
    if (!enabled) {
      setItems([]);
      setTotal(0);
      setPage(1);
      return;
    }

    let cancelled = false;
    setLoading(true);
    fetchFnRef.current({ search, page: 1, limit })
      .then((result) => {
        if (cancelled) return;
        setItems(result.data);
        setTotal(result.pagination.total);
        setPage(1);
      })
      .catch(() => {
        if (cancelled) return;
        setItems([]);
        setTotal(0);
        setPage(1);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [search, enabled, limit]);

  const loadNextPage = useCallback(async () => {
    if (!enabled || loading || loadingMore) return;
    const nextPage = page + 1;
    if (nextPage > Math.ceil(total / limit)) return;

    setLoadingMore(true);
    try {
      const result = await fetchFnRef.current({ search, page: nextPage, limit });
      setItems((prev) => [...prev, ...result.data]);
      setPage(nextPage);
      setTotal(result.pagination.total);
    } catch {
      // keep existing items on failure
    } finally {
      setLoadingMore(false);
    }
  }, [enabled, loading, loadingMore, page, total, limit, search]);

  const hasMore = page * limit < total;

  return {
    searchInput,
    setSearchInput,
    search,
    items,
    setItems,
    page,
    total,
    loading,
    loadingMore,
    hasMore,
    loadNextPage,
  };
}
