import { AppError } from './helpers.js';

export const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;
export const DEFAULT_QUERY_TIMEOUT_MS = 25_000;
export const EXPORT_MAX_ROWS = 5_000;

/** Reject a promise if it does not settle within `ms`. */
export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label = 'Operation'
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new AppError(504, `${label} timed out after ${ms}ms`, 'TIMEOUT'));
    }, ms);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}
