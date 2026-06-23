import { type ReactNode, useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { HOME_HERO_VIDEO } from '../../lib/placeholders';

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
      className="relative overflow-hidden min-h-[min(78vh,680px)] pt-28 pb-20 sm:min-h-[min(88vh,820px)] sm:pb-24 lg:pt-36 lg:pb-32"
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
