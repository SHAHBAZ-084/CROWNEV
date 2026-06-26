import { OrderStatus, Role, VoucherStatus } from '@prisma/client';
import { prisma } from '../../config/database.js';
import {
  bootstrapBranchChartOfAccounts,
} from '../accounting/accounting.service.js';
import { deleteBranchImageFile } from '../../utils/imageProcessing.js';
import { AppError, getPagination, paginatedResponse } from '../../utils/helpers.js';

export async function listBranches(activeOnly = false) {
  const excludeTestBranches = { NOT: { name: { startsWith: 'Accounting Test' } } };
  return prisma.branch.findMany({
    where: activeOnly
      ? { isActive: true, ...excludeTestBranches }
      : excludeTestBranches,
    include: {
      owner: { select: { id: true, firstName: true, lastName: true, email: true } },
      _count: { select: { orders: true, inventory: true } },
    },
    orderBy: { name: 'asc' },
  });
}

export async function getBranch(id: number) {
  const branch = await prisma.branch.findUnique({
    where: { id },
    include: {
      owner: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
  });
  if (!branch) throw new AppError(404, 'Branch not found');
  return branch;
}

export async function createBranch(data: {
  name: string;
  location: string;
  phone: string;
  whatsapp?: string;
  description?: string;
  imageUrl?: string;
  latitude?: number;
  longitude?: number;
}) {
  const branch = await prisma.branch.create({ data });
  await bootstrapBranchChartOfAccounts(branch.id);
  return branch;
}

export async function updateBranch(
  id: number,
  data: Partial<{
    name: string;
    location: string;
    phone: string;
    whatsapp: string;
    description: string;
    imageUrl: string | null;
    latitude: number | null;
    longitude: number | null;
    isActive: boolean;
  }>
) {
  if (data.imageUrl !== undefined) {
    const existing = await prisma.branch.findUnique({ where: { id }, select: { imageUrl: true } });
    if (existing?.imageUrl && existing.imageUrl !== data.imageUrl) {
      await deleteBranchImageFile(existing.imageUrl);
    }
  }
  return prisma.branch.update({ where: { id }, data });
}

export async function deleteBranch(id: number) {
  const branch = await prisma.branch.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          orders: true,
          inventory: true,
          services: true,
          suppliers: true,
          purchases: true,
          accounts: true,
          customers: true,
        },
      },
    },
  });
  if (!branch) throw new AppError(404, 'Branch not found');

  const hasData = Object.values(branch._count).some((n) => n > 0);

  if (hasData) {
    await prisma.$transaction([
      prisma.user.updateMany({ where: { branchId: id }, data: { branchId: null } }),
      prisma.branch.update({ where: { id }, data: { isActive: false, ownerId: null } }),
    ]);
    return { deactivated: true as const };
  }

  await prisma.$transaction([
    prisma.user.updateMany({ where: { branchId: id }, data: { branchId: null } }),
    prisma.branch.delete({ where: { id } }),
  ]);
  return { deactivated: false as const };
}

export async function assignOwner(branchId: number, ownerId: string) {
  const branch = await prisma.branch.findUnique({ where: { id: branchId } });
  if (!branch) throw new AppError(404, 'Branch not found');

  const user = await prisma.user.findUnique({ where: { id: ownerId } });
  if (!user) throw new AppError(404, 'User not found');

  return prisma.$transaction([
    prisma.user.update({
      where: { id: ownerId },
      data: { role: Role.BRANCH_OWNER, branchId },
    }),
    prisma.branch.update({
      where: { id: branchId },
      data: { ownerId },
    }),
  ]);
}

export async function assignStaff(branchId: number, userId: string) {
  const branch = await prisma.branch.findUnique({ where: { id: branchId } });
  if (!branch) throw new AppError(404, 'Branch not found');

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError(404, 'User not found');

  return prisma.user.update({
    where: { id: userId },
    data: { role: Role.BRANCH_OWNER, branchId },
  });
}

export async function removeStaff(branchId: number, userId: string) {
  const user = await prisma.user.findFirst({ where: { id: userId, branchId } });
  if (!user) throw new AppError(404, 'Staff member not found at this branch');

  const branch = await prisma.branch.findUnique({ where: { id: branchId } });
  if (branch?.ownerId === userId) {
    throw new AppError(400, 'Cannot remove branch owner — reassign owner first');
  }

  return prisma.user.update({
    where: { id: userId },
    data: { branchId: null },
  });
}

