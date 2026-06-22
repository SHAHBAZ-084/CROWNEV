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

export async function removePartFromBranch(branchId: number, partId: number) {
  await prisma.inventory.deleteMany({ where: { branchId, partId } });
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

const BIKE_LOW_STOCK_THRESHOLD = 3;

export type BranchStockItem = {
  type: 'BIKE' | 'PART';
  source: 'PRODUCT' | 'SERVICE_PART';
  id: string | number;
  name: string;
  code: string;
  quantity: number;
  alertAt: number;
  isLowStock: boolean;
  isSelected: boolean;
};

export async function getBranchStock(branchId: number) {
  const [catalogProducts, inventories, serviceParts] = await Promise.all([
    prisma.product.findMany({
      where: { isActive: true, type: { in: ['BIKE', 'PART'] } },
      include: { branchProducts: { where: { branchId } } },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    }),
    prisma.inventory.findMany({
      where: { branchId },
      include: { part: true },
    }),
    prisma.part.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } }),
  ]);

  const inventoryByPartId = new Map(inventories.map((i) => [i.partId, i]));

  const productItems: BranchStockItem[] = catalogProducts.map((product) => {
    const branchLink = product.branchProducts[0];
    const quantity = branchLink?.stock ?? 0;
    const isSelected = branchLink?.isListed ?? false;
    const alertAt = product.type === 'BIKE' ? BIKE_LOW_STOCK_THRESHOLD : 5;
    return {
      type: product.type,
      source: 'PRODUCT',
      id: product.id,
      name: product.name,
      code: product.slug,
      quantity,
      alertAt,
      isLowStock: isSelected && quantity <= alertAt,
      isSelected,
    };
  });

  const servicePartItems: BranchStockItem[] = serviceParts.map((part) => {
    const inventory = inventoryByPartId.get(part.id);
    const quantity = inventory?.quantity ?? 0;
    const isSelected = !!inventory;
    return {
      type: 'PART',
      source: 'SERVICE_PART',
      id: part.id,
      name: part.name,
      code: part.itemCode,
      quantity,
      alertAt: part.alertAt,
      isLowStock: isSelected && quantity <= part.alertAt,
      isSelected,
    };
  });

  const items = [...productItems, ...servicePartItems];
  const lowStock = items.filter((i) => i.isSelected && i.isLowStock);
  const selectedItems = items.filter((i) => i.isSelected);

  return {
    summary: {
      totalBikes: productItems.filter((i) => i.type === 'BIKE').length,
      totalParts: productItems.filter((i) => i.type === 'PART').length + servicePartItems.length,
      bikesInStock: productItems.filter((i) => i.type === 'BIKE' && i.isSelected && i.quantity > 0).length,
      partsInStock: selectedItems.filter((i) => i.type === 'PART' && i.quantity > 0).length,
      lowStockCount: lowStock.length,
      totalUnits: selectedItems.reduce((sum, i) => sum + i.quantity, 0),
    },
    items,
    lowStock,
  };
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
