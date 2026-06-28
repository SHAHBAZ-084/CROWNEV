import { lazy as reactLazy, type ComponentType, type LazyExoticComponent } from 'react';

const CHUNK_RELOAD_KEY = 'crownev-chunk-reload';

function isChunkLoadError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    /Failed to fetch dynamically imported module/i.test(msg) ||
    /Importing a module script failed/i.test(msg) ||
    /Loading chunk .* failed/i.test(msg)
  );
}

function reloadForStaleChunk(): never {
  const entrySrc =
    document.querySelector('script[type="module"][src]')?.getAttribute('src') ?? 'unknown';
  const last = sessionStorage.getItem(CHUNK_RELOAD_KEY);
  if (last !== entrySrc) {
    sessionStorage.setItem(CHUNK_RELOAD_KEY, entrySrc);
    window.location.reload();
  }
  throw new Error('A new version of the site is available. Please reload the page.');
}

/** Drop-in replacement for React.lazy — auto-reloads once when a deploy invalidates old chunks. */
export function lazyRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
): LazyExoticComponent<T> {
  return reactLazy(async () => {
    try {
      return await factory();
    } catch (err) {
      if (isChunkLoadError(err)) {
        reloadForStaleChunk();
      }
      throw err;
    }
  });
}

export function installChunkLoadRecovery(): void {
  window.addEventListener('vite:preloadError', (event) => {
    event.preventDefault();
    reloadForStaleChunk();
  });

  window.addEventListener('unhandledrejection', (event) => {
    if (isChunkLoadError(event.reason)) {
      event.preventDefault();
      reloadForStaleChunk();
    }
  });
}

export { isChunkLoadError };
