import { Router } from 'express';
import { Role } from '@prisma/client';
import { z } from 'zod';
import { asyncHandler, param, validateBody } from '../../utils/helpers.js';
import { authenticate, requireRoles } from '../../middleware/auth.js';
import * as partsService from './parts.service.js';

export const partsRouter = Router();

partsRouter.use(authenticate);

partsRouter.get(
  '/',
  requireRoles(Role.ADMIN, Role.BRANCH_OWNER),
  asyncHandler(async (req, res) => {
    const result = await partsService.listParts({
      page: req.query.page as string,
      limit: req.query.limit as string,
      search: req.query.search as string,
    });
    res.json(result);
  })
);

partsRouter.get(
  '/:id',
  requireRoles(Role.ADMIN, Role.BRANCH_OWNER),
  asyncHandler(async (req, res) => {
    const part = await partsService.getPart(parseInt(param(req.params.id), 10));
    res.json(part);
  })
);

partsRouter.post(
  '/',
  requireRoles(Role.ADMIN),
  validateBody(
    z.object({
      itemCode: z.string().min(1),
      name: z.string().min(1),
      description: z.string().optional(),
      costPrice: z.number().nonnegative(),
      alertAt: z.number().int().optional(),
    })
  ),
  asyncHandler(async (req, res) => {
    const part = await partsService.createPart(req.body);
    res.status(201).json(part);
  })
);

partsRouter.patch(
  '/:id',
  requireRoles(Role.ADMIN),
  validateBody(z.record(z.unknown())),
  asyncHandler(async (req, res) => {
    const part = await partsService.updatePart(parseInt(param(req.params.id), 10), req.body);
    res.json(part);
  })
);

partsRouter.delete(
  '/:id',
  requireRoles(Role.ADMIN),
  asyncHandler(async (req, res) => {
    await partsService.deletePart(parseInt(param(req.params.id), 10));
    res.status(204).send();
  })
);
