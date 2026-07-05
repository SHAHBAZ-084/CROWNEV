import {
  CustomerLedgerType,
  CustomerType,
  OrderStatus,
  OrderType,
  PaymentMethod,
  PaymentStatus,
  Prisma,
  ProductType,
  ShippingMethod,
  VoucherType,
} from '@prisma/client';
import { prisma } from '../../config/database.js';
import { AppError, getPagination, paginatedResponse } from '../../utils/helpers.js';
import { allocateSaleInvoiceNumber } from '../../utils/documentNumbers.js';
import {
  createVoucherInTx,
  ensureCustomerAccount,
  ensureSaleRevenueAccount,
  formatPurchaseItemsDescription,
} from '../accounting/accounting.service.js';
import { countInStockChassis, markChassisSoldInTx } from '../chassis/chassis.service.js';
import { deductBranchProductStockInTx } from '../inventory/inventory.service.js';

function normalizeCnic(cnic: string): string {
  return cnic.replace(/\D/g, '');
}

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
      type: OrderType.ONLINE,
      status: OrderStatus.PAYMENT_SUBMITTED,
      paymentMethod: PaymentMethod.BANK_TRANSFER,
      paymentStatus: PaymentStatus.PENDING,
    },
    include: {
      items: { include: { product: { select: { name: true } } } },
      user: { select: { firstName: true, lastName: true, email: true } },
      branch: { select: { name: true } },
    },
    orderBy: { createdAt: 'asc' },
    take: 200,
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
          soldChassis: { select: { engineNumber: true, motorNumber: true } },
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
    (order.status === OrderStatus.CONFIRMED &&
      (order.paymentStatus === PaymentStatus.APPROVED || order.paymentStatus === PaymentStatus.PAID)) ||
    (order.type === OrderType.POS && order.invoiceGeneratedAt != null);

  const biltyCharges = order.biltyCharges != null ? Number(order.biltyCharges) : null;

  return {
    invoiceType: 'SALE' as const,
    invoiceAvailable,
    currency: 'PKR' as const,
    invoiceNumber: order.saleReference?.trim() || String(order.id),
    orderType: order.type,
    shippingMethod: order.shippingMethod,
    saleReference: order.saleReference,
    biltyId: order.biltyId,
    shippingProvider: order.shippingProvider,
    biltyCharges,
    date: order.createdAt,
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
      engineNumber: i.engineNumber,
      motorNumber: i.motorNumber,
    })),
    subtotal: Number(order.subtotal),
    total: Number(order.total),
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    status: order.status,
    notes: order.notes,
  };
}

