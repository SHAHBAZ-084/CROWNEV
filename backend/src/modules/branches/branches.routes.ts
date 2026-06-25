import { Router } from 'express';
import { PaymentChannelType, Role } from '@prisma/client';
import { z } from 'zod';
import { asyncHandler, param, validateBody } from '../../utils/helpers.js';
import { authenticate, branchScope, requireBranchDeletePermission, requireBranchUpdatePermission, requireRoles } from '../../middleware/auth.js';
import { productImageUpload } from '../../middleware/upload.js';
import { branchImagePublicUrl, saveBranchImageAsWebp } from '../../utils/imageProcessing.js';
import * as branchesService from './branches.service.js';
import * as paymentChannelsService from './payment-channels.service.js';

export const branchesRouter = Router();

branchesRouter.get(
  '/public',
  asyncHandler(async (_req, res) => {
    const branches = await branchesService.listBranches(true);
    res.json(branches);
  })
);

branchesRouter.get(
  '/public/:branchId/payment-channels',
  asyncHandler(async (req, res) => {
    const branchId = parseInt(param(req.params.branchId), 10);
    const channels = await paymentChannelsService.listPublicPaymentChannels(branchId);
    res.json(channels);
  })
);

branchesRouter.use(authenticate);

branchesRouter.post(
  '/upload-image',
  requireRoles(Role.ADMIN),
  productImageUpload.single('image'),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      res.status(400).json({ error: 'No image uploaded' });
      return;
    }
    const filename = await saveBranchImageAsWebp(req.file.buffer);
    res.json({ url: branchImagePublicUrl(filename) });
  }),
);

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
  '/:id/pos-stats',
  requireRoles(Role.ADMIN, Role.BRANCH_OWNER),
  branchScope,
  asyncHandler(async (req, res) => {
    const id = parseInt(param(req.params.id), 10);
    if (req.user!.role === Role.BRANCH_OWNER && req.user!.branchId !== id) {
      res.status(403).json({ error: 'Cross-branch access denied' });
      return;
    }
    const stats = await branchesService.getPosWorkspaceStats(id);
    res.json(stats);
  }),
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
      imageUrl: z
        .union([z.string().startsWith('/uploads/branches/'), z.string().url()])
        .optional(),
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
      imageUrl: z
        .union([z.string().startsWith('/uploads/branches/'), z.string().url()])
        .nullable()
        .optional(),
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

branchesRouter.get(
  '/:id/clear-preview',
  requireRoles(Role.ADMIN),
  asyncHandler(async (req, res) => {
    const preview = await branchesService.getBranchClearPreview(parseInt(param(req.params.id), 10));
    res.json(preview);
  })
);

branchesRouter.post(
  '/:id/clear-data',
  requireRoles(Role.ADMIN),
  validateBody(z.object({ confirmName: z.string().min(1) })),
  asyncHandler(async (req, res) => {
    const result = await branchesService.clearBranchData(
      parseInt(param(req.params.id), 10),
      req.body.confirmName,
    );
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

const paymentChannelBody = z.object({
  type: z.nativeEnum(PaymentChannelType),
  name: z.string().min(1),
  accountTitle: z.string().optional(),
  accountNumber: z.string().min(1),
});

branchesRouter.get(
  '/:branchId/payment-channels',
  requireRoles(Role.ADMIN, Role.BRANCH_OWNER),
  asyncHandler(async (req, res) => {
    const branchId = parseInt(param(req.params.branchId), 10);
    if (req.user!.role === Role.BRANCH_OWNER && req.user!.branchId !== branchId) {
      res.status(403).json({ error: 'Cross-branch access denied' });
      return;
    }
    const channels = await paymentChannelsService.listPaymentChannels(branchId);
    res.json(channels);
  })
);

branchesRouter.post(
  '/:branchId/payment-channels',
  requireRoles(Role.ADMIN, Role.BRANCH_OWNER),
  validateBody(paymentChannelBody),
  asyncHandler(async (req, res) => {
    const branchId = parseInt(param(req.params.branchId), 10);
    if (req.user!.role === Role.BRANCH_OWNER && req.user!.branchId !== branchId) {
      res.status(403).json({ error: 'Cross-branch access denied' });
      return;
    }
    const channel = await paymentChannelsService.createPaymentChannel(branchId, req.body);
    res.status(201).json(channel);
  })
);

branchesRouter.patch(
  '/:branchId/payment-channels/:channelId',
  requireRoles(Role.ADMIN, Role.BRANCH_OWNER),
  requireBranchUpdatePermission,
  validateBody(
    paymentChannelBody.partial().extend({ isActive: z.boolean().optional() })
  ),
  asyncHandler(async (req, res) => {
    const branchId = parseInt(param(req.params.branchId), 10);
    if (req.user!.role === Role.BRANCH_OWNER && req.user!.branchId !== branchId) {
      res.status(403).json({ error: 'Cross-branch access denied' });
      return;
    }
    const channel = await paymentChannelsService.updatePaymentChannel(
      branchId,
      parseInt(param(req.params.channelId), 10),
      req.body
    );
    res.json(channel);
  })
);

branchesRouter.delete(
  '/:branchId/payment-channels/:channelId',
  requireRoles(Role.ADMIN, Role.BRANCH_OWNER),
  requireBranchDeletePermission,
  asyncHandler(async (req, res) => {
    const branchId = parseInt(param(req.params.branchId), 10);
    if (req.user!.role === Role.BRANCH_OWNER && req.user!.branchId !== branchId) {
      res.status(403).json({ error: 'Cross-branch access denied' });
      return;
    }
    await paymentChannelsService.deletePaymentChannel(
      branchId,
      parseInt(param(req.params.channelId), 10)
    );
    res.status(204).send();
  })
);
