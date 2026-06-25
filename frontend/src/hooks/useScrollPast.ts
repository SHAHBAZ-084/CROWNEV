import { useEffect, useState } from 'react';

/** Returns true once the window has scrolled past `threshold` pixels. */
export function useScrollPast(threshold: number) {
  const [past, setPast] = useState(false);

  useEffect(() => {
    const onScroll = () => setPast(window.scrollY > threshold);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, [threshold]);

  return past;
}
