import { motion } from 'framer-motion';
import { BRANCH_SECTION } from '../../lib/placeholders';
import type { Branch } from '../../types';
import { BranchCard } from './BranchCard';

const mapMaskStyle = {
  backgroundColor: 'var(--color-brand)',
  WebkitMaskImage: `url(${BRANCH_SECTION.mapBackground})`,
  maskImage: `url(${BRANCH_SECTION.mapBackground})`,
  maskSize: 'contain',
  maskRepeat: 'no-repeat',
  maskPosition: 'center',
} as const;

export function FindBranchSection({ branches }: { branches: Branch[] }) {
  return (
    <section className="bg-gradient-to-b from-white via-surface-alt/20 to-white pt-14 pb-10 lg:pt-16 lg:pb-12">
      <div className="mx-auto max-w-7xl px-4 lg:px-8">
        <div className="grid items-start gap-8 lg:grid-cols-2 lg:gap-10 xl:gap-12">
          <div>
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">Nationwide network</p>
              <h2 className="mt-2 font-display text-3xl font-bold text-brand lg:text-4xl">Find a Branch</h2>
              <p className="mt-2 max-w-xl text-sm text-text-muted lg:text-base">
                Visit a Crown Ev showroom near you for test rides, service, and parts.
              </p>
            </motion.div>

            <div className="mt-8 flex flex-col gap-3.5">
              {branches.map((b, i) => (
                <BranchCard key={b.id} branch={b} index={i} variant="compact" showDescription={false} />
              ))}
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="flex items-start justify-center lg:justify-end"
            aria-hidden
          >
            <div
              className="aspect-[3/4] w-full max-w-[min(100%,320px)] drop-shadow-lg sm:max-w-[min(100%,360px)] lg:max-w-[min(100%,380px)]"
              style={mapMaskStyle}
              role="img"
              aria-label="Pakistan branch network map"
            />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
