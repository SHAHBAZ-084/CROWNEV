import {
  CustomerLedgerType,
  CustomerType,
  OrderStatus,
  OrderType,
  PaymentMethod,
  PaymentStatus,
  Prisma,
  ProductType,
  VoucherType,
} from '@prisma/client';
import { prisma } from '../../config/database.js';
import { AppError, getPagination, paginatedResponse } from '../../utils/helpers.js';
import { generateTrackingId } from '../../utils/crypto.js';
import { deductStock } from '../inventory/inventory.service.js';
import {
  createVoucherInTx,
  ensureCustomerAccount,
  ensureSaleRevenueAccount,
} from '../accounting/accounting.service.js';

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
        user: { select: { firstName: true, lastName: true, email: true, phone: true } },
        customer: { select: { name: true, cnic: true, phone: true, type: true } },
        branch: { select: { name: true, location: true, phone: true } },
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
      customer: true,
      branch: true,
    },
  });
  if (!order) throw new AppError(404, 'Order not found');
  return order;
}

export async function getOrderInvoice(id: number, userId?: string, branchId?: number) {
  const order = await prisma.order.findFirst({
    where: { id, ...(branchId && { branchId }) },
    include: {
      items: {
        include: {
          product: {
            include: { images: { where: { isPrimary: true }, take: 1 } },
          },
        },
      },
      user: true,
      customer: true,
      branch: true,
    },
  });
  if (!order) throw new AppError(404, 'Order not found');

  if (userId && order.userId !== userId) throw new AppError(403, 'Access denied');

  const invoiceAvailable =
    order.status === OrderStatus.DELIVERED ||
    (order.status === OrderStatus.CONFIRMED && order.paymentStatus === PaymentStatus.APPROVED) ||
    order.paymentStatus === PaymentStatus.PAID ||
    (order.type === OrderType.POS && order.invoiceGeneratedAt != null);

  return {
    invoiceType: 'SALE' as const,
    invoiceAvailable,
    currency: 'PKR' as const,
    invoiceNumber: `INV-${order.publicId.slice(0, 8).toUpperCase()}`,
    trackingId: order.trackingId,
    cargoTrackingId: order.cargoTrackingId,
    date: order.createdAt,
    deliveredAt: order.updatedAt,
    branch: {
      name: order.branch.name,
      location: order.branch.location,
      phone: order.branch.phone,
      whatsapp: order.branch.whatsapp,
    },
    customer: order.user
      ? {
          name: `${order.user.firstName} ${order.user.lastName}`,
          email: order.user.email,
          phone: order.customerPhone ?? order.user.phone,
          address: order.customerAddress,
        }
      : order.customer
        ? {
            name: order.customer.name,
            phone: order.customer.phone,
            address: order.customer.address,
          }
        : {
            name: order.customerName ?? 'Walk-in Customer',
            phone: order.customerPhone,
            address: order.customerAddress,
          },
    items: order.items.map((i) => ({
      name: i.product.name,
      type: i.product.type,
      quantity: i.quantity,
      unitPrice: Number(i.unitPrice),
      total: Number(i.total),
      color: i.color,
      chassisNumber: i.chassisNumber,
    })),
    subtotal: Number(order.subtotal),
    total: Number(order.total),
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    status: order.status,
    notes: order.notes,
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
      cargoTrackingId: true,
      paymentMethod: true,
      paymentStatus: true,
      createdAt: true,
      updatedAt: true,
      branch: { select: { name: true, location: true, phone: true } },
      items: {
        include: {
          product: { select: { name: true, type: true } },
        },
      },
    },
  });
  if (!order) throw new AppError(404, 'Order not found');
  return order;
}

