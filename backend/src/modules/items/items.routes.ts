import { Router } from 'express';
import { z } from 'zod';
import { Role } from '@prisma/client';
import { authenticate, requireRoles } from '../../middleware/auth.js';
import { asyncHandler, param, validateBody } from '../../utils/helpers.js';
import * as itemsService from './items.service.js';

export const itemsRouter = Router();

// Validation schemas
const createItemSchema = z.object({
  productId: z.string().min(1),
  color: z.string().optional(),
  model: z.string().optional(),
  costPrice: z.number().nonnegative(),
  salePrice: z.number().nonnegative(),
  stockQty: z.number().int().nonnegative().optional(),
  isActive: z.boolean().optional(),
});

const updateItemSchema = createItemSchema.partial();

// 1. Create Item (Admin only)
itemsRouter.post(
  '/',
  authenticate,
  requireRoles(Role.ADMIN),
  validateBody(createItemSchema),
  asyncHandler(async (req, res) => {
    const item = await itemsService.createItem(req.body);
    res.status(201).json(item);
  }),
);

// 2. List Items (Admin & Branch Owner)
itemsRouter.get(
  '/',
  authenticate,
  requireRoles(Role.ADMIN, Role.BRANCH_OWNER),
  asyncHandler(async (req, res) => {
    const result = await itemsService.getItems({
      page: req.query.page as string | undefined,
      limit: req.query.limit as string | undefined,
      search: req.query.search as string | undefined,
      brandId: req.query.brandId as string | undefined,
      categoryId: req.query.categoryId as string | undefined,
      isActive: req.query.isActive as string | undefined,
    });
    res.json(result);
  }),
);

// 3. Fetch single Item by Code/ID (Admin & Branch Owner)
itemsRouter.get(
  '/:id',
  authenticate,
  requireRoles(Role.ADMIN, Role.BRANCH_OWNER),
  asyncHandler(async (req, res) => {
    const id = parseInt(param(req.params.id), 10);
    const item = await itemsService.getItem(id);
    res.json(item);
  }),
);

// 4. Update Item (Admin only)
itemsRouter.patch(
  '/:id',
  authenticate,
  requireRoles(Role.ADMIN),
  validateBody(updateItemSchema),
  asyncHandler(async (req, res) => {
    const id = parseInt(param(req.params.id), 10);
    const item = await itemsService.updateItem(id, req.body);
    res.json(item);
  }),
);

// 5. Soft Delete Item (Admin only)
itemsRouter.delete(
  '/:id',
  authenticate,
  requireRoles(Role.ADMIN),
  asyncHandler(async (req, res) => {
    const id = parseInt(param(req.params.id), 10);
    const item = await itemsService.deleteItem(id);
    res.json({ success: true, item });
  }),
);

// 6. Get available chassis numbers for item (Admin & Branch Owner)
itemsRouter.get(
  '/:id/chassis-numbers',
  authenticate,
  requireRoles(Role.ADMIN, Role.BRANCH_OWNER),
  asyncHandler(async (req, res) => {
    const id = parseInt(param(req.params.id), 10);
    const branchId = req.user?.branchId;
    
    // If admin is requesting, they might pass branchId in query
    const targetBranchId = req.user?.role === Role.ADMIN && req.query.branchId 
      ? parseInt(req.query.branchId as string, 10) 
      : branchId;

    if (!targetBranchId) {
      res.json([]);
      return;
    }

    const chassisNumbers = await itemsService.getItemChassisNumbers(id, targetBranchId);
    res.json(chassisNumbers);
  }),
);
