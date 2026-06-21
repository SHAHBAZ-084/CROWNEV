import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { publicApi } from '../../api/client';
import type { Product } from '../../types';
import { ProductCard } from '../../components/public/ProductCard';
import { Input, Select } from '../../components/ui/Input';
import { ProductGridSkeleton } from '../../components/ui/Skeleton';
import { useDebounce } from '../../hooks/useDebounce';

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

  useEffect(() => {
    Promise.all([publicApi.brands(), publicApi.categories()])
      .then(([b, c]) => { setBrands(b); setCategories(c); })
      .catch(console.error);
  }, []);

  useEffect(() => {
    setLoading(true);
    const q: Record<string, string> = {};
    if (debouncedSearch) q.search = debouncedSearch;
    if (type) q.type = type;
    if (brandId) q.brandId = brandId;
    if (categoryId) q.categoryId = categoryId;

    publicApi.shop(q)
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

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 lg:px-8">
      <h1 className="font-display text-3xl font-bold text-brand">Shop</h1>
      <p className="mt-2 text-text-muted">Electric bikes and parts — filter by brand or category</p>

      <div className="mt-8 flex flex-wrap gap-4">
        <div className="flex-1 min-w-[200px] max-w-md">
          <Input
            placeholder="Search products…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={type} onChange={(e) => setFilter('type', e.target.value)} className="w-40">
          <option value="">All Types</option>
          <option value="BIKE">Bikes</option>
          <option value="PART">Parts</option>
        </Select>
        <Select value={brandId} onChange={(e) => setFilter('brandId', e.target.value)} className="w-44">
          <option value="">All Brands</option>
          {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </Select>
        <Select value={categoryId} onChange={(e) => setFilter('categoryId', e.target.value)} className="w-44">
          <option value="">All Categories</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
      </div>

      <div className="mt-10">
        {loading ? (
          <ProductGridSkeleton />
        ) : products.length === 0 ? (
          <p className="py-16 text-center text-text-muted">No products found</p>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {products.map((p, i) => <ProductCard key={p.id} product={p} index={i} />)}
          </div>
        )}
      </div>
    </div>
  );
}
