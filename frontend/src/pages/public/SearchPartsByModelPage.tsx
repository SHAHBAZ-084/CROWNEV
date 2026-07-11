import { useEffect, useState } from 'react';
import { Bike, ChevronLeft, Package } from 'lucide-react';
import { publicApi } from '../../api/client';
import type { Product } from '../../types';
import { ProductCard } from '../../components/public/ProductCard';
import { MotionSection } from '../../components/public/MotionSection';
import { PageHero } from '../../components/public/PageHero';
import { PageHeader } from '../../components/layout/PageTransition';
import { ProductGridSkeleton } from '../../components/ui/Skeleton';

type BikeModel = { id: number; name: string };

export default function SearchPartsByModelPage() {
  const [models, setModels] = useState<BikeModel[]>([]);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [parts, setParts] = useState<Product[]>([]);
  const [partsLoading, setPartsLoading] = useState(false);

  useEffect(() => {
    setModelsLoading(true);
    publicApi
      .bikeModels()
      .then(setModels)
      .catch(console.error)
      .finally(() => setModelsLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedModel) {
      setParts([]);
      return;
    }
    setPartsLoading(true);
    publicApi
      .partsByModel(selectedModel)
      .then((rows) =>
        setParts(
          rows.map((r) => ({
            id: r.id,
            slug: r.slug,
            name: r.name,
            type: 'PART' as const,
            price: String(r.price),
            salePrice: r.salePrice != null ? String(r.salePrice) : null,
            images: (r.images ?? (r.image ? [{ url: r.image, isPrimary: true }] : [])).map((img) => ({
              url: img.url,
              isPrimary: img.isPrimary,
            })),
          })),
        ),
      )
      .catch(console.error)
      .finally(() => setPartsLoading(false));
  }, [selectedModel]);

  return (
    <>
      <PageHeader title="Parts by Bike Model" />
      <PageHero
        page="shop"
        eyebrow="Genuine Parts"
        title="Find Parts for Your Bike"
        subtitle="Select your Crown electric bike model to browse compatible parts and accessories available at our branches."
      />

      <MotionSection className="pb-16">
        {selectedModel ? (
          <div className="mb-6">
            <button
              type="button"
              onClick={() => setSelectedModel(null)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border-light bg-subtle px-3.5 py-2 text-sm font-medium text-ink-muted transition-colors hover:bg-border-light/40 hover:text-brand"
            >
              <ChevronLeft className="h-4 w-4" />
              All models
            </button>
            <h2 className="mt-4 font-display text-xl font-semibold text-ink">
              Parts for <span className="text-accent">{selectedModel}</span>
            </h2>
          </div>
        ) : (
          <>
            <h2 className="font-display text-lg font-semibold text-ink">Choose your bike model</h2>
            <p className="mt-1 text-sm text-ink-muted">
              Tap a model to see parts tagged as compatible by our team.
            </p>
          </>
        )}

        {!selectedModel && (
          <div className="mt-6">
            {modelsLoading ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="h-14 animate-pulse rounded-xl bg-subtle" />
                ))}
              </div>
            ) : models.length === 0 ? (
              <div className="rounded-[var(--radius-card)] border border-dashed border-border-light bg-elevated px-6 py-12 text-center">
                <Bike className="mx-auto h-10 w-10 text-brand/30" />
                <p className="mt-3 text-sm text-ink-muted">No bike models listed yet. Check back soon.</p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {models.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setSelectedModel(m.name)}
                    className="flex items-center gap-3 rounded-[var(--radius-card)] border border-border-light bg-elevated px-4 py-3.5 text-left text-sm font-medium text-ink shadow-[var(--shadow-elevated)] transition-colors hover:border-accent/30 hover:bg-subtle"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
                      <Bike className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1 leading-snug">{m.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {selectedModel && (
          <div className="mt-6 min-h-[20rem]">
            {partsLoading ? (
              <ProductGridSkeleton />
            ) : parts.length === 0 ? (
              <div className="rounded-[var(--radius-card)] border border-dashed border-border-light bg-elevated px-6 py-16 text-center">
                <Package className="mx-auto h-12 w-12 text-brand/30" />
                <p className="mt-4 font-display text-lg font-semibold text-ink">No parts found</p>
                <p className="mt-2 text-sm text-ink-muted">
                  No listed parts are tagged for {selectedModel} yet. Try another model or browse the full shop.
                </p>
              </div>
            ) : (
              <>
                <p className="mb-4 text-sm text-ink-muted">
                  <span className="font-semibold text-ink">{parts.length}</span>
                  {parts.length === 1 ? ' part' : ' parts'} available
                </p>
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {parts.map((p, i) => (
                    <ProductCard key={p.id} product={p} index={i} animate={false} />
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </MotionSection>
    </>
  );
}
