import { Router } from 'express';
import { OrderStatus, OrderType, PaymentMethod, Role } from '@prisma/client';
import { z } from 'zod';
import { asyncHandler, param, validateBody } from '../../utils/helpers.js';
import { authenticate, branchScope, requireRoles } from '../../middleware/auth.js';
import * as ordersService from './orders.service.js';

export const ordersRouter = Router();

const orderItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().positive(),
  color: z.string().optional(),
});

ordersRouter.get(
  '/track/:trackingId',
  asyncHandler(async (req, res) => {
    const order = await ordersService.trackOrder(param(req.params.trackingId));
    res.json(order);
  })
);

ordersRouter.use(authenticate);

ordersRouter.get(
  '/pending-payments',
  requireRoles(Role.ADMIN, Role.BRANCH_OWNER),
  asyncHandler(async (req, res) => {
    const branchId =
      req.user!.role === Role.BRANCH_OWNER
        ? req.user!.branchId ?? undefined
        : req.query.branchId
          ? parseInt(req.query.branchId as string, 10)
          : undefined;
    const orders = await ordersService.listPendingBankTransfers(branchId);
    res.json(orders);
  })
);

ordersRouter.get(
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

    const result = await ordersService.listOrders({
      page: req.query.page as string,
      limit: req.query.limit as string,
      branchId,
      status: req.query.status as OrderStatus | undefined,
      type: req.query.type as OrderType | undefined,
      userId,
      paymentStatus: req.query.paymentStatus as import('@prisma/client').PaymentStatus | undefined,
      paymentMethod: req.query.paymentMethod as PaymentMethod | undefined,
    });
    res.json(result);
  })
);

ordersRouter.get(
  '/:id/invoice',
  requireRoles(Role.ADMIN, Role.BRANCH_OWNER, Role.CUSTOMER),
  asyncHandler(async (req, res) => {
    const branchId = req.user!.role === Role.BRANCH_OWNER ? req.user!.branchId ?? undefined : undefined;
    const order = await ordersService.getOrder(parseInt(param(req.params.id), 10), branchId);
    if (req.user!.role === Role.CUSTOMER && order.userId !== req.user!.userId) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }
    const invoice = await ordersService.getOrderInvoice(parseInt(param(req.params.id), 10), branchId);
    res.json(invoice);
  })
);

ordersRouter.get(
  '/:id',
  requireRoles(Role.ADMIN, Role.BRANCH_OWNER, Role.CUSTOMER),
  asyncHandler(async (req, res) => {
    const branchId = req.user!.role === Role.BRANCH_OWNER ? req.user!.branchId ?? undefined : undefined;
    const order = await ordersService.getOrder(parseInt(param(req.params.id), 10), branchId);
    if (req.user!.role === Role.CUSTOMER && order.userId !== req.user!.userId) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }
    res.json(order);
  })
);

ordersRouter.post(
  '/online',
  requireRoles(Role.CUSTOMER),
  validateBody(
    z.object({
      branchId: z.number().int(),
      paymentMethod: z.nativeEnum(PaymentMethod),
      items: z.array(orderItemSchema).min(1),
      notes: z.string().optional(),
      bankTransferScreenshot: z.string().optional(),
    })
  ),
  asyncHandler(async (req, res) => {
    const order = await ordersService.createOnlineOrder({
      userId: req.user!.userId,
      ...req.body,
    });
    res.status(201).json(order);
  })
);

ordersRouter.post(
  '/pos',
  requireRoles(Role.BRANCH_OWNER, Role.ADMIN),
  validateBody(
    z.object({
      branchId: z.number().int(),
      paymentMethod: z.nativeEnum(PaymentMethod),
      walkInCustomerId: z.number().int().optional(),
      items: z.array(orderItemSchema).min(1),
      notes: z.string().optional(),
      isPaid: z.boolean().optional(),
    })
  ),
  asyncHandler(async (req, res) => {
    if (req.user!.role === Role.BRANCH_OWNER && req.user!.branchId !== req.body.branchId) {
      res.status(403).json({ error: 'Cross-branch access denied' });
      return;
    }
    const order = await ordersService.createPosOrder(req.body);
    res.status(201).json(order);
  })
);

