import { Router } from 'express';
import { BookingStatus, Role } from '@prisma/client';
import { z } from 'zod';
import { asyncHandler, param, validateBody } from '../../utils/helpers.js';
import { authenticate, requireRoles } from '../../middleware/auth.js';
import * as servicesService from './services.service.js';

export const servicesRouter = Router();

servicesRouter.get(
  '/public/:branchId',
  asyncHandler(async (req, res) => {
    const services = await servicesService.listServices(parseInt(param(req.params.branchId), 10));
    res.json(services);
  })
);

servicesRouter.use(authenticate);

servicesRouter.get(
  '/:branchId',
  requireRoles(Role.ADMIN, Role.BRANCH_OWNER),
  asyncHandler(async (req, res) => {
    const branchId = parseInt(param(req.params.branchId), 10);
    if (req.user!.role === Role.BRANCH_OWNER && req.user!.branchId !== branchId) {
      res.status(403).json({ error: 'Cross-branch access denied' });
      return;
    }
    const services = await servicesService.listServices(branchId);
    res.json(services);
  })
);

servicesRouter.post(
  '/:branchId',
  requireRoles(Role.ADMIN, Role.BRANCH_OWNER),
  validateBody(
    z.object({
      categoryId: z.number().int().optional(),
      name: z.string().min(1),
      description: z.string().optional(),
      basePrice: z.number().nonnegative(),
      duration: z.number().int().positive(),
      checklist: z.record(z.unknown()).optional(),
    })
  ),
  asyncHandler(async (req, res) => {
    const branchId = parseInt(param(req.params.branchId), 10);
    if (req.user!.role === Role.BRANCH_OWNER && req.user!.branchId !== branchId) {
      res.status(403).json({ error: 'Cross-branch access denied' });
      return;
    }
    const service = await servicesService.createService({ branchId, ...req.body });
    res.status(201).json(service);
  })
);

servicesRouter.patch(
  '/:branchId/:id',
  requireRoles(Role.ADMIN, Role.BRANCH_OWNER),
  validateBody(z.record(z.unknown())),
  asyncHandler(async (req, res) => {
    const branchId = parseInt(param(req.params.branchId), 10);
    if (req.user!.role === Role.BRANCH_OWNER && req.user!.branchId !== branchId) {
      res.status(403).json({ error: 'Cross-branch access denied' });
      return;
    }
    const service = await servicesService.updateService(parseInt(param(req.params.id), 10), branchId, req.body);
    res.json(service);
  })
);

servicesRouter.get(
  '/:branchId/categories',
  requireRoles(Role.ADMIN, Role.BRANCH_OWNER),
  asyncHandler(async (req, res) => {
    const branchId = parseInt(param(req.params.branchId), 10);
    const categories = await servicesService.listServiceCategories(branchId);
    res.json(categories);
  })
);

servicesRouter.post(
  '/:branchId/categories',
  requireRoles(Role.ADMIN, Role.BRANCH_OWNER),
  validateBody(z.object({ name: z.string().min(1) })),
  asyncHandler(async (req, res) => {
    const branchId = parseInt(param(req.params.branchId), 10);
    const category = await servicesService.createServiceCategory(branchId, req.body.name);
    res.status(201).json(category);
  })
);

export const bookingsRouter = Router();
bookingsRouter.use(authenticate);

bookingsRouter.get(
  '/',
  requireRoles(Role.ADMIN, Role.BRANCH_OWNER, Role.CUSTOMER),
  asyncHandler(async (req, res) => {
    const branchId =
      req.user!.role === Role.BRANCH_OWNER
        ? req.user!.branchId ?? undefined
        : req.query.branchId
          ? parseInt(req.query.branchId as string, 10)
          : undefined;
    const userId = req.user!.role === Role.CUSTOMER ? req.user!.userId : undefined;

    const result = await servicesService.listBookings({
      branchId,
      userId,
      status: req.query.status as BookingStatus | undefined,
      date: req.query.date as string,
      page: req.query.page as string,
      limit: req.query.limit as string,
    });
    res.json(result);
  })
);

