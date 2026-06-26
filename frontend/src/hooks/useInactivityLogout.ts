import { useEffect, useRef } from 'react';

export const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000;
export const INACTIVITY_CHECK_INTERVAL_MS = 60 * 1000;
export const INACTIVITY_ACTIVITY_DEBOUNCE_MS = 1000;

const ACTIVITY_EVENTS = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click', 'focusin'] as const;

type UseInactivityLogoutOptions = {
  enabled: boolean;
  onExpire: () => void;
  timeoutMs?: number;
  checkIntervalMs?: number;
  activityDebounceMs?: number;
};

export function useInactivityLogout({
  enabled,
  onExpire,
  timeoutMs = INACTIVITY_TIMEOUT_MS,
  checkIntervalMs = INACTIVITY_CHECK_INTERVAL_MS,
  activityDebounceMs = INACTIVITY_ACTIVITY_DEBOUNCE_MS,
}: UseInactivityLogoutOptions) {
  const lastActivityRef = useRef(Date.now());
  const lastRecordedRef = useRef(0);
  const expiredRef = useRef(false);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  useEffect(() => {
    if (!enabled) {
      expiredRef.current = false;
      return;
    }

    const now = Date.now();
    lastActivityRef.current = now;
    lastRecordedRef.current = now;
    expiredRef.current = false;

    function recordActivity() {
      if (expiredRef.current) return;
      const ts = Date.now();
      if (ts - lastRecordedRef.current < activityDebounceMs) return;
      lastRecordedRef.current = ts;
      lastActivityRef.current = ts;
    }

    const listenerOptions: AddEventListenerOptions = { capture: true, passive: true };
    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, recordActivity, listenerOptions);
    }

    const intervalId = window.setInterval(() => {
      if (expiredRef.current) return;
      if (Date.now() - lastActivityRef.current >= timeoutMs) {
        expiredRef.current = true;
        onExpireRef.current();
      }
    }, checkIntervalMs);

    return () => {
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, recordActivity, listenerOptions);
      }
      window.clearInterval(intervalId);
    };
  }, [enabled, timeoutMs, checkIntervalMs, activityDebounceMs]);
}
