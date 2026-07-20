import { Router } from 'express';
import { Role } from '@prisma/client';
import { z } from 'zod';
import { asyncHandler, param, validateBody } from '../../utils/helpers.js';
import { authenticate, requireRoles } from '../../middleware/auth.js';
import * as serviceInvoicesService from './service-invoices.service.js';

export const serviceInvoicesRouter = Router();

serviceInvoicesRouter.use(authenticate);

serviceInvoicesRouter.post(
  '/invoice',
  requireRoles(Role.ADMIN, Role.BRANCH_OWNER),
  validateBody(
    z.object({
      branchId: z.number().int(),
      customerId: z.number().int(),
      reference: z.string().trim().min(1).max(64).optional(),
      labourCost: z.coerce.number().min(0),
      notes: z.string().optional(),
      invoiceDate: z.string().optional(),
      items: z
        .array(
          z.object({
            productId: z.string().uuid(),
            quantity: z.number().int().positive(),
            unitPrice: z.coerce.number().positive().optional(),
          }),
        )
        .default([]),
    }),
  ),
  asyncHandler(async (req, res) => {
    if (req.user!.role === Role.BRANCH_OWNER && req.user!.branchId !== req.body.branchId) {
      res.status(403).json({ error: 'Cross-branch access denied' });
      return;
    }
    const result = await serviceInvoicesService.createServiceInvoice({
      ...req.body,
      createdById: req.user!.userId,
    });
    res.status(201).json(result);
  }),
);

serviceInvoicesRouter.get(
  '/',
  requireRoles(Role.ADMIN, Role.BRANCH_OWNER),
  asyncHandler(async (req, res) => {
    const branchId =
      req.user!.role === Role.BRANCH_OWNER
        ? req.user!.branchId ?? undefined
        : req.query.branchId
          ? parseInt(req.query.branchId as string, 10)
          : undefined;
    if (!branchId) {
      res.status(400).json({ error: 'branchId is required' });
      return;
    }
    if (req.user!.role === Role.BRANCH_OWNER && req.user!.branchId !== branchId) {
      res.status(403).json({ error: 'Cross-branch access denied' });
      return;
    }
    const result = await serviceInvoicesService.listServiceInvoices(branchId, {
      page: req.query.page as string,
      limit: req.query.limit as string,
      search: req.query.search as string,
    });
    res.json(result);
  }),
);

serviceInvoicesRouter.get(
  '/:id/invoice',
  requireRoles(Role.ADMIN, Role.BRANCH_OWNER),
  asyncHandler(async (req, res) => {
    const branchId = req.user!.role === Role.BRANCH_OWNER ? req.user!.branchId ?? undefined : undefined;
    const invoice = await serviceInvoicesService.getServiceInvoiceFormatted(
      parseInt(param(req.params.id), 10),
      branchId,
    );
    res.json(invoice);
  }),
);

serviceInvoicesRouter.delete(
  '/:id',
  requireRoles(Role.ADMIN, Role.BRANCH_OWNER),
  asyncHandler(async (req, res) => {
    const branchId = req.user!.role === Role.BRANCH_OWNER ? req.user!.branchId ?? undefined : undefined;
    await serviceInvoicesService.deleteServiceInvoice(
      parseInt(param(req.params.id), 10),
      branchId,
      req.user!.userId,
    );
    res.status(204).send();
  }),
);
