import { z } from 'zod';

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters long')
  .max(128, 'Password must be no more than 128 characters long')
  .regex(/[A-Z]/, 'Password must include at least one uppercase letter (A-Z)')
  .regex(/[0-9]/, 'Password must include at least one number (0-9)');