export async function validateAndPriceItems(
  branchId: number,
  items: { productId: string; quantity: number; unitPrice?: number; color?: string; chassisNumber?: string }[]
) {
  const uniqueProductIds = [...new Set(items.map((i) => i.productId))];
  const products = await prisma.product.findMany({
    where: { id: { in: uniqueProductIds }, isActive: true },
    include: {
      bikePartDetails: true,
      branchProducts: { where: { branchId, isListed: true } },
    },
  });

  if (products.length !== uniqueProductIds.length) {
    throw new AppError(400, 'One or more products not found or inactive');
  }

  const qtyByProduct = new Map<string, number>();
  for (const item of items) {
    qtyByProduct.set(item.productId, (qtyByProduct.get(item.productId) ?? 0) + item.quantity);
  }

  for (const [productId, totalQty] of qtyByProduct) {
    const product = products.find((p) => p.id === productId)!;
    if (product.branchProducts.length === 0) {
      throw new AppError(400, `Product "${product.name}" is not listed at this branch`);
    }

    if (product.type === ProductType.BIKE) {
      const stock = product.branchProducts[0]?.stock ?? 0;
      if (stock < totalQty) {
        throw new AppError(
          400,
          `Insufficient stock for ${product.name}. Available: ${stock}`,
        );
      }
    }

    if (product.type === ProductType.PART) {
      for (const detail of product.bikePartDetails) {
        if (!detail.partId) continue;
        const inventory = await prisma.inventory.findUnique({
          where: { branchId_partId: { branchId, partId: detail.partId } },
        });
        const available = inventory?.quantity ?? 0;
        if (available < totalQty) {
          throw new AppError(400, `Insufficient part stock for ${product.name}`);
        }
      }
    }
  }

  const pricedItems: {
    productId: string;
    quantity: number;
    unitPrice: number;
    total: number;
    color?: string;
    chassisNumber?: string;
    product: (typeof products)[number];
  }[] = [];

  for (const item of items) {
    const product = products.find((p) => p.id === item.productId)!;
    const catalogPrice = Number(product.salePrice ?? product.price);
    const unitPrice = item.unitPrice != null ? Number(item.unitPrice) : catalogPrice;
    if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
      throw new AppError(400, `Price must be greater than zero for "${product.name}"`);
    }

    pricedItems.push({
      productId: item.productId,
      quantity: item.quantity,
      unitPrice,
      total: unitPrice * item.quantity,
      color: item.color,
      chassisNumber: item.chassisNumber,
      product,
    });
  }

  return pricedItems;
}

export async function createOnlineOrder(data: {
  userId: string;
  branchId: number;
  paymentMethod: PaymentMethod;
  items: { productId: string; quantity: number; color?: string; chassisNumber?: string }[];
  notes?: string;
  bankTransferScreenshot?: string;
  paymentTransactionId?: string;
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
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
      paymentTransactionId: data.paymentTransactionId,
      customerName: data.customerName,
      customerPhone: data.customerPhone,
      customerAddress: data.customerAddress,
      items: {
        create: pricedItems.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          total: i.total,
          color: i.color,
          chassisNumber: i.chassisNumber,
        })),
      },
    },
    include: { items: { include: { product: true } }, branch: true },
  });
}

