import { NextFunction, Request, Response } from 'express';
import { env } from '../config/env.js';

/**
 * Abort slow HTTP requests so one client cannot hold workers indefinitely.
 * Uses Node's socket timeout — independent per connection.
 */
export function requestTimeoutMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const ms = env.requestTimeoutMs;

  req.setTimeout(ms, () => {
    if (!res.headersSent) {
      res.status(504).json({ error: 'Request timeout', code: 'TIMEOUT' });
    }
    req.destroy();
  });

  res.setTimeout(ms, () => {
    if (!res.headersSent) {
      res.status(504).json({ error: 'Request timeout', code: 'TIMEOUT' });
    }
  });

  next();
}
