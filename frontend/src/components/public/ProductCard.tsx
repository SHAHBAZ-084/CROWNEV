import { motion } from 'framer-motion';
import { ArrowRight, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Product } from '../../types';
import { publicApi } from '../../api/client';
import { ctaArrowClass, defaultViewport } from '../../lib/publicMotion';
import { formatPKR } from '../../lib/format';
import { getFeatureIcon } from '../../lib/featureIcons';
import { DEFAULT_FEATURE_SECTION, normalizeFeatureSection, type FeatureSection } from '../../lib/placeholders';
import { Badge } from '../ui/Badge';
import { SectionHeadingIcon } from './SectionHeadingIcon';

export function ProductCard({
  product,
  index = 0,
  animate = true,
  size = 'default',
}: {
  product: Product;
  index?: number;
  animate?: boolean;
  size?: 'default' | 'lg';
}) {
  const price = Number(product.salePrice ?? product.price);
  const original = product.salePrice ? Number(product.price) : null;
  const image = product.images?.find((i) => i.isPrimary)?.url ?? product.images?.[0]?.url;
  const discount =
    original && original > price ? Math.round(((original - price) / original) * 100) : null;

  const isLarge = size === 'lg';

  const card = (
    <Link to={`/shop/${product.id}`} className="block h-full">
      <motion.div
        whileHover={{ y: -4 }}
        transition={{ duration: 0.2 }}
        className="group flex h-full flex-col overflow-hidden rounded-[var(--radius-card)] border border-border-light bg-elevated shadow-[var(--shadow-elevated)] transition-colors duration-200 hover:border-accent/30 group-hover:shadow-lg"
      >
          <div
            className={`relative overflow-hidden bg-subtle ${isLarge ? 'aspect-[5/4] lg:aspect-[6/5]' : 'aspect-[5/4]'}`}
          >
            {image ? (
              <img
                src={image}
                alt={product.name}
                width={500}
                height={400}
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center bg-gradient-to-br from-subtle via-elevated to-accent/5">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-elevated shadow-sm ring-1 ring-border-light">
                  <Zap className="h-8 w-8 text-accent/60" />
                </div>
                <p className="mt-3 text-xs font-medium text-ink-muted/70">No image</p>
              </div>
            )}

            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-brand/50 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

            <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
              <Badge variant="brand">{product.type}</Badge>
              {product.salePrice && <Badge variant="info">PRO</Badge>}
            </div>

            {(product.salePrice || discount) && (
              <div className="absolute right-3 top-3 flex flex-col items-end gap-1.5">
                {product.salePrice && <Badge variant="warning">SALE</Badge>}
                {discount != null && discount > 0 && (
                  <span className="rounded-full bg-surface-alt/95 px-2 py-0.5 text-[10px] font-bold text-warning shadow-sm">
                    −{discount}%
                  </span>
                )}
              </div>
            )}

            <div className="absolute inset-x-0 bottom-0 flex translate-y-0 items-center justify-center gap-2 bg-gradient-to-t from-brand/90 to-brand/70 py-2.5 text-sm font-semibold text-white sm:translate-y-full sm:py-3 sm:transition-transform sm:duration-300 sm:group-hover:translate-y-0">
              View Details
              <ArrowRight className={`h-4 w-4 ${ctaArrowClass}`} />
            </div>
          </div>

          <div className={`flex min-h-[7.5rem] flex-1 flex-col ${isLarge ? 'p-5 lg:p-6' : 'p-5'}`}>
            <h3
              className={`mt-1 line-clamp-2 font-display font-semibold leading-snug text-ink group-hover:text-brand ${isLarge ? 'text-base lg:text-lg' : 'text-base'}`}
            >
              {product.name}
            </h3>

            <div className="mt-auto flex items-end justify-between gap-2 pt-4">
              <div className="min-w-0">
                <span
                  className={`block font-display font-bold tabular-nums text-brand ${isLarge ? 'text-lg lg:text-xl' : 'text-lg'}`}
                >
                  {formatPKR(price)}
                </span>
                {original && (
                  <span className="text-xs text-text-muted line-through">{formatPKR(original)}</span>
                )}
              </div>
              <span
                className={`flex shrink-0 items-center justify-center rounded-xl bg-border-light text-ink-muted transition-colors group-hover:bg-brand group-hover:text-white ${isLarge ? 'h-9 w-9 lg:h-11 lg:w-11' : 'h-9 w-9'}`}
              >
                <ArrowRight className={`h-4 w-4 ${ctaArrowClass}`} />
              </span>
            </div>
          </div>
      </motion.div>
    </Link>
  );

  if (!animate) {
    return <div className="h-full">{card}</div>;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={defaultViewport}
      transition={{ duration: 0.3, delay: index * 0.06, ease: 'easeOut' }}
      className="h-full"
    >
      {card}
    </motion.div>
  );
}

export function FeatureGrid() {
  const [section, setSection] = useState<FeatureSection>(DEFAULT_FEATURE_SECTION);

  useEffect(() => {
    publicApi.features().then((data) => setSection(normalizeFeatureSection(data))).catch(console.error);
  }, []);

  return (
    <section className="relative overflow-hidden bg-subtle bg-[radial-gradient(ellipse_at_bottom_left,_rgb(249_115_22_/_4%)_0%,_transparent_55%)] py-12 lg:py-16">
      <div className="relative mx-auto max-w-7xl px-4 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={defaultViewport}
          className="mx-auto mb-10 max-w-2xl text-center"
        >
          <span className="inline-flex items-center rounded-full border border-border-light bg-subtle px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-brand">
            {section.eyebrow}
          </span>
          <h2 className="mt-4 font-display text-2xl font-bold text-ink sm:text-3xl lg:text-4xl">
            {section.title}
          </h2>
          <p className="mt-4 text-base leading-relaxed text-ink-muted">
            {section.subtitle}
          </p>
        </motion.div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {section.features.map((f, i) => {
            const Icon = getFeatureIcon(f.icon);
            return (
            <motion.div
              key={`${f.title}-${i}`}
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={defaultViewport}
              transition={{ delay: i * 0.08, duration: 0.35, ease: 'easeOut' }}
              whileHover={{ y: -6, boxShadow: 'var(--shadow-card-hover)' }}
              className="group relative overflow-hidden rounded-[var(--radius-card)] border border-border-light bg-elevated p-6 shadow-[var(--shadow-elevated)] transition-colors hover:border-accent/30"
            >
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand via-accent to-accent-soft opacity-0 transition-opacity group-hover:opacity-100" />

              <div className="flex items-start justify-between gap-3">
                <SectionHeadingIcon className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-elevated ring-1 ring-border-light transition-transform group-hover:scale-105">
                  <Icon className="h-7 w-7 text-accent" />
                </SectionHeadingIcon>
                <div className="text-right">
                  <p className="font-display text-lg font-bold tabular-nums text-brand">{f.stat}</p>
                  <p className="text-[10px] font-medium uppercase tracking-wide text-ink-muted">{f.statLabel}</p>
                </div>
              </div>

              <h3 className="mt-5 font-display text-lg font-semibold text-ink">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">{f.desc}</p>
            </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
