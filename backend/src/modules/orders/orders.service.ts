import {
  OrderStatus,
  OrderType,
  PaymentMethod,
  PaymentStatus,
  ProductType,
  WalkInLedgerType,
} from '@prisma/client';
import { prisma } from '../../config/database.js';
import { AppError, getPagination, paginatedResponse } from '../../utils/helpers.js';
import { generateTrackingId } from '../../utils/crypto.js';
import { deductStock } from '../inventory/inventory.service.js';

export async function listOrders(query: {
  page?: string;
  limit?: string;
  branchId?: number;
  status?: OrderStatus;
  type?: OrderType;
  userId?: string;
  paymentStatus?: PaymentStatus;
  paymentMethod?: PaymentMethod;
}) {
  const { page, limit, skip } = getPagination(query);
  const where = {
    ...(query.branchId && { branchId: query.branchId }),
    ...(query.status && { status: query.status }),
    ...(query.type && { type: query.type }),
    ...(query.userId && { userId: query.userId }),
    ...(query.paymentStatus && { paymentStatus: query.paymentStatus }),
    ...(query.paymentMethod && { paymentMethod: query.paymentMethod }),
  };

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      skip,
      take: limit,
      include: {
        items: { include: { product: { select: { name: true, type: true } } } },
        user: { select: { firstName: true, lastName: true, email: true } },
        walkInCustomer: { select: { name: true, cnic: true } },
        branch: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.order.count({ where }),
  ]);

  return paginatedResponse(orders, total, page, limit);
}

export async function listPendingBankTransfers(branchId?: number) {
  return prisma.order.findMany({
    where: {
      ...(branchId && { branchId }),
      paymentMethod: PaymentMethod.BANK_TRANSFER,
      paymentStatus: PaymentStatus.PENDING,
    },
    include: {
      items: { include: { product: { select: { name: true } } } },
      user: { select: { firstName: true, lastName: true, email: true } },
      branch: { select: { name: true } },
    },
    orderBy: { createdAt: 'asc' },
  });
}

export async function getOrder(id: number, branchId?: number) {
  const order = await prisma.order.findFirst({
    where: { id, ...(branchId && { branchId }) },
    include: {
      items: { include: { product: true } },
      user: true,
      walkInCustomer: true,
      branch: true,
    },
  });
  if (!order) throw new AppError(404, 'Order not found');
  return order;
}

export async function getOrderInvoice(id: number, branchId?: number) {
  const order = await getOrder(id, branchId);
  return {
    invoiceType: 'SALE',
    currency: 'PKR',
    invoiceNumber: order.publicId,
    trackingId: order.trackingId,
    date: order.createdAt,
    branch: order.branch,
    customer: order.user
      ? { name: `${order.user.firstName} ${order.user.lastName}`, email: order.user.email }
      : order.walkInCustomer
        ? { name: order.walkInCustomer.name, cnic: order.walkInCustomer.cnic }
        : { name: 'Walk-in Customer' },
    items: order.items.map((i) => ({
      name: i.product.name,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      total: i.total,
      color: i.color,
    })),
    subtotal: order.subtotal,
    total: order.total,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    status: order.status,
  };
}

export async function trackOrder(trackingId: string) {
  const order = await prisma.order.findUnique({
    where: { trackingId },
    select: {
      trackingId: true,
      status: true,
      type: true,
      total: true,
      createdAt: true,
      updatedAt: true,
      branch: { select: { name: true, location: true, phone: true } },
      items: { include: { product: { select: { name: true } } } },
    },
  });
  if (!order) throw new AppError(404, 'Order not found');
  return order;
}

async function validateAndPriceItems(
  branchId: number,
  items: { productId: string; quantity: number; color?: string }[]
) {
  const productIds = items.map((i) => i.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, isActive: true },
    include: {
      bikePartDetails: true,
      branchProducts: { where: { branchId, isListed: true } },
    },
  });

  if (products.length !== productIds.length) {
    throw new AppError(400, 'One or more products not found or inactive');
  }

  return items.map((item) => {
    const product = products.find((p) => p.id === item.productId)!;
    if (product.branchProducts.length === 0) {
      throw new AppError(400, `Product "${product.name}" is not listed at this branch`);
    }
    const unitPrice = Number(product.salePrice ?? product.price);
    return {
      productId: item.productId,
      quantity: item.quantity,
      unitPrice,
      total: unitPrice * item.quantity,
      color: item.color,
      product,
    };
  });
}

