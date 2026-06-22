import { z } from 'zod';

export const passwordSchema = z
  .string()
  .min(8)
  .regex(/[A-Z]/, 'Must contain an uppercase letter')
  .regex(/[0-9]/, 'Must contain a number');
