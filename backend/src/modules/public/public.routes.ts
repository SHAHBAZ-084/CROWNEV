import { Router } from 'express';
import { Role } from '@prisma/client';
import { z } from 'zod';
import { asyncHandler, param, validateBody } from '../../utils/helpers.js';
import { authenticate, requireRoles } from '../../middleware/auth.js';
import { cachePublicJson } from '../../middleware/cacheControl.js';
import * as publicService from './public.service.js';

export const publicRouter = Router();

publicRouter.get(
  '/landing',
  cachePublicJson(120),
  asyncHandler(async (_req, res) => {
    const data = await publicService.getLandingData();
    res.json(data);
  })
);

publicRouter.get(
  '/pages',
  asyncHandler(async (_req, res) => {
    const pages = await publicService.listContentPages();
    res.json(pages);
  })
);

publicRouter.get(
  '/pages/:slug',
  asyncHandler(async (req, res) => {
    const page = await publicService.getContentPage(param(req.params.slug));
    if (!page) {
      res.status(404).json({ error: 'Page not found' });
      return;
    }
    res.json(page);
  })
);

publicRouter.put(
  '/pages/:slug',
  authenticate,
  requireRoles(Role.ADMIN),
  validateBody(z.object({ title: z.string().min(1), content: z.string().min(1) })),
  asyncHandler(async (req, res) => {
    const page = await publicService.upsertContentPage(
      param(req.params.slug),
      req.body.title,
      req.body.content
    );
    res.json(page);
  })
);
