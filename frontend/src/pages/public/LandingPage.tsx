import { lazy, Suspense, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { publicApi } from '../../api/client';
import type { LandingData, Product } from '../../types';
import { HeroCta, HeroHeadline, HomeHeroVideo } from '../../components/public/HomeHeroVideo';
import { MotionItem, MotionSection, MotionStagger } from '../../components/public/MotionSection';
import { ProductCard, FeatureGrid } from '../../components/public/ProductCard';
import { Button } from '../../components/ui/Button';
import { ProductGridSkeleton } from '../../components/ui/Skeleton';
import { ctaArrowClass } from '../../lib/publicMotion';
import { DEFAULT_HOME_HERO_SECTION, type HomeHeroSection } from '../../lib/placeholders';

const SavingsCalculator = lazy(() =>
  import('../../components/public/SavingsCalculator').then((m) => ({ default: m.SavingsCalculator }))
);
const RidersSaySection = lazy(() =>
  import('../../components/public/RidersSaySection').then((m) => ({ default: m.RidersSaySection }))
);
const FindBranchSection = lazy(() =>
  import('../../components/public/FindBranchSection').then((m) => ({ default: m.FindBranchSection }))
);
const HomeFaqSection = lazy(() =>
  import('../../components/public/HomeFaqSection').then((m) => ({ default: m.HomeFaqSection }))
);

function SectionFallback({ className = 'py-16' }: { className?: string }) {
  return <div className={className} aria-hidden />;
}

export default function LandingPage() {
  const [data, setData] = useState<LandingData | null>(null);
  const [homeHero, setHomeHero] = useState<HomeHeroSection>(DEFAULT_HOME_HERO_SECTION);
  const [saleProducts, setSaleProducts] = useState<Product[]>([]);

  useEffect(() => {
    publicApi.landing().then(setData).catch(console.error);
    publicApi.homeHero().then(setHomeHero).catch(console.error);
    publicApi
      .shop({ onSale: 'true', limit: '3' })
      .then((result) => setSaleProducts(result.data))
      .catch(() => setSaleProducts([]));
  }, []);

  return (
    <>
      <HomeHeroVideo>
        <MotionStagger immediate>
          <MotionItem>
            <p className="text-sm font-semibold uppercase tracking-wider text-brand drop-shadow-sm">
              {homeHero.eyebrow}
            </p>
          </MotionItem>
          <HeroHeadline
            text={homeHero.headline}
            className="mt-4 font-display text-3xl font-bold leading-tight text-white drop-shadow-md sm:text-4xl lg:text-6xl"
          />
          <MotionItem>
            <p className="mt-6 text-lg leading-relaxed text-white/90 drop-shadow-sm">
              {homeHero.subtext}
            </p>
          </MotionItem>
          <MotionItem>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-4">
              <HeroCta>
                <Link to="/shop">
                  <Button variant="accent" size="lg" className="group">
                    {homeHero.primaryCtaLabel} <ArrowRight className={`h-4 w-4 ${ctaArrowClass}`} aria-hidden />
                  </Button>
                </Link>
              </HeroCta>
              <HeroCta>
                <Link to="/book-service">
                  <Button
                    variant="ghost"
                    size="lg"
                    className="border border-white/80 bg-black/25 text-white shadow-sm backdrop-blur-sm hover:border-brand-light hover:bg-brand/20 hover:text-white"
                  >
                    {homeHero.secondaryCtaLabel}
                  </Button>
                </Link>
              </HeroCta>
            </div>
          </MotionItem>
        </MotionStagger>
      </HomeHeroVideo>

      <FeatureGrid />

      {saleProducts.length > 0 && (
        <MotionSection className="border-y border-border-light bg-elevated py-12 lg:py-20">
          <div className="mx-auto max-w-7xl px-4 lg:px-8">
            <div className="mb-8 flex flex-col gap-3 sm:mb-12 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="font-display text-2xl font-bold text-ink sm:text-3xl">Today&apos;s Discounted Items</h2>
                <p className="mt-2 text-ink-muted">Limited-time deals on bikes and parts</p>
              </div>
              <Link
                to="/shop?sale=true"
                className="group inline-flex items-center gap-1 text-sm font-medium text-brand hover:text-brand-light hover:underline"
              >
                View all
                <ArrowRight className={`h-3.5 w-3.5 ${ctaArrowClass}`} aria-hidden />
              </Link>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8">
              {saleProducts.map((p, i) => (
                <ProductCard key={p.id} product={p} index={i} size="lg" />
              ))}
            </div>
          </div>
        </MotionSection>
      )}

      <MotionSection className="bg-subtle py-12 lg:py-28">
        <div className="mx-auto max-w-7xl px-4 lg:px-8">
          <div className="mb-8 flex flex-col gap-3 sm:mb-12 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="font-display text-2xl font-bold text-ink sm:text-3xl">Featured Models</h2>
              <p className="mt-2 text-ink-muted">Explore our latest electric bikes</p>
            </div>
            <Link to="/shop" className="group inline-flex items-center gap-1 text-sm font-medium text-brand hover:text-brand-light hover:underline">
              View all
              <ArrowRight className={`h-3.5 w-3.5 ${ctaArrowClass}`} aria-hidden />
            </Link>
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

      <Suspense fallback={<SectionFallback className="border-y border-border-light bg-elevated py-16 lg:py-24" />}>
        <HomeFaqSection />
      </Suspense>
    </>
  );
}
