import { Prisma, ProductType, StockAdjustmentReason } from '@prisma/client';
import { prisma } from '../../config/database.js';
import { countInStockChassis } from '../chassis/chassis.service.js';
import {
  partItemCodeFromSpecs,
  partModelFromSpecs,
} from '../products/products.service.js';
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

export async function deductBranchProductStockInTx(
  tx: Prisma.TransactionClient,
  branchId: number,
  productId: string,
  quantity: number,
  productType: ProductType,
) {
  if (productType !== ProductType.BIKE && productType !== ProductType.PART) return;

  const updated = await tx.branchProduct.updateMany({
    where: {
      branchId,
      productId,
      stock: { gte: quantity },
    },
    data: { stock: { decrement: quantity } },
  });

  if (updated.count !== 1) {
    throw new AppError(400, `Insufficient stock for ${productType.toLowerCase()}`);
  }
}

export async function deductPartInventoryInTx(
  tx: Prisma.TransactionClient,
  branchId: number,
  partId: number,
  quantity: number,
) {
  const updated = await tx.inventory.updateMany({
    where: {
      branchId,
      partId,
      quantity: { gte: quantity },
    },
    data: { quantity: { decrement: quantity } },
  });

  if (updated.count !== 1) {
    throw new AppError(400, `Insufficient stock for part ${partId}`);
  }
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
      await deductPartInventoryInTx(tx, branchId, item.partId, item.quantity);
    }
  });
}

export async function addStockInTx(
  tx: Prisma.TransactionClient,
  branchId: number,
  items: { partId: number; quantity: number }[],
) {
  for (const item of items) {
    await tx.inventory.upsert({
      where: { branchId_partId: { branchId, partId: item.partId } },
      create: { branchId, partId: item.partId, quantity: item.quantity },
      update: { quantity: { increment: item.quantity } },
    });
  }
}

export async function addStock(branchId: number, items: { partId: number; quantity: number }[]) {
  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await addStockInTx(tx, branchId, items);
  });
}

export async function getLowStockAlerts(branchId?: number) {
  const inventories = await prisma.inventory.findMany({
    where: {
      ...(branchId && { branchId }),
      part: { isActive: true },
    },
    include: { part: true, branch: { select: { id: true, name: true } } },
    orderBy: { quantity: 'asc' },
    take: 500,
  });
  return inventories.filter((i) => i.quantity <= i.part.alertAt);
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
  brand?: string | null;
  category?: string | null;
  model?: string | null;
};

export async function getBranchStock(branchId: number) {
  const [listedProducts, inventories] = await Promise.all([
    prisma.product.findMany({
      where: {
        isActive: true,
        type: { in: ['BIKE', 'PART'] },
        branchProducts: { some: { branchId, isListed: true } },
      },
      include: { branchProducts: { where: { branchId } }, brand: true, category: true },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    }),
    prisma.inventory.findMany({
      where: { branchId },
      include: { part: true },
    }),
  ]);

  const productItems: BranchStockItem[] = [];
  for (const product of listedProducts) {
    const branchLink = product.branchProducts[0];
    let quantity = branchLink?.stock ?? 0;
    if (product.type === 'BIKE') {
      quantity = await countInStockChassis(branchId, product.id);
    }
    const alertAt = product.type === 'BIKE' ? BIKE_LOW_STOCK_THRESHOLD : 5;
    productItems.push({
      type: product.type,
      source: 'PRODUCT',
      id: product.id,
      name: product.name,
      code: partItemCodeFromSpecs(product.specs) ?? product.slug,
      quantity,
      alertAt,
      isLowStock: quantity <= alertAt,
      isSelected: true,
      brand: product.brand?.name ?? null,
      category: product.category?.name ?? null,
      model: product.model ?? partModelFromSpecs(product.specs),
    });
  }

  const servicePartItems: BranchStockItem[] = inventories
    .filter((row) => row.part?.isActive)
    .map((row) => {
      const part = row.part!;
      const quantity = row.quantity;
      return {
        type: 'PART' as const,
        source: 'SERVICE_PART' as const,
        id: part.id,
        name: part.name,
        code: part.itemCode,
        quantity,
        alertAt: part.alertAt,
        isLowStock: quantity <= part.alertAt,
        isSelected: true,
      };
    });

  const items = [...productItems, ...servicePartItems];
  const lowStock = items.filter((i) => i.isLowStock);

  return {
    summary: {
      totalBikes: productItems.filter((i) => i.type === 'BIKE').length,
      totalParts:
        productItems.filter((i) => i.type === 'PART').length + servicePartItems.length,
      bikesInStock: productItems.filter((i) => i.type === 'BIKE' && i.quantity > 0).length,
      partsInStock: items.filter((i) => i.type === 'PART' && i.quantity > 0).length,
      lowStockCount: lowStock.length,
      totalUnits: items.reduce((sum, i) => sum + i.quantity, 0),
    },
    items,
    lowStock,
  };
}

