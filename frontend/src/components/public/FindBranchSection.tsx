import { motion } from 'framer-motion';
import { MapPin, MessageCircle } from 'lucide-react';
import { BRANCH_SECTION } from '../../lib/placeholders';
import type { Branch } from '../../types';

const mapMaskStyle = {
  backgroundColor: 'var(--color-accent)',
  WebkitMaskImage: `url(${BRANCH_SECTION.mapBackground})`,
  maskImage: `url(${BRANCH_SECTION.mapBackground})`,
  maskSize: 'contain',
  maskRepeat: 'no-repeat',
  maskPosition: 'center',
} as const;

export function FindBranchSection({ branches }: { branches: Branch[] }) {
  return (
    <section className="bg-white py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 lg:px-8">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-12 xl:gap-16">
          <div>
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">Nationwide network</p>
              <h2 className="mt-2 font-display text-3xl font-bold text-brand lg:text-4xl">Find a Branch</h2>
              <p className="mt-2 max-w-xl text-sm text-text-muted">
                Visit a Crown Eve showroom near you for test rides, service, and parts.
              </p>
            </motion.div>

            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              {branches.map((b, i) => (
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
                    <p className="mt-1 text-sm text-accent">{b.phone}</p>
                    {b.whatsapp && (
                      <a
                        href={`https://wa.me/${b.whatsapp.replace(/\D/g, '')}`}
                        className="mt-1 inline-flex items-center gap-1 text-xs text-success hover:underline"
                      >
                        <MessageCircle className="h-3 w-3" /> WhatsApp
                      </a>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4 }}
            className="flex items-center justify-center lg:justify-end"
            aria-hidden
          >
            <div
              className="aspect-[3/4] w-full max-w-[min(100%,420px)] lg:max-w-[min(100%,480px)]"
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
