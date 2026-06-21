import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, MapPin, MessageCircle, Star } from 'lucide-react';
import { publicApi } from '../../api/client';
import type { LandingData } from '../../types';
import { ProductCard, FeatureGrid } from '../../components/public/ProductCard';
import { Button } from '../../components/ui/Button';
import { ProductGridSkeleton } from '../../components/ui/Skeleton';
import { useAnimatedNumber } from '../../hooks/useAnimatedNumber';

const heroVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.12 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' as const } },
};

function AnimatedStat({ value, label }: { value: number; label: string }) {
  const n = useAnimatedNumber(value);
  return (
    <div className="text-center">
      <p className="font-display text-3xl font-bold tabular-nums text-brand lg:text-4xl">{n}</p>
      <p className="mt-1 text-sm text-text-muted">{label}</p>
    </div>
  );
}

export default function LandingPage() {
  const [data, setData] = useState<LandingData | null>(null);

  useEffect(() => {
    publicApi.landing().then(setData).catch(console.error);
  }, []);

  return (
    <>
      <section className="relative overflow-hidden bg-gradient-to-b from-surface-alt via-white to-white py-24 lg:py-32">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-accent-soft/15 via-transparent to-transparent" />
        <div className="relative mx-auto max-w-7xl px-4 lg:px-8">
          <motion.div variants={heroVariants} initial="hidden" animate="show" className="max-w-2xl">
            <motion.p variants={itemVariants} className="text-sm font-semibold uppercase tracking-wider text-accent">
              Electric Mobility · Pakistan
            </motion.p>
            <motion.h1 variants={itemVariants} className="mt-4 font-display text-4xl font-bold leading-tight text-brand lg:text-6xl">
              Ride the Future with <span className="text-accent">Crown Eve</span>
            </motion.h1>
            <motion.p variants={itemVariants} className="mt-6 text-lg text-text-muted leading-relaxed">
              Premium electric bikes and parts across multiple branches. Shop online, book service, and track your order — all in PKR.
            </motion.p>
            <motion.div variants={itemVariants} className="mt-10 flex flex-wrap gap-4">
              <Link to="/shop"><Button variant="accent" size="lg">Browse Shop <ArrowRight className="h-4 w-4" /></Button></Link>
              <Link to="/book-service"><Button variant="secondary" size="lg">Book Service</Button></Link>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {data?.stats && (
        <section className="border-y border-border bg-white py-16">
          <div className="mx-auto grid max-w-7xl grid-cols-3 gap-8 px-4 lg:px-8">
            {[
              { label: 'Branches Nationwide', value: data.stats.branches },
              { label: 'Products Available', value: data.stats.products },
              { label: 'Orders Delivered', value: data.stats.ordersDelivered },
            ].map((s, i) => (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <AnimatedStat value={s.value} label={s.label} />
              </motion.div>
            ))}
          </div>
        </section>
      )}

      <FeatureGrid />

      <section className="py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-4 lg:px-8">
          <div className="flex items-end justify-between mb-12">
            <div>
              <h2 className="font-display text-3xl font-bold text-brand">Featured Models</h2>
              <p className="mt-2 text-text-muted">Explore our latest electric bikes and parts</p>
            </div>
            <Link to="/shop" className="hidden sm:block text-sm font-medium text-accent hover:underline">View all →</Link>
          </div>
          {!data ? (
            <ProductGridSkeleton />
          ) : (
            <motion.div
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
              variants={{ show: { transition: { staggerChildren: 0.08 } } }}
              className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4"
            >
              {data.featuredProducts.map((p, i) => (
                <ProductCard key={p.id} product={p} index={i} />
              ))}
            </motion.div>
          )}
        </div>
      </section>

      {data?.testimonials && data.testimonials.length > 0 && (
        <section className="bg-surface-alt py-20 lg:py-28">
          <div className="mx-auto max-w-7xl px-4 lg:px-8">
            <h2 className="font-display text-3xl font-bold text-brand text-center mb-12">What Riders Say</h2>
            <div className="grid gap-6 md:grid-cols-3">
              {data.testimonials.slice(0, 3).map((t, i) => (
                <motion.div
                  key={t.customerName + i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  whileHover={{ scale: 1.02, boxShadow: 'var(--shadow-card-hover)' }}
                  className="rounded-[var(--radius-card)] border border-border bg-white p-6 shadow-[var(--shadow-card)]"
                >
                  <div className="flex gap-0.5">
                    {Array.from({ length: t.rating }).map((_, j) => (
                      <Star key={j} className="h-4 w-4 fill-accent text-accent" />
                    ))}
                  </div>
                  <p className="mt-4 text-text-muted leading-relaxed">&ldquo;{t.content}&rdquo;</p>
                  <p className="mt-4 font-semibold text-brand">{t.customerName}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {data?.branches && (
        <section className="py-20 lg:py-28">
          <div className="mx-auto max-w-7xl px-4 lg:px-8">
            <h2 className="font-display text-3xl font-bold text-brand mb-12">Find a Branch</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {data.branches.map((b, i) => (
                <motion.div
                  key={b.id}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08 }}
                  whileHover={{ scale: 1.02 }}
                  className="flex gap-4 rounded-[var(--radius-card)] border border-border bg-white p-5 shadow-[var(--shadow-card)]"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10">
                    <MapPin className="h-5 w-5 text-accent" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-brand">{b.name}</h3>
                    <p className="text-sm text-text-muted">{b.location}</p>
                    <p className="text-sm text-accent mt-1">{b.phone}</p>
                    {b.whatsapp && (
                      <a href={`https://wa.me/${b.whatsapp.replace(/\D/g, '')}`} className="mt-1 inline-flex items-center gap-1 text-xs text-success hover:underline">
                        <MessageCircle className="h-3 w-3" /> WhatsApp
                      </a>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
