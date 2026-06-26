import { NextFunction, Request, Response } from 'express';

const MAX_INPUT_STRING_LENGTH = 500;
/** Google ID tokens are JWTs — much longer than normal form fields. */
const FIELD_STRING_LIMITS: Record<string, number> = {
  idToken: 8192,
};
const POLLUTED_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/** Strip prototype-pollution and `$`-operator keys from parsed JSON bodies/queries. */
function stripPollutedKeys(value: unknown): void {
  if (!value || typeof value !== 'object') return;

  if (Array.isArray(value)) {
    for (const item of value) stripPollutedKeys(item);
    return;
  }

  const record = value as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (POLLUTED_KEYS.has(key) || key.startsWith('$')) {
      delete record[key];
      continue;
    }
    stripPollutedKeys(record[key]);
  }
}

function maxStringLengthForPath(path: string): number {
  const fieldName = path.split('.').pop()?.replace(/\[\d+\]$/, '') ?? '';
  return FIELD_STRING_LIMITS[fieldName] ?? MAX_INPUT_STRING_LENGTH;
}

function findOversizedString(value: unknown, path: string): string | null {
  if (typeof value === 'string') {
    return value.length > maxStringLengthForPath(path) ? path : null;
  }
  if (!value || typeof value !== 'object') return null;

  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      const hit = findOversizedString(value[i], `${path}[${i}]`);
      if (hit) return hit;
    }
    return null;
  }

  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    const hit = findOversizedString(nested, `${path}.${key}`);
    if (hit) return hit;
  }
  return null;
}

export function stripPollutionMiddleware(req: Request, _res: Response, next: NextFunction) {
  stripPollutedKeys(req.body);
  stripPollutedKeys(req.query);
  stripPollutedKeys(req.params);
  next();
}

/** Reject oversized string fields before regex / DB work (ReDoS / abuse guard). */
export function inputLengthMiddleware(req: Request, res: Response, next: NextFunction) {
  const tooLong =
    findOversizedString(req.body, 'body') ?? findOversizedString(req.query, 'query');
  if (tooLong) {
    res.status(400).json({ error: 'Input too long' });
    return;
  }
  next();
}
