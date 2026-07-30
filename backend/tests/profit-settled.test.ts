import {
  ChassisStatus,
  OrderStatus,
  OrderType,
  PaymentMethod,
  PaymentStatus,
  ProductType,
  Role,
} from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { prisma } from '../src/config/database.js';
import { requireRoles } from '../src/middleware/auth.js';
import {
  getProfitLossReport,
  setChassisProfitSettled,
} from '../src/modules/reports/reports.service.js';
import { AppError } from '../src/utils/helpers.js';

describe.skipIf(!process.env.DATABASE_URL)('chassis profit settled P&L', () => {
  const suffix = Date.now();
  const chassisA = `SETTLE-A-${suffix}`;
  const chassisB = `SETTLE-B-${suffix}`;

  let branchAId: number;
  let branchBId: number;
  let userId: string;
  let productId: string;
  let purchaseAId: number;
  let purchaseBId: number;
  let orderItemAId: number;
  let orderItemBId: number;
  let orderAId: number;
  let orderBId: number;
  let supplierAId: number;
  let supplierBId: number;

  beforeAll(async () => {
    const branchA = await prisma.branch.create({
      data: {
        name: `Settle Test A ${suffix}`,
        location: 'Test',
        phone: '03001110001',
        isActive: true,
        showOnPublicSite: false,
      },
    });
    const branchB = await prisma.branch.create({
      data: {
        name: `Settle Test B ${suffix}`,
        location: 'Test',
        phone: '03001110002',
        isActive: true,
        showOnPublicSite: false,
      },
    });
    branchAId = branchA.id;
    branchBId = branchB.id;

    const user = await prisma.user.create({
      data: {
        email: `settle-test-${suffix}@example.com`,
        firstName: 'Settle',
        lastName: 'Tester',
        role: Role.BRANCH_OWNER,
        branchId: branchAId,
        isVerified: true,
        passwordHash: 'unused',
      },
    });
    userId = user.id;

    const product = await prisma.product.create({
      data: {
        name: `Settle Bike ${suffix}`,
        slug: `settle-bike-${suffix}`,
        type: ProductType.BIKE,
        price: 200000,
        model: 'TEST',
      },
    });
    productId = product.id;

    const supplierA = await prisma.supplier.create({
      data: { branchId: branchAId, name: `Supplier A ${suffix}`, phone: `0301${suffix}`.slice(0, 11) },
    });
    const supplierB = await prisma.supplier.create({
      data: { branchId: branchBId, name: `Supplier B ${suffix}`, phone: `0302${suffix}`.slice(0, 11) },
    });
    supplierAId = supplierA.id;
    supplierBId = supplierB.id;

    const purchaseA = await prisma.purchase.create({
      data: {
        branchId: branchAId,
        supplierId: supplierAId,
        total: 150000,
        items: { create: [{ productId, quantity: 1, unitCost: 150000 }] },
      },
    });
    const purchaseB = await prisma.purchase.create({
      data: {
        branchId: branchBId,
        supplierId: supplierBId,
        total: 150000,
        items: { create: [{ productId, quantity: 1, unitCost: 150000 }] },
      },
    });
    purchaseAId = purchaseA.id;
    purchaseBId = purchaseB.id;

    const orderA = await prisma.order.create({
      data: {
        branchId: branchAId,
        type: OrderType.POS,
        status: OrderStatus.CONFIRMED,
        paymentMethod: PaymentMethod.CASH,
        paymentStatus: PaymentStatus.PAID,
        subtotal: 200000,
        total: 200000,
        invoiceDate: new Date(),
        items: {
          create: [{ productId, quantity: 1, unitPrice: 200000, total: 200000, chassisNumber: chassisA }],
        },
      },
      include: { items: true },
    });
    const orderB = await prisma.order.create({
      data: {
        branchId: branchBId,
        type: OrderType.POS,
        status: OrderStatus.CONFIRMED,
        paymentMethod: PaymentMethod.CASH,
        paymentStatus: PaymentStatus.PAID,
        subtotal: 200000,
        total: 200000,
        invoiceDate: new Date(),
        items: {
          create: [{ productId, quantity: 1, unitPrice: 200000, total: 200000, chassisNumber: chassisB }],
        },
      },
      include: { items: true },
    });
    orderAId = orderA.id;
    orderBId = orderB.id;
    orderItemAId = orderA.items[0]!.id;
    orderItemBId = orderB.items[0]!.id;

    await prisma.bikeChassisNumber.create({
      data: {
        chassisNumber: chassisA,
        productId,
        branchId: branchAId,
        status: ChassisStatus.SOLD,
        purchaseId: purchaseAId,
        saleOrderItemId: orderItemAId,
        purchasePrice: 150000,
      },
    });
    await prisma.bikeChassisNumber.create({
      data: {
        chassisNumber: chassisB,
        productId,
        branchId: branchBId,
        status: ChassisStatus.SOLD,
        purchaseId: purchaseBId,
        saleOrderItemId: orderItemBId,
        purchasePrice: 150000,
      },
    });
  });

  afterAll(async () => {
    await prisma.bikeChassisNumber.deleteMany({
      where: { chassisNumber: { in: [chassisA, chassisB] } },
    });
    if (orderAId && orderBId) {
      await prisma.orderItem.deleteMany({ where: { orderId: { in: [orderAId, orderBId] } } });
      await prisma.order.deleteMany({ where: { id: { in: [orderAId, orderBId] } } });
    }
    if (purchaseAId && purchaseBId) {
      await prisma.purchaseItem.deleteMany({ where: { purchaseId: { in: [purchaseAId, purchaseBId] } } });
      await prisma.purchase.deleteMany({ where: { id: { in: [purchaseAId, purchaseBId] } } });
    }
    if (supplierAId && supplierBId) {
      await prisma.supplier.deleteMany({ where: { id: { in: [supplierAId, supplierBId] } } });
    }
    if (productId) await prisma.product.deleteMany({ where: { id: productId } });
    if (userId) await prisma.user.deleteMany({ where: { id: userId } });
    if (branchAId && branchBId) {
      await prisma.branch.deleteMany({ where: { id: { in: [branchAId, branchBId] } } });
    }
    await prisma.$disconnect();
  });

  it('settles a chassis and excludes it from totalProfit while keeping it in items', async () => {
    const before = await getProfitLossReport(branchAId, 'sale', {});
    const beforeItem = before.items.find((i) => i.chassisNumber === chassisA);
    expect(beforeItem?.settled).toBe(false);
    expect(before.totalProfit).toBeGreaterThanOrEqual(50000);

    const updated = await setChassisProfitSettled(branchAId, [chassisA], true, userId);
    expect(updated).toBe(1);

    const after = await getProfitLossReport(branchAId, 'sale', {});
    const afterItem = after.items.find((i) => i.chassisNumber === chassisA);
    expect(afterItem).toBeTruthy();
    expect(afterItem?.settled).toBe(true);
    expect(after.totalProfit).toBe(before.totalProfit - afterItem!.profit);
    expect(after.settledProfit).toBeGreaterThanOrEqual(afterItem!.profit);
  });

  it('unsettles a chassis and includes it in totalProfit again', async () => {
    await setChassisProfitSettled(branchAId, [chassisA], true, userId);
    const settled = await getProfitLossReport(branchAId, 'sale', {});
    const settledProfit = settled.totalProfit;

    const updated = await setChassisProfitSettled(branchAId, [chassisA], false, userId);
    expect(updated).toBe(1);

    const unsettled = await getProfitLossReport(branchAId, 'sale', {});
    const item = unsettled.items.find((i) => i.chassisNumber === chassisA);
    expect(item?.settled).toBe(false);
    expect(unsettled.totalProfit).toBe(settledProfit + item!.profit);
  });

  it('rejects settling a chassis from another branch', async () => {
    await expect(setChassisProfitSettled(branchAId, [chassisB], true, userId)).rejects.toBeInstanceOf(
      AppError,
    );
    await expect(setChassisProfitSettled(branchAId, [chassisB], true, userId)).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it('blocks CUSTOMER role from settle endpoint via requireRoles', () => {
    const req = {
      user: { role: Role.CUSTOMER, userId: 'x' },
    } as import('express').Request;
    const res = {} as import('express').Response;
    const next = vi.fn();

    requireRoles(Role.ADMIN, Role.BRANCH_OWNER)(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    const err = next.mock.calls[0]![0] as AppError;
    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(403);
  });
});
