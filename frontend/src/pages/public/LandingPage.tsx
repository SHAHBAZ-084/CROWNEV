import { lazy, Suspense, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { publicApi } from '../../api/client';
import type { LandingData } from '../../types';
import { ProductCard, FeatureGrid } from '../../components/public/ProductCard';
import { Button } from '../../components/ui/Button';
import { ProductGridSkeleton } from '../../components/ui/Skeleton';
import { useAnimatedNumber } from '../../hooks/useAnimatedNumber';

const SavingsCalculator = lazy(() =>
  import('../../components/public/SavingsCalculator').then((m) => ({ default: m.SavingsCalculator }))
);
const RidersSaySection = lazy(() =>
  import('../../components/public/RidersSaySection').then((m) => ({ default: m.RidersSaySection }))
);
const FindBranchSection = lazy(() =>
  import('../../components/public/FindBranchSection').then((m) => ({ default: m.FindBranchSection }))
);

function SectionFallback({ className = 'py-16' }: { className?: string }) {
  return <div className={className} aria-hidden />;
}

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
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-wider text-brand">
              Electric Mobility · Pakistan
            </p>
            <h1 className="mt-4 font-display text-4xl font-bold leading-tight text-brand lg:text-6xl">
              Ride the Future with <span className="text-brand">Crown Eve</span>
            </h1>
            <p className="mt-6 text-lg text-text-muted leading-relaxed">
              Premium electric bikes and parts across multiple branches. Shop online, book service, and track your order, all in PKR.
            </p>
            <div className="mt-10 flex flex-wrap gap-4">
              <Link to="/shop"><Button variant="accent" size="lg">Browse Shop <ArrowRight className="h-4 w-4" aria-hidden /></Button></Link>
              <Link to="/book-service"><Button variant="secondary" size="lg">Book Service</Button></Link>
            </div>
          </div>
        </div>
      </section>

      {data?.stats && (
        <section className="border-y border-border bg-white py-16">
          <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-4 sm:grid-cols-3 sm:gap-8 lg:px-8">
            {[
              { label: 'Branches Nationwide', value: data.stats.branches },
              { label: 'Products Available', value: data.stats.products },
              { label: 'Orders Delivered', value: data.stats.ordersDelivered },
            ].map((s) => (
              <AnimatedStat key={s.label} value={s.value} label={s.label} />
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
              <p className="mt-2 text-text-muted">Explore our latest electric bikes</p>
            </div>
            <Link to="/shop" className="hidden sm:block text-sm font-medium text-brand hover:underline">View all →</Link>
          </div>
          {!data ? (
            <ProductGridSkeleton />
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {data.featuredProducts.filter((p) => p.type === 'BIKE').map((p, i) => (
                <ProductCard key={p.id} product={p} index={i} />
              ))}
            </div>
          )}
        </div>
      </section>

      <Suspense fallback={<SectionFallback className="border-y border-border py-10 lg:py-12" />}>
        <SavingsCalculator />
      </Suspense>

      <Suspense fallback={<SectionFallback className="min-h-[420px] lg:min-h-[480px]" />}>
        <RidersSaySection testimonials={data?.testimonials} />
      </Suspense>

      {data?.branches && (
        <Suspense fallback={<SectionFallback className="py-20 lg:py-28" />}>
          <FindBranchSection branches={data.branches} />
        </Suspense>
      )}
    </>
  );
}
