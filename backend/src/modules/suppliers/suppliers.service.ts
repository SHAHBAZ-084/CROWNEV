import { Prisma, ProductType, SupplierLedgerType, VoucherStatus, VoucherType } from '@prisma/client';
import { prisma } from '../../config/database.js';
import { AppError, getPagination, paginatedResponse } from '../../utils/helpers.js';
import { batterySpecsFromProduct } from '../../utils/productSpecs.js';
import { addStockInTx } from '../inventory/inventory.service.js';
import {
  createChassisRecordsInTx,
  findExistingBikeUnitNumbers,
  isChassisIdentityLocked,
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
  updateVoucherAmount,
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
  items: { productId: string; quantity: number; unitCost: number; bikeUnits?: BikeUnitInput[] }[],
) {
  const uniqueProductIds = [...new Set(items.map((i) => i.productId))];
  const products = await prisma.product.findMany({
    where: { id: { in: uniqueProductIds }, isActive: true },
    include: {
      bikePartDetails: true,
      branchProducts: { where: { branchId, isListed: true } },
    },
  });

  if (products.length !== uniqueProductIds.length) {
    throw new AppError(400, 'One or more products not found or inactive');
  }

  const pricedItems: {
    productId: string;
    partId?: number;
    quantity: number;
    unitCost: number;
    total: number;
    bikeUnits?: BikeUnitInput[];
    product: (typeof products)[number];
  }[] = [];

  for (const item of items) {
    const product = products.find((p) => p.id === item.productId)!;
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

    let partId: number | undefined;
    if (product.type === ProductType.PART) {
      partId = product.bikePartDetails.find((d) => d.partId != null)?.partId ?? undefined;
    }

    pricedItems.push({
      productId: item.productId,
      partId,
      quantity: item.quantity,
      unitCost: effectiveUnitCost,
      total: lineTotal,
      bikeUnits: item.bikeUnits?.map((u) => ({
        chassisNumber: normalizeChassisNumber(u.chassisNumber),
        engineNumber: u.engineNumber ? normalizeIdentifierNumber(u.engineNumber) : undefined,
        motorNumber: u.motorNumber ? normalizeIdentifierNumber(u.motorNumber) : undefined,
        color: u.color?.trim() || undefined,
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
  items: { productId: string; quantity: number; unitCost: number; bikeUnits?: BikeUnitInput[] }[];
}) {
  const supplier = await prisma.supplier.findFirst({
    where: { id: data.supplierId, branchId: data.branchId, isActive: true },
  });
  if (!supplier) throw new AppError(404, 'Supplier not found');

  const productIds = data.items.map((i) => i.productId);
  if (new Set(productIds).size !== productIds.length) {
    throw new AppError(400, 'Product is already selected');
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
      .map((i) => ({ productId: i.productId, units: i.bikeUnits! }));

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
      items: { include: { product: { include: { brand: true, category: true } }, part: true } },
      chassis: {
        select: {
          id: true,
          productId: true,
          chassisNumber: true,
          engineNumber: true,
          motorNumber: true,
          color: true,
          isUsed: true,
          purchasePrice: true,
          meterReading: true,
          condition: true,
          comments: true,
          status: true,
          saleOrderItemId: true,
        },
      },
    },
  });
  if (!purchase) throw new AppError(404, 'Purchase not found');

  const reference = purchase.documentRef?.trim() || purchase.invoiceNumber?.trim() || null;

  const unitsByProduct = new Map<
    string,
    {
      chassisId: number;
      chassisNumber: string;
      engineNumber: string | null;
      motorNumber: string | null;
      color: string | null;
      isUsed: boolean;
      purchasePrice: number | null;
      meterReading: number | null;
      condition: string | null;
      comments: string | null;
      identityLocked: boolean;
    }[]
  >();
  for (const c of purchase.chassis) {
    const list = unitsByProduct.get(c.productId) ?? [];
    list.push({
      chassisId: c.id,
      chassisNumber: c.chassisNumber,
      engineNumber: c.engineNumber,
      motorNumber: c.motorNumber,
      color: c.color,
      isUsed: c.isUsed,
      purchasePrice: c.purchasePrice ? Number(c.purchasePrice) : null,
      meterReading: c.meterReading,
      condition: c.condition,
      comments: c.comments,
      identityLocked: c.status === 'SOLD' || c.saleOrderItemId != null,
    });
    unitsByProduct.set(c.productId, list);
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
      const name = i.product?.name ?? i.part?.name ?? 'Item';
      const type = i.product?.type ?? 'PART';
      const unitCost = Number(i.unitCost);
      const bikeUnits = i.productId ? unitsByProduct.get(i.productId) : undefined;
      return {
        purchaseItemId: i.id,
        name,
        type,
        quantity: i.quantity,
        unitCost,
        total: unitCost * i.quantity,
        chassisNumber: i.chassisNumber,
        bikeUnits: bikeUnits ?? undefined,
        brand: i.product?.brand ? (i.product.brand as any).name : undefined,
        category: i.product?.category ? (i.product.category as any).name : undefined,
        model: i.product ? (i.product as any).model ?? undefined : undefined,
        ...(i.product ? batterySpecsFromProduct(i.product) : {}),
        colorOptions: i.product ? (i.product as any).colorOptions ?? undefined : undefined,
      };
    }),
    subtotal: Number(purchase.total),
    total: Number(purchase.total),
    notes: purchase.notes,
  };
}

type PurchaseItemEditInput = {
  purchaseItemId?: number;
  chassisId?: number;
  unitCost?: number;
  color?: string | null;
  engineNumber?: string | null;
  motorNumber?: string | null;
  chassisNumber?: string;
};

async function shiftSupplierPurchaseLedgerAmount(
  tx: Prisma.TransactionClient,
  purchaseId: number,
  supplierId: number,
  newAmount: number,
) {
  const entry = await tx.supplierLedger.findFirst({
    where: { purchaseId, type: SupplierLedgerType.CREDIT },
    orderBy: { id: 'asc' },
  });
  if (!entry) return;

  const oldAmount = Number(entry.amount);
  const delta = newAmount - oldAmount;
  if (Math.abs(delta) < 0.005) return;

  await tx.supplierLedger.update({
    where: { id: entry.id },
    data: {
      amount: newAmount,
      balance: Number(entry.balance) + delta,
    },
  });
  await tx.supplierLedger.updateMany({
    where: { supplierId, id: { gt: entry.id } },
    data: { balance: { increment: delta } },
  });
  await tx.supplier.update({
    where: { id: supplierId },
    data: { balance: { increment: delta } },
  });
}

function computeBikeLineTotal(
  chassisRows: { purchasePrice: Prisma.Decimal | null }[],
  fallbackUnitCost: number,
  quantity: number,
): number {
  const priced = chassisRows.filter((c) => c.purchasePrice != null);
  if (priced.length === chassisRows.length && priced.length > 0) {
    return priced.reduce((sum, c) => sum + Number(c.purchasePrice), 0);
  }
  if (priced.length > 0) {
    throw new AppError(400, 'Enter a price for every unit, or none, on this line');
  }
  return fallbackUnitCost * quantity;
}

function validateSingleBikeUnitFields(unit: BikeUnitInput) {
  const chassisNumber = unit.chassisNumber?.trim();
  if (!chassisNumber) throw new AppError(400, 'Chassis number is required');
  const hasEngine = !!unit.engineNumber?.trim();
  const hasMotor = !!unit.motorNumber?.trim();
  if (hasEngine && hasMotor) {
    throw new AppError(400, 'Enter either engine number or motor number, not both');
  }
  if (!hasEngine && !hasMotor) {
    throw new AppError(400, 'Enter either engine number or motor number');
  }
}

export async function updatePurchaseInvoice(
  id: number,
  branchId: number | undefined,
  userId: string,
  data: { items: PurchaseItemEditInput[] },
) {
  if (!data.items.length) throw new AppError(400, 'No items to update');

  const purchase = await prisma.purchase.findFirst({
    where: { id, ...(branchId != null ? { branchId } : {}) },
    include: {
      supplier: true,
      items: { include: { product: true } },
      chassis: true,
    },
  });
  if (!purchase) throw new AppError(404, 'Purchase not found');

  const chassisById = new Map(purchase.chassis.map((c) => [c.id, c]));
  const itemById = new Map(purchase.items.map((i) => [i.id, i]));

  for (const edit of data.items) {
    if (edit.chassisId != null) {
      const chassis = chassisById.get(edit.chassisId);
      if (!chassis || chassis.purchaseId !== purchase.id) {
        throw new AppError(400, 'Chassis unit not found on this purchase');
      }

      const identityLocked = isChassisIdentityLocked(chassis);
      const identityEdit =
        edit.chassisNumber !== undefined ||
        edit.engineNumber !== undefined ||
        edit.motorNumber !== undefined;
      if (identityLocked && identityEdit) {
        throw new AppError(
          409,
          'Cannot change chassis, engine, or motor number on a unit that is already sold or invoiced — price and color can still be edited',
        );
      }

      const proposed: BikeUnitInput = {
        chassisNumber: edit.chassisNumber ?? chassis.chassisNumber,
        engineNumber: edit.engineNumber !== undefined ? (edit.engineNumber ?? undefined) : (chassis.engineNumber ?? undefined),
        motorNumber: edit.motorNumber !== undefined ? (edit.motorNumber ?? undefined) : (chassis.motorNumber ?? undefined),
      };
      if (identityEdit) {
        validateSingleBikeUnitFields(proposed);
        const conflicts = await findExistingBikeUnitNumbers([proposed], [chassis.id]);
        if (conflicts.length > 0) {
          throw new AppError(409, `Chassis/engine/motor number(s) already exist: ${conflicts.join(', ')}`);
        }
      }

      if (edit.unitCost !== undefined) {
        if (edit.unitCost <= 0) throw new AppError(400, 'Unit cost must be greater than zero');
      }
    } else if (edit.purchaseItemId != null) {
      const item = itemById.get(edit.purchaseItemId);
      if (!item || item.purchaseId !== purchase.id) {
        throw new AppError(400, 'Purchase line not found on this invoice');
      }
      if (item.product?.type === ProductType.BIKE) {
        throw new AppError(400, 'Use chassisId to edit bike unit fields on this purchase');
      }
      if (edit.unitCost !== undefined && edit.unitCost <= 0) {
        throw new AppError(400, 'Unit cost must be greater than zero');
      }
      if (
        edit.color !== undefined ||
        edit.engineNumber !== undefined ||
        edit.motorNumber !== undefined ||
        edit.chassisNumber !== undefined
      ) {
        throw new AppError(400, 'Color and unit numbers apply to bike chassis rows only');
      }
    } else {
      throw new AppError(400, 'Each edit must include chassisId or purchaseItemId');
    }
  }

  const reference = purchase.documentRef?.trim();
  const oldTotal = Number(purchase.total);
  let voucherId: number | null = null;

  const updated = await prisma.$transaction(async (tx) => {
    for (const edit of data.items) {
      if (edit.chassisId != null) {
        const chassis = chassisById.get(edit.chassisId)!;
        const identityLocked = isChassisIdentityLocked(chassis);
        const chassisData: Prisma.BikeChassisNumberUpdateInput = {};

        if (edit.color !== undefined) {
          chassisData.color = edit.color?.trim() || null;
        }
        if (!identityLocked) {
          if (edit.chassisNumber !== undefined) {
            chassisData.chassisNumber = normalizeChassisNumber(edit.chassisNumber);
          }
          if (edit.engineNumber !== undefined) {
            chassisData.engineNumber = edit.engineNumber ? normalizeIdentifierNumber(edit.engineNumber) : null;
          }
          if (edit.motorNumber !== undefined) {
            chassisData.motorNumber = edit.motorNumber ? normalizeIdentifierNumber(edit.motorNumber) : null;
          }
        }
        if (edit.unitCost !== undefined) {
          chassisData.purchasePrice = edit.unitCost;
        }

        if (Object.keys(chassisData).length > 0) {
          await tx.bikeChassisNumber.update({ where: { id: chassis.id }, data: chassisData });
        }
      } else if (edit.purchaseItemId != null && edit.unitCost !== undefined) {
        await tx.purchaseItem.update({
          where: { id: edit.purchaseItemId },
          data: { unitCost: edit.unitCost },
        });
      }
    }

    const refreshed = await tx.purchase.findUniqueOrThrow({
      where: { id: purchase.id },
      include: {
        items: { include: { product: true } },
        chassis: true,
      },
    });

    for (const item of refreshed.items) {
      if (item.product?.type !== ProductType.BIKE || !item.productId) continue;
      const units = refreshed.chassis.filter((c) => c.productId === item.productId);
      const lineTotal = computeBikeLineTotal(units, Number(item.unitCost), item.quantity);
      const effectiveUnitCost = lineTotal / item.quantity;
      await tx.purchaseItem.update({
        where: { id: item.id },
        data: { unitCost: effectiveUnitCost },
      });
    }

    const finalPurchase = await tx.purchase.findUniqueOrThrow({
      where: { id: purchase.id },
      include: { items: { include: { product: true } }, chassis: true },
    });

    let newTotal = 0;
    for (const item of finalPurchase.items) {
      if (item.product?.type === ProductType.BIKE && item.productId) {
        const units = finalPurchase.chassis.filter((c) => c.productId === item.productId);
        newTotal += computeBikeLineTotal(units, Number(item.unitCost), item.quantity);
      } else {
        newTotal += Number(item.unitCost) * item.quantity;
      }
    }

    if (newTotal <= 0) throw new AppError(400, 'Purchase total must be greater than zero');

    await tx.purchase.update({
      where: { id: purchase.id },
      data: { total: newTotal },
    });

    await shiftSupplierPurchaseLedgerAmount(tx, purchase.id, purchase.supplierId, newTotal);

    if (reference && Math.abs(newTotal - oldTotal) >= 0.005) {
      const voucher = await tx.voucher.findFirst({
        where: {
          branchId: purchase.branchId,
          reference,
          status: VoucherStatus.ACTIVE,
        },
        orderBy: { id: 'asc' },
      });
      voucherId = voucher?.id ?? null;
    }

    return tx.purchase.findUniqueOrThrow({
      where: { id: purchase.id },
      include: {
        supplier: true,
        items: { include: { part: true, product: true } },
        chassis: true,
      },
    });
  });

  if (voucherId != null && Math.abs(Number(updated.total) - oldTotal) >= 0.005) {
    await updateVoucherAmount(purchase.branchId, voucherId, Number(updated.total), userId);
  }

  return updated;
}
