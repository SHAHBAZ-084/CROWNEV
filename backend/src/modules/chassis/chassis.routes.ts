import { Router } from 'express';
import { ChassisStatus, Role } from '@prisma/client';
import { z } from 'zod';
import { asyncHandler, param, validateBody } from '../../utils/helpers.js';
import { authenticate, branchScope, requireRoles } from '../../middleware/auth.js';
import * as chassisService from './chassis.service.js';

export const chassisRouter = Router();

chassisRouter.use(authenticate, requireRoles(Role.ADMIN, Role.BRANCH_OWNER), branchScope);

chassisRouter.get(
  '/:branchId/chassis',
  asyncHandler(async (req, res) => {
    const branchId = parseInt(param(req.params.branchId), 10);
    if (req.user!.role === Role.BRANCH_OWNER && req.user!.branchId !== branchId) {
      res.status(403).json({ error: 'Cross-branch access denied' });
      return;
    }
    const statusParam = req.query.status as string | undefined;
    const status =
      statusParam === 'IN_STOCK' || statusParam === 'SOLD'
        ? (statusParam as ChassisStatus)
        : undefined;
    const rows = await chassisService.listBranchChassis(branchId, {
      productId: req.query.productId as string | undefined,
      status,
    });
    res.json(rows);
  }),
);

chassisRouter.get(
  '/:branchId/chassis/available/:productId',
  asyncHandler(async (req, res) => {
    const branchId = parseInt(param(req.params.branchId), 10);
    if (req.user!.role === Role.BRANCH_OWNER && req.user!.branchId !== branchId) {
      res.status(403).json({ error: 'Cross-branch access denied' });
      return;
    }
    const rows = await chassisService.listAvailableChassis(branchId, param(req.params.productId));
    res.json(rows);
  }),
);

chassisRouter.post(
  '/:branchId/chassis/validate',
  validateBody(
    z.object({
      chassisNumbers: z.array(z.string().trim().min(1)).min(1),
    }),
  ),
  asyncHandler(async (req, res) => {
    const branchId = parseInt(param(req.params.branchId), 10);
    if (req.user!.role === Role.BRANCH_OWNER && req.user!.branchId !== branchId) {
      res.status(403).json({ error: 'Cross-branch access denied' });
      return;
    }
    chassisService.assertNoDuplicateChassisInList(req.body.chassisNumbers);
    const conflicts = await chassisService.findExistingChassisNumbers(req.body.chassisNumbers);
    if (conflicts.length > 0) {
      res.status(409).json({
        error: `Chassis number(s) already exist: ${conflicts.join(', ')}`,
        conflicts,
      });
      return;
    }
    res.json({ valid: true });
  }),
);