export async function listStaff(branchId: number) {
  return prisma.user.findMany({
    where: { branchId, role: Role.BRANCH_OWNER },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      isActive: true,
      createdAt: true,
    },
    orderBy: { firstName: 'asc' },
  });
}

export async function getBranchDashboard(branchId: number) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [revenue, todayBookings, pendingOrders, lowStock, recentOrders] = await Promise.all([
    prisma.order.aggregate({
      where: { branchId, status: { in: ['CONFIRMED', 'DELIVERED'] } },
      _sum: { total: true },
    }),
    prisma.serviceBooking.count({
      where: { branchId, date: { gte: today, lt: tomorrow }, status: { not: 'CANCELLED' } },
    }),
    prisma.order.count({ where: { branchId, status: 'PENDING' } }),
    prisma.inventory.count({
      where: {
        branchId,
        part: { isActive: true },
        quantity: { lte: 5 },
      },
    }),
    prisma.order.findMany({
      where: { branchId },
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { firstName: true, lastName: true } } },
    }),
  ]);

  return {
    revenue: revenue._sum.total ?? 0,
    todayBookings,
    pendingOrders,
    lowStockAlerts: lowStock,
    recentOrders,
  };
}

function startOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function startOfTomorrow() {
  const tomorrow = startOfToday();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow;
}

export async function getBranchClearPreview(branchId: number) {
  const branch = await prisma.branch.findUnique({ where: { id: branchId } });
  if (!branch) throw new AppError(404, 'Branch not found');

  const [
    orders,
    customers,
    suppliers,
    purchases,
    serviceInvoices,
    vouchers,
    inventory,
    branchProducts,
    bookings,
    services,
    stockAdjustments,
    accounts,
  ] = await Promise.all([
    prisma.order.count({ where: { branchId } }),
    prisma.customer.count({ where: { branchId } }),
    prisma.supplier.count({ where: { branchId } }),
    prisma.purchase.count({ where: { branchId } }),
    prisma.serviceInvoice.count({ where: { branchId } }),
    prisma.voucher.count({ where: { branchId } }),
    prisma.inventory.count({ where: { branchId } }),
    prisma.branchProduct.count({ where: { branchId } }),
    prisma.serviceBooking.count({ where: { branchId } }),
    prisma.service.count({ where: { branchId } }),
    prisma.stockAdjustment.count({ where: { branchId } }),
    prisma.account.count({ where: { branchId } }),
  ]);

  return {
    branchId,
    branchName: branch.name,
    counts: {
      orders,
      customers,
      suppliers,
      purchases,
      serviceInvoices,
      vouchers,
      inventory,
      branchProducts,
      bookings,
      services,
      stockAdjustments,
      accounts,
    },
  };
}

