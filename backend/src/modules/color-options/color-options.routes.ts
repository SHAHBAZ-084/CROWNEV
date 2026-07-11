import { Router } from 'express';
import { Role } from '@prisma/client';
import { z } from 'zod';
import { asyncHandler, validateBody } from '../../utils/helpers.js';
import { authenticate, requireRoles } from '../../middleware/auth.js';
import { cachePublicJson } from '../../middleware/cacheControl.js';
import * as colorOptionsService from './color-options.service.js';

export const colorOptionsRouter = Router();

colorOptionsRouter.get(
  '/',
  cachePublicJson(300),
  authenticate,
  requireRoles(Role.ADMIN, Role.BRANCH_OWNER),
  asyncHandler(async (_req, res) => {
    const options = await colorOptionsService.listColorOptions();
    res.json(options);
  }),
);

colorOptionsRouter.post(
  '/',
  authenticate,
  requireRoles(Role.ADMIN, Role.BRANCH_OWNER),
  validateBody(z.object({ name: z.string().trim().min(1) })),
  asyncHandler(async (req, res) => {
    const option = await colorOptionsService.findOrCreateColorOption(req.body.name);
    res.status(201).json(option);
  }),
);
