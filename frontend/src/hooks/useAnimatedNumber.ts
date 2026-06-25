import { useEffect, useRef, useState } from 'react';
import { useSpring } from 'framer-motion';

type UseAnimatedNumberOptions = {
  duration?: number;
  /** When false, the counter stays at 0 until enabled (e.g. scroll into view). */
  enabled?: boolean;
  onComplete?: () => void;
};

function resolveOptions(durationOrOptions?: number | UseAnimatedNumberOptions): UseAnimatedNumberOptions {
  if (typeof durationOrOptions === 'number') {
    return { duration: durationOrOptions };
  }
  return durationOrOptions ?? {};
}

export function useAnimatedNumber(value: number, durationOrOptions?: number | UseAnimatedNumberOptions) {
  const { duration = 1.2, enabled = true, onComplete } = resolveOptions(durationOrOptions);
  const [display, setDisplay] = useState(0);
  const spring = useSpring(0, { duration: duration * 1000 });
  const completedRef = useRef(false);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    completedRef.current = false;

    if (!enabled) {
      spring.set(0);
      setDisplay(0);
      return;
    }

    spring.set(0);
    setDisplay(0);
    spring.set(value);

    const unsub = spring.on('change', (v) => {
      const rounded = Math.round(v);
      setDisplay(rounded);
      if (!completedRef.current && rounded === value) {
        completedRef.current = true;
        onCompleteRef.current?.();
      }
    });

    return unsub;
  }, [value, spring, enabled]);

  return display;
}
