import { Router } from 'express';
import { Role } from '@prisma/client';
import { z } from 'zod';
import { asyncHandler, param, validateBody } from '../../utils/helpers.js';
import { authenticate, branchScope, requireRoles } from '../../middleware/auth.js';
import * as branchesService from './branches.service.js';

export const branchesRouter = Router();

branchesRouter.get(
  '/public',
  asyncHandler(async (_req, res) => {
    const branches = await branchesService.listBranches(true);
    res.json(branches);
  })
);

branchesRouter.use(authenticate);

branchesRouter.get(
  '/',
  requireRoles(Role.ADMIN),
  asyncHandler(async (_req, res) => {
    const branches = await branchesService.listBranches();
    res.json(branches);
  })
);

branchesRouter.get(
  '/:id',
  requireRoles(Role.ADMIN, Role.BRANCH_OWNER),
  branchScope,
  asyncHandler(async (req, res) => {
    const id = parseInt(param(req.params.id), 10);
    if (req.user!.role === Role.BRANCH_OWNER && req.user!.branchId !== id) {
      res.status(403).json({ error: 'Cross-branch access denied' });
      return;
    }
    const branch = await branchesService.getBranch(id);
    res.json(branch);
  })
);

branchesRouter.get(
  '/:id/dashboard',
  requireRoles(Role.ADMIN, Role.BRANCH_OWNER),
  branchScope,
  asyncHandler(async (req, res) => {
    const id = parseInt(param(req.params.id), 10);
    if (req.user!.role === Role.BRANCH_OWNER && req.user!.branchId !== id) {
      res.status(403).json({ error: 'Cross-branch access denied' });
      return;
    }
    const dashboard = await branchesService.getBranchDashboard(id);
    res.json(dashboard);
  })
);

branchesRouter.post(
  '/',
  requireRoles(Role.ADMIN),
  validateBody(
    z.object({
      name: z.string().min(1),
      location: z.string().min(1),
      phone: z.string().min(1),
      whatsapp: z.string().optional(),
      description: z.string().optional(),
    })
  ),
  asyncHandler(async (req, res) => {
    const branch = await branchesService.createBranch(req.body);
    res.status(201).json(branch);
  })
);

branchesRouter.patch(
  '/:id',
  requireRoles(Role.ADMIN),
  validateBody(
    z.object({
      name: z.string().optional(),
      location: z.string().optional(),
      phone: z.string().optional(),
      whatsapp: z.string().optional(),
      description: z.string().optional(),
      isActive: z.boolean().optional(),
    })
  ),
  asyncHandler(async (req, res) => {
    const branch = await branchesService.updateBranch(parseInt(param(req.params.id), 10), req.body);
    res.json(branch);
  })
);

branchesRouter.delete(
  '/:id',
  requireRoles(Role.ADMIN),
  asyncHandler(async (req, res) => {
    const result = await branchesService.deleteBranch(parseInt(param(req.params.id), 10));
    res.json(result);
  })
);

branchesRouter.post(
  '/:id/assign-owner',
  requireRoles(Role.ADMIN),
  validateBody(z.object({ ownerId: z.string().uuid() })),
  asyncHandler(async (req, res) => {
    await branchesService.assignOwner(parseInt(param(req.params.id), 10), req.body.ownerId);
    res.json({ message: 'Owner assigned' });
  })
);

branchesRouter.get(
  '/:id/staff',
  requireRoles(Role.ADMIN, Role.BRANCH_OWNER),
  asyncHandler(async (req, res) => {
    const id = parseInt(param(req.params.id), 10);
    if (req.user!.role === Role.BRANCH_OWNER && req.user!.branchId !== id) {
      res.status(403).json({ error: 'Cross-branch access denied' });
      return;
    }
    const staff = await branchesService.listStaff(id);
    res.json(staff);
  })
);

branchesRouter.post(
  '/:id/staff',
  requireRoles(Role.ADMIN),
  validateBody(z.object({ userId: z.string().uuid() })),
  asyncHandler(async (req, res) => {
    const user = await branchesService.assignStaff(parseInt(param(req.params.id), 10), req.body.userId);
    res.status(201).json(user);
  })
);

branchesRouter.delete(
  '/:id/staff/:userId',
  requireRoles(Role.ADMIN),
  asyncHandler(async (req, res) => {
    await branchesService.removeStaff(parseInt(param(req.params.id), 10), param(req.params.userId));
    res.status(204).send();
  })
);
