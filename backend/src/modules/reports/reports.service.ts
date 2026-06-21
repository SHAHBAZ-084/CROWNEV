import { Role } from '@prisma/client';
import { prisma } from '../../config/database.js';
import { getLowStockAlerts } from '../inventory/inventory.service.js';

export async function getAdminDashboard() {
  const [revenue, orderCount, branchCount, lowStock, recentOrders, branches] = await Promise.all([
    prisma.order.aggregate({
      where: { status: { in: ['CONFIRMED', 'DELIVERED'] } },
      _sum: { total: true },
    }),
    prisma.order.count(),
    prisma.branch.count({ where: { isActive: true } }),
    getLowStockAlerts(),
    prisma.order.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: { branch: { select: { name: true } }, user: { select: { firstName: true, lastName: true } } },
    }),
    prisma.branch.findMany({
      where: { isActive: true },
      include: {
        _count: { select: { orders: true } },
        orders: {
          where: { status: { in: ['CONFIRMED', 'DELIVERED'] } },
          select: { total: true },
        },
      },
    }),
  ]);

  const branchComparison = branches.map((b: (typeof branches)[number]) => ({
    id: b.id,
    name: b.name,
    orderCount: b._count.orders,
    revenue: b.orders.reduce((sum: number, o: (typeof b.orders)[number]) => sum + Number(o.total), 0),
  }));

  return {
    totalRevenue: revenue._sum.total ?? 0,
    totalOrders: orderCount,
    totalBranches: branchCount,
    lowStockAlerts: lowStock.length,
    lowStock,
    recentOrders,
    branchComparison,
  };
}

export async function getRevenueTrend(branchId?: number, days = 30) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const orders = await prisma.order.findMany({
    where: {
      ...(branchId && { branchId }),
      status: { in: ['CONFIRMED', 'DELIVERED'] },
      createdAt: { gte: since },
    },
    select: { total: true, createdAt: true, branchId: true },
    orderBy: { createdAt: 'asc' },
  });

  const dailyMap = new Map<string, number>();
  for (const order of orders) {
    const key = order.createdAt.toISOString().split('T')[0];
    dailyMap.set(key, (dailyMap.get(key) ?? 0) + Number(order.total));
  }

  return Array.from(dailyMap.entries()).map(([date, revenue]) => ({ date, revenue }));
}

export async function exportOrders(branchId?: number, from?: string, to?: string) {
  const orders = await prisma.order.findMany({
    where: {
      ...(branchId && { branchId }),
      ...(from || to
        ? {
            createdAt: {
              ...(from && { gte: new Date(from) }),
              ...(to && { lte: new Date(to) }),
            },
          }
        : {}),
    },
    include: { branch: { select: { name: true } }, user: { select: { firstName: true, lastName: true, email: true } } },
    orderBy: { createdAt: 'desc' },
  });

  return orders.map((o) => ({
    id: o.id,
    trackingId: o.trackingId,
    branch: o.branch.name,
    customer: o.user ? `${o.user.firstName} ${o.user.lastName}` : 'Walk-in',
    type: o.type,
    status: o.status,
    total: o.total,
    paymentMethod: o.paymentMethod,
    paymentStatus: o.paymentStatus,
    createdAt: o.createdAt.toISOString(),
  }));
}

export async function exportBookings(branchId?: number, from?: string, to?: string) {
  const bookings = await prisma.serviceBooking.findMany({
    where: {
      ...(branchId && { branchId }),
      ...(from || to
        ? {
            date: {
              ...(from && { gte: new Date(from) }),
              ...(to && { lte: new Date(to) }),
            },
          }
        : {}),
    },
    include: {
      service: { select: { name: true, basePrice: true } },
      user: { select: { firstName: true, lastName: true } },
    },
    orderBy: { date: 'desc' },
  });

  return bookings.map((b) => ({
    id: b.id,
    service: b.service.name,
    customer: b.user ? `${b.user.firstName} ${b.user.lastName}` : b.customerName,
    date: b.date.toISOString().split('T')[0],
    time: b.time,
    status: b.status,
    price: b.service.basePrice,
  }));
}

export async function exportInventory(branchId?: number) {
  const inventories = await prisma.inventory.findMany({
    where: branchId ? { branchId } : undefined,
    include: { part: true, branch: { select: { name: true } } },
    orderBy: [{ branchId: 'asc' }, { partId: 'asc' }],
  });

  return inventories.map((i) => ({
    branch: i.branch.name,
    itemCode: i.part.itemCode,
    partName: i.part.name,
    quantity: i.quantity,
    alertAt: i.part.alertAt,
    lowStock: i.quantity <= i.part.alertAt ? 'YES' : 'NO',
  }));
}
