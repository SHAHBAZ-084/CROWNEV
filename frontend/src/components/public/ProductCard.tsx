import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Battery, Gauge, Shield, Zap } from 'lucide-react';
import type { Product } from '../../types';
import { formatPKR } from '../../lib/format';
import { Badge } from '../ui/Badge';

export function ProductCard({ product, index = 0 }: { product: Product; index?: number }) {
  const price = Number(product.salePrice ?? product.price);
  const original = product.salePrice ? Number(product.price) : null;
  const image = product.images?.find((i) => i.isPrimary)?.url ?? product.images?.[0]?.url;
  const variantLabel = product.salePrice ? 'PRO' : 'Standard';

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.3, delay: index * 0.06, ease: 'easeOut' }}
    >
      <Link to={`/shop/${product.id}`}>
        <motion.div
          whileHover={{ scale: 1.04, boxShadow: 'var(--shadow-card-hover)' }}
          whileTap={{ scale: 0.99 }}
          transition={{ duration: 0.2 }}
          className="group overflow-hidden rounded-[var(--radius-card)] border border-border bg-white shadow-[var(--shadow-card)]"
        >
          <div className="relative aspect-[4/3] overflow-hidden bg-surface-alt">
            {image ? (
              <img src={image} alt={product.name} loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
            ) : (
              <div className="flex h-full items-center justify-center">
                <Zap className="h-12 w-12 text-brand/20" />
              </div>
            )}
            <div className="absolute left-3 top-3 flex gap-1.5">
              <Badge variant="brand">{product.type}</Badge>
              <Badge variant="info">{variantLabel}</Badge>
            </div>
            {product.salePrice && (
              <div className="absolute right-3 top-3">
                <Badge variant="warning">SALE</Badge>
              </div>
            )}
          </div>
          <div className="p-4">
            {product.brand && <p className="text-xs text-text-muted">{product.brand.name}</p>}
            <h3 className="font-display font-semibold text-brand mt-0.5">{product.name}</h3>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="font-display text-lg font-bold tabular-nums text-brand">{formatPKR(price)}</span>
              {original && <span className="text-sm text-text-muted line-through">{formatPKR(original)}</span>}
            </div>
          </div>
        </motion.div>
      </Link>
    </motion.div>
  );
}

const features = [
  { icon: Zap, title: 'Powerful Motor', desc: 'High-torque BLDC motors for smooth acceleration on Pakistani roads.' },
  { icon: Battery, title: 'Long Range Battery', desc: 'Lithium-ion packs delivering up to 80km on a single charge.' },
  { icon: Gauge, title: 'Smart Dashboard', desc: 'Digital display with speed, battery level, and ride mode indicators.' },
  { icon: Shield, title: 'CBS Braking', desc: 'Combined braking system for safer stops in all weather conditions.' },
];

export function FeatureGrid() {
  return (
    <section className="bg-surface-alt py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="font-display text-3xl font-bold text-brand lg:text-4xl">Built for Pakistan</h2>
          <p className="mt-3 text-text-muted max-w-xl mx-auto">Engineered for local roads, climate, and daily commuting needs.</p>
        </motion.div>
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.3 }}
              className="text-center"
            >
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-[var(--shadow-card)]">
                <f.icon className="h-7 w-7 text-accent" />
              </div>
              <h3 className="mt-4 font-display font-semibold text-brand">{f.title}</h3>
              <p className="mt-2 text-sm text-text-muted leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