export async function clearBranchData(branchId: number, confirmName: string) {
  const branch = await prisma.branch.findUnique({ where: { id: branchId } });
  if (!branch) throw new AppError(404, 'Branch not found');

  if (confirmName.trim() !== branch.name.trim()) {
    throw new AppError(400, 'Branch name confirmation does not match');
  }

  const deleted = await prisma.$transaction(
    async (tx) => {
      const counts = {
        customerLedger: 0,
        supplierLedger: 0,
        ledgerEntries: 0,
        serviceInvoiceItems: 0,
        serviceInvoices: 0,
        orderItems: 0,
        orders: 0,
        purchaseItems: 0,
        purchases: 0,
        serviceBookingParts: 0,
        serviceBookings: 0,
        services: 0,
        serviceCategories: 0,
        suppliers: 0,
        vouchers: 0,
        customers: 0,
        ledgers: 0,
        accounts: 0,
        accountCategories: 0,
        inventory: 0,
        branchProducts: 0,
        stockAdjustments: 0,
        bankAccounts: 0,
        paymentChannels: 0,
        trialBalanceApprovals: 0,
        contactMessages: 0,
      };

      const r1 = await tx.customerLedger.deleteMany({
        where: {
          OR: [
            { customer: { branchId } },
            { order: { branchId } },
            { serviceInvoice: { branchId } },
          ],
        },
      });
      counts.customerLedger = r1.count;

      const r2 = await tx.supplierLedger.deleteMany({
        where: {
          OR: [{ supplier: { branchId } }, { purchase: { branchId } }],
        },
      });
      counts.supplierLedger = r2.count;

      const r3 = await tx.ledgerEntry.deleteMany({
        where: {
          OR: [{ ledger: { branchId } }, { voucher: { branchId } }],
        },
      });
      counts.ledgerEntries = r3.count;

      const r4 = await tx.serviceInvoiceItem.deleteMany({
        where: { serviceInvoice: { branchId } },
      });
      counts.serviceInvoiceItems = r4.count;

      const r5 = await tx.serviceInvoice.deleteMany({ where: { branchId } });
      counts.serviceInvoices = r5.count;

      const r6 = await tx.orderItem.deleteMany({ where: { order: { branchId } } });
      counts.orderItems = r6.count;

      const r7 = await tx.order.deleteMany({ where: { branchId } });
      counts.orders = r7.count;

      const r8 = await tx.purchaseItem.deleteMany({ where: { purchase: { branchId } } });
      counts.purchaseItems = r8.count;

      const r9 = await tx.purchase.deleteMany({ where: { branchId } });
      counts.purchases = r9.count;

      const r10 = await tx.serviceBookingPart.deleteMany({
        where: { booking: { branchId } },
      });
      counts.serviceBookingParts = r10.count;

      const r11 = await tx.serviceBooking.deleteMany({ where: { branchId } });
      counts.serviceBookings = r11.count;

      const r12 = await tx.service.deleteMany({ where: { branchId } });
      counts.services = r12.count;

      const r13 = await tx.serviceCategory.deleteMany({ where: { branchId } });
      counts.serviceCategories = r13.count;

      const r14 = await tx.supplier.deleteMany({ where: { branchId } });
      counts.suppliers = r14.count;

      const r15 = await tx.voucher.deleteMany({ where: { branchId } });
      counts.vouchers = r15.count;

      const r16 = await tx.customer.deleteMany({ where: { branchId } });
      counts.customers = r16.count;

      const r17 = await tx.ledger.deleteMany({ where: { branchId } });
      counts.ledgers = r17.count;

      const r18 = await tx.account.deleteMany({ where: { branchId } });
      counts.accounts = r18.count;

      const r19 = await tx.accountCategory.deleteMany({ where: { branchId } });
      counts.accountCategories = r19.count;

      const r20 = await tx.inventory.deleteMany({ where: { branchId } });
      counts.inventory = r20.count;

      const r21 = await tx.branchProduct.deleteMany({ where: { branchId } });
      counts.branchProducts = r21.count;

      const r22 = await tx.stockAdjustment.deleteMany({ where: { branchId } });
      counts.stockAdjustments = r22.count;

      const r23 = await tx.bankAccount.deleteMany({ where: { branchId } });
      counts.bankAccounts = r23.count;

      const r24 = await tx.branchPaymentChannel.deleteMany({ where: { branchId } });
      counts.paymentChannels = r24.count;

      const r25 = await tx.trialBalanceApproval.deleteMany({ where: { branchId } });
      counts.trialBalanceApprovals = r25.count;

      const r26 = await tx.contactMessage.deleteMany({ where: { branchId } });
      counts.contactMessages = r26.count;

      return counts;
    },
    { timeout: 120_000 },
  );

  await bootstrapBranchChartOfAccounts(branchId);

  return { branchId, branchName: branch.name, deleted };
}

export async function getPosWorkspaceStats(branchId: number) {
  const today = startOfToday();
  const tomorrow = startOfTomorrow();

  const [todayVouchers, todayCustomers, salesAgg] = await Promise.all([
    prisma.voucher.count({
      where: {
        branchId,
        status: { not: VoucherStatus.CANCELLED },
        createdAt: { gte: today, lt: tomorrow },
      },
    }),
    prisma.customer.count({
      where: {
        branchId,
        isActive: true,
        createdAt: { gte: today, lt: tomorrow },
      },
    }),
    prisma.order.aggregate({
      where: {
        branchId,
        status: { not: OrderStatus.CANCELLED },
        createdAt: { gte: today, lt: tomorrow },
      },
      _sum: { total: true },
    }),
  ]);

  return {
    todayVouchers,
    todayCustomers,
    todaySales: Number(salesAgg._sum.total ?? 0),
  };
}
