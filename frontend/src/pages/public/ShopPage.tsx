import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Bike, Package, Percent, Search, SlidersHorizontal, Wrench, X } from 'lucide-react';
import { publicApi } from '../../api/client';
import type { Product } from '../../types';
import { ProductCard } from '../../components/public/ProductCard';
import { MotionSection } from '../../components/public/MotionSection';
import { PageHero } from '../../components/public/PageHero';
import { PageHeader } from '../../components/layout/PageTransition';
import { useAuth } from '../../contexts/AuthContext';
import { ProductGridSkeleton } from '../../components/ui/Skeleton';
import { useDebounce } from '../../hooks/useDebounce';
import { buildShopGridItems } from '../../lib/shopListing';

const TYPE_FILTERS = [
  { value: '', label: 'All', icon: Package },
  { value: 'BIKE', label: 'Bikes', icon: Bike },
  { value: 'PART', label: 'Parts', icon: Wrench },
] as const;

export default function ShopPage() {
  const { user } = useAuth();
  const isCustomerDashboard = user?.role === 'CUSTOMER';
  const [params, setParams] = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(params.get('search') ?? '');
  const debouncedSearch = useDebounce(search);

  const type = params.get('type') ?? '';
  const onSale = params.get('sale') === 'true';
  const gridItems = useMemo(() => buildShopGridItems(products), [products]);

  const activeFilters = useMemo(() => {
    const filters: { key: string; label: string }[] = [];
    if (type) filters.push({ key: 'type', label: type === 'BIKE' ? 'Bikes' : 'Parts' });
    if (onSale) filters.push({ key: 'sale', label: 'On Sale' });
    if (debouncedSearch) filters.push({ key: 'search', label: `"${debouncedSearch}"` });
    return filters;
  }, [type, onSale, debouncedSearch]);

  useEffect(() => {
    setLoading(true);
    const q: Record<string, string> = { limit: '100' };
    if (debouncedSearch) q.search = debouncedSearch;
    if (type) q.type = type;
    if (onSale) q.onSale = 'true';

    publicApi
      .shop(q)
      .then((result) => {
        setProducts(result.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [debouncedSearch, type, onSale]);

  function setFilter(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next);
  }

  function toggleSaleFilter() {
    const next = new URLSearchParams(params);
    if (onSale) next.delete('sale');
    else next.set('sale', 'true');
    setParams(next);
  }

  function clearFilters() {
    setSearch('');
    setParams(new URLSearchParams());
  }

  function removeFilter(key: string) {
    if (key === 'search') {
      setSearch('');
      return;
    }
    if (key === 'sale') {
      toggleSaleFilter();
      return;
    }
    setFilter(key, '');
  }

  return (
    <div className={isCustomerDashboard ? '' : 'bg-subtle'}>
      {isCustomerDashboard ? (
        <PageHeader
          title="Shop"
          subtitle="Electric bikes and genuine parts. Browse, filter, and order in PKR."
        />
      ) : (
        <PageHero
          page="shop"
          eyebrow="Crown Ev Store"
          title="Shop"
          subtitle="Electric bikes and genuine parts. Browse, filter, and order in PKR."
        />
      )}

      <MotionSection as="div" immediate className={`mx-auto max-w-7xl ${isCustomerDashboard ? '' : 'px-4 py-6 lg:px-8 lg:py-8'}`}>
        <div className="rounded-[var(--radius-card)] border border-border-light bg-elevated p-4 shadow-[var(--shadow-elevated)] lg:p-5">
          <div className="mb-4 flex items-center gap-2 text-sm font-medium text-ink">
            <SlidersHorizontal className="h-4 w-4 text-accent" />
            Filter products
          </div>

          <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
              <input
                type="search"
                placeholder="Search products…"
                aria-label="Search products"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border border-border-light bg-subtle py-2.5 pl-10 pr-4 text-sm text-ink outline-none transition-shadow focus:border-accent focus:bg-elevated focus:ring-2 focus:ring-accent/20"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {TYPE_FILTERS.map(({ value, label, icon: Icon }) => {
                const active = type === value;
                return (
                  <button
                    key={value || 'all'}
                    type="button"
                    onClick={() => setFilter('type', value)}
                    className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-medium transition-colors ${
                      active
                        ? 'bg-brand text-white shadow-sm'
                        : 'bg-subtle text-ink-muted hover:bg-border-light/40 hover:text-brand'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={toggleSaleFilter}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-medium transition-colors ${
                  onSale
                    ? 'bg-brand text-white shadow-sm'
                    : 'bg-subtle text-ink-muted hover:bg-border-light/40 hover:text-brand'
                }`}
              >
                <Percent className="h-4 w-4" />
                Sale
              </button>
            </div>
          </div>

          {activeFilters.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border-light pt-4">
              <span className="text-xs font-medium text-ink-muted">Active:</span>
              {activeFilters.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => removeFilter(f.key)}
                  className="inline-flex items-center gap-1 rounded-full border border-brand/30 bg-subtle px-2.5 py-1 text-xs font-medium text-brand hover:bg-accent/10"
                >
                  {f.label}
                  <X className="h-3 w-3" />
                </button>
              ))}
              <button
                type="button"
                onClick={clearFilters}
                className="text-xs font-medium text-accent hover:underline"
              >
                Clear all
              </button>
            </div>
          )}
        </div>

        <div className="mt-6 flex items-center justify-between gap-4">
          <p className="text-sm text-ink-muted">
            {loading ? (
              'Loading products…'
            ) : (
              <>
                <span className="font-semibold text-ink">{products.length}</span>
                {products.length === 1 ? ' product' : ' products'}
                {activeFilters.length > 0 ? ' found' : ' available'}
              </>
            )}
          </p>
        </div>

        <div className="mt-6 min-h-[28rem] sm:min-h-[32rem]">
          {loading ? (
            <ProductGridSkeleton />
          ) : gridItems.length === 0 ? (
            <div className="rounded-[var(--radius-card)] border border-dashed border-border-light bg-elevated px-6 py-16 text-center">
              <Package className="mx-auto h-12 w-12 text-brand/30" />
              <p className="mt-4 font-display text-lg font-semibold text-ink">No products found</p>
              <p className="mt-2 text-sm text-ink-muted">
                Try adjusting your search or filters to find what you&apos;re looking for.
              </p>
              {activeFilters.length > 0 && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="mt-6 rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand/90"
                >
                  Clear all filters
                </button>
              )}
            </div>
          ) : (
            <>
              <h2 className="sr-only">Product catalog</h2>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {gridItems.map((item, i) =>
                  item.kind === 'spacer' ? (
                    <div
                      key={`shop-slot-${item.position}`}
                      aria-hidden
                      className="pointer-events-none invisible"
                    >
                      <div className="aspect-[4/5] w-full" />
                    </div>
                  ) : (
                    <ProductCard key={item.product.id} product={item.product} index={i} animate={false} />
                  ),
                )}
              </div>
            </>
          )}
        </div>
      </MotionSection>
    </div>
  );
}
