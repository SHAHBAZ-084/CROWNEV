import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Star } from 'lucide-react';
import { BIKE_VIDEO_AD } from '../../lib/placeholders';

type Testimonial = {
  customerName: string;
  content: string;
  rating: number;
};

function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(`(max-width: ${breakpoint}px)`).matches : false,
  );

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const onChange = () => setIsMobile(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [breakpoint]);

  return isMobile;
}

function useVisibleCount() {
  const [visibleCount, setVisibleCount] = useState(() => {
    if (typeof window === 'undefined') return 3;
    if (window.innerWidth >= 1024) return 3;
    if (window.innerWidth >= 640) return 2;
    return 1;
  });

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setVisibleCount(3);
      } else if (window.innerWidth >= 640) {
        setVisibleCount(2);
      } else {
        setVisibleCount(1);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return visibleCount;
}

export function RidersSaySection({ testimonials }: { testimonials?: Testimonial[] }) {
  const items = testimonials ?? [];
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const visibleCount = useVisibleCount();

  const reduceMotion = useReducedMotion();
  const isMobile = useIsMobile();
  const sectionRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoReady, setVideoReady] = useState(false);
  const [inView, setInView] = useState(false);

  const videoSrc = isMobile ? BIKE_VIDEO_AD.mp4Mobile : BIKE_VIDEO_AD.mp4;
  const posterSrc = isMobile ? BIKE_VIDEO_AD.posterMobile : BIKE_VIDEO_AD.poster;
  const showVideo = !reduceMotion && Boolean(videoSrc);

  useEffect(() => {
    setVideoReady(false);
  }, [videoSrc]);

  useEffect(() => {
    if (!showVideo) return;
    const section = sectionRef.current;
    if (!section) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setInView(entry.isIntersecting);
      },
      { rootMargin: '120px 0px', threshold: 0.12 },
    );
    observer.observe(section);
    return () => observer.disconnect();
  }, [showVideo]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !showVideo) return;

    if (inView) {
      video.preload = 'auto';
      const playPromise = video.play();
      if (playPromise) playPromise.catch(() => {});
    } else {
      video.pause();
    }
  }, [inView, showVideo, videoSrc]);

  // Autoplay effect
  useEffect(() => {
    if (items.length <= visibleCount || isHovered) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => {
        const maxIndex = items.length - visibleCount;
        if (prev >= maxIndex) {
          return 0;
        }
        return prev + 1;
      });
    }, 5000);

    return () => clearInterval(interval);
  }, [items.length, visibleCount, isHovered]);

  // Reset index when visible count changes or items list updates
  useEffect(() => {
    setCurrentIndex((prev) => {
      const maxIndex = items.length - visibleCount;
      if (maxIndex <= 0) return 0;
      return Math.min(prev, maxIndex);
    });
  }, [visibleCount, items.length]);

  return (
    <section
      ref={sectionRef}
      className="relative min-h-[520px] overflow-hidden py-14 sm:min-h-[480px] sm:py-16 lg:min-h-[520px] lg:py-24"
    >
      <div className="absolute inset-0" aria-hidden>
        <picture className="absolute inset-0">
          <source media="(max-width: 768px)" srcSet={BIKE_VIDEO_AD.posterMobile} type="image/webp" />
          <img
            src={BIKE_VIDEO_AD.poster}
            alt=""
            width={1280}
            height={720}
            decoding="async"
            fetchPriority="high"
            className={`h-full w-full object-cover transition-opacity duration-700 ${
              isMobile ? 'object-[center_42%]' : 'object-center'
            } ${showVideo && videoReady ? 'opacity-0' : 'opacity-100'}`}
          />
        </picture>

        {showVideo ? (
          <video
            ref={videoRef}
            key={videoSrc}
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${
              isMobile ? 'object-[center_42%] scale-[1.08]' : 'object-center scale-105'
            } ${videoReady ? 'opacity-100' : 'opacity-0'}`}
            poster={posterSrc}
            muted
            loop
            playsInline
            autoPlay={false}
            preload="none"
            disablePictureInPicture
            onLoadedData={() => setVideoReady(true)}
          >
            <source src={videoSrc} type="video/mp4" />
          </video>
        ) : null}

        <div className="absolute inset-0 bg-black/20" />
        <div className="absolute inset-0 bg-gradient-to-b from-brand/25 via-brand/10 to-brand/35" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/90 drop-shadow-md">
            {BIKE_VIDEO_AD.subtitle}
          </p>
          <h2 className="mt-2 font-display text-2xl font-bold text-white drop-shadow-md sm:text-3xl lg:text-4xl">
            What Riders Say
          </h2>
          <p className="mx-auto mt-2 max-w-lg text-sm text-white/95 drop-shadow sm:text-base">
            {BIKE_VIDEO_AD.title}, trusted by riders across Pakistan
          </p>
        </motion.div>

        {items.length > 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mt-8 overflow-hidden py-3 sm:mt-10"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
          >
            <motion.div
              className="flex select-none"
              animate={{ x: `-${currentIndex * (100 / visibleCount)}%` }}
              transition={{ type: 'spring', stiffness: 100, damping: 20 }}
            >
              {items.map((t, i) => (
                <div
                  key={t.customerName + i}
                  className="w-full shrink-0 px-2 sm:w-1/2 sm:px-2.5 lg:w-1/3 lg:px-3"
                >
                  <div className="flex h-full flex-col justify-between rounded-[var(--radius-card)] border border-border-light bg-elevated/95 p-4 shadow-lg backdrop-blur-sm sm:p-5">
                    <div>
                      <div className="flex gap-0.5">
                        {Array.from({ length: t.rating }).map((_, j) => (
                          <Star key={j} className="h-4 w-4 fill-accent text-accent" />
                        ))}
                      </div>
                      <p className="mt-3 text-sm leading-relaxed text-text-muted">&ldquo;{t.content}&rdquo;</p>
                    </div>
                    <p className="mt-3 text-sm font-semibold text-brand">{t.customerName}</p>
                  </div>
                </div>
              ))}
            </motion.div>
          </motion.div>
        ) : (
          <p className="mt-10 text-center text-sm text-white/85">Customer reviews coming soon.</p>
        )}
      </div>
    </section>
  );
}
