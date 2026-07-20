import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_PAGE_SIZE,
  usePaginatedSearch,
  type PaginatedFetchFn,
} from '../../hooks/usePaginatedSearch';
import { SearchSelect, type SearchSelectOption } from './SearchSelect';

export function AsyncSearchSelect<T>({
  label,
  value,
  onChange,
  fetchPage,
  mapOption,
  getItemKey,
  pinnedItems = [],
  resolvePinnedByValue,
  placeholder,
  required,
  disabled,
  enabled = true,
  pageSize = DEFAULT_PAGE_SIZE,
}: {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  fetchPage: PaginatedFetchFn<T>;
  mapOption: (item: T) => SearchSelectOption;
  getItemKey?: (item: T) => string;
  pinnedItems?: T[];
  resolvePinnedByValue?: (value: string) => Promise<T | null>;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  enabled?: boolean;
  pageSize?: number;
}) {
  const keyOf = getItemKey ?? ((item: T) => mapOption(item).value);
  const [resolvedPinned, setResolvedPinned] = useState<T | null>(null);

  const {
    setSearchInput,
    items,
    loading,
    loadingMore,
    hasMore,
    loadNextPage,
  } = usePaginatedSearch(fetchPage, { enabled, limit: pageSize });

  useEffect(() => {
    if (!value || !resolvePinnedByValue) {
      setResolvedPinned(null);
      return;
    }
    const alreadyPinned =
      pinnedItems.some((item) => keyOf(item) === value)
      || items.some((item) => keyOf(item) === value);
    if (alreadyPinned) {
      setResolvedPinned(null);
      return;
    }

    let cancelled = false;
    resolvePinnedByValue(value)
      .then((item) => {
        if (!cancelled) setResolvedPinned(item);
      })
      .catch(() => {
        if (!cancelled) setResolvedPinned(null);
      });
    return () => { cancelled = true; };
  }, [value, resolvePinnedByValue, pinnedItems, items, keyOf]);

  const options: SearchSelectOption[] = useMemo(() => {
    const merged: T[] = [];
    const seen = new Set<string>();

    const add = (item: T) => {
      const key = keyOf(item);
      if (seen.has(key)) return;
      seen.add(key);
      merged.push(item);
    };

    if (resolvedPinned) add(resolvedPinned);
    for (const item of pinnedItems) add(item);
    for (const item of items) add(item);

    return merged.map(mapOption);
  }, [items, pinnedItems, resolvedPinned, mapOption, keyOf]);

  const handleChange = useCallback(
    (next: string) => {
      onChange(next);
    },
    [onChange],
  );

  return (
    <SearchSelect
      label={label}
      value={value}
      onChange={handleChange}
      options={options}
      placeholder={placeholder}
      required={required}
      disabled={disabled}
      onQueryChange={setSearchInput}
      remoteSearch
      hasMore={hasMore}
      onLoadMore={loadNextPage}
      loadingMore={loadingMore}
      loading={loading}
    />
  );
}
