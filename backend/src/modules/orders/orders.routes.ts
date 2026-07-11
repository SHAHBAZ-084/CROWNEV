import { Router } from 'express';
import { OrderStatus, OrderType, PaymentMethod, PaymentStatus, Role, ShippingMethod } from '@prisma/client';
import { z } from 'zod';
import { asyncHandler, param, validateBody, AppError } from '../../utils/helpers.js';
import { authenticate, branchScope, requireBranchDeletePermission, requireBranchUpdatePermission, requireRoles } from '../../middleware/auth.js';
import { paymentScreenshotUpload } from '../../middleware/upload.js';
import * as ordersService from './orders.service.js';

export const ordersRouter = Router();

const orderItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().positive(),
  color: z.string().optional(),
  chassisNumber: z.string().optional(),
});

const saleInvoiceItemSchema = orderItemSchema.extend({
  unitPrice: z.optional(z.coerce.number().positive()),
  bikeChassisNumberId: z.number().int().positive().optional(),
});

ordersRouter.get(
  '/track/:publicId',
  asyncHandler(async (req, res) => {
    const order = await ordersService.trackOrder(param(req.params.publicId));
    res.json(order);
  })
);

ordersRouter.use(authenticate);

ordersRouter.post(
  '/upload-screenshot',
  requireRoles(Role.CUSTOMER),
  paymentScreenshotUpload.single('screenshot'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new AppError(400, 'No file uploaded');
    const url = `/uploads/payments/${req.file.filename}`;
    res.json({ url });
  }),
);

ordersRouter.get(
  '/part-orders',
  requireRoles(Role.ADMIN, Role.BRANCH_OWNER),
  asyncHandler(async (req, res) => {
    const branchId =
      req.user!.role === Role.BRANCH_OWNER
        ? req.user!.branchId ?? undefined
        : req.query.branchId
          ? parseInt(req.query.branchId as string, 10)
          : undefined;
    if (req.user!.role === Role.BRANCH_OWNER && !branchId) {
      res.status(403).json({ error: 'Branch not assigned' });
      return;
    }
    const orders = await ordersService.listPartOrders(branchId);
    res.json(orders);
  }),
);

ordersRouter.get(
  '/pending-payments',
  requireRoles(Role.BRANCH_OWNER),
  asyncHandler(async (req, res) => {
    const branchId = req.user!.branchId;
    if (!branchId) {
      res.status(403).json({ error: 'Branch not assigned' });
      return;
    }
    const orders = await ordersService.listPendingBankTransfers(branchId);
    res.json(orders);
  }),
);

