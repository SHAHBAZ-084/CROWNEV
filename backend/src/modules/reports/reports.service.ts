import { OrderStatus, OrderType, Prisma, ChassisStatus } from '@prisma/client';
import { prisma } from '../../config/database.js';
import { comparePassword } from '../../utils/crypto.js';
import { AppError } from '../../utils/helpers.js';
import { EXPORT_MAX_ROWS, withTimeout } from '../../utils/timeout.js';

export type ReportPeriod = 'daily' | 'weekly' | 'monthly' | 'yearly';

const CONFIRMED_STATUSES: OrderStatus[] = [OrderStatus.CONFIRMED];

export function getPeriodRange(period: ReportPeriod) {
  const now = new Date();
  const to = new Date(now);
  to.setHours(23, 59, 59, 999);

  const from = new Date(now);
  from.setHours(0, 0, 0, 0);

  let label: string;
  switch (period) {
    case 'weekly': {
      const day = from.getDay();
      const diff = day === 0 ? 6 : day - 1;
      from.setDate(from.getDate() - diff);
      label = 'This week';
      break;
    }
    case 'monthly':
      from.setDate(1);
      label = 'This month';
      break;
    case 'yearly':
      from.setMonth(0, 1);
      label = 'This year';
      break;
    default:
      label = 'Today';
      break;
  }

  return { from, to, label, period };
}

export async function getSalesSummary(period: ReportPeriod, branchId?: number) {
  const { from, to, label } = getPeriodRange(period);

  const orderWhere = {
    ...(branchId !== undefined && { branchId }),
    status: { in: CONFIRMED_STATUSES },
    invoiceDate: { gte: from, lte: to },
  };

  const serviceWhere = {
    ...(branchId !== undefined && { branchId }),
    invoiceDate: { gte: from, lte: to },
  };

  const [
    onlineAgg,
    posAgg,
    onlineCount,
    posCount,
    serviceAgg,
    serviceCount,
  ] = await Promise.all([
    prisma.order.aggregate({
      where: { ...orderWhere, type: OrderType.ONLINE },
      _sum: { total: true },
    }),
    prisma.order.aggregate({
      where: { ...orderWhere, type: OrderType.POS },
      _sum: { total: true },
    }),
    prisma.order.count({ where: { ...orderWhere, type: OrderType.ONLINE } }),
    prisma.order.count({ where: { ...orderWhere, type: OrderType.POS } }),
    prisma.serviceInvoice.aggregate({
      where: serviceWhere,
      _sum: { total: true },
    }),
    prisma.serviceInvoice.count({ where: serviceWhere }),
  ]);

  const onlineSales = Number(onlineAgg._sum.total ?? 0);
  const posSales = Number(posAgg._sum.total ?? 0);
  const serviceSales = Number(serviceAgg._sum.total ?? 0);
  const walkInSales = posSales + serviceSales;

  return {
    period,
    label,
    from: from.toISOString(),
    to: to.toISOString(),
    branchId: branchId ?? null,
    totalSales: onlineSales + walkInSales,
    onlineSales,
    walkInSales,
    posSales,
    serviceSales,
    onlineOrders: onlineCount,
    walkInOrders: posCount,
    serviceInvoices: serviceCount,
    totalOrders: onlineCount + posCount,
  };
}

export async function getBranchSalesSummary(branchId: number, period: ReportPeriod) {
  return getSalesSummary(period, branchId);
}

