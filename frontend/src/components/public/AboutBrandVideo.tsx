import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { ABOUT_VIDEO } from '../../lib/placeholders';

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

export function AboutBrandVideo() {
  const reduceMotion = useReducedMotion();
  const isMobile = useIsMobile();
  const wrapRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoReady, setVideoReady] = useState(false);
  const [inView, setInView] = useState(false);

  const videoSrc = isMobile ? ABOUT_VIDEO.mp4Mobile : ABOUT_VIDEO.mp4;
  const posterSrc = isMobile ? ABOUT_VIDEO.posterMobile : ABOUT_VIDEO.poster;
  const showVideo = !reduceMotion;

  useEffect(() => {
    setVideoReady(false);
  }, [videoSrc]);

  useEffect(() => {
    if (!showVideo) return;
    const el = wrapRef.current;
    if (!el) return;

    const update = (visible: boolean) => setInView(visible);
    const observer = new IntersectionObserver(
      ([entry]) => update(entry.isIntersecting),
      { rootMargin: '120px 0px', threshold: 0.1 },
    );
    observer.observe(el);

    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight + 120 && rect.bottom > -120) {
      update(true);
    }

    return () => observer.disconnect();
  }, [showVideo]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !showVideo) return;
    if (inView) {
      video.preload = 'auto';
      void video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, [inView, showVideo, videoSrc]);

  return (
    <div ref={wrapRef} className="relative w-full max-w-[300px] sm:max-w-[340px] lg:max-w-[380px]">
      <div className="relative aspect-[9/16] w-full overflow-hidden rounded-[1.75rem] bg-neutral-900 shadow-[0_24px_60px_-12px_rgba(179,71,0,0.35)] ring-1 ring-black/10">
        <img
          src={posterSrc}
          alt=""
          width={720}
          height={1280}
          decoding="async"
          fetchPriority="high"
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${
            showVideo && videoReady ? 'opacity-0' : 'opacity-100'
          }`}
        />

        {showVideo ? (
          <video
            ref={videoRef}
            key={videoSrc}
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${
              videoReady ? 'opacity-100' : 'opacity-0'
            }`}
            poster={posterSrc}
            muted
            loop
            playsInline
            autoPlay={inView}
            preload={inView ? 'auto' : 'metadata'}
            disablePictureInPicture
            onLoadedData={() => setVideoReady(true)}
            onCanPlay={() => setVideoReady(true)}
          >
            <source src={videoSrc} type="video/mp4" />
          </video>
        ) : null}

        <div className="pointer-events-none absolute inset-0 rounded-[1.75rem] ring-1 ring-inset ring-white/15" />
      </div>
      <div
        className="pointer-events-none absolute -inset-3 -z-10 rounded-[2rem] bg-gradient-to-br from-accent/20 via-brand/10 to-transparent blur-sm"
        aria-hidden
      />
    </div>
  );
}
