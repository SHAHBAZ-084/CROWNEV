import { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { AppError } from '../utils/helpers.js';

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message, code: err.code });
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    res.status(400).json({ error: 'Invalid data submitted' });
    return;
  }

  if (err instanceof Prisma.PrismaClientValidationError) {
    console.error(err);
    const detail = err.message
      .split('\n')
      .map((line) => line.trim())
      .find(Boolean);
    res.status(500).json({
      error:
        detail ??
        'Database validation error. Run prisma migrate deploy && prisma generate, then restart the API.',
    });
    return;
  }

  if (
    err instanceof Prisma.PrismaClientUnknownRequestError &&
    err.message.includes('numeric field overflow')
  ) {
    res.status(400).json({ error: 'Price value is too large. Maximum is 9,999,999,999.99 PKR.' });
    return;
  }

  const statusCode = (err as Error & { statusCode?: number }).statusCode;
  if (statusCode) {
    res.status(statusCode).json({ error: err.message });
    return;
  }

  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
}

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ error: 'Route not found' });
}
