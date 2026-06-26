import { Router } from 'express';
import { Role, StockAdjustmentReason } from '@prisma/client';
import { z } from 'zod';
import { asyncHandler, param, validateBody } from '../../utils/helpers.js';
import { authenticate, branchScope, requireBranchDeletePermission, requireBranchUpdatePermission, requireRoles } from '../../middleware/auth.js';
import * as inventoryService from './inventory.service.js';

export const inventoryRouter = Router();

inventoryRouter.use(authenticate, branchScope);

function assertBranchAccess(req: import('express').Request, branchId: number) {
  if (req.user!.role === Role.BRANCH_OWNER && req.user!.branchId !== branchId) {
    throw Object.assign(new Error('Cross-branch access denied'), { statusCode: 403 });
  }
}

inventoryRouter.get(
  '/alerts/all',
  requireRoles(Role.ADMIN),
  asyncHandler(async (_req, res) => {
    const alerts = await inventoryService.getLowStockAlerts();
    res.json(alerts);
  })
);

inventoryRouter.get(
  '/:branchId/stock',
  requireRoles(Role.ADMIN, Role.BRANCH_OWNER),
  asyncHandler(async (req, res) => {
    const branchId = parseInt(param(req.params.branchId), 10);
    assertBranchAccess(req, branchId);
    const stock = await inventoryService.getBranchStock(branchId);
    res.json(stock);
  })
);

inventoryRouter.get(
  '/:branchId/catalog-search',
  requireRoles(Role.ADMIN, Role.BRANCH_OWNER),
  asyncHandler(async (req, res) => {
    const branchId = parseInt(param(req.params.branchId), 10);
    assertBranchAccess(req, branchId);
    const search = String(req.query.q ?? '');
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 10;
    const rows = await inventoryService.searchBranchCatalog(branchId, search, limit);
    res.json(rows);
  })
);

inventoryRouter.get(
  '/:branchId',
  requireRoles(Role.ADMIN, Role.BRANCH_OWNER),
  asyncHandler(async (req, res) => {
    const branchId = parseInt(param(req.params.branchId), 10);
    assertBranchAccess(req, branchId);
    const result = await inventoryService.getBranchInventory(branchId, {
      page: req.query.page as string,
      limit: req.query.limit as string,
      lowStock: req.query.lowStock === 'true',
    });
    res.json(result);
  })
);

inventoryRouter.get(
  '/:branchId/low-stock',
  requireRoles(Role.ADMIN, Role.BRANCH_OWNER),
  asyncHandler(async (req, res) => {
    const branchId = parseInt(param(req.params.branchId), 10);
    assertBranchAccess(req, branchId);
    const alerts = await inventoryService.getLowStockAlerts(branchId);
    res.json(alerts);
  })
);

inventoryRouter.get(
  '/:branchId/adjustments',
  requireRoles(Role.ADMIN, Role.BRANCH_OWNER),
  asyncHandler(async (req, res) => {
    const branchId = parseInt(param(req.params.branchId), 10);
    assertBranchAccess(req, branchId);
    const result = await inventoryService.listAdjustments(branchId, {
      page: req.query.page as string,
      limit: req.query.limit as string,
    });
    res.json(result);
  })
);

inventoryRouter.put(
  '/:branchId/:partId',
  requireRoles(Role.ADMIN, Role.BRANCH_OWNER),
  requireBranchUpdatePermission,
  validateBody(z.object({ quantity: z.number().int().nonnegative() })),
  asyncHandler(async (req, res) => {
    const branchId = parseInt(param(req.params.branchId), 10);
    const partId = parseInt(param(req.params.partId), 10);
    assertBranchAccess(req, branchId);
    const inventory = await inventoryService.updateStock(branchId, partId, req.body.quantity);
    res.json(inventory);
  })
);

inventoryRouter.delete(
  '/:branchId/:partId',
  requireRoles(Role.BRANCH_OWNER),
  requireBranchDeletePermission,
  asyncHandler(async (req, res) => {
    const branchId = parseInt(param(req.params.branchId), 10);
    const partId = parseInt(param(req.params.partId), 10);
    assertBranchAccess(req, branchId);
    await inventoryService.removePartFromBranch(branchId, partId);
    res.status(204).send();
  })
);

inventoryRouter.post(
  '/:branchId/adjust',
  requireRoles(Role.ADMIN, Role.BRANCH_OWNER),
  validateBody(
    z.object({
      partId: z.number().int(),
      quantityChange: z.number().int(),
      reason: z.nativeEnum(StockAdjustmentReason),
      notes: z.string().optional(),
    })
  ),
  asyncHandler(async (req, res) => {
    const branchId = parseInt(param(req.params.branchId), 10);
    assertBranchAccess(req, branchId);
    const result = await inventoryService.adjustStock({
      branchId,
      ...req.body,
      adjustedById: req.user!.userId,
    });
    res.json(result);
  })
);
