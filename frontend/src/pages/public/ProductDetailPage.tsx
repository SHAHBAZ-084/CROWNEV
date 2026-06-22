import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ShoppingCart, Zap } from 'lucide-react';
import { publicApi } from '../../api/client';
import { useCart } from '../../contexts/CartContext';
import { useToast } from '../../contexts/ToastContext';
import type { Product } from '../../types';
import { formatPKR } from '../../lib/format';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { EvSpecsGrid } from '../../components/public/EvSpecsGrid';
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

  if (!product) return <div className="p-8"><ProductGridSkeleton count={1} /></div>;

  const price = Number(product.salePrice ?? product.price);
  const image = product.images?.find((i) => i.isPrimary)?.url ?? product.images?.[0]?.url;
  const colors = (product.colorOptions as string[] | null) ?? [];
  const specs = product.specs as Record<string, string> | null;

  function handleAddToCart() {
    addItem({
      productId: product!.id,
      name: product!.name,
      price,
      color: color || undefined,
      imageUrl: image,
    }, qty);
    toast('Added to cart!', 'success');
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 lg:px-8">
      <div className="grid gap-12 lg:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="aspect-square overflow-hidden rounded-2xl bg-surface-alt"
        >
          {image ? (
            <img src={image} alt={product.name} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center"><Zap className="h-24 w-24 text-brand/20" /></div>
          )}
        </motion.div>

        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
          <div className="flex gap-2">
            <Badge variant="brand">{product.type}</Badge>
            {product.brand && <Badge>{product.brand.name}</Badge>}
          </div>
          <h1 className="mt-4 font-display text-3xl font-bold text-brand">{product.name}</h1>
          <p className="mt-4 font-display text-3xl font-bold tabular-nums text-brand">{formatPKR(price)}</p>
          {product.description && <p className="mt-4 text-text-muted leading-relaxed">{product.description}</p>}

          {colors.length > 0 && (
            <div className="mt-6">
              <p className="text-sm font-medium text-brand mb-2">Color</p>
              <div className="flex flex-wrap gap-2">
                {colors.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`rounded-full border px-4 py-1.5 text-sm transition-colors ${color === c ? 'border-brand bg-brand/5 text-brand' : 'border-border text-text-muted'}`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mt-6 flex items-center gap-4">
            <label className="text-sm font-medium text-brand">Qty</label>
            <input
              type="number"
              min={1}
              value={qty}
              onChange={(e) => setQty(Math.max(1, parseInt(e.target.value, 10) || 1))}
              className="w-20 rounded-xl border border-border px-3 py-2 text-center"
            />
          </div>

          <div className="mt-8 flex gap-4">
            <Button variant="accent" size="lg" onClick={handleAddToCart}>
              <ShoppingCart className="h-5 w-5" /> Add to Cart
            </Button>
          </div>

          {specs && Object.keys(specs).length > 0 && (
            <div className="mt-10">
              <EvSpecsGrid specs={specs} />
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
