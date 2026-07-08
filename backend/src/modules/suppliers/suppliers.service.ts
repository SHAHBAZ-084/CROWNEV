import { Prisma, ProductType, SupplierLedgerType, VoucherType } from '@prisma/client';
import { prisma } from '../../config/database.js';
import { AppError, getPagination, paginatedResponse } from '../../utils/helpers.js';
import { addStockInTx } from '../inventory/inventory.service.js';
import {
  createChassisRecordsInTx,
  normalizeChassisNumber,
  normalizeIdentifierNumber,
  validateBikePurchaseUnits,
  validateBikeUnitsAvailable,
  type BikeUnitInput,
} from '../chassis/chassis.service.js';
import {
  createVoucherInTx,
  ensureInventoryAccount,
  ensureSupplierAccount,
  formatPurchaseItemsDescription,
} from '../accounting/accounting.service.js';
import { allocatePurchaseInvoiceNumber } from '../../utils/documentNumbers.js';

export async function listBranchSuppliers(branchId: number, query?: { page?: string; limit?: string }) {
  const { page, limit, skip } = getPagination(query ?? {});
  const where = { branchId, isActive: true };

  const [suppliers, total] = await Promise.all([
    prisma.supplier.findMany({ where, skip, take: limit, orderBy: { name: 'asc' } }),
    prisma.supplier.count({ where }),
  ]);

  return paginatedResponse(
    suppliers.map((s) => ({ ...s, balance: Number(s.balance) })),
    total,
    page,
    limit,
  );
}

export async function getSupplierLedgerFormatted(supplierId: number, branchId: number) {
  const supplier = await prisma.supplier.findFirst({
    where: { id: supplierId, branchId, isActive: true },
  });
  if (!supplier) throw new AppError(404, 'Supplier not found');

  const entries = await prisma.supplierLedger.findMany({
    where: { supplierId },
    include: {
      purchase: {
        include: {
          items: {
            include: {
              product: { select: { name: true } },
              part: { select: { name: true } },
            },
          },
        },
      },
    },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });

  type LedgerRow = {
    date: string;
    voucherNo: string;
    ref: string | null;
    type: string;
    description: string;
    debit: number;
    credit: number;
    balance: number;
  };

  const rows: LedgerRow[] = [];
  let totalDebit = 0;
  let totalCredit = 0;

  for (const e of entries) {
    const debit = e.type === SupplierLedgerType.DEBIT ? Number(e.amount) : 0;
    const credit = e.type === SupplierLedgerType.CREDIT ? Number(e.amount) : 0;
    totalDebit += debit;
    totalCredit += credit;
    const purchaseRef = e.purchase?.documentRef?.trim() || null;
    const purchaseItems = e.purchase?.items?.length
      ? formatPurchaseItemsDescription(e.purchase.items)
      : '';
    const purchaseBase = `From ${supplier.name} to inventory`;
    rows.push({
      date: e.createdAt.toISOString(),
      voucherNo: purchaseRef ?? String(e.id),
      ref: purchaseRef,
      type: e.type === SupplierLedgerType.CREDIT ? 'Purchase' : 'Payment',
      description:
        e.type === SupplierLedgerType.CREDIT
          ? purchaseItems
            ? `${purchaseBase} — ${purchaseItems}`
            : purchaseBase
          : (e.notes ?? 'Payment'),
      debit,
      credit,
      balance: Number(e.balance),
    });
  }

  return {
    supplier: {
      id: supplier.id,
      name: supplier.name,
      code: `S${String(supplier.id).padStart(4, '0')}`,
      balance: Number(supplier.balance),
    },
    rows,
    summary: {
      totalDebit,
      totalCredit,
      closingBalance: Number(supplier.balance),
    },
  };
}

export async function listSuppliers(
  branchId?: number,
  query?: { page?: string; limit?: string; search?: string },
) {
  const { page, limit, skip } = getPagination(query ?? {});
  const search = query?.search?.trim();
  const where = {
    ...(branchId ? { branchId } : {}),
    isActive: true,
    ...(search && {
      OR: [
        { name: { contains: search, mode: 'insensitive' as const } },
        { contactPerson: { contains: search, mode: 'insensitive' as const } },
        { phone: { contains: search } },
      ],
    }),
  };

  const [suppliers, total] = await Promise.all([
    prisma.supplier.findMany({ where, skip, take: limit, orderBy: { name: 'asc' } }),
    prisma.supplier.count({ where }),
  ]);

  return paginatedResponse(
    suppliers.map((s) => ({ ...s, balance: Number(s.balance) })),
    total,
    page,
    limit,
  );
}

