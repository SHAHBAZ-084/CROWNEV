import { Router } from 'express';
import { Role } from '@prisma/client';
import { z } from 'zod';
import { asyncHandler, param, validateBody } from '../../utils/helpers.js';
import { authenticate, requireBranchDeletePermission, requireBranchUpdatePermission, requireRoles } from '../../middleware/auth.js';
import * as suppliersService from './suppliers.service.js';

export const suppliersRouter = Router();
export const purchasesRouter = Router();

suppliersRouter.use(authenticate);

suppliersRouter.get(
  '/',
  requireRoles(Role.ADMIN, Role.BRANCH_OWNER),
  asyncHandler(async (req, res) => {
    const branchId =
      req.user!.role === Role.BRANCH_OWNER
        ? req.user!.branchId ?? undefined
        : req.query.branchId
          ? parseInt(req.query.branchId as string, 10)
          : undefined;
    const result = await suppliersService.listSuppliers(branchId, {
      page: req.query.page as string,
      limit: req.query.limit as string,
      search: req.query.search as string,
    });
    res.json(result);
  })
);

suppliersRouter.post(
  '/',
  requireRoles(Role.ADMIN, Role.BRANCH_OWNER),
  validateBody(
    z.object({
      branchId: z.number().int(),
      name: z.string().min(1),
      contactPerson: z.string().optional(),
      phone: z.string().optional(),
      email: z.string().email().optional(),
      address: z.string().optional(),
    })
  ),
  asyncHandler(async (req, res) => {
    if (req.user!.role === Role.BRANCH_OWNER && req.user!.branchId !== req.body.branchId) {
      res.status(403).json({ error: 'Cross-branch access denied' });
      return;
    }
    const supplier = await suppliersService.createSupplier(req.body);
    res.status(201).json(supplier);
  })
);

suppliersRouter.patch(
  '/:id',
  requireRoles(Role.ADMIN, Role.BRANCH_OWNER),
  requireBranchUpdatePermission,
  validateBody(
    z.object({
      branchId: z.number().int(),
      name: z.string().min(1).max(200).optional(),
      contactPerson: z.string().max(200).optional(),
      phone: z.string().max(32).optional(),
      email: z.string().email().max(254).optional(),
      address: z.string().max(500).optional(),
    }),
  ),
  asyncHandler(async (req, res) => {
    const branchId = req.body.branchId as number;
    if (req.user!.role === Role.BRANCH_OWNER && req.user!.branchId !== branchId) {
      res.status(403).json({ error: 'Cross-branch access denied' });
      return;
    }
    const supplier = await suppliersService.updateSupplier(parseInt(param(req.params.id), 10), branchId, req.body);
    res.json(supplier);
  })
);

suppliersRouter.delete(
  '/:id',
  requireRoles(Role.ADMIN, Role.BRANCH_OWNER),
  requireBranchDeletePermission,
  validateBody(z.object({ branchId: z.number().int() })),
  asyncHandler(async (req, res) => {
    const branchId = req.body.branchId;
    if (req.user!.role === Role.BRANCH_OWNER && req.user!.branchId !== branchId) {
      res.status(403).json({ error: 'Cross-branch access denied' });
      return;
    }
    const supplier = await suppliersService.softDeleteSupplier(parseInt(param(req.params.id), 10), branchId);
    res.json(supplier);
  }),
);

suppliersRouter.get(
  '/:branchId/:supplierId/ledger',
  requireRoles(Role.ADMIN, Role.BRANCH_OWNER),
  asyncHandler(async (req, res) => {
    const branchId = parseInt(param(req.params.branchId), 10);
    if (req.user!.role === Role.BRANCH_OWNER && req.user!.branchId !== branchId) {
      res.status(403).json({ error: 'Cross-branch access denied' });
      return;
    }
    const ledger = await suppliersService.getSupplierLedgerFormatted(
      parseInt(param(req.params.supplierId), 10),
      branchId,
    );
    res.json(ledger);
  }),
);