bookingsRouter.get(
  '/today/:branchId',
  requireRoles(Role.ADMIN, Role.BRANCH_OWNER),
  asyncHandler(async (req, res) => {
    const branchId = parseInt(param(req.params.branchId), 10);
    if (req.user!.role === Role.BRANCH_OWNER && req.user!.branchId !== branchId) {
      res.status(403).json({ error: 'Cross-branch access denied' });
      return;
    }
    const bookings = await servicesService.getTodayBookings(branchId);
    res.json(bookings);
  })
);

bookingsRouter.post(
  '/',
  requireRoles(Role.CUSTOMER, Role.BRANCH_OWNER, Role.ADMIN),
  validateBody(
    z.object({
      branchId: z.number().int(),
      notes: z.string().optional(),
      customerName: z.string().optional(),
      customerPhone: z.string().optional(),
    })
  ),
  asyncHandler(async (req, res) => {
    const userId = req.user!.role === Role.CUSTOMER ? req.user!.userId : undefined;
    const booking = await servicesService.createBooking({ ...req.body, userId });
    res.status(201).json(booking);
  })
);

bookingsRouter.patch(
  '/:id/status',
  requireRoles(Role.BRANCH_OWNER),
  validateBody(
    z.object({
      branchId: z.number().int(),
      status: z.nativeEnum(BookingStatus),
      confirmedTime: z.string().optional(),
      date: z.string().optional(),
      serviceId: z.number().int().optional(),
      parts: z.array(z.object({ partId: z.number().int(), quantity: z.number().int().positive() })).optional(),
    })
  ),
  asyncHandler(async (req, res) => {
    const branchId = req.user!.branchId;
    if (!branchId || branchId !== req.body.branchId) {
      res.status(403).json({ error: 'Cross-branch access denied' });
      return;
    }
    const booking = await servicesService.updateBookingStatus(
      parseInt(param(req.params.id), 10),
      req.body.branchId,
      req.body.status,
      req.body.parts,
      req.body.confirmedTime,
      req.body.date,
      req.body.serviceId
    );
    res.json(booking);
  })
);

bookingsRouter.delete(
  '/:id',
  requireRoles(Role.ADMIN, Role.BRANCH_OWNER),
  asyncHandler(async (req, res) => {
    const id = parseInt(param(req.params.id), 10);
    const branchId =
      req.user!.role === Role.BRANCH_OWNER
        ? req.user!.branchId!
        : parseInt(req.query.branchId as string, 10);
    if (!branchId || Number.isNaN(branchId)) {
      res.status(400).json({ error: 'branchId is required' });
      return;
    }
    if (req.user!.role === Role.BRANCH_OWNER && req.user!.branchId !== branchId) {
      res.status(403).json({ error: 'Cross-branch access denied' });
      return;
    }
    await servicesService.deleteBooking(id, branchId);
    res.status(204).send();
  })
);

bookingsRouter.get(
  '/:id/receipt',
  requireRoles(Role.ADMIN, Role.BRANCH_OWNER, Role.CUSTOMER),
  asyncHandler(async (req, res) => {
    const branchId = req.user!.role === Role.BRANCH_OWNER ? req.user!.branchId ?? undefined : undefined;
    const receipt = await servicesService.getBookingReceipt(parseInt(param(req.params.id), 10), branchId);
    res.json(receipt);
  })
);

servicesRouter.delete(
  '/:branchId/:id',
  requireRoles(Role.ADMIN, Role.BRANCH_OWNER),
  asyncHandler(async (req, res) => {
    const branchId = parseInt(param(req.params.branchId), 10);
    if (req.user!.role === Role.BRANCH_OWNER && req.user!.branchId !== branchId) {
      res.status(403).json({ error: 'Cross-branch access denied' });
      return;
    }
    await servicesService.deactivateService(parseInt(param(req.params.id), 10), branchId);
    res.status(204).send();
  })
);
