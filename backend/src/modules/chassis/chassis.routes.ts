import { Router } from 'express';
import { ChassisStatus, Role } from '@prisma/client';
import { z } from 'zod';
import { asyncHandler, param, validateBody } from '../../utils/helpers.js';
import { authenticate, branchScope, requireRoles } from '../../middleware/auth.js';
import * as chassisService from './chassis.service.js';
import * as bikeDocumentsService from './bike-documents.service.js';

export const chassisRouter = Router();

chassisRouter.use(authenticate, requireRoles(Role.ADMIN, Role.BRANCH_OWNER), branchScope);

chassisRouter.get(
  '/admin/bike-documents',
  requireRoles(Role.ADMIN),
  asyncHandler(async (req, res) => {
    const branchId = req.query.branchId ? parseInt(req.query.branchId as string, 10) : undefined;
    const rows = await bikeDocumentsService.listBikeDocuments(branchId, {
      search: req.query.search as string,
      status: req.query.status as 'PENDING_SUPPLIER' | 'PENDING_CUSTOMER' | 'ALL',
    });
    res.json(rows);
  }),
);

chassisRouter.get(
  '/:branchId/bike-documents',
  asyncHandler(async (req, res) => {
    const branchId = parseInt(param(req.params.branchId), 10);
    if (req.user!.role === Role.BRANCH_OWNER && req.user!.branchId !== branchId) {
      res.status(403).json({ error: 'Cross-branch access denied' });
      return;
    }
    const rows = await bikeDocumentsService.listBikeDocuments(branchId, {
      search: req.query.search as string,
      status: req.query.status as 'PENDING_SUPPLIER' | 'PENDING_CUSTOMER' | 'ALL',
    });
    res.json(rows);
  }),
);

chassisRouter.get(
  '/:branchId/bike-documents/:chassisId',
  asyncHandler(async (req, res) => {
    const branchId = parseInt(param(req.params.branchId), 10);
    if (req.user!.role === Role.BRANCH_OWNER && req.user!.branchId !== branchId) {
      res.status(403).json({ error: 'Cross-branch access denied' });
      return;
    }
    const chassis = await bikeDocumentsService.getBikeDocumentChecklist(parseInt(param(req.params.chassisId), 10));
    if (chassis.branchId !== branchId) {
      res.status(403).json({ error: 'Cross-branch access denied' });
      return;
    }
    res.json(chassis);
  }),
);

chassisRouter.patch(
  '/:branchId/bike-documents/:chassisId/:documentId',
  validateBody(
    z.object({
      receivedFromSupplier: z.boolean().optional(),
      receivedNotes: z.string().optional(),
      givenToCustomer: z.boolean().optional(),
      givenNotes: z.string().optional(),
    })
  ),
  asyncHandler(async (req, res) => {
    const branchId = parseInt(param(req.params.branchId), 10);
    if (req.user!.role === Role.BRANCH_OWNER && req.user!.branchId !== branchId) {
      res.status(403).json({ error: 'Cross-branch access denied' });
      return;
    }
    const updated = await bikeDocumentsService.updateBikeDocument(
      parseInt(param(req.params.documentId), 10),
      req.body,
      req.user!.userId,
    );
    res.json(updated);
  }),
);

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
      statusParam === 'IN_STOCK' || statusParam === 'RESERVED' || statusParam === 'SOLD'
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
      chassisNumbers: z.array(z.string().trim().min(1)).optional(),
      bikeUnits: z
        .array(
          z.object({
            chassisNumber: z.string().trim().min(1),
            engineNumber: z.string().trim().min(1).optional(),
            motorNumber: z.string().trim().min(1).optional(),
            color: z.string().trim().min(1).optional(),
          }),
        )
        .optional(),
    }),
  ),
  asyncHandler(async (req, res) => {
    const branchId = parseInt(param(req.params.branchId), 10);
    if (req.user!.role === Role.BRANCH_OWNER && req.user!.branchId !== branchId) {
      res.status(403).json({ error: 'Cross-branch access denied' });
      return;
    }

    if (req.body.bikeUnits?.length) {
      chassisService.assertNoDuplicateBikeUnitsInList(req.body.bikeUnits);
      const conflicts = await chassisService.findExistingBikeUnitNumbers(req.body.bikeUnits);
      if (conflicts.length > 0) {
        res.status(409).json({
          error: `Chassis/engine/motor number(s) already exist: ${conflicts.join(', ')}`,
          conflicts,
        });
        return;
      }
      res.json({ valid: true });
      return;
    }

    const chassisNumbers = req.body.chassisNumbers ?? [];
    chassisService.assertNoDuplicateChassisInList(chassisNumbers);
    const conflicts = await chassisService.findExistingChassisNumbers(chassisNumbers);
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