export async function createPosOrder(data: {
  branchId: number;
  paymentMethod: PaymentMethod;
  customerId?: number;
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
        customerId: data.customerId,
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

    await deductStockForOrder(data.branchId, created.items, tx);

    if (!isPaid && data.customerId) {
      const customer = await tx.customer.findUniqueOrThrow({
        where: { id: data.customerId },
      });
      const newBalance = Number(customer.balance) + subtotal;
      await tx.customer.update({
        where: { id: data.customerId },
        data: { balance: newBalance },
      });
      await tx.customerLedger.create({
        data: {
          customerId: data.customerId,
          orderId: created.id,
          type: CustomerLedgerType.DEBIT,
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

export async function createSaleInvoice(data: {
  branchId: number;
  customerId: number;
  items: { productId: string; quantity: number; unitPrice?: number }[];
  reference: string;
  notes?: string;
  createdById: string;
}) {
  const customer = await prisma.customer.findFirst({
    where: {
      id: data.customerId,
      branchId: data.branchId,
      type: CustomerType.WALK_IN,
      isActive: true,
    },
  });
  if (!customer) throw new AppError(404, 'Walk-in customer not found');

  const reference = data.reference.trim();
  if (!reference) throw new AppError(400, 'Reference is required');

  const productIds = data.items.map((i) => i.productId);
  if (new Set(productIds).size !== productIds.length) {
    throw new AppError(400, 'Product is already selected');
  }

  const pricedItems = await validateAndPriceItems(data.branchId, data.items);
  const subtotal = pricedItems.reduce((sum, i) => sum + i.total, 0);
  if (subtotal <= 0) throw new AppError(400, 'Sale total must be greater than zero');

  const trackingId = generateTrackingId();

  return prisma.$transaction(async (tx) => {
    const order = await tx.order.create({
      data: {
        branchId: data.branchId,
        customerId: data.customerId,
        type: OrderType.POS,
        status: OrderStatus.CONFIRMED,
        paymentMethod: PaymentMethod.CASH,
        paymentStatus: PaymentStatus.PENDING,
        subtotal,
        total: subtotal,
        trackingId,
        saleReference: reference,
        notes: data.notes,
        invoiceGeneratedAt: new Date(),
        items: {
          create: pricedItems.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            total: i.total,
          })),
        },
      },
      include: {
        items: { include: { product: { include: { bikePartDetails: true } } } },
        customer: true,
        branch: true,
      },
    });

    await deductStockForOrder(data.branchId, order.items, tx);

    const newBalance = Number(customer.balance) + subtotal;
    await tx.customer.update({
      where: { id: data.customerId },
      data: { balance: newBalance },
    });
    await tx.customerLedger.create({
      data: {
        customerId: data.customerId,
        orderId: order.id,
        type: CustomerLedgerType.DEBIT,
        amount: subtotal,
        balance: newBalance,
        notes: `From sale revenue to ${customer.name}`,
      },
    });

    const customerAccount = await ensureCustomerAccount(tx, data.branchId, customer);
    const revenueAccount = await ensureSaleRevenueAccount(tx, data.branchId);

    const voucher = await createVoucherInTx(tx, {
      branchId: data.branchId,
      type: VoucherType.JOURNAL,
      debitAccountId: customerAccount.id,
      creditAccountId: revenueAccount.id,
      amount: subtotal,
      reference,
      createdById: data.createdById,
    });

    return { order, voucher };
  });
}

export async function getCustomerLedgerFormatted(customerId: number, branchId: number) {
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, branchId, isActive: true },
  });
  if (!customer) throw new AppError(404, 'Customer not found');

  const entries = await prisma.customerLedger.findMany({
    where: { customerId },
    include: { order: true, serviceInvoice: true },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });

  type LedgerRow = {
    date: string;
    voucherNo: string;
    ref: string | null;
    type: string;
    description: string;
    debit: number;
    credit: number;
    balance: number;
  };

  const rows: LedgerRow[] = [];
  let totalDebit = 0;
  let totalCredit = 0;

  for (const e of entries) {
    const debit = e.type === CustomerLedgerType.DEBIT ? Number(e.amount) : 0;
    const credit = e.type === CustomerLedgerType.CREDIT ? Number(e.amount) : 0;
    totalDebit += debit;
    totalCredit += credit;
    const orderRef = e.order?.saleReference?.trim() || null;
    const serviceRef = e.serviceInvoice?.reference?.trim() || null;
    const ref = orderRef ?? serviceRef;
    const isService = Boolean(serviceRef && !orderRef);
    rows.push({
      date: e.createdAt.toISOString(),
      voucherNo: orderRef ? `SI-${orderRef}` : serviceRef ? `SVI-${serviceRef}` : `CL-${e.id}`,
      ref,
      type: e.type === CustomerLedgerType.DEBIT ? (isService ? 'Service' : 'Sale') : 'Receipt',
      description:
        e.type === CustomerLedgerType.DEBIT
          ? isService
            ? `From service revenue to ${customer.name}`
            : `From sale revenue to ${customer.name}`
          : (e.notes ?? 'Payment'),
      debit,
      credit,
      balance: Number(e.balance),
    });
  }

  return {
    customer: {
      id: customer.id,
      name: customer.name,
      code: `C${String(customer.id).padStart(4, '0')}`,
      balance: Number(customer.balance),
    },
    rows,
    summary: {
      totalDebit,
      totalCredit,
      closingBalance: Number(customer.balance),
    },
  };
}