async function countLowStockAlerts(branchId?: number) {
  const rows = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*)::bigint AS count
    FROM "Inventory" i
    INNER JOIN "Part" p ON i."partId" = p.id
    WHERE p."isActive" = true
      AND i.quantity <= p."alertAt"
      ${branchId ? Prisma.sql`AND i."branchId" = ${branchId}` : Prisma.empty}
  `;
  return Number(rows[0]?.count ?? 0);
}

export async function getAdminDashboard() {
  return withTimeout(
    (async () => {
      const [
        revenue,
        orderCount,
        branchCount,
        lowStockAlerts,
        recentOrders,
        branchMeta,
        revenueByBranch,
      ] = await Promise.all([
        prisma.order.aggregate({
          where: { status: 'CONFIRMED' },
          _sum: { total: true },
        }),
        prisma.order.count({ where: { status: { not: OrderStatus.CANCELLED } } }),
        prisma.branch.count({ where: { isActive: true } }),
        countLowStockAlerts(),
        prisma.order.findMany({
          where: { status: { not: OrderStatus.CANCELLED } },
          take: 10,
          orderBy: [{ invoiceDate: 'desc' }, { id: 'desc' }],
          select: {
            id: true,
            publicId: true,
            saleReference: true,
            type: true,
            status: true,
            total: true,
            branch: { select: { name: true } },
          },
        }),
        prisma.branch.findMany({
          where: { isActive: true },
          select: { id: true, name: true, _count: { select: { orders: true } } },
          take: 100,
        }),
        prisma.order.groupBy({
          by: ['branchId'],
          where: { status: 'CONFIRMED' },
          _sum: { total: true },
        }),
      ]);

      const revenueMap = new Map(
        revenueByBranch.map((row) => [row.branchId, Number(row._sum.total ?? 0)])
      );

      const branchComparison = branchMeta.map((b) => ({
        id: b.id,
        name: b.name,
        orderCount: b._count.orders,
        revenue: revenueMap.get(b.id) ?? 0,
      }));

      return {
        totalRevenue: revenue._sum.total ?? 0,
        totalOrders: orderCount,
        totalBranches: branchCount,
        lowStockAlerts,
        recentOrders,
        branchComparison,
      };
    })(),
    25_000,
    'Admin dashboard'
  );
}

export async function getRevenueTrend(branchId?: number, days = 30) {
  const cappedDays = Math.min(Math.max(days, 1), 365);
  const since = new Date();
  since.setDate(since.getDate() - cappedDays);
  since.setHours(0, 0, 0, 0);

  const rows = await prisma.$queryRaw<{ day: Date; revenue: string }[]>`
    SELECT DATE("invoiceDate") AS day, SUM(total)::text AS revenue
    FROM "Order"
    WHERE status = 'CONFIRMED'
      AND "invoiceDate" >= ${since}
      ${branchId ? Prisma.sql`AND "branchId" = ${branchId}` : Prisma.empty}
    GROUP BY DATE("invoiceDate")
    ORDER BY day ASC
  `;

  return rows.map((row) => ({
    date: row.day.toISOString().split('T')[0],
    revenue: Number(row.revenue),
  }));
}

type ExportPagination = { page?: string; limit?: string };

/** Oldest transaction first (ID 1 → latest) for PDF/CSV exports */
const EXPORT_CHRONOLOGICAL = [{ id: 'asc' as const }];

function exportPagination(query?: ExportPagination) {
  const page = Math.max(1, parseInt(query?.page ?? '1', 10) || 1);
  const limit = Math.min(
    EXPORT_MAX_ROWS,
    Math.max(1, parseInt(query?.limit ?? String(EXPORT_MAX_ROWS), 10) || EXPORT_MAX_ROWS)
  );
  return { skip: (page - 1) * limit, take: limit };
}

export async function exportOrders(
  branchId?: number,
  from?: string,
  to?: string,
  pagination?: ExportPagination
) {
  const fromDate = from ? new Date(from) : undefined;
  const toDate = to ? new Date(to) : undefined;
  if (toDate) toDate.setHours(23, 59, 59, 999);

  const { take, skip } = exportPagination(pagination);

  const orders = await prisma.order.findMany({
    where: {
      ...(branchId && { branchId }),
      ...(fromDate || toDate
        ? {
            invoiceDate: {
              ...(fromDate && { gte: fromDate }),
              ...(toDate && { lte: toDate }),
            },
          }
        : {}),
    },
    include: {
      branch: { select: { name: true } },
      user: { select: { firstName: true, lastName: true, email: true } },
      customer: { select: { name: true, type: true } },
    },
    orderBy: EXPORT_CHRONOLOGICAL,
    take,
    skip,
  });

  return orders.map((o) => ({
    id: o.id,
    reference: o.saleReference ?? (o.type === OrderType.ONLINE ? String(o.id) : null),
    orderId: o.type === OrderType.ONLINE ? o.id : null,
    branch: o.branch.name,
    customer: o.user
      ? `${o.user.firstName} ${o.user.lastName}`.trim()
      : o.customer?.name ?? o.customerName ?? 'Walk-in',
    type: o.type === OrderType.ONLINE ? 'Online' : 'Walk-in',
    status: o.status,
    total: o.total,
    paymentMethod: o.paymentMethod,
    paymentStatus: o.paymentStatus,
    createdAt: o.invoiceDate.toISOString(),
  }));
}

export async function exportBookings(
  branchId?: number,
  from?: string,
  to?: string,
  pagination?: ExportPagination
) {
  const { take, skip } = exportPagination(pagination);

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
      branch: { select: { name: true } },
      user: { select: { firstName: true, lastName: true } },
    },
    orderBy: EXPORT_CHRONOLOGICAL,
    take,
    skip,
  });

  return bookings.map((b) => ({
    id: b.id,
    branch: b.branch.name,
    service: b.service?.name ?? '',
    customer: b.user ? `${b.user.firstName} ${b.user.lastName}` : b.customerName,
    date: b.date ? b.date.toISOString().split('T')[0] : '',
    time: b.time,
    status: b.status,
    price: b.service?.basePrice ?? 0,
  }));
}

export async function exportInventory(branchId?: number, pagination?: ExportPagination) {
  const { take, skip } = exportPagination(pagination);

  const [inventories, bikes] = await Promise.all([
    prisma.inventory.findMany({
      where: branchId ? { branchId } : undefined,
      include: { part: true, branch: { select: { name: true } } },
      orderBy: [{ branchId: 'asc' }, { partId: 'asc' }],
    }),
    prisma.bikeChassisNumber.findMany({
      where: { status: ChassisStatus.IN_STOCK, ...(branchId ? { branchId } : {}) },
      include: {
        product: { select: { name: true, model: true } },
        branch: { select: { name: true } },
      },
      orderBy: [{ branchId: 'asc' }, { chassisNumber: 'asc' }],
    }),
  ]);

  const partRows = inventories.map((i) => ({
    branch: i.branch.name,
    type: 'Part',
    itemCode: i.part.itemCode,
    name: i.part.name,
    color: '',
    quantity: i.quantity,
    alertAt: String(i.part.alertAt),
    lowStock: i.quantity <= i.part.alertAt ? 'YES' : 'NO',
  }));

  const bikeRows = bikes.map((b) => ({
    branch: b.branch.name,
    type: 'Bike',
    itemCode: b.chassisNumber,
    name: b.product.model ? `${b.product.name} (${b.product.model})` : b.product.name,
    color: b.color ?? '',
    quantity: 1,
    alertAt: 'N/A',
    lowStock: 'N/A',
  }));

  const rows = [...partRows, ...bikeRows];
  return pagination ? rows.slice(skip, skip + take) : rows;
}

export async function getProfitLossReport(
  branchId: number,
  revenueType: 'sale' | 'service',
  range: { from?: string; to?: string },
) {
  const fromDate = range.from ? new Date(range.from) : undefined;
  const toDate = range.to ? new Date(`${range.to}T23:59:59.999`) : undefined;

  if (revenueType === 'sale') {
    const chassisRows = await prisma.bikeChassisNumber.findMany({
      where: {
        branchId,
        status: ChassisStatus.SOLD,
        saleOrderItem: {
          order: {
            status: { not: OrderStatus.CANCELLED },
            ...(fromDate || toDate
              ? {
                  invoiceDate: {
                    ...(fromDate && { gte: fromDate }),
                    ...(toDate && { lte: toDate }),
                  },
                }
              : {}),
          },
        },
      },
      include: {
        product: { select: { name: true, model: true } },
        saleOrderItem: { select: { unitPrice: true, order: { select: { invoiceDate: true } } } },
        purchase: { select: { items: { select: { productId: true, unitCost: true } } } },
      },
    });

    const items = chassisRows.map((c) => {
      const salePrice = Number(c.saleOrderItem?.unitPrice ?? 0);
      // If purchase has two lines for the same product, .find() uses the first match — acceptable approximation.
      const fallbackUnitCost = c.purchase.items.find((i) => i.productId === c.productId)?.unitCost;
      const purchasePrice = Number(c.purchasePrice ?? fallbackUnitCost ?? 0);
      return {
        modelName: c.product.model ? `${c.product.name} (${c.product.model})` : c.product.name,
        chassisNumber: c.chassisNumber,
        salePrice,
        purchasePrice,
        profit: salePrice - purchasePrice,
        date: c.saleOrderItem?.order.invoiceDate,
        settled: c.profitSettledAt !== null,
      };
    });

    const unsettled = items.filter((i) => !i.settled);
    const settledItems = items.filter((i) => i.settled);
    const totalRevenue = unsettled.reduce((s, i) => s + i.salePrice, 0);
    const totalProfit = unsettled.reduce((s, i) => s + i.profit, 0);
    const settledProfit = settledItems.reduce((s, i) => s + i.profit, 0);

    return { revenueType, items, totalRevenue, totalProfit, settledProfit };
  }

  const invoices = await prisma.serviceInvoice.findMany({
    where: {
      branchId,
      ...(fromDate || toDate
        ? {
            invoiceDate: {
              ...(fromDate && { gte: fromDate }),
              ...(toDate && { lte: toDate }),
            },
          }
        : {}),
    },
    select: { total: true },
  });
  const totalRevenue = invoices.reduce((s, i) => s + Number(i.total), 0);

  return { revenueType, items: [], totalRevenue, totalProfit: totalRevenue, count: invoices.length };
}

export async function setChassisProfitSettled(
  branchId: number,
  chassisNumbers: string[],
  settled: boolean,
  userId: string,
  password: string,
) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.passwordHash) {
    throw new AppError(400, 'Password verification is not available for this account');
  }
  const valid = await comparePassword(password, user.passwordHash);
  if (!valid) throw new AppError(401, 'Current password is incorrect');

  const uniqueNumbers = [...new Set(chassisNumbers.map((n) => n.trim()).filter(Boolean))];
  if (uniqueNumbers.length === 0) {
    throw new AppError(400, 'At least one chassis number is required');
  }

  const rows = await prisma.bikeChassisNumber.findMany({
    where: {
      chassisNumber: { in: uniqueNumbers },
      branchId,
      status: ChassisStatus.SOLD,
    },
    select: { id: true, chassisNumber: true },
  });

  if (rows.length !== uniqueNumbers.length) {
    const found = new Set(rows.map((r) => r.chassisNumber));
    const missing = uniqueNumbers.filter((n) => !found.has(n));
    throw new AppError(
      400,
      `Chassis not found as sold in this branch: ${missing.join(', ')}`,
    );
  }

  const result = await prisma.bikeChassisNumber.updateMany({
    where: { id: { in: rows.map((r) => r.id) } },
    data: settled
      ? { profitSettledAt: new Date(), profitSettledById: userId }
      : { profitSettledAt: null, profitSettledById: null },
  });

  return result.count;
}
