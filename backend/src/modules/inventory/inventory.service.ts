import { Prisma, StockAdjustmentReason } from '@prisma/client';
import { prisma } from '../../config/database.js';
import { AppError, getPagination, paginatedResponse } from '../../utils/helpers.js';

export async function getBranchInventory(branchId: number, query: { page?: string; limit?: string; lowStock?: boolean }) {
  const { page, limit, skip } = getPagination(query);

  const inventory = await prisma.inventory.findMany({
    where: {
      branchId,
      ...(query.lowStock && {
        part: { isActive: true },
      }),
    },
    include: { part: true },
    skip,
    take: limit,
    orderBy: { part: { name: 'asc' } },
  });

  const filtered = query.lowStock
    ? inventory.filter((i: (typeof inventory)[number]) => i.quantity <= i.part.alertAt)
    : inventory;

  const total = await prisma.inventory.count({ where: { branchId } });
  return paginatedResponse(filtered, total, page, limit);
}

export async function updateStock(branchId: number, partId: number, quantity: number) {
  return prisma.inventory.upsert({
    where: { branchId_partId: { branchId, partId } },
    create: { branchId, partId, quantity },
    update: { quantity },
    include: { part: true },
  });
}

export async function adjustStock(data: {
  branchId: number;
  partId: number;
  quantityChange: number;
  reason: StockAdjustmentReason;
  notes?: string;
  adjustedById: string;
}) {
  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const inventory = await tx.inventory.findUnique({
      where: { branchId_partId: { branchId: data.branchId, partId: data.partId } },
    });

    const currentQty = inventory?.quantity ?? 0;
    const newQty = currentQty + data.quantityChange;
    if (newQty < 0) throw new AppError(400, 'Insufficient stock');

    const [updated, adjustment] = await Promise.all([
      tx.inventory.upsert({
        where: { branchId_partId: { branchId: data.branchId, partId: data.partId } },
        create: { branchId: data.branchId, partId: data.partId, quantity: newQty },
        update: { quantity: newQty },
        include: { part: true },
      }),
      tx.stockAdjustment.create({
        data: {
          branchId: data.branchId,
          partId: data.partId,
          quantityChange: data.quantityChange,
          reason: data.reason,
          notes: data.notes,
          adjustedById: data.adjustedById,
        },
      }),
    ]);

    return { inventory: updated, adjustment };
  });
}

export async function deductStock(branchId: number, items: { partId: number; quantity: number }[]) {
  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    for (const item of items) {
      const inventory = await tx.inventory.findUnique({
        where: { branchId_partId: { branchId, partId: item.partId } },
      });
      const currentQty = inventory?.quantity ?? 0;
      if (currentQty < item.quantity) {
        throw new AppError(400, `Insufficient stock for part ${item.partId}`);
      }
      await tx.inventory.update({
        where: { branchId_partId: { branchId, partId: item.partId } },
        data: { quantity: currentQty - item.quantity },
      });
    }
  });
}

export async function addStock(branchId: number, items: { partId: number; quantity: number }[]) {
  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    for (const item of items) {
      await tx.inventory.upsert({
        where: { branchId_partId: { branchId, partId: item.partId } },
        create: { branchId, partId: item.partId, quantity: item.quantity },
        update: { quantity: { increment: item.quantity } },
      });
    }
  });
}

export async function getLowStockAlerts(branchId?: number) {
  const inventories = await prisma.inventory.findMany({
    where: branchId ? { branchId } : undefined,
    include: { part: true, branch: { select: { id: true, name: true } } },
  });
  return inventories.filter((i: (typeof inventories)[number]) => i.quantity <= i.part.alertAt && i.part.isActive);
}

export async function listAdjustments(branchId: number, query: { page?: string; limit?: string }) {
  const { page, limit, skip } = getPagination(query);
  const where = { branchId };

  const [adjustments, total] = await Promise.all([
    prisma.stockAdjustment.findMany({
      where,
      skip,
      take: limit,
      include: { part: true, adjustedBy: { select: { firstName: true, lastName: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.stockAdjustment.count({ where }),
  ]);

  return paginatedResponse(adjustments, total, page, limit);
}