export type BikeModelSummary = { name: string; quantity: number };

export type BranchInventorySummary = {
  branchId: number;
  branchName?: string;
  bikeModels: BikeModelSummary[];
  totalBikeUnits: number;
  totalPartUnits: number;
};

export async function getInventorySummary(branchId: number): Promise<BranchInventorySummary> {
  const stock = await getBranchStock(branchId);
  const bikeModels: BikeModelSummary[] = stock.items
    .filter((i) => i.type === 'BIKE' && i.quantity > 0)
    .map((i) => ({ name: i.model ? `${i.name} (${i.model})` : i.name, quantity: i.quantity }))
    .sort((a, b) => b.quantity - a.quantity);
  const totalBikeUnits = bikeModels.reduce((sum, m) => sum + m.quantity, 0);
  const totalPartUnits = stock.items
    .filter((i) => i.type === 'PART')
    .reduce((sum, i) => sum + i.quantity, 0);
  return { branchId, bikeModels, totalBikeUnits, totalPartUnits };
}

export async function getAdminInventorySummary() {
  const branches = await prisma.branch.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });
  const perBranch = await Promise.all(
    branches.map(async (b) => ({
      branchName: b.name,
      ...(await getInventorySummary(b.id)),
    }))
  );
  const grandTotalBikeUnits = perBranch.reduce((sum, b) => sum + b.totalBikeUnits, 0);
  const grandTotalPartUnits = perBranch.reduce((sum, b) => sum + b.totalPartUnits, 0);
  return { branches: perBranch, grandTotalBikeUnits, grandTotalPartUnits };
}

async function findProductIdsByPartSpecsSearch(q: string): Promise<string[]> {
  const pattern = `%${q.replace(/[%_\\]/g, '\\$&')}%`;
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM "Product"
    WHERE specs IS NOT NULL
      AND (
        specs->>'item_code' ILIKE ${pattern}
        OR specs->>'model' ILIKE ${pattern}
      )
  `;
  return rows.map((row) => row.id);
}

/** Search global catalog for products/parts not yet selected at this branch. */
export async function searchBranchCatalog(branchId: number, search: string, limit = 10) {
  const q = search.trim();
  if (!q) return [] as BranchStockItem[];

  const specMatchIds = await findProductIdsByPartSpecsSearch(q);

  const [products, serviceParts] = await Promise.all([
    prisma.product.findMany({
      where: {
        isActive: true,
        type: { in: ['BIKE', 'PART'] },
        branchProducts: { none: { branchId, isListed: true } },
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { description: { contains: q, mode: 'insensitive' } },
          { slug: { contains: q, mode: 'insensitive' } },
          { model: { contains: q, mode: 'insensitive' } },
          ...(specMatchIds.length ? [{ id: { in: specMatchIds } }] : []),
        ],
      },
      take: limit,
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        slug: true,
        type: true,
        model: true,
        specs: true,
        brand: { select: { name: true } },
        category: { select: { name: true } },
      },
    }),
    prisma.part.findMany({
      where: {
        isActive: true,
        inventory: { none: { branchId } },
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { itemCode: { contains: q, mode: 'insensitive' } },
          { description: { contains: q, mode: 'insensitive' } },
        ],
      },
      take: limit,
      orderBy: { name: 'asc' },
      select: { id: true, name: true, itemCode: true, alertAt: true },
    }),
  ]);

  const productRows: BranchStockItem[] = products.map((p) => ({
    type: p.type,
    source: 'PRODUCT',
    id: p.id,
    name: p.name,
    code: partItemCodeFromSpecs(p.specs) ?? p.slug,
    quantity: 0,
    alertAt: p.type === 'BIKE' ? BIKE_LOW_STOCK_THRESHOLD : 5,
    isLowStock: false,
    isSelected: false,
    brand: p.brand?.name ?? null,
    category: p.category?.name ?? null,
    model: p.model ?? partModelFromSpecs(p.specs),
  }));

  const serviceRows: BranchStockItem[] = serviceParts.map((part) => ({
    type: 'PART',
    source: 'SERVICE_PART',
    id: part.id,
    name: part.name,
    code: part.itemCode,
    quantity: 0,
    alertAt: part.alertAt,
    isLowStock: false,
    isSelected: false,
  }));

  return [...productRows, ...serviceRows].slice(0, limit);
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