ordersRouter.get(
  '/',
  requireRoles(Role.ADMIN, Role.BRANCH_OWNER, Role.CUSTOMER),
  asyncHandler(async (req, res) => {
    let branchId: number | undefined;
    if (req.user!.role === Role.BRANCH_OWNER) {
      branchId = req.user!.branchId ?? undefined;
      if (!branchId) {
        res.status(403).json({ error: 'Branch not assigned' });
        return;
      }
    } else if (req.query.branchId) {
      branchId = parseInt(req.query.branchId as string, 10);
    }
    const userId = req.user!.role === Role.CUSTOMER ? req.user!.userId : undefined;

    const result = await ordersService.listOrders({
      page: req.query.page as string,
      limit: req.query.limit as string,
      branchId,
      status: req.query.status as OrderStatus | undefined,
      type: req.query.type as OrderType | undefined,
      userId,
      paymentStatus: req.query.paymentStatus as PaymentStatus | undefined,
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
    const userId = req.user!.role === Role.CUSTOMER ? req.user!.userId : undefined;
    const invoice = await ordersService.getOrderInvoice(
      parseInt(param(req.params.id), 10),
      userId,
      branchId,
    );
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
      shippingMethod: z.nativeEnum(ShippingMethod),
      items: z.array(orderItemSchema).min(1),
      notes: z.string().optional(),
      bankTransferScreenshot: z.string().optional(),
      paymentTransactionId: z.string().optional(),
      customerName: z.string().optional(),
      customerPhone: z.string().optional(),
      customerWhatsapp: z.string().optional(),
      customerAddress: z.string().optional(),
    }),
  ),
  asyncHandler(async (req, res) => {
    const order = await ordersService.createOnlineOrder({
      userId: req.user!.userId,
      paymentMethod: PaymentMethod.BANK_TRANSFER,
      ...req.body,
    });
    res.status(201).json(order);
  })
);

ordersRouter.patch(
  '/:id/submit-payment',
  requireRoles(Role.CUSTOMER),
  validateBody(
    z.object({
      paymentTransactionId: z.string().min(1, 'Please enter your transaction ID'),
      bankTransferScreenshot: z.string().min(1, 'Please upload your payment screenshot'),
    }),
  ),
  asyncHandler(async (req, res) => {
    const order = await ordersService.submitOrderPayment(
      parseInt(param(req.params.id), 10),
      req.user!.userId,
      req.body,
    );
    res.json(order);
  }),
);

ordersRouter.post(
  '/pos',
  requireRoles(Role.BRANCH_OWNER, Role.ADMIN),
  validateBody(
    z.object({
      branchId: z.number().int(),
      paymentMethod: z.nativeEnum(PaymentMethod),
      walkInCustomerId: z.number().int().optional(),
      customerId: z.number().int().optional(),
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
    const order = await ordersService.createPosOrder({
      ...req.body,
      customerId: req.body.customerId ?? req.body.walkInCustomerId,
    });
    res.status(201).json(order);
  })
);

ordersRouter.post(
  '/sale-invoice',
  requireRoles(Role.BRANCH_OWNER, Role.ADMIN),
  validateBody(
    z.object({
      branchId: z.number().int(),
      customerId: z.number().int(),
      items: z.array(saleInvoiceItemSchema).min(1),
      reference: z.string().trim().min(1).max(64).optional(),
      notes: z.string().optional(),
      receivedAmount: z.number().positive().optional(),
      receivedAccountId: z.number().int().optional(),
    }),
  ),
  asyncHandler(async (req, res) => {
    if (req.user!.role === Role.BRANCH_OWNER && req.user!.branchId !== req.body.branchId) {
      res.status(403).json({ error: 'Cross-branch access denied' });
      return;
    }
    const result = await ordersService.createSaleInvoice({
      ...req.body,
      createdById: req.user!.userId,
    });
    res.status(201).json(result);
  }),
);

const orderItemEditSchema = z.object({
  orderItemId: z.number().int().positive(),
  unitPrice: z.coerce.number().positive().optional(),
});

ordersRouter.patch(
  '/:id/items',
  requireRoles(Role.BRANCH_OWNER, Role.ADMIN),
  validateBody(z.object({ items: z.array(orderItemEditSchema).min(1) })),
  asyncHandler(async (req, res) => {
    const branchId = req.user!.role === Role.BRANCH_OWNER ? req.user!.branchId ?? undefined : undefined;
    const order = await ordersService.updateOrderItems(
      parseInt(param(req.params.id), 10),
      branchId,
      req.user!.userId,
      req.body,
    );
    res.json(order);
  }),
);

ordersRouter.delete(
  '/:id',
  requireRoles(Role.ADMIN, Role.BRANCH_OWNER),
  asyncHandler(async (req, res) => {
    const branchId = req.user!.role === Role.BRANCH_OWNER ? req.user!.branchId ?? undefined : undefined;
    await ordersService.deleteSaleInvoice(
      parseInt(param(req.params.id), 10),
      branchId,
      req.user!.userId,
    );
    res.status(204).send();
  }),
);

ordersRouter.patch(
  '/:id/status',
  requireRoles(Role.BRANCH_OWNER),
  requireBranchUpdatePermission,
  validateBody(z.object({ status: z.nativeEnum(OrderStatus) })),
  asyncHandler(async (req, res) => {
    const branchId = req.user!.branchId;
    if (!branchId) {
      res.status(403).json({ error: 'Branch not assigned' });
      return;
    }
    const order = await ordersService.updateOrderStatus(
      parseInt(param(req.params.id), 10),
      req.body.status,
      branchId
    );
    res.json(order);
  })
);

ordersRouter.patch(
  '/:id/bilty-charges',
  requireRoles(Role.BRANCH_OWNER),
  requireBranchUpdatePermission,
  validateBody(
    z.object({
      biltyCharges: z.number().min(0),
      shippingProvider: z.string().trim().min(1).max(80),
    }),
  ),
  asyncHandler(async (req, res) => {
    const branchId = req.user!.branchId;
    if (!branchId) {
      res.status(403).json({ error: 'Branch not assigned' });
      return;
    }
    const order = await ordersService.setBiltyCharges(
      parseInt(param(req.params.id), 10),
      req.body.biltyCharges,
      req.body.shippingProvider,
      branchId,
    );
    res.json(order);
  }),
);

ordersRouter.patch(
  '/:id/verify-payment',
  requireRoles(Role.BRANCH_OWNER),
  requireBranchUpdatePermission,
  validateBody(
    z.object({
      approved: z.boolean(),
      biltyId: z.string().optional(),
    }),
  ),
  asyncHandler(async (req, res) => {
    const branchId = req.user!.branchId;
    if (!branchId) {
      res.status(403).json({ error: 'Branch not assigned' });
      return;
    }
    const order = await ordersService.approvePayment(
      parseInt(param(req.params.id), 10),
      req.body.approved,
      branchId,
      req.body.biltyId,
    );
    res.json(order);
  }),
);

ordersRouter.patch(
  '/:id/approve-part-order',
  requireRoles(Role.ADMIN, Role.BRANCH_OWNER),
  asyncHandler(async (req, res) => {
    const branchId = req.user!.role === Role.BRANCH_OWNER ? req.user!.branchId ?? undefined : undefined;
    const order = await ordersService.approvePartOrder(
      parseInt(param(req.params.id), 10),
      branchId,
      req.user!.userId,
    );
    res.json(order);
  }),
);

ordersRouter.delete(
  '/:id/part-order',
  requireRoles(Role.ADMIN, Role.BRANCH_OWNER),
  asyncHandler(async (req, res) => {
    const branchId = req.user!.role === Role.BRANCH_OWNER ? req.user!.branchId ?? undefined : undefined;
    await ordersService.deletePartOrder(parseInt(param(req.params.id), 10), branchId);
    res.status(204).send();
  }),
);

/** @deprecated Use PATCH /:id/verify-payment */
ordersRouter.patch(
  '/:id/payment',
  requireRoles(Role.BRANCH_OWNER),
  requireBranchUpdatePermission,
  validateBody(z.object({ approved: z.boolean(), biltyId: z.string().optional() })),
  asyncHandler(async (req, res) => {
    const branchId = req.user!.branchId;
    if (!branchId) {
      res.status(403).json({ error: 'Branch not assigned' });
      return;
    }
    const order = await ordersService.approvePayment(
      parseInt(param(req.params.id), 10),
      req.body.approved,
      branchId,
      req.body.biltyId,
    );
    res.json(order);
  })
);

ordersRouter.patch(
  '/:id/bilty-tracking',
  requireRoles(Role.BRANCH_OWNER),
  requireBranchUpdatePermission,
  validateBody(z.object({ biltyId: z.string().min(1) })),
  asyncHandler(async (req, res) => {
    const branchId = req.user!.branchId;
    if (!branchId) {
      res.status(403).json({ error: 'Branch not assigned' });
      return;
    }
    const order = await ordersService.setBiltyTracking(
      parseInt(param(req.params.id), 10),
      req.body.biltyId,
      branchId,
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
      search: req.query.search as string,
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
  requireBranchUpdatePermission,
  validateBody(
    z.object({
      name: z.string().optional(),
      fatherName: z.string().optional(),
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
  requireBranchDeletePermission,
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
      customerId: parseInt(param(req.params.id), 10),
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
      fatherName: z.string().optional(),
      cnic: z
        .string()
        .min(1)
        .transform((value) => value.replace(/\D/g, ''))
        .pipe(z.string().regex(/^\d{13}$/, 'CNIC must be 13 digits')),
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