export async function deductStockForOrder(
  branchId: number,
  items: {
    productId: string;
    quantity: number;
    product: { type: ProductType; bikePartDetails: { partId: number | null }[] };
  }[],
  tx?: Prisma.TransactionClient
) {
  const db = tx ?? prisma;
  const partDeductions: { partId: number; quantity: number }[] = [];

  for (const item of items) {
    if (item.product.type === ProductType.BIKE) {
      const branchProduct = await db.branchProduct.findUnique({
        where: { branchId_productId: { branchId, productId: item.productId } },
      });
      if (!branchProduct || branchProduct.stock < item.quantity) {
        throw new AppError(400, 'Insufficient bike stock');
      }
      await db.branchProduct.update({
        where: { branchId_productId: { branchId, productId: item.productId } },
        data: { stock: { decrement: item.quantity } },
      });
      continue;
    }

    if (item.product.type !== ProductType.PART) continue;
    for (const detail of item.product.bikePartDetails) {
      if (detail.partId) {
        partDeductions.push({ partId: detail.partId, quantity: item.quantity });
      }
    }
  }

  if (partDeductions.length === 0) return;

  if (tx) {
    for (const part of partDeductions) {
      const inventory = await tx.inventory.findUnique({
        where: { branchId_partId: { branchId, partId: part.partId } },
      });
      const currentQty = inventory?.quantity ?? 0;
      if (currentQty < part.quantity) {
        throw new AppError(400, `Insufficient stock for part ${part.partId}`);
      }
      await tx.inventory.update({
        where: { branchId_partId: { branchId, partId: part.partId } },
        data: { quantity: currentQty - part.quantity },
      });
    }
    return;
  }

  await deductStock(branchId, partDeductions);
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
  await deductStockForOrder(order.branchId, itemsWithDetails);
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

export async function setCargoTracking(id: number, cargoTrackingId: string, branchId?: number) {
  const order = await getOrder(id, branchId);
  if (order.status !== OrderStatus.CONFIRMED) {
    throw new AppError(400, 'Can only set cargo tracking on confirmed orders');
  }

  const paymentOk =
    order.paymentStatus === PaymentStatus.APPROVED ||
    order.paymentStatus === PaymentStatus.PAID;

  return prisma.order.update({
    where: { id },
    data: {
      cargoTrackingId,
      status: OrderStatus.DELIVERED,
      invoiceGeneratedAt: paymentOk ? new Date() : undefined,
    },
    include: {
      items: { include: { product: true } },
      user: true,
      branch: true,
    },
  });
}

export async function createWalkInCustomer(data: {
  branchId: number;
  name: string;
  cnic: string;
  phone?: string;
  email?: string;
  address?: string;
}) {
  return prisma.$transaction(async (tx) => {
    const customer = await tx.customer.upsert({
      where: { branchId_cnic: { branchId: data.branchId, cnic: data.cnic } },
      create: { ...data, type: CustomerType.WALK_IN },
      update: {
        name: data.name,
        phone: data.phone,
        email: data.email,
        address: data.address,
        type: CustomerType.WALK_IN,
        isActive: true,
      },
    });
    await ensureCustomerAccount(tx, data.branchId, { id: customer.id, name: customer.name });
    return { ...customer, balance: Number(customer.balance) };
  });
}

export async function getWalkInCustomer(id: number, branchId: number) {
  const customer = await prisma.customer.findFirst({
    where: { id, branchId, type: CustomerType.WALK_IN },
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
  return prisma.$transaction(async (tx) => {
    const customer = await tx.customer.findFirst({
      where: { id, branchId, type: CustomerType.WALK_IN },
    });
    if (!customer) throw new AppError(404, 'Customer not found');
    const updated = await tx.customer.update({ where: { id }, data });
    if (data.name) {
      await ensureCustomerAccount(tx, branchId, { id: updated.id, name: updated.name });
    }
    return updated;
  });
}

export async function getWalkInLedger(customerId: number, branchId: number) {
  return getCustomerLedgerFormatted(customerId, branchId);
}

export async function recordWalkInPayment(data: {
  customerId: number;
  branchId: number;
  amount: number;
  notes?: string;
}) {
  return prisma.$transaction(async (tx) => {
    const customer = await tx.customer.findFirstOrThrow({
      where: { id: data.customerId, branchId: data.branchId, type: CustomerType.WALK_IN },
    });
    const newBalance = Math.max(0, Number(customer.balance) - data.amount);
    await tx.customer.update({
      where: { id: data.customerId },
      data: { balance: newBalance },
    });
    return tx.customerLedger.create({
      data: {
        customerId: data.customerId,
        type: CustomerLedgerType.CREDIT,
        amount: data.amount,
        balance: newBalance,
        notes: data.notes ?? 'Payment received',
      },
    });
  });
}

export async function softDeleteWalkInCustomer(id: number, branchId: number) {
  const customer = await prisma.customer.findFirst({
    where: { id, branchId, type: CustomerType.WALK_IN, isActive: true },
  });
  if (!customer) throw new AppError(404, 'Customer not found');
  return prisma.customer.update({
    where: { id },
    data: { isActive: false },
  });
}

export async function listBranchCustomers(branchId: number, query: { page?: string; limit?: string }) {
  const { page, limit, skip } = getPagination(query);
  const where = { branchId, isActive: true };

  const [rows, total] = await Promise.all([
    prisma.customer.findMany({ where, skip, take: limit, orderBy: { name: 'asc' } }),
    prisma.customer.count({ where }),
  ]);

  const customers = rows.map((c) => ({
    ...c,
    balance: Number(c.balance),
  }));

  return paginatedResponse(customers, total, page, limit);
}

export async function listWalkInCustomers(branchId: number, query: { page?: string; limit?: string }) {
  const { page, limit, skip } = getPagination(query);
  const where = { branchId, type: CustomerType.WALK_IN, isActive: true };

  const [rows, total] = await Promise.all([
    prisma.customer.findMany({ where, skip, take: limit, orderBy: { name: 'asc' } }),
    prisma.customer.count({ where }),
  ]);

  const customers = rows.map((c) => ({
    ...c,
    balance: Number(c.balance),
  }));

  return paginatedResponse(customers, total, page, limit);
}
