import { motion } from 'framer-motion';
import { Star } from 'lucide-react';
import { BIKE_VIDEO_AD } from '../../lib/placeholders';

type Testimonial = {
  customerName: string;
  content: string;
  rating: number;
};

export function RidersSaySection({ testimonials }: { testimonials?: Testimonial[] }) {
  const items = testimonials?.slice(0, 3) ?? [];
  const hasFile = Boolean(BIKE_VIDEO_AD.src);
  const hasYoutube = Boolean(BIKE_VIDEO_AD.youtubeId);

  return (
    <section className="relative min-h-[420px] overflow-hidden py-16 lg:min-h-[480px] lg:py-24">
      <div className="absolute inset-0" aria-hidden>
        {hasFile ? (
          <video
            className="h-full w-full scale-105 object-cover"
            src={BIKE_VIDEO_AD.src}
            poster={BIKE_VIDEO_AD.poster}
            autoPlay
            muted
            loop
            playsInline
            preload="none"
          />
        ) : hasYoutube ? (
          <iframe
            title={BIKE_VIDEO_AD.title}
            className="pointer-events-none absolute left-1/2 top-1/2 h-[300%] w-[300%] max-w-none -translate-x-1/2 -translate-y-1/2"
            src={`https://www.youtube.com/embed/${BIKE_VIDEO_AD.youtubeId}?autoplay=1&mute=1&loop=1&playlist=${BIKE_VIDEO_AD.youtubeId}&controls=0&rel=0&modestbranding=1`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          />
        ) : (
          <img
            src={BIKE_VIDEO_AD.poster}
            alt=""
            className="h-full w-full object-cover"
          />
        )}
        <div className="absolute inset-0 bg-black/45" />
        <div className="absolute inset-0 bg-gradient-to-b from-brand/70 via-brand/35 to-brand/75" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/80">
            {BIKE_VIDEO_AD.subtitle}
          </p>
          <h2 className="mt-2 font-display text-3xl font-bold text-white lg:text-4xl">
            What Riders Say
          </h2>
          <p className="mx-auto mt-2 max-w-lg text-sm text-white/85">
            {BIKE_VIDEO_AD.title}, trusted by riders across Pakistan
          </p>
        </motion.div>

        {items.length > 0 ? (
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
            {items.map((t, i) => (
              <motion.div
                key={t.customerName + i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="rounded-[var(--radius-card)] border border-white/20 bg-white/95 p-5 shadow-lg backdrop-blur-sm"
              >
                <div className="flex gap-0.5">
                  {Array.from({ length: t.rating }).map((_, j) => (
                    <Star key={j} className="h-4 w-4 fill-accent text-accent" />
                  ))}
                </div>
                <p className="mt-3 text-sm leading-relaxed text-text-muted">&ldquo;{t.content}&rdquo;</p>
                <p className="mt-3 text-sm font-semibold text-brand">{t.customerName}</p>
              </motion.div>
            ))}
          </div>
        ) : (
          <p className="mt-10 text-center text-sm text-white/80">Customer reviews coming soon.</p>
        )}
      </div>
    </section>
  );
}
