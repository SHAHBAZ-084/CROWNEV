import { lazy, Suspense, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { publicApi } from '../../api/client';
import type { LandingData } from '../../types';
import { HomeHeroVideo } from '../../components/public/HomeHeroVideo';
import { MotionItem, MotionSection, MotionStagger } from '../../components/public/MotionSection';
import { PublicAnalyticsStrip } from '../../components/public/PublicAnalyticsStrip';
import { ProductCard, FeatureGrid } from '../../components/public/ProductCard';
import { Button } from '../../components/ui/Button';
import { ProductGridSkeleton } from '../../components/ui/Skeleton';

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

export default function LandingPage() {
  const [data, setData] = useState<LandingData | null>(null);

  useEffect(() => {
    publicApi.landing().then(setData).catch(console.error);
  }, []);

  return (
    <>
      <HomeHeroVideo>
        <MotionStagger immediate>
          <MotionItem>
            <p className="text-sm font-semibold uppercase tracking-wider text-brand drop-shadow-sm">
              Electric Mobility · Pakistan
            </p>
          </MotionItem>
          <MotionItem>
            <h1 className="mt-4 font-display text-4xl font-bold leading-tight text-white drop-shadow-md lg:text-6xl">
              Ride the Future with Crown Ev
            </h1>
          </MotionItem>
          <MotionItem>
            <p className="mt-6 text-lg leading-relaxed text-white/90 drop-shadow-sm">
              Premium electric bikes and parts across multiple branches. Shop online, book service, and track your order.
            </p>
          </MotionItem>
          <MotionItem>
            <div className="mt-10 flex flex-wrap gap-4">
              <Link to="/shop"><Button variant="accent" size="lg">Browse Shop <ArrowRight className="h-4 w-4" aria-hidden /></Button></Link>
              <Link to="/book-service">
                <Button
                  variant="secondary"
                  size="lg"
                  className="border-white/80 text-white hover:border-brand-light hover:bg-brand/15 hover:text-brand-light"
                >
                  Book Service
                </Button>
              </Link>
            </div>
          </MotionItem>
        </MotionStagger>
      </HomeHeroVideo>

      <PublicAnalyticsStrip variant="full" />

      <FeatureGrid />

      <MotionSection className="py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-4 lg:px-8">
          <div className="flex items-end justify-between mb-12">
            <div>
              <h2 className="font-display text-3xl font-bold text-brand">Featured Models</h2>
              <p className="mt-2 text-text-muted">Explore our latest electric bikes</p>
            </div>
            <Link to="/shop" className="hidden sm:block text-sm font-medium text-brand hover:text-brand-light hover:underline">View all →</Link>
          </div>
          {!data ? (
            <ProductGridSkeleton />
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8">
              {data.featuredProducts.filter((p) => p.type === 'BIKE').map((p, i) => (
                <ProductCard key={p.id} product={p} index={i} size="lg" />
              ))}
            </div>
          )}
        </div>
      </MotionSection>

      <Suspense fallback={<SectionFallback className="border-y border-border py-10 lg:py-12" />}>
        <SavingsCalculator />
      </Suspense>

      <Suspense fallback={<SectionFallback className="min-h-[420px] lg:min-h-[480px]" />}>
        <RidersSaySection testimonials={data?.testimonials} />
      </Suspense>

      {data?.branches && (
        <Suspense fallback={<SectionFallback className="pt-14 pb-10 lg:pt-16 lg:pb-12" />}>
          <FindBranchSection branches={data.branches} />
        </Suspense>
      )}
    </>
  );
}
