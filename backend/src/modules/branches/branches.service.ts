import { Role } from '@prisma/client';
import { prisma } from '../../config/database.js';
import { AppError, getPagination, paginatedResponse } from '../../utils/helpers.js';

export async function listBranches(activeOnly = false) {
  return prisma.branch.findMany({
    where: activeOnly
      ? { isActive: true, NOT: { name: { startsWith: 'Accounting Test' } } }
      : undefined,
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
}) {
  return prisma.branch.create({ data });
}

export async function updateBranch(
  id: number,
  data: Partial<{ name: string; location: string; phone: string; whatsapp: string; description: string; isActive: boolean }>
) {
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
          walkInCustomers: true,
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
