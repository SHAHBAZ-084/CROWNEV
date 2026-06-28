import { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { AppError } from '../utils/helpers.js';

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message, code: err.code });
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      const target = err.meta?.target;
      const fields = Array.isArray(target) ? target : typeof target === 'string' ? [target] : [];
      if (fields.some((field) => String(field).includes('cnic'))) {
        res.status(409).json({ error: 'A customer with this CNIC already exists.' });
        return;
      }
      if (fields.some((field) => String(field).includes('chassisNumber'))) {
        res.status(409).json({ error: 'Chassis number(s) already exist' });
        return;
      }
      if (fields.some((field) => String(field).includes('saleOrderItemId'))) {
        res.status(409).json({ error: 'This chassis number is already linked to a sale line' });
        return;
      }
      res.status(409).json({
        error: `Duplicate value for: ${fields.join(', ') || 'unknown field'}`,
      });
      return;
    }
    if (err.code === 'P2021' || err.code === 'P2022') {
      res.status(500).json({
        error: 'Database schema is out of date. Run: npx prisma migrate deploy && npx prisma generate, then restart the API.',
      });
      return;
    }
    if (err.code === 'P2003') {
      res.status(400).json({ error: 'Invalid reference — linked record not found' });
      return;
    }
    if (err.code === 'P2025') {
      res.status(404).json({ error: 'Record not found' });
      return;
    }
    console.error('Prisma error:', err.code, err.meta);
    res.status(400).json({
      error: err.message || `Database error (${err.code})`,
    });
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