export async function createOnlineOrder(data: {
  userId: string;
  branchId: number;
  paymentMethod: PaymentMethod;
  items: { productId: string; quantity: number; color?: string }[];
  notes?: string;
  bankTransferScreenshot?: string;
}) {
  const pricedItems = await validateAndPriceItems(data.branchId, data.items);
  const subtotal = pricedItems.reduce((sum, i) => sum + i.total, 0);
  const trackingId = generateTrackingId();

  return prisma.order.create({
    data: {
      branchId: data.branchId,
      userId: data.userId,
      type: OrderType.ONLINE,
      paymentMethod: data.paymentMethod,
      paymentStatus:
        data.paymentMethod === PaymentMethod.CASH ? PaymentStatus.PAID : PaymentStatus.PENDING,
      subtotal,
      total: subtotal,
      trackingId,
      notes: data.notes,
      bankTransferScreenshot: data.bankTransferScreenshot,
      items: {
        create: pricedItems.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          total: i.total,
          color: i.color,
        })),
      },
    },
    include: { items: { include: { product: true } } },
  });
}

export async function createPosOrder(data: {
  branchId: number;
  paymentMethod: PaymentMethod;
  walkInCustomerId?: number;
  items: { productId: string; quantity: number }[];
  notes?: string;
  isPaid?: boolean;
}) {
  const pricedItems = await validateAndPriceItems(data.branchId, data.items);
  const subtotal = pricedItems.reduce((sum, i) => sum + i.total, 0);
  const trackingId = generateTrackingId();
  const isPaid = data.isPaid !== false;

  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        branchId: data.branchId,
        walkInCustomerId: data.walkInCustomerId,
        type: OrderType.POS,
        status: OrderStatus.CONFIRMED,
        paymentMethod: data.paymentMethod,
        paymentStatus: isPaid ? PaymentStatus.PAID : PaymentStatus.PENDING,
        subtotal,
        total: subtotal,
        trackingId,
        notes: data.notes,
        items: {
          create: pricedItems.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            total: i.total,
          })),
        },
      },
      include: { items: { include: { product: { include: { bikePartDetails: true } } } } },
    });

    await deductPartsForOrder(data.branchId, created.items);

    if (!isPaid && data.walkInCustomerId) {
      const customer = await tx.walkInCustomer.findUniqueOrThrow({
        where: { id: data.walkInCustomerId },
      });
      const newBalance = Number(customer.balance) + subtotal;
      await tx.walkInCustomer.update({
        where: { id: data.walkInCustomerId },
        data: { balance: newBalance },
      });
      await tx.walkInCustomerLedger.create({
        data: {
          walkInCustomerId: data.walkInCustomerId,
          orderId: created.id,
          type: WalkInLedgerType.DEBIT,
          amount: subtotal,
          balance: newBalance,
          notes: 'POS sale on credit',
        },
      });
    }

    return created;
  });

  return order;
}

async function deductPartsForOrder(
  branchId: number,
  items: { productId: string; quantity: number; product: { type: ProductType; bikePartDetails: { partId: number | null }[] } }[]
) {
  const partDeductions: { partId: number; quantity: number }[] = [];

  for (const item of items) {
    if (item.product.type !== ProductType.PART) continue;
    for (const detail of item.product.bikePartDetails) {
      if (detail.partId) {
        partDeductions.push({ partId: detail.partId, quantity: item.quantity });
      }
    }
  }

  if (partDeductions.length > 0) {
    await deductStock(branchId, partDeductions);
  }
}

export async function updateOrderStatus(id: number, status: OrderStatus, branchId?: number) {
  const order = await getOrder(id, branchId);

  if (status === OrderStatus.CONFIRMED && order.status === OrderStatus.PENDING) {
    await confirmOrder(order);
  }

  return prisma.order.update({
    where: { id },
    data: { status },
    include: { items: { include: { product: true } } },
  });
}

