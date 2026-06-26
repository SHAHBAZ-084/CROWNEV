import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ShoppingCart } from 'lucide-react';
import { publicApi } from '../../api/client';
import { useCart } from '../../contexts/CartContext';
import { useToast } from '../../contexts/ToastContext';
import type { Product } from '../../types';
import { formatPKR } from '../../lib/format';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { EvSpecsGrid } from '../../components/public/EvSpecsGrid';
import { ProductImageGallery, sortProductImages } from '../../components/public/ProductImageGallery';
import { ProductGridSkeleton } from '../../components/ui/Skeleton';

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [color, setColor] = useState('');
  const [qty, setQty] = useState(1);
  const { addItem } = useCart();
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (id) publicApi.product(id).then(setProduct).catch(() => navigate('/shop'));
  }, [id, navigate]);

  const images = useMemo(() => sortProductImages(product?.images), [product?.images]);

  if (!product) {
    return (
      <div className="bg-subtle p-8">
        <ProductGridSkeleton count={1} />
      </div>
    );
  }

  const price = Number(product.salePrice ?? product.price);
  const colors = (product.colorOptions as string[] | null) ?? [];
  const specs = product.specs as Record<string, unknown> | null;
  const specTitle = product.type === 'PART' ? 'Part Details' : 'EV Specifications';
  const hasSpecs = specs && Object.keys(specs).length > 0;

  function handleAddToCart() {
    addItem(
      {
        productId: product!.id,
        name: product!.name,
        price,
        color: color || undefined,
        imageUrl: images[0]?.url,
        productType: product!.type,
      },
      qty,
    );
    toast('Added to cart!', 'success');
  }

  return (
    <div className="bg-subtle">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:py-12 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-2 lg:items-start lg:gap-x-12">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
            <ProductImageGallery images={product.images} alt={product.name} />
          </motion.div>

          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
            <div className="flex flex-wrap gap-2">
              <Badge variant="brand">{product.type}</Badge>
              {product.brand && <Badge>{product.brand.name}</Badge>}
            </div>

            <h1 className="mt-4 font-display text-3xl font-bold text-ink lg:text-4xl">{product.name}</h1>
            <p className="mt-4 font-display text-3xl font-bold tabular-nums text-brand">{formatPKR(price)}</p>

            {product.description && (
              <p className="mt-4 max-w-xl leading-relaxed text-ink-muted">{product.description}</p>
            )}

            {colors.length > 0 && (
              <div className="mt-6">
                <p className="mb-2 text-sm font-semibold text-ink">Color</p>
                <div className="flex flex-wrap gap-2">
                  {colors.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
                        color === c
                          ? 'border-brand bg-brand/10 text-brand'
                          : 'border-border-light bg-elevated text-ink-muted hover:border-brand/40 hover:text-ink'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-6 flex items-center gap-4">
              <label htmlFor="product-qty" className="text-sm font-semibold text-ink">
                Qty
              </label>
              <input
                id="product-qty"
                type="number"
                min={1}
                value={qty}
                onChange={(e) => setQty(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="w-20 rounded-xl border border-border-light bg-elevated px-3 py-2 text-center text-ink shadow-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
              />
            </div>

            <div className="mt-8">
              <Button variant="accent" size="lg" onClick={handleAddToCart}>
                <ShoppingCart className="h-5 w-5" /> Add to Cart
              </Button>
            </div>
          </motion.div>
        </div>

        {hasSpecs ? (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            className="mt-12 lg:mt-14"
          >
            <EvSpecsGrid specs={specs} title={specTitle} />
          </motion.div>
        ) : null}
      </div>
    </div>
  );
}
