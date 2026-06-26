import type { RequestHandler } from 'express';

/** Cache public read-only JSON for `seconds` (browser + CDN). */
export function cachePublicJson(seconds: number): RequestHandler {
  return (_req, res, next) => {
    res.set('Cache-Control', `public, max-age=${seconds}, stale-while-revalidate=${seconds * 2}`);
    next();
  };
}
