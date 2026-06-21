import { useEffect, useRef, useState } from 'react';
import { useSpring } from 'framer-motion';

export function useAnimatedNumber(value: number, duration = 1.2) {
  const [display, setDisplay] = useState(0);
  const spring = useSpring(0, { duration: duration * 1000 });
  const prev = useRef(0);

  useEffect(() => {
    spring.set(value);
    const unsub = spring.on('change', (v) => setDisplay(Math.round(v)));
    spring.set(value);
    prev.current = value;
    return unsub;
  }, [value, spring]);

  return display;
}
