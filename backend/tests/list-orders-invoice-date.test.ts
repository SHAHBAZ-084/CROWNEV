import { OrderStatus, OrderType, PaymentMethod, Prisma } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/config/database.js';
import { listOrders } from '../src/modules/orders/orders.service.js';

function isMissingInvoiceDateColumn(err: unknown) {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2022';
}

describe.skipIf(!process.env.DATABASE_URL)('listOrders invoiceDate ordering', () => {
  let branchId: number;
  let invoiceDateReady = false;
  const createdOrderIds: number[] = [];
  const sharedInvoiceDate = new Date('2026-07-15T12:00:00.000Z');

  beforeAll(async () => {
    const suffix = Date.now();
    const branch = await prisma.branch.create({
      data: {
        name: `List Orders Test Branch ${suffix}`,
        location: 'Test City',
        phone: '03000000999',
        isActive: true,
        showOnPublicSite: false,
      },
    });
    branchId = branch.id;

    try {
      await prisma.order.findFirst({ select: { invoiceDate: true } });
      invoiceDateReady = true;
    } catch (err) {
      if (!isMissingInvoiceDateColumn(err)) throw err;
    }
  });

  afterAll(async () => {
    if (createdOrderIds.length) {
      await prisma.orderItem.deleteMany({ where: { orderId: { in: createdOrderIds } } });
      await prisma.order.deleteMany({ where: { id: { in: createdOrderIds } } });
    }
    if (branchId) {
      await prisma.branch.deleteMany({ where: { id: branchId } });
    }
    await prisma.$disconnect();
  });

  it('returns orders with identical invoiceDate newest-id-first', async (ctx) => {
    if (!invoiceDateReady) ctx.skip();
    const suffix = Date.now();
    for (let i = 0; i < 3; i++) {
      const order = await prisma.order.create({
        data: {
          branchId,
          type: OrderType.POS,
          status: OrderStatus.CONFIRMED,
          paymentMethod: PaymentMethod.CASH,
          subtotal: 100 + i,
          total: 100 + i,
          invoiceDate: sharedInvoiceDate,
          saleReference: `LIST-ORD-TEST-${suffix}-${i}`,
        },
      });
      createdOrderIds.push(order.id);
    }

    const [newest, middle, oldest] = createdOrderIds.slice(-3).sort((a, b) => b - a);

    const limited = await listOrders({
      branchId,
      type: OrderType.POS,
      limit: '2',
    });
    expect(limited.data.map((order) => order.id)).toEqual([newest, middle]);

    const full = await listOrders({
      branchId,
      type: OrderType.POS,
      limit: '10',
    });
    const testOrderIds = full.data
      .map((order) => order.id)
      .filter((id) => createdOrderIds.includes(id));
    expect(testOrderIds).toEqual([newest, middle, oldest]);
  });
});