export async function trackOrder(publicId: string) {
  const order = await prisma.order.findUnique({
    where: { publicId },
    select: {
      publicId: true,
      id: true,
      status: true,
      type: true,
      shippingMethod: true,
      subtotal: true,
      biltyCharges: true,
      total: true,
      biltyId: true,
      shippingProvider: true,
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

    if (product.type === ProductType.BIKE || product.type === ProductType.PART) {
      const stock =
        product.type === ProductType.BIKE
          ? await countInStockChassis(branchId, productId)
          : product.branchProducts[0]?.stock ?? 0;
      if (stock < totalQty) {
        throw new AppError(
          400,
          `Insufficient stock for ${product.name}. Available: ${stock}`,
        );
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
  shippingMethod: ShippingMethod;
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

  const isSelfPickup = data.shippingMethod === ShippingMethod.SELF;

  if (isSelfPickup) {
    if (!data.paymentTransactionId?.trim()) {
      throw new AppError(400, 'Transaction ID (TID) is required for self pickup orders');
    }
    if (!data.bankTransferScreenshot?.trim()) {
      throw new AppError(400, 'Payment proof is required for self pickup orders');
    }
  }

  return prisma.order.create({
    data: {
      branchId: data.branchId,
      userId: data.userId,
      type: OrderType.ONLINE,
      shippingMethod: data.shippingMethod,
      status: isSelfPickup ? OrderStatus.PAYMENT_SUBMITTED : OrderStatus.AWAITING_BILTY_CHARGES,
      paymentMethod: PaymentMethod.BANK_TRANSFER,
      paymentStatus: PaymentStatus.PENDING,
      subtotal,
      total: subtotal,
      notes: data.notes,
      bankTransferScreenshot: isSelfPickup ? data.bankTransferScreenshot : undefined,
      paymentTransactionId: isSelfPickup ? data.paymentTransactionId?.trim() : undefined,
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
  items: { productId: string; quantity: number; unitPrice?: number; bikeChassisNumberId?: number }[];
  reference?: string;
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

  const pricedItems = await validateAndPriceItems(data.branchId, data.items);
  const subtotal = pricedItems.reduce((sum, i) => sum + i.total, 0);
  if (subtotal <= 0) throw new AppError(400, 'Sale total must be greater than zero');

  const chassisIds = data.items.map((i) => i.bikeChassisNumberId).filter(Boolean) as number[];
  if (new Set(chassisIds).size !== chassisIds.length) {
    throw new AppError(400, 'Duplicate chassis number selection');
  }

  const partProductIds = new Set<string>();
  for (const priced of pricedItems) {
    if (priced.product.type === ProductType.PART) {
      if (partProductIds.has(priced.productId)) {
        throw new AppError(400, 'Part is already selected');
      }
      partProductIds.add(priced.productId);
    }
  }

  const saleLines: {
    productId: string;
    quantity: number;
    unitPrice: number;
    total: number;
    chassisNumber?: string;
    bikeChassisNumberId?: number;
    product: (typeof pricedItems)[number]['product'];
  }[] = [];

  for (let idx = 0; idx < data.items.length; idx++) {
    const input = data.items[idx];
    const priced = pricedItems[idx];

    if (priced.product.type === ProductType.BIKE) {
      if (input.quantity !== 1) {
        throw new AppError(400, 'Bike sales must have quantity 1 — select one chassis number per line');
      }
      if (!input.bikeChassisNumberId) {
        throw new AppError(400, `Select a chassis number for "${priced.product.name}"`);
      }
      saleLines.push({
        productId: priced.productId,
        quantity: priced.quantity,
        unitPrice: priced.unitPrice,
        total: priced.total,
        bikeChassisNumberId: input.bikeChassisNumberId,
        product: priced.product,
      });
    } else {
      if (input.bikeChassisNumberId) {
        throw new AppError(400, 'Chassis numbers apply to bikes only');
      }
      saleLines.push({
        productId: priced.productId,
        quantity: priced.quantity,
        unitPrice: priced.unitPrice,
        total: priced.total,
        product: priced.product,
      });
    }
  }

  return prisma.$transaction(async (tx) => {
    const reference =
      data.reference?.trim() || (await allocateSaleInvoiceNumber(tx, data.branchId));

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
        saleReference: reference,
        notes: data.notes,
        invoiceGeneratedAt: new Date(),
        items: {
          create: saleLines.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            total: i.total,
            chassisNumber: i.chassisNumber,
          })),
        },
      },
      include: {
        items: { include: { product: { include: { bikePartDetails: true } } } },
        customer: true,
        branch: true,
      },
    });

    for (let i = 0; i < saleLines.length; i++) {
      const line = saleLines[i];
      const orderItem = order.items[i];
      if (line.bikeChassisNumberId && orderItem) {
        const chassis = await markChassisSoldInTx(tx, {
          bikeChassisNumberId: line.bikeChassisNumberId,
          branchId: data.branchId,
          productId: line.productId,
          saleOrderItemId: orderItem.id,
        });
        await tx.orderItem.update({
          where: { id: orderItem.id },
          data: {
            chassisNumber: chassis.chassisNumber,
            engineNumber: chassis.engineNumber,
            motorNumber: chassis.motorNumber,
          },
        });
      }
    }

    const orderWithChassis = await tx.order.findUniqueOrThrow({
      where: { id: order.id },
      include: {
        items: { include: { product: { include: { bikePartDetails: true } } } },
        customer: true,
        branch: true,
      },
    });

    await deductStockForOrder(data.branchId, orderWithChassis.items, tx);

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

    return { order: orderWithChassis, voucher };
  });
}

export async function getCustomerLedgerFormatted(customerId: number, branchId: number) {
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, branchId, isActive: true },
  });
  if (!customer) throw new AppError(404, 'Customer not found');

  const entries = await prisma.customerLedger.findMany({
    where: { customerId },
    include: {
      order: {
        include: {
          items: { include: { product: { select: { name: true } } } },
        },
      },
      serviceInvoice: true,
    },
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
    const saleBase = `From sale revenue to ${customer.name}`;
    const saleItems = e.order?.items?.length
      ? formatPurchaseItemsDescription(
          e.order.items.map((item) => ({ quantity: item.quantity, product: item.product })),
        )
      : '';
    rows.push({
      date: e.createdAt.toISOString(),
      voucherNo: orderRef ?? serviceRef ?? String(e.id),
      ref,
      type: e.type === CustomerLedgerType.DEBIT ? (isService ? 'Service' : 'Sale') : 'Receipt',
      description:
        e.type === CustomerLedgerType.DEBIT
          ? isService
            ? `From service revenue to ${customer.name}`
            : saleItems
              ? `${saleBase} — ${saleItems}`
              : saleBase
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

  for (const item of items) {
    if (item.product.type === ProductType.BIKE || item.product.type === ProductType.PART) {
      await deductBranchProductStockInTx(db, branchId, item.productId, item.quantity, item.product.type);
    }
  }
}

export async function updateOrderStatus(id: number, status: OrderStatus, branchId?: number) {
  const order = await getOrder(id, branchId);

  if (order.type === OrderType.ONLINE && status === OrderStatus.CONFIRMED) {
    throw new AppError(400, 'Online orders must be confirmed through payment verification');
  }

  if (
    order.type !== OrderType.ONLINE &&
    status === OrderStatus.CONFIRMED &&
    order.status === OrderStatus.PAYMENT_SUBMITTED
  ) {
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

export async function setBiltyCharges(
  id: number,
  biltyCharges: number,
  shippingProvider: string,
  branchId?: number,
) {
  const order = await getOrder(id, branchId);
  if (order.type !== OrderType.ONLINE) throw new AppError(400, 'Bilty charges only apply to online orders');
  if (order.shippingMethod !== ShippingMethod.BILTY) {
    throw new AppError(400, 'Order is not shipped by bilty');
  }
  if (order.status !== OrderStatus.AWAITING_BILTY_CHARGES) {
    throw new AppError(400, 'Order is not awaiting bilty charges');
  }
  if (!Number.isFinite(biltyCharges) || biltyCharges < 0) {
    throw new AppError(400, 'Bilty charges must be zero or greater');
  }
  if (!shippingProvider?.trim()) {
    throw new AppError(400, 'Please select a courier / shipping provider');
  }

  const subtotal = Number(order.subtotal);
  const total = subtotal + biltyCharges;

  return prisma.order.update({
    where: { id },
    data: {
      biltyCharges,
      shippingProvider: shippingProvider.trim(),
      total,
      status: OrderStatus.AWAITING_PAYMENT,
    },
    include: {
      items: { include: { product: true } },
      user: true,
      branch: true,
    },
  });
}

export async function submitOrderPayment(
  id: number,
  userId: string,
  data: { paymentTransactionId: string; bankTransferScreenshot: string },
) {
  const order = await getOrder(id);
  if (order.userId !== userId) throw new AppError(403, 'Access denied');

  const canSubmit =
    order.status === OrderStatus.AWAITING_PAYMENT ||
    (order.shippingMethod === ShippingMethod.SELF &&
      order.status === OrderStatus.PAYMENT_SUBMITTED &&
      order.paymentStatus === PaymentStatus.REJECTED);

  if (!canSubmit) {
    throw new AppError(400, 'Order is not awaiting payment');
  }
  if (!data.paymentTransactionId?.trim()) {
    throw new AppError(400, 'Transaction ID (TID) is required');
  }
  if (!data.bankTransferScreenshot?.trim()) {
    throw new AppError(400, 'Payment proof is required');
  }

  return prisma.order.update({
    where: { id },
    data: {
      paymentTransactionId: data.paymentTransactionId.trim(),
      bankTransferScreenshot: data.bankTransferScreenshot.trim(),
      paymentStatus: PaymentStatus.PENDING,
      status: OrderStatus.PAYMENT_SUBMITTED,
    },
    include: { items: { include: { product: true } }, branch: true },
  });
}

export async function approvePayment(
  id: number,
  approved: boolean,
  branchId?: number,
  biltyId?: string,
) {
  const order = await getOrder(id, branchId);
  if (order.type !== OrderType.ONLINE) {
    throw new AppError(400, 'Payment verification only applies to online orders');
  }
  if (order.status !== OrderStatus.PAYMENT_SUBMITTED) {
    throw new AppError(400, 'Order is not awaiting payment verification');
  }
  if (order.paymentStatus !== PaymentStatus.PENDING) {
    throw new AppError(400, 'Payment has already been processed');
  }
  if (!order.paymentTransactionId?.trim() || !order.bankTransferScreenshot?.trim()) {
    throw new AppError(400, 'Customer payment details are missing');
  }

  if (approved && order.shippingMethod === ShippingMethod.BILTY && !biltyId?.trim()) {
    throw new AppError(400, 'Bilty ID is required when verifying bilty shipping orders');
  }

  if (approved) {
    const updated = await prisma.order.update({
      where: { id },
      data: {
        paymentStatus: PaymentStatus.APPROVED,
        status: OrderStatus.CONFIRMED,
        biltyId: order.shippingMethod === ShippingMethod.BILTY ? biltyId!.trim() : null,
        invoiceGeneratedAt: new Date(),
      },
      include: { items: { include: { product: { include: { bikePartDetails: true } } } } },
    });
    await confirmOrder(updated);
    return updated;
  }

  const rejectData =
    order.shippingMethod === ShippingMethod.SELF
      ? {
          paymentStatus: PaymentStatus.REJECTED,
          status: OrderStatus.PAYMENT_SUBMITTED,
          paymentTransactionId: null,
          bankTransferScreenshot: null,
        }
      : {
          paymentStatus: PaymentStatus.REJECTED,
          status: OrderStatus.AWAITING_PAYMENT,
          paymentTransactionId: null,
          bankTransferScreenshot: null,
        };

  return prisma.order.update({
    where: { id },
    data: rejectData,
    include: { items: { include: { product: true } }, user: true, branch: true },
  });
}

/** @deprecated Use approvePayment with biltyId at verification time */
export async function setBiltyTracking(id: number, biltyId: string, branchId?: number) {
  const order = await getOrder(id, branchId);
  if (order.status !== OrderStatus.CONFIRMED) {
    throw new AppError(400, 'Can only set bilty ID on confirmed orders');
  }
  if (order.shippingMethod !== ShippingMethod.BILTY) {
    throw new AppError(400, 'Order is not shipped by bilty');
  }

  return prisma.order.update({
    where: { id },
    data: { biltyId: biltyId.trim() },
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
  const cnic = normalizeCnic(data.cnic);
  if (cnic.length !== 13 || !/^\d+$/.test(cnic)) {
    throw new AppError(400, 'CNIC must be 13 digits');
  }

  const existing = await prisma.customer.findFirst({
    where: { cnic },
    select: { id: true },
  });
  if (existing) {
    throw new AppError(409, 'A customer with this CNIC already exists.');
  }

  return prisma.$transaction(async (tx) => {
    const customer = await tx.customer.create({
      data: {
        branchId: data.branchId,
        name: data.name,
        cnic,
        phone: data.phone,
        email: data.email,
        address: data.address,
        type: CustomerType.WALK_IN,
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
