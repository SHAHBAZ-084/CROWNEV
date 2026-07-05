import type { RequestHandler } from 'express';

/** Cache public read-only JSON for `seconds` (browser + CDN). */
export function cachePublicJson(seconds: number): RequestHandler {
  return (_req, res, next) => {
    res.set('Cache-Control', `public, max-age=${seconds}, stale-while-revalidate=${seconds * 2}`);
    next();
  };
}

/**
 * Never cache — for public endpoints that mirror admin-editable content
 * (About page founders, homepage feature cards, etc.). Admins expect a save
 * to show up immediately, and this content changes rarely enough that
 * skipping caching entirely has no real performance cost.
 */
export const noStorePublicJson: RequestHandler = (_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
};
