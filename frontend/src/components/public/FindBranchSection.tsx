import { useCallback, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import type { Branch } from '../../types';
import { BranchCard } from './BranchCard';
import { BranchLocationsMap } from './BranchLocationsMap';

export function FindBranchSection({ branches }: { branches: Branch[] }) {
  const [selectedId, setSelectedId] = useState<number | null>(branches[0]?.id ?? null);
  const mapWrapRef = useRef<HTMLDivElement>(null);

  const handleSelect = useCallback((branchId: number) => {
    setSelectedId(branchId);
    if (window.matchMedia('(max-width: 1023px)').matches) {
      mapWrapRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, []);

  if (branches.length === 0) return null;

  return (
    <section className="bg-subtle pt-10 pb-10 sm:pt-14 lg:pt-16 lg:pb-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-5 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mx-auto mb-8 max-w-2xl text-center sm:mb-10 lg:mb-12"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">Nationwide network</p>
          <h2 className="mt-2 font-display text-2xl font-bold text-ink sm:text-3xl">Our Branches</h2>
          <p className="mt-3 text-sm leading-relaxed text-ink-muted sm:text-base">
            Visit a Crown Ev showroom near you for test rides, service, and parts.
          </p>
        </motion.div>

        <div className="flex flex-col gap-5 sm:gap-6 lg:grid lg:grid-cols-2 lg:items-start lg:gap-10">
          <div ref={mapWrapRef} className="order-1 lg:order-2 lg:sticky lg:top-24">
            <BranchLocationsMap
              branches={branches}
              selectedId={selectedId}
              onSelect={handleSelect}
            />
            <p className="mt-2.5 text-center text-xs text-ink-muted sm:text-sm lg:text-left">
              Tap a branch below or a pin on the map
            </p>
          </div>

          <div className="order-2 flex flex-col gap-3.5 sm:gap-4 lg:order-1 lg:max-w-xl lg:gap-5">
            {branches.map((branch, index) => (
              <BranchCard
                key={branch.id}
                branch={branch}
                index={index}
                variant="featured"
                showDescription={false}
                selected={selectedId === branch.id}
                onSelect={() => handleSelect(branch.id)}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