export async function createSupplier(data: {
  branchId: number;
  name: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
}) {
  return prisma.$transaction(async (tx) => {
    const supplier = await tx.supplier.create({ data });
    await ensureSupplierAccount(tx, data.branchId, { id: supplier.id, name: supplier.name });
    return supplier;
  });
}

export async function updateSupplier(id: number, branchId: number, data: Record<string, unknown>) {
  return prisma.$transaction(async (tx) => {
    const supplier = await tx.supplier.findFirst({ where: { id, branchId } });
    if (!supplier) throw new AppError(404, 'Supplier not found');
    const updated = await tx.supplier.update({ where: { id }, data });
    if (typeof data.name === 'string' && data.name.trim()) {
      await ensureSupplierAccount(tx, branchId, { id: updated.id, name: updated.name });
    }
    return updated;
  });
}

export async function softDeleteSupplier(id: number, branchId: number) {
  const supplier = await prisma.supplier.findFirst({
    where: { id, branchId, isActive: true },
  });
  if (!supplier) throw new AppError(404, 'Supplier not found');
  return prisma.supplier.update({
    where: { id },
    data: { isActive: false },
  });
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

async function validatePurchaseItems(
  branchId: number,
  items: { productId?: string; itemId?: number; quantity: number; unitCost: number; bikeUnits?: BikeUnitInput[] }[],
) {
  const resolvedItems = [];
  for (const item of items) {
    if (item.itemId) {
      const dbItem = await prisma.item.findUnique({
        where: { id: item.itemId, isActive: true },
        include: {
          product: {
            include: {
              bikePartDetails: true,
              branchProducts: { where: { branchId } },
            },
          },
        },
      });
      if (!dbItem) {
        throw new AppError(404, `Item #${item.itemId} not found or inactive`);
      }
      resolvedItems.push({
        ...item,
        productId: dbItem.productId,
        product: dbItem.product,
        partId: dbItem.product.type === ProductType.PART ? dbItem.product.bikePartDetails.find(d => d.partId != null)?.partId ?? undefined : undefined,
      });
    } else if (item.productId) {
      const product = await prisma.product.findUnique({
        where: { id: item.productId, isActive: true },
        include: {
          bikePartDetails: true,
          branchProducts: { where: { branchId, isListed: true } },
        },
      });
      if (!product) {
        throw new AppError(404, `Product not found or inactive`);
      }
      resolvedItems.push({
        ...item,
        product,
        partId: product.type === ProductType.PART ? product.bikePartDetails.find(d => d.partId != null)?.partId ?? undefined : undefined,
      });
    } else {
      throw new AppError(400, 'Each item must have a productId or itemId');
    }
  }

  const pricedItems: {
    productId: string;
    itemId?: number;
    partId?: number;
    quantity: number;
    unitCost: number;
    total: number;
    bikeUnits?: BikeUnitInput[];
    product: any;
  }[] = [];

  for (const item of resolvedItems) {
    const product = item.product;
    if (product.branchProducts.length === 0) {
      throw new AppError(400, `Product "${product.name}" is not listed at this branch`);
    }
    if (product.type !== ProductType.BIKE && product.type !== ProductType.PART) {
      throw new AppError(400, `Product "${product.name}" cannot be purchased`);
    }

    validateBikePurchaseUnits(product.type, item.quantity, item.bikeUnits);

    const isOldBikeLine = product.type === ProductType.BIKE && item.bikeUnits?.every((u) => u.purchasePrice != null && u.purchasePrice > 0);
    const lineTotal = isOldBikeLine
      ? item.bikeUnits!.reduce((sum, u) => sum + (u.purchasePrice ?? 0), 0)
      : (Number(item.unitCost) || 0) * item.quantity;
    const effectiveUnitCost = isOldBikeLine ? lineTotal / item.quantity : Number(item.unitCost);

    if (!isOldBikeLine && (!Number.isFinite(effectiveUnitCost) || effectiveUnitCost <= 0)) {
      throw new AppError(400, `Enter a valid purchase cost for "${product.name}"`);
    }

    const someUnitsPriced = product.type === ProductType.BIKE && item.bikeUnits?.some((u) => u.purchasePrice != null && u.purchasePrice > 0);
    if (someUnitsPriced && !isOldBikeLine) {
      throw new AppError(400, 'Enter a price for every unit, or none, on this line');
    }

    pricedItems.push({
      productId: item.productId!,
      itemId: item.itemId,
      partId: item.partId,
      quantity: item.quantity,
      unitCost: effectiveUnitCost,
      total: lineTotal,
      bikeUnits: item.bikeUnits?.map((u) => ({
        chassisNumber: normalizeChassisNumber(u.chassisNumber),
        engineNumber: u.engineNumber ? normalizeIdentifierNumber(u.engineNumber) : undefined,
        motorNumber: u.motorNumber ? normalizeIdentifierNumber(u.motorNumber) : undefined,
        isUsed: u.isUsed,
        purchasePrice: u.purchasePrice,
        meterReading: u.meterReading,
        condition: u.condition?.trim(),
        comments: u.comments?.trim(),
      })),
      product,
    });
  }

  return pricedItems;
}

export async function createPurchaseInvoice(data: {
  branchId: number;
  supplierId: number;
  reference?: string;
  notes?: string;
  createdById: string;
  items: { productId?: string; itemId?: number; quantity: number; unitCost: number; bikeUnits?: BikeUnitInput[] }[];
}) {
  const supplier = await prisma.supplier.findFirst({
    where: { id: data.supplierId, branchId: data.branchId, isActive: true },
  });
  if (!supplier) throw new AppError(404, 'Supplier not found');

  const itemIdentifiers = data.items.map((i) => i.itemId ? `item-${i.itemId}` : `prod-${i.productId}`);
  if (new Set(itemIdentifiers).size !== itemIdentifiers.length) {
    throw new AppError(400, 'Duplicate item or product selection');
  }

  const pricedItems = await validatePurchaseItems(data.branchId, data.items);
  const total = pricedItems.reduce((sum, i) => sum + i.total, 0);
  if (total <= 0) throw new AppError(400, 'Purchase total must be greater than zero');

  const allBikeUnits = pricedItems.flatMap((i) => i.bikeUnits ?? []);
  if (allBikeUnits.length > 0) {
    await validateBikeUnitsAvailable(allBikeUnits);
  }

  return prisma.$transaction(async (tx) => {
    const reference =
      data.reference?.trim() || (await allocatePurchaseInvoiceNumber(tx, data.branchId));

    const purchase = await tx.purchase.create({
      data: {
        branchId: data.branchId,
        supplierId: data.supplierId,
        documentRef: reference,
        notes: data.notes,
        total,
        items: {
          create: pricedItems.map((i) => ({
            productId: i.productId,
            itemId: i.itemId,
            partId: i.partId,
            quantity: i.quantity,
            unitCost: i.unitCost,
          })),
        },
      },
      include: { items: true, supplier: true },
    });

    const bikeChassisRecords = pricedItems
      .filter((i) => i.product.type === ProductType.BIKE && i.bikeUnits?.length)
      .map((i) => ({ productId: i.productId, itemId: i.itemId, units: i.bikeUnits! }));

    if (bikeChassisRecords.length > 0) {
      await createChassisRecordsInTx(tx, {
        branchId: data.branchId,
        purchaseId: purchase.id,
        records: bikeChassisRecords,
      });
    }

    const partItems = pricedItems
      .filter((i) => i.partId)
      .map((i) => ({ partId: i.partId!, quantity: i.quantity }));
    if (partItems.length) {
      await addStockInTx(tx, data.branchId, partItems);
    }

    for (const item of pricedItems) {
      if (item.product.type !== ProductType.BIKE && item.product.type !== ProductType.PART) continue;
      await tx.branchProduct.upsert({
        where: {
          branchId_productId: { branchId: data.branchId, productId: item.productId },
        },
        create: {
          branchId: data.branchId,
          productId: item.productId,
          stock: item.quantity,
          isListed: true,
        },
        update: { stock: { increment: item.quantity } },
      });
    }

    const inventoryAccount = await ensureInventoryAccount(tx, data.branchId);
    const supplierAccount = await ensureSupplierAccount(tx, data.branchId, supplier);
    const purchaseItems = formatPurchaseItemsDescription(
      pricedItems.map((item) => ({
        quantity: item.quantity,
        product: item.product,
      })),
    );
    const purchaseBase = `From ${supplier.name} to inventory`;

    const newBalance = Number(supplier.balance) + total;
    await tx.supplier.update({
      where: { id: data.supplierId },
      data: { balance: newBalance },
    });
    await tx.supplierLedger.create({
      data: {
        supplierId: data.supplierId,
        purchaseId: purchase.id,
        type: SupplierLedgerType.CREDIT,
        amount: total,
        balance: newBalance,
        notes: purchaseItems ? `${purchaseBase} — ${purchaseItems}` : purchaseBase,
      },
    });

    const voucher = await createVoucherInTx(tx, {
      branchId: data.branchId,
      type: VoucherType.JOURNAL,
      debitAccountId: inventoryAccount.id,
      creditAccountId: supplierAccount.id,
      amount: total,
      reference,
      description: purchaseItems || undefined,
      createdById: data.createdById,
    });

    return { purchase, voucher };
  });
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
      await addStockInTx(tx, data.branchId, partItems);
    }

    for (const item of data.items) {
      if (!item.productId) continue;
      await tx.branchProduct.upsert({
        where: {
          branchId_productId: { branchId: data.branchId, productId: item.productId },
        },
        create: {
          branchId: data.branchId,
          productId: item.productId,
          stock: item.quantity,
          isListed: true,
        },
        update: { stock: { increment: item.quantity } },
      });
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

export async function getPurchaseInvoice(id: number, branchId?: number) {
  const purchase = await prisma.purchase.findFirst({
    where: { id, ...(branchId && { branchId }) },
    include: {
      branch: true,
      supplier: true,
      items: { include: { product: true, part: true, item: { include: { product: { include: { brand: true, category: true } } } } } },
      chassis: {
        select: {
          productId: true,
          itemId: true,
          chassisNumber: true,
          engineNumber: true,
          motorNumber: true,
          isUsed: true,
          purchasePrice: true,
          meterReading: true,
          condition: true,
          comments: true,
        },
      },
    },
  });
  if (!purchase) throw new AppError(404, 'Purchase not found');

  const reference = purchase.documentRef?.trim() || purchase.invoiceNumber?.trim() || null;

  const unitsByItemOrProduct = new Map<
    string,
    {
      chassisNumber: string;
      engineNumber: string | null;
      motorNumber: string | null;
      isUsed: boolean;
      purchasePrice: number | null;
      meterReading: number | null;
      condition: string | null;
      comments: string | null;
    }[]
  >();
  for (const c of purchase.chassis) {
    const key = c.itemId ? `item-${c.itemId}` : `prod-${c.productId}`;
    const list = unitsByItemOrProduct.get(key) ?? [];
    list.push({
      chassisNumber: c.chassisNumber,
      engineNumber: c.engineNumber,
      motorNumber: c.motorNumber,
      isUsed: c.isUsed,
      purchasePrice: c.purchasePrice ? Number(c.purchasePrice) : null,
      meterReading: c.meterReading,
      condition: c.condition,
      comments: c.comments,
    });
    unitsByItemOrProduct.set(key, list);
  }

  return {
    invoiceType: 'PURCHASE' as const,
    invoiceAvailable: true,
    currency: 'PKR' as const,
    invoiceNumber: reference || String(purchase.id),
    reference,
    date: purchase.createdAt,
    branch: {
      name: purchase.branch.name,
      location: purchase.branch.location,
      phone: purchase.branch.phone,
      whatsapp: purchase.branch.whatsapp,
    },
    supplier: {
      name: purchase.supplier.name,
      contactPerson: purchase.supplier.contactPerson,
      phone: purchase.supplier.phone,
      email: purchase.supplier.email,
      address: purchase.supplier.address,
    },
    items: purchase.items.map((i) => {
      const name = i.item
        ? `${i.item.product.name} (${i.item.product.brand?.name ?? ''} ${i.item.product.category?.name ?? ''} ${i.item.model ?? ''})`
        : i.product?.name ?? i.part?.name ?? 'Item';
      const type = i.item ? i.item.product.type : i.product?.type ?? 'PART';
      const unitCost = Number(i.unitCost);
      const key = i.itemId ? `item-${i.itemId}` : `prod-${i.productId}`;
      const bikeUnits = unitsByItemOrProduct.get(key);
      return {
        name,
        type,
        quantity: i.quantity,
        unitCost,
        total: unitCost * i.quantity,
        chassisNumber: i.chassisNumber,
        bikeUnits: bikeUnits ?? undefined,
      };
    }),
    subtotal: Number(purchase.total),
    total: Number(purchase.total),
    notes: purchase.notes,
  };
}
