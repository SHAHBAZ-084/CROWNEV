import { Router } from 'express';
import { Role } from '@prisma/client';
import { z } from 'zod';
import { asyncHandler, param, validateBody } from '../../utils/helpers.js';
import { authenticate, requireRoles } from '../../middleware/auth.js';
import * as service from '../chassis/bike-documents.service.js';

export const documentTypesRouter = Router();

documentTypesRouter.use(authenticate, requireRoles(Role.ADMIN));

documentTypesRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.json(await service.listDocumentTypes());
  }),
);

documentTypesRouter.post(
  '/',
  validateBody(z.object({ name: z.string().min(1) })),
  asyncHandler(async (req, res) => {
    res.status(201).json(await service.createDocumentType(req.body.name));
  }),
);

documentTypesRouter.patch(
  '/:id/active',
  validateBody(z.object({ isActive: z.boolean() })),
  asyncHandler(async (req, res) => {
    res.json(await service.setDocumentTypeActive(parseInt(param(req.params.id), 10), req.body.isActive));
  }),
);
