import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Bike, Package, Search, SlidersHorizontal, Wrench, X } from 'lucide-react';
import { publicApi } from '../../api/client';
import type { Product } from '../../types';
import { ProductCard } from '../../components/public/ProductCard';
import { MotionSection } from '../../components/public/MotionSection';
import { PageHero } from '../../components/public/PageHero';
import { Select } from '../../components/ui/Input';
import { ProductGridSkeleton } from '../../components/ui/Skeleton';
import { useDebounce } from '../../hooks/useDebounce';

const TYPE_FILTERS = [
  { value: '', label: 'All', icon: Package },
  { value: 'BIKE', label: 'Bikes', icon: Bike },
  { value: 'PART', label: 'Parts', icon: Wrench },
] as const;

export default function ShopPage() {
  const [params, setParams] = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [brands, setBrands] = useState<{ id: number; name: string }[]>([]);
  const [categories, setCategories] = useState<{ id: number; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(params.get('search') ?? '');
  const debouncedSearch = useDebounce(search);

  const type = params.get('type') ?? '';
  const brandId = params.get('brandId') ?? '';
  const categoryId = params.get('categoryId') ?? '';

  const activeFilters = useMemo(() => {
    const filters: { key: string; label: string }[] = [];
    if (type) filters.push({ key: 'type', label: type === 'BIKE' ? 'Bikes' : 'Parts' });
    if (brandId) {
      const brand = brands.find((b) => String(b.id) === brandId);
      if (brand) filters.push({ key: 'brandId', label: brand.name });
    }
    if (categoryId) {
      const cat = categories.find((c) => String(c.id) === categoryId);
      if (cat) filters.push({ key: 'categoryId', label: cat.name });
    }
    if (debouncedSearch) filters.push({ key: 'search', label: `"${debouncedSearch}"` });
    return filters;
  }, [type, brandId, categoryId, debouncedSearch, brands, categories]);

  useEffect(() => {
    Promise.all([publicApi.brands(), publicApi.categories()])
      .then(([b, c]) => {
        setBrands(b);
        setCategories(c);
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    setLoading(true);
    const q: Record<string, string> = {};
    if (debouncedSearch) q.search = debouncedSearch;
    if (type) q.type = type;
    if (brandId) q.brandId = brandId;
    if (categoryId) q.categoryId = categoryId;

    publicApi
      .shop(q)
      .then((r) => setProducts(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [debouncedSearch, type, brandId, categoryId]);

  function setFilter(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
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
    setFilter(key, '');
  }

  return (
    <div>
      <PageHero
        page="shop"
        eyebrow="Crown Ev Store"
        title="Shop"
        subtitle="Electric bikes and genuine parts. Browse, filter, and order in PKR."
      />

      <MotionSection as="div" className="mx-auto max-w-7xl px-4 py-6 lg:px-8 lg:py-8">
        <div className="rounded-[var(--radius-card)] border border-border bg-white p-4 shadow-[var(--shadow-card)] lg:p-5">
          <div className="mb-4 flex items-center gap-2 text-sm font-medium text-brand">
            <SlidersHorizontal className="h-4 w-4 text-accent" />
            Filter products
          </div>

          <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
              <input
                type="search"
                placeholder="Search products…"
                aria-label="Search products"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border border-border bg-surface-alt/50 py-2.5 pl-10 pr-4 text-sm outline-none transition-shadow focus:border-accent focus:bg-white focus:ring-2 focus:ring-accent/20"
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
                        : 'bg-surface-alt text-text-muted hover:bg-surface-alt/80 hover:text-brand'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </button>
                );
              })}
            </div>

            <Select
              value={brandId}
              onChange={(e) => setFilter('brandId', e.target.value)}
              className="w-full sm:w-40"
              aria-label="Filter by brand"
            >
              <option value="">All Brands</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>

            <Select
              value={categoryId}
              onChange={(e) => setFilter('categoryId', e.target.value)}
              className="w-full sm:w-44"
              aria-label="Filter by category"
            >
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>

          {activeFilters.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">
              <span className="text-xs font-medium text-text-muted">Active:</span>
              {activeFilters.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => removeFilter(f.key)}
                  className="inline-flex items-center gap-1 rounded-full bg-surface-alt px-2.5 py-1 text-xs font-medium text-brand hover:bg-accent/10"
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
          <p className="text-sm text-text-muted">
            {loading ? (
              'Loading products…'
            ) : (
              <>
                <span className="font-semibold text-brand">{products.length}</span>
                {products.length === 1 ? ' product' : ' products'}
                {activeFilters.length > 0 ? ' found' : ' available'}
              </>
            )}
          </p>
        </div>

        <div className="mt-6">
          {loading ? (
            <ProductGridSkeleton />
          ) : products.length === 0 ? (
            <div className="rounded-[var(--radius-card)] border border-dashed border-border bg-surface-alt/50 px-6 py-16 text-center">
              <Package className="mx-auto h-12 w-12 text-brand/25" />
              <p className="mt-4 font-display text-lg font-semibold text-brand">No products found</p>
              <p className="mt-2 text-sm text-text-muted">
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
                {products.map((p, i) => (
                  <ProductCard key={p.id} product={p} index={i} />
                ))}
              </div>
            </>
          )}
        </div>
      </MotionSection>
    </div>
  );
}
