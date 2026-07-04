import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, ShoppingCart } from 'lucide-react';
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
  const [activeImageUrl, setActiveImageUrl] = useState<string | null>(null);
  const { addItem } = useCart();
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (id) publicApi.product(id).then(setProduct).catch(() => navigate('/shop'));
  }, [id, navigate]);

  const images = useMemo(() => sortProductImages(product?.images), [product?.images]);

  const colors = useMemo(() => {
    if (!product) return [];
    const raw = (product.colorOptions as any[] | null) ?? [];
    return raw
      .map((c) => {
        if (typeof c === 'string') {
          return { name: c, imageUrl: null };
        }
        return { name: c?.name || '', imageUrl: c?.imageUrl || null };
      })
      .filter((c) => c.name !== '');
  }, [product]);

  useEffect(() => {
    if (colors.length > 0) {
      setColor(colors[0].name);
      if (colors[0].imageUrl) {
        setActiveImageUrl(colors[0].imageUrl);
      }
    }
  }, [colors]);

  if (!product) {
    return (
      <div className="bg-subtle p-8">
        <ProductGridSkeleton count={1} />
      </div>
    );
  }

  const price = Number(product.salePrice ?? product.price);
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
    <div className="overflow-x-hidden bg-subtle">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:py-12 lg:px-8">
        <div className="grid gap-8 sm:gap-10 lg:grid-cols-2 lg:items-start lg:gap-x-12">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
            <ProductImageGallery
              images={product.images}
              alt={product.name}
              activeOverrideUrl={activeImageUrl}
              onImageChange={setActiveImageUrl}
            />
          </motion.div>

          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
            <div className="flex flex-wrap gap-2">
              <Badge variant="brand">{product.type}</Badge>
            </div>

            <h1 className="mt-4 font-display text-2xl font-bold text-ink sm:text-3xl lg:text-4xl">{product.name}</h1>
            <p className="mt-4 font-display text-2xl font-bold tabular-nums text-brand sm:text-3xl">{formatPKR(price)}</p>

            {product.description && (
              <p className="mt-4 max-w-xl leading-relaxed text-ink-muted">{product.description}</p>
            )}

            {colors.length > 0 && (
              <div className="mt-6">
                <p className="mb-2 text-sm font-semibold text-ink">Color</p>
                <div className="flex flex-wrap gap-2">
                  {colors.map((c) => (
                    <button
                      key={c.name}
                      type="button"
                      onClick={() => {
                        setColor(c.name);
                        if (c.imageUrl) {
                          setActiveImageUrl(c.imageUrl);
                        }
                      }}
                      className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
                        color === c.name
                          ? 'border-brand bg-brand/10 text-brand'
                          : 'border-border-light bg-elevated text-ink-muted hover:border-brand/40 hover:text-ink'
                      }`}
                    >
                      {c.name}
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

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button variant="accent" size="lg" onClick={handleAddToCart}>
                <ShoppingCart className="h-5 w-5" /> Add to Cart
              </Button>
              <Button variant="secondary" size="sm" onClick={() => navigate('/shop')}>
                <ArrowLeft className="h-4 w-4" /> Back to Shop
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
