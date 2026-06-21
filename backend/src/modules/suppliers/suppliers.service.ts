import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database.js';
import { AppError, getPagination, paginatedResponse } from '../../utils/helpers.js';
import { addStock } from '../inventory/inventory.service.js';

export async function listSuppliers(branchId?: number, query?: { page?: string; limit?: string }) {
  const { page, limit, skip } = getPagination(query ?? {});
  const where = branchId ? { branchId } : {};

  const [suppliers, total] = await Promise.all([
    prisma.supplier.findMany({ where, skip, take: limit, orderBy: { name: 'asc' } }),
    prisma.supplier.count({ where }),
  ]);

  return paginatedResponse(suppliers, total, page, limit);
}

export async function createSupplier(data: {
  branchId: number;
  name: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
}) {
  return prisma.supplier.create({ data });
}

export async function updateSupplier(id: number, branchId: number, data: Record<string, unknown>) {
  const supplier = await prisma.supplier.findFirst({ where: { id, branchId } });
  if (!supplier) throw new AppError(404, 'Supplier not found');
  return prisma.supplier.update({ where: { id }, data });
}

export async function listPurchases(branchId?: number, query?: { page?: string; limit?: string }) {
  const { page, limit, skip } = getPagination(query ?? {});
  const where = branchId ? { branchId } : {};

  const [purchases, total] = await Promise.all([
    prisma.purchase.findMany({
      where,
      skip,
      take: limit,
      include: { supplier: true, items: { include: { part: true, product: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.purchase.count({ where }),
  ]);

  return paginatedResponse(purchases, total, page, limit);
}

export async function createPurchase(data: {
  branchId: number;
  supplierId: number;
  invoiceNumber?: string;
  documentRef?: string;
  notes?: string;
  items: {
    partId?: number;
    productId?: string;
    quantity: number;
    unitCost: number;
    engineNumber?: string;
    chassisNumber?: string;
  }[];
}) {
  const total = data.items.reduce((sum, i) => sum + i.unitCost * i.quantity, 0);

  const purchase = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const created = await tx.purchase.create({
      data: {
        branchId: data.branchId,
        supplierId: data.supplierId,
        invoiceNumber: data.invoiceNumber,
        documentRef: data.documentRef,
        notes: data.notes,
        total,
        items: { create: data.items },
      },
      include: { items: true, supplier: true },
    });

    const partItems = data.items.filter((i) => i.partId).map((i) => ({
      partId: i.partId!,
      quantity: i.quantity,
    }));
    if (partItems.length) {
      await addStock(data.branchId, partItems);
    }

    return created;
  });

  return purchase;
}

export async function getPurchase(id: number, branchId?: number) {
  const purchase = await prisma.purchase.findFirst({
    where: { id, ...(branchId && { branchId }) },
    include: { supplier: true, items: { include: { part: true, product: true } } },
  });
  if (!purchase) throw new AppError(404, 'Purchase not found');
  return purchase;
}