purchasesRouter.use(authenticate);

purchasesRouter.post(
  '/invoice',
  requireRoles(Role.ADMIN, Role.BRANCH_OWNER),
  validateBody(
    z.object({
      branchId: z.number().int(),
      supplierId: z.number().int(),
      reference: z.string().trim().min(1).max(64).optional(),
      notes: z.string().optional(),
      items: z
        .array(
          z.object({
            productId: z.string().uuid(),
            quantity: z.number().int().positive(),
            unitCost: z.coerce.number().positive(),
            bikeUnits: z
              .array(
                z.object({
                  chassisNumber: z.string().trim().min(1),
                  engineNumber: z.string().trim().min(1).optional(),
                  motorNumber: z.string().trim().min(1).optional(),
                  color: z.string().trim().min(1).optional(),
                  isUsed: z.boolean().optional(),
                  purchasePrice: z.number().positive().optional(),
                  meterReading: z.number().int().nonnegative().optional(),
                  condition: z.string().optional(),
                  comments: z.string().optional(),
                }),
              )
              .optional(),
          }),
        )
        .min(1),
    }),
  ),
  asyncHandler(async (req, res) => {
    if (req.user!.role === Role.BRANCH_OWNER && req.user!.branchId !== req.body.branchId) {
      res.status(403).json({ error: 'Cross-branch access denied' });
      return;
    }
    const result = await suppliersService.createPurchaseInvoice({
      ...req.body,
      createdById: req.user!.userId,
    });
    res.status(201).json(result);
  }),
);

purchasesRouter.get(
  '/',
  requireRoles(Role.ADMIN, Role.BRANCH_OWNER),
  asyncHandler(async (req, res) => {
    const branchId =
      req.user!.role === Role.BRANCH_OWNER
        ? req.user!.branchId ?? undefined
        : req.query.branchId
          ? parseInt(req.query.branchId as string, 10)
          : undefined;
    const result = await suppliersService.listPurchases(branchId, {
      page: req.query.page as string,
      limit: req.query.limit as string,
    });
    res.json(result);
  })
);

purchasesRouter.get(
  '/:id/invoice',
  requireRoles(Role.ADMIN, Role.BRANCH_OWNER),
  asyncHandler(async (req, res) => {
    const branchId = req.user!.role === Role.BRANCH_OWNER ? req.user!.branchId ?? undefined : undefined;
    const invoice = await suppliersService.getPurchaseInvoice(
      parseInt(param(req.params.id), 10),
      branchId,
    );
    res.json(invoice);
  }),
);

purchasesRouter.get(
  '/:id',
  requireRoles(Role.ADMIN, Role.BRANCH_OWNER),
  asyncHandler(async (req, res) => {
    const branchId = req.user!.role === Role.BRANCH_OWNER ? req.user!.branchId ?? undefined : undefined;
    const purchase = await suppliersService.getPurchase(parseInt(param(req.params.id), 10), branchId);
    res.json(purchase);
  })
);

purchasesRouter.post(
  '/',
  requireRoles(Role.ADMIN, Role.BRANCH_OWNER),
  validateBody(
    z.object({
      branchId: z.number().int(),
      supplierId: z.number().int(),
      invoiceNumber: z.string().optional(),
      documentRef: z.string().optional(),
      notes: z.string().optional(),
      items: z
        .array(
          z.object({
            partId: z.number().int().optional(),
            productId: z.string().uuid().optional(),
            quantity: z.number().int().positive(),
            unitCost: z.number().nonnegative(),
            engineNumber: z.string().optional(),
            chassisNumber: z.string().optional(),
          })
        )
        .min(1),
    })
  ),
  asyncHandler(async (req, res) => {
    if (req.user!.role === Role.BRANCH_OWNER && req.user!.branchId !== req.body.branchId) {
      res.status(403).json({ error: 'Cross-branch access denied' });
      return;
    }
    const purchase = await suppliersService.createPurchase(req.body);
    res.status(201).json(purchase);
  })
);
