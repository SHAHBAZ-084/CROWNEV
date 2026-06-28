import { type ReactNode, useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { easeOut } from '../../lib/publicMotion';
import { HOME_HERO_VIDEO } from '../../lib/placeholders';

export function HeroHeadline({ text, className = '' }: { text: string; className?: string }) {
  const reduceMotion = useReducedMotion();
  const words = text.split(' ');

  return (
    <h1 className={className}>
      {words.map((word, index) => (
        <motion.span
          key={`${word}-${index}`}
          className="inline-block"
          style={{ marginRight: index < words.length - 1 ? '0.28em' : undefined }}
          initial={reduceMotion ? false : { opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: index * 0.08, ease: easeOut }}
        >
          {word}
        </motion.span>
      ))}
    </h1>
  );
}

export function HeroCta({ children, className = '' }: { children: ReactNode; className?: string }) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className={className}
      whileHover={reduceMotion ? undefined : { scale: 1.04 }}
      whileTap={reduceMotion ? undefined : { scale: 0.97 }}
    >
      {children}
    </motion.div>
  );
}

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

export function HomeHeroVideo({ children }: { children: ReactNode }) {
  const reduceMotion = useReducedMotion();
  const isMobile = useIsMobile();
  const sectionRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoReady, setVideoReady] = useState(false);
  const [inView, setInView] = useState(true);

  const videoSrc = isMobile ? HOME_HERO_VIDEO.mp4Mobile : HOME_HERO_VIDEO.mp4;
  const posterSrc = isMobile ? HOME_HERO_VIDEO.posterMobile : HOME_HERO_VIDEO.poster;
  const showVideo = !reduceMotion && Boolean(videoSrc);

  useEffect(() => {
    setVideoReady(false);
  }, [videoSrc]);

  useEffect(() => {
    if (!showVideo) return;
    const section = sectionRef.current;
    if (!section) return;

    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { rootMargin: '80px 0px', threshold: 0.05 },
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

  const mobileMediaClass = 'object-[50%_68%] scale-[1.22] origin-center';
  const desktopMediaClass = 'object-[center_35%]';

  return (
    <section
      ref={sectionRef}
      className="relative overflow-hidden min-h-[min(72vh,640px)] pt-24 pb-16 sm:min-h-[min(88vh,820px)] sm:pt-28 sm:pb-24 lg:pt-36 lg:pb-32"
    >
      <div className="absolute inset-0" aria-hidden>
        <picture className="absolute inset-0">
          <source media="(max-width: 768px)" srcSet={HOME_HERO_VIDEO.posterMobile} type="image/webp" />
          <img
            src={HOME_HERO_VIDEO.poster}
            alt=""
            width={1280}
            height={2276}
            decoding="async"
            fetchPriority="high"
            className={`h-full w-full object-cover transition-opacity duration-700 ${
              isMobile ? mobileMediaClass : desktopMediaClass
            } ${showVideo && videoReady ? 'opacity-0' : 'opacity-100'}`}
          />
        </picture>

        {showVideo ? (
          <video
            ref={videoRef}
            key={videoSrc}
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${
              isMobile ? mobileMediaClass : desktopMediaClass
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

        {/* Cinematic scrim — darkens text side only; video stays clear on the right */}
        <div className="absolute inset-0 bg-black/5" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/45 via-black/12 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-transparent" />
        <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/55 via-black/20 to-transparent sm:h-24 lg:hidden" />
        <div className="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-b from-transparent via-brand/15 to-brand/50 lg:h-16" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 lg:px-8">
        <div className="max-w-2xl">{children}</div>
      </div>
    </section>
  );
}