async function confirmOrder(order: {
  id: number;
  branchId: number;
  items: { productId: string; quantity: number; product: { type: ProductType; bikePartDetails?: { partId: number | null }[] } }[];
}) {
  const itemsWithDetails = await prisma.orderItem.findMany({
    where: { orderId: order.id },
    include: { product: { include: { bikePartDetails: true } } },
  });
  await deductPartsForOrder(order.branchId, itemsWithDetails);
}

export async function approvePayment(id: number, approved: boolean, branchId?: number) {
  const order = await getOrder(id, branchId);
  if (order.paymentMethod !== PaymentMethod.BANK_TRANSFER) {
    throw new AppError(400, 'Order is not bank transfer');
  }

  const updated = await prisma.order.update({
    where: { id },
    data: {
      paymentStatus: approved ? PaymentStatus.APPROVED : PaymentStatus.REJECTED,
      status: approved ? OrderStatus.CONFIRMED : OrderStatus.PENDING,
    },
    include: { items: { include: { product: { include: { bikePartDetails: true } } } } },
  });

  if (approved && order.status === OrderStatus.PENDING) {
    await confirmOrder(updated);
  }

  return updated;
}

export async function createWalkInCustomer(data: {
  branchId: number;
  name: string;
  cnic: string;
  phone?: string;
  email?: string;
  address?: string;
}) {
  return prisma.walkInCustomer.upsert({
    where: { branchId_cnic: { branchId: data.branchId, cnic: data.cnic } },
    create: data,
    update: { name: data.name, phone: data.phone, email: data.email, address: data.address },
  });
}

export async function getWalkInCustomer(id: number, branchId: number) {
  const customer = await prisma.walkInCustomer.findFirst({
    where: { id, branchId },
    include: { ledger: { orderBy: { createdAt: 'desc' }, take: 50 } },
  });
  if (!customer) throw new AppError(404, 'Customer not found');
  return customer;
}

export async function updateWalkInCustomer(
  id: number,
  branchId: number,
  data: Partial<{ name: string; phone: string; email: string; address: string }>
) {
  const customer = await prisma.walkInCustomer.findFirst({ where: { id, branchId } });
  if (!customer) throw new AppError(404, 'Customer not found');
  return prisma.walkInCustomer.update({ where: { id }, data });
}

export async function getWalkInLedger(walkInCustomerId: number, branchId: number) {
  const customer = await prisma.walkInCustomer.findFirst({
    where: { id: walkInCustomerId, branchId },
  });
  if (!customer) throw new AppError(404, 'Customer not found');

  return prisma.walkInCustomerLedger.findMany({
    where: { walkInCustomerId },
    include: { order: { select: { trackingId: true, total: true } } },
    orderBy: { createdAt: 'desc' },
  });
}

export async function recordWalkInPayment(data: {
  walkInCustomerId: number;
  branchId: number;
  amount: number;
  notes?: string;
}) {
  return prisma.$transaction(async (tx) => {
    const customer = await tx.walkInCustomer.findFirstOrThrow({
      where: { id: data.walkInCustomerId, branchId: data.branchId },
    });
    const newBalance = Math.max(0, Number(customer.balance) - data.amount);
    await tx.walkInCustomer.update({
      where: { id: data.walkInCustomerId },
      data: { balance: newBalance },
    });
    return tx.walkInCustomerLedger.create({
      data: {
        walkInCustomerId: data.walkInCustomerId,
        type: WalkInLedgerType.CREDIT,
        amount: data.amount,
        balance: newBalance,
        notes: data.notes ?? 'Payment received',
      },
    });
  });
}

export async function listWalkInCustomers(branchId: number, query: { page?: string; limit?: string }) {
  const { page, limit, skip } = getPagination(query);
  const where = { branchId };

  const [customers, total] = await Promise.all([
    prisma.walkInCustomer.findMany({ where, skip, take: limit, orderBy: { name: 'asc' } }),
    prisma.walkInCustomer.count({ where }),
  ]);

  return paginatedResponse(customers, total, page, limit);
}
