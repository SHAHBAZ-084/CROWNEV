import { AppError } from './helpers.js';

/** Optional YYYY-MM-DD from invoice forms; defaults to now when omitted. */
export function parseOptionalInvoiceDate(input?: string | null): Date {
  if (!input?.trim()) return new Date();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input.trim());
  if (!match) throw new AppError(400, 'Invalid invoice date');
  const [, y, m, d] = match;
  const date = new Date(Number(y), Number(m) - 1, Number(d), 12, 0, 0, 0);
  if (Number.isNaN(date.getTime())) throw new AppError(400, 'Invalid invoice date');
  return date;
}