ordersRouter.patch(
  '/:id/status',
  requireRoles(Role.ADMIN, Role.BRANCH_OWNER),
  validateBody(z.object({ status: z.nativeEnum(OrderStatus) })),
  asyncHandler(async (req, res) => {
    const branchId = req.user!.role === Role.BRANCH_OWNER ? req.user!.branchId ?? undefined : undefined;
    const order = await ordersService.updateOrderStatus(
      parseInt(param(req.params.id), 10),
      req.body.status,
      branchId
    );
    res.json(order);
  })
);

ordersRouter.patch(
  '/:id/payment',
  requireRoles(Role.ADMIN, Role.BRANCH_OWNER),
  validateBody(z.object({ approved: z.boolean() })),
  asyncHandler(async (req, res) => {
    const branchId = req.user!.role === Role.BRANCH_OWNER ? req.user!.branchId ?? undefined : undefined;
    const order = await ordersService.approvePayment(
      parseInt(param(req.params.id), 10),
      req.body.approved,
      branchId
    );
    res.json(order);
  })
);

export const walkInRouter = Router();
walkInRouter.use(authenticate, requireRoles(Role.ADMIN, Role.BRANCH_OWNER), branchScope);

walkInRouter.get(
  '/:branchId/customers',
  asyncHandler(async (req, res) => {
    const branchId = parseInt(param(req.params.branchId), 10);
    if (req.user!.role === Role.BRANCH_OWNER && req.user!.branchId !== branchId) {
      res.status(403).json({ error: 'Cross-branch access denied' });
      return;
    }
    const result = await ordersService.listWalkInCustomers(branchId, {
      page: req.query.page as string,
      limit: req.query.limit as string,
    });
    res.json(result);
  })
);

walkInRouter.get(
  '/:branchId/customers/:id',
  asyncHandler(async (req, res) => {
    const branchId = parseInt(param(req.params.branchId), 10);
    const customer = await ordersService.getWalkInCustomer(parseInt(param(req.params.id), 10), branchId);
    res.json(customer);
  })
);

walkInRouter.patch(
  '/:branchId/customers/:id',
  validateBody(
    z.object({
      name: z.string().optional(),
      phone: z.string().optional(),
      email: z.string().email().optional(),
      address: z.string().optional(),
    })
  ),
  asyncHandler(async (req, res) => {
    const branchId = parseInt(param(req.params.branchId), 10);
    const customer = await ordersService.updateWalkInCustomer(
      parseInt(param(req.params.id), 10),
      branchId,
      req.body
    );
    res.json(customer);
  })
);

walkInRouter.delete(
  '/:branchId/customers/:id',
  asyncHandler(async (req, res) => {
    const branchId = parseInt(param(req.params.branchId), 10);
    const customer = await ordersService.softDeleteWalkInCustomer(
      parseInt(param(req.params.id), 10),
      branchId,
    );
    res.json(customer);
  })
);

walkInRouter.get(
  '/:branchId/customers/:id/ledger',
  asyncHandler(async (req, res) => {
    const branchId = parseInt(param(req.params.branchId), 10);
    const ledger = await ordersService.getWalkInLedger(parseInt(param(req.params.id), 10), branchId);
    res.json(ledger);
  })
);

walkInRouter.post(
  '/:branchId/customers/:id/payment',
  validateBody(z.object({ amount: z.number().positive(), notes: z.string().optional() })),
  asyncHandler(async (req, res) => {
    const branchId = parseInt(param(req.params.branchId), 10);
    const entry = await ordersService.recordWalkInPayment({
      walkInCustomerId: parseInt(param(req.params.id), 10),
      branchId,
      amount: req.body.amount,
      notes: req.body.notes,
    });
    res.status(201).json(entry);
  })
);

walkInRouter.post(
  '/:branchId/customers',
  validateBody(
    z.object({
      name: z.string().min(1),
      cnic: z.string().min(13).max(15),
      phone: z.string().optional(),
      email: z.string().email().optional(),
      address: z.string().optional(),
    })
  ),
  asyncHandler(async (req, res) => {
    const branchId = parseInt(param(req.params.branchId), 10);
    if (req.user!.role === Role.BRANCH_OWNER && req.user!.branchId !== branchId) {
      res.status(403).json({ error: 'Cross-branch access denied' });
      return;
    }
    const customer = await ordersService.createWalkInCustomer({ branchId, ...req.body });
    res.status(201).json(customer);
  })
);
