import { ChassisStatus, Prisma, ProductType, SupplierLedgerType, VoucherStatus, VoucherType } from '@prisma/client';
import { prisma } from '../../config/database.js';
import { AppError, getPagination, paginatedResponse } from '../../utils/helpers.js';
import { assertNoSupplierLedgerHistory } from '../../utils/entityGuards.js';
import { batterySpecsFromProduct } from '../../utils/productSpecs.js';
import {
  addStockInTx,
  deductBranchProductStockInTx,
  deductPartInventoryInTx,
} from '../inventory/inventory.service.js';
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
  getAccountLedgerBalance,
  getLedgerBalancesByAccountCodes,
  supplierAccountCode,
  updateVoucherAmount,
  cancelActiveVouchersByReferenceInTx,
  getActiveFinancialYearId,
  assertActiveFinancialYear,
} from '../accounting/accounting.service.js';
import { allocatePurchaseInvoiceNumber } from '../../utils/documentNumbers.js';
import { parseOptionalInvoiceDate } from '../../utils/invoiceDate.js';

export async function listBranchSuppliers(branchId: number, query?: { page?: string; limit?: string }) {
  const { page, limit, skip } = getPagination(query ?? {});
  const where = { branchId, isActive: true };

  const [suppliers, total] = await Promise.all([
    prisma.supplier.findMany({ where, skip, take: limit, orderBy: { name: 'asc' } }),
    prisma.supplier.count({ where }),
  ]);

  return paginatedResponse(
    await attachSupplierLedgerBalances(branchId, suppliers),
    total,
    page,
    limit,
  );
}

async function attachSupplierLedgerBalances<T extends { id: number; balance: unknown }>(
  branchId: number | undefined,
  rows: T[],
) {
  const accountCodes = rows.map((s) => supplierAccountCode(s.id));
  const ledgerByCode = await getLedgerBalancesByAccountCodes(branchId, accountCodes);

  return rows.map((s) => {
    const code = supplierAccountCode(s.id);
    const ledgerBalance = ledgerByCode.get(code);
    return {
      ...s,
      balance: ledgerBalance ?? Number(s.balance),
    };
  });
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
      date: (e.purchase?.invoiceDate ?? e.createdAt).toISOString(),
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

  const closingBalance = await getAccountLedgerBalance(
    branchId,
    supplierAccountCode(supplier.id),
    Number(supplier.balance),
  );

  return {
    supplier: {
      id: supplier.id,
      name: supplier.name,
      code: supplierAccountCode(supplier.id),
      balance: closingBalance,
    },
    rows,
    summary: {
      totalDebit,
      totalCredit,
      closingBalance,
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
    await attachSupplierLedgerBalances(branchId, suppliers),
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
  if (data.phone) {
    const existing = await prisma.supplier.findFirst({
      where: { branchId: data.branchId, phone: data.phone, isActive: true },
      select: { id: true },
    });
    if (existing) {
      throw new AppError(409, 'A supplier with this phone number already exists.');
    }
  }

  return prisma.$transaction(async (tx) => {
    const supplier = await tx.supplier.create({ data });
    await ensureSupplierAccount(tx, data.branchId, { id: supplier.id, name: supplier.name });
    return supplier;
  });
}

export async function updateSupplier(id: number, branchId: number, data: Record<string, unknown>) {
  if (typeof data.phone === 'string' && data.phone) {
    const existing = await prisma.supplier.findFirst({
      where: { branchId, phone: data.phone, isActive: true, NOT: { id } },
      select: { id: true },
    });
    if (existing) {
      throw new AppError(409, 'A supplier with this phone number already exists.');
    }
  }

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
  await assertNoSupplierLedgerHistory(id);
  return prisma.supplier.update({
    where: { id },
    data: { isActive: false, phone: null },
  });
}

export async function listPurchases(branchId?: number, query?: { page?: string; limit?: string }) {
  const { page, limit, skip } = getPagination(query ?? {});
  let financialYearId: number | undefined;
  if (branchId) {
    try {
      financialYearId = await getActiveFinancialYearId(prisma, branchId);
    } catch {
      financialYearId = undefined;
    }
  }
  const where = {
    ...(branchId ? { branchId } : {}),
    ...(financialYearId != null && { financialYearId }),
  };

  const [purchases, total] = await Promise.all([
    prisma.purchase.findMany({
      where,
      skip,
      take: limit,
      include: { supplier: true, items: { include: { part: true, product: true } } },
      orderBy: { invoiceDate: 'desc' },
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
  invoiceDate?: string;
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
    const financialYearId = await getActiveFinancialYearId(tx, data.branchId);
    const invoiceDate = parseOptionalInvoiceDate(data.invoiceDate);

    const purchase = await tx.purchase.create({
      data: {
        branchId: data.branchId,
        financialYearId,
        supplierId: data.supplierId,
        documentRef: reference,
        notes: data.notes,
        total,
        invoiceDate,
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
        createdAt: invoiceDate,
      },
    });

    const voucher = await createVoucherInTx(tx, {
      branchId: data.branchId,
      type: VoucherType.PURCHASE,
      debitAccountId: inventoryAccount.id,
      creditAccountId: supplierAccount.id,
      amount: total,
      reference,
      description: purchaseItems || undefined,
      createdById: data.createdById,
      entryDate: invoiceDate,
    });

    return { purchase, voucher };
  });
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
      removable: boolean;
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
      removable: c.status === ChassisStatus.IN_STOCK && c.saleOrderItemId == null,
    });
    unitsByProduct.set(c.productId, list);
  }

  return {
    invoiceType: 'PURCHASE' as const,
    invoiceAvailable: true,
    currency: 'PKR' as const,
    invoiceNumber: reference || String(purchase.id),
    reference,
    date: purchase.invoiceDate,
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

type PurchaseItemRemovalInput = {
  chassisId?: number;
  purchaseItemId?: number;
};

const PURCHASE_ZERO_ITEMS_MESSAGE =
  'Purchase invoice must have at least one item. Use Delete Invoice to remove the whole purchase.';

function isChassisRemovable(chassis: { status: ChassisStatus; saleOrderItemId: number | null }) {
  return chassis.status === ChassisStatus.IN_STOCK && chassis.saleOrderItemId == null;
}

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
  data: {
    supplierId?: number;
    items?: PurchaseItemEditInput[];
    removals?: PurchaseItemRemovalInput[];
  },
) {
  const edits = data.items ?? [];
  const removals = data.removals ?? [];
  if (!edits.length && !removals.length) {
    throw new AppError(400, 'No items to update');
  }

  const purchase = await prisma.purchase.findFirst({
    where: { id, ...(branchId != null ? { branchId } : {}) },
    include: {
      supplier: true,
      items: { include: { product: true } },
      chassis: true,
    },
  });
  if (!purchase) throw new AppError(404, 'Purchase not found');
  await assertActiveFinancialYear(prisma, purchase.branchId, purchase.financialYearId);

  let newSupplier: Awaited<ReturnType<typeof prisma.supplier.findFirst>> = null;
  const supplierChanged = data.supplierId != null && data.supplierId !== purchase.supplierId;
  if (supplierChanged) {
    const hasNonStockChassis = purchase.chassis.some((c) => c.status !== ChassisStatus.IN_STOCK);
    if (hasNonStockChassis) {
      throw new AppError(
        400,
        'Cannot change supplier: this purchase invoice only allows a supplier change while all bikes from it are still in stock (not sold or reserved).',
      );
    }
    newSupplier = await prisma.supplier.findFirst({
      where: { id: data.supplierId, branchId: purchase.branchId },
    });
    if (!newSupplier) throw new AppError(404, 'Supplier not found in this branch');
  }

  const chassisById = new Map(purchase.chassis.map((c) => [c.id, c]));
  const itemById = new Map(purchase.items.map((i) => [i.id, i]));
  const removedChassisIds = new Set<number>();
  const removedPartItemIds = new Set<number>();

  for (const removal of removals) {
    const hasChassis = removal.chassisId != null;
    const hasItem = removal.purchaseItemId != null;
    if (hasChassis === hasItem) {
      throw new AppError(400, 'Each removal must include either chassisId or purchaseItemId');
    }

    if (hasChassis) {
      const chassisId = removal.chassisId!;
      if (removedChassisIds.has(chassisId)) {
        throw new AppError(400, 'Duplicate chassis removal requested');
      }
      const chassis = chassisById.get(chassisId);
      if (!chassis || chassis.purchaseId !== purchase.id) {
        throw new AppError(400, 'Chassis unit not found on this purchase');
      }
      if (!isChassisRemovable(chassis)) {
        throw new AppError(
          409,
          'This unit is sold/reserved and cannot be removed from the invoice',
        );
      }
      removedChassisIds.add(chassisId);
    } else {
      const purchaseItemId = removal.purchaseItemId!;
      if (removedPartItemIds.has(purchaseItemId)) {
        throw new AppError(400, 'Duplicate purchase line removal requested');
      }
      const item = itemById.get(purchaseItemId);
      if (!item || item.purchaseId !== purchase.id) {
        throw new AppError(400, 'Purchase line not found on this invoice');
      }
      if (item.product?.type === ProductType.BIKE) {
        throw new AppError(400, 'Use chassisId to remove bike units on this purchase');
      }
      if (item.product?.type !== ProductType.PART) {
        throw new AppError(400, 'Only part purchase lines can be removed by purchaseItemId');
      }
      removedPartItemIds.add(purchaseItemId);
    }
  }

  const chassisCountAfterRemoval = new Map<string, number>();
  for (const chassis of purchase.chassis) {
    if (removedChassisIds.has(chassis.id)) continue;
    chassisCountAfterRemoval.set(
      chassis.productId,
      (chassisCountAfterRemoval.get(chassis.productId) ?? 0) + 1,
    );
  }

  let remainingLines = 0;
  for (const item of purchase.items) {
    if (item.product?.type === ProductType.BIKE && item.productId) {
      if ((chassisCountAfterRemoval.get(item.productId) ?? 0) > 0) remainingLines += 1;
    } else if (item.product?.type === ProductType.PART && !removedPartItemIds.has(item.id)) {
      remainingLines += 1;
    }
  }
  if (remainingLines === 0) {
    throw new AppError(400, PURCHASE_ZERO_ITEMS_MESSAGE);
  }

  for (const edit of edits) {
    if (edit.chassisId != null) {
      if (removedChassisIds.has(edit.chassisId)) {
        throw new AppError(400, 'Cannot edit a bike unit that is marked for removal');
      }
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
      if (removedPartItemIds.has(edit.purchaseItemId)) {
        throw new AppError(400, 'Cannot edit a purchase line that is marked for removal');
      }
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
    for (const removal of removals) {
      if (removal.chassisId != null) {
        const chassis = chassisById.get(removal.chassisId)!;
        await tx.bikeChassisNumber.delete({ where: { id: chassis.id } });
        await deductBranchProductStockInTx(
          tx,
          purchase.branchId,
          chassis.productId,
          1,
          ProductType.BIKE,
        );

        const lineItem = purchase.items.find(
          (i) => i.productId === chassis.productId && i.product?.type === ProductType.BIKE,
        );
        if (lineItem) {
          const updatedLine = await tx.purchaseItem.update({
            where: { id: lineItem.id },
            data: { quantity: { decrement: 1 } },
          });
          if (updatedLine.quantity <= 0) {
            await tx.purchaseItem.delete({ where: { id: lineItem.id } });
          }
        }
      } else if (removal.purchaseItemId != null) {
        const item = itemById.get(removal.purchaseItemId)!;
        if (item.partId) {
          await deductPartInventoryInTx(tx, purchase.branchId, item.partId, item.quantity);
        }
        if (item.productId && item.product?.type === ProductType.PART) {
          await deductBranchProductStockInTx(
            tx,
            purchase.branchId,
            item.productId,
            item.quantity,
            ProductType.PART,
          );
        }
        await tx.purchaseItem.delete({ where: { id: item.id } });
      }
    }

    for (const edit of edits) {
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

    if (refreshed.items.length === 0) {
      throw new AppError(400, PURCHASE_ZERO_ITEMS_MESSAGE);
    }

    for (const item of refreshed.items) {
      if (item.product?.type !== ProductType.BIKE || !item.productId) continue;
      const units = refreshed.chassis.filter((c) => c.productId === item.productId);
      if (units.length === 0) {
        await tx.purchaseItem.delete({ where: { id: item.id } });
        continue;
      }
      const lineTotal = computeBikeLineTotal(units, Number(item.unitCost), units.length);
      const effectiveUnitCost = lineTotal / units.length;
      await tx.purchaseItem.update({
        where: { id: item.id },
        data: { quantity: units.length, unitCost: effectiveUnitCost },
      });
    }

    const finalPurchase = await tx.purchase.findUniqueOrThrow({
      where: { id: purchase.id },
      include: { items: { include: { product: true } }, chassis: true },
    });

    if (finalPurchase.items.length === 0) {
      throw new AppError(400, PURCHASE_ZERO_ITEMS_MESSAGE);
    }

    let newTotal = 0;
    for (const item of finalPurchase.items) {
      if (item.product?.type === ProductType.BIKE && item.productId) {
        const units = finalPurchase.chassis.filter((c) => c.productId === item.productId);
        newTotal += computeBikeLineTotal(units, Number(item.unitCost), units.length);
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

    if (supplierChanged && newSupplier) {
      const total = newTotal;

      await removeSupplierLedgerForPurchaseInTx(tx, purchase.id, purchase.supplierId);

      if (reference) {
        await cancelActiveVouchersByReferenceInTx(tx, purchase.branchId, reference, userId);
      }

      const inventoryAccount = await ensureInventoryAccount(tx, purchase.branchId);
      const supplierAccount = await ensureSupplierAccount(tx, purchase.branchId, newSupplier);

      const newBalance = Number(newSupplier.balance) + total;
      await tx.supplier.update({
        where: { id: newSupplier.id },
        data: { balance: newBalance },
      });
      await tx.supplierLedger.create({
        data: {
          supplierId: newSupplier.id,
          purchaseId: purchase.id,
          type: SupplierLedgerType.CREDIT,
          amount: total,
          balance: newBalance,
          notes: `From ${newSupplier.name} to inventory — transferred from ${purchase.supplier.name}`,
        },
      });
      await createVoucherInTx(tx, {
        branchId: purchase.branchId,
        type: VoucherType.PURCHASE,
        debitAccountId: inventoryAccount.id,
        creditAccountId: supplierAccount.id,
        amount: total,
        reference,
        description: `Purchase supplier changed: ${purchase.supplier.name} → ${newSupplier.name}`,
        createdById: userId,
      });

      await tx.purchase.update({
        where: { id: purchase.id },
        data: { supplierId: newSupplier.id },
      });

      voucherId = null;
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

  if (!supplierChanged && voucherId != null && Math.abs(Number(updated.total) - oldTotal) >= 0.005) {
    await updateVoucherAmount(purchase.branchId, voucherId, Number(updated.total), userId);
  }

  return updated;
}

async function removeSupplierLedgerForPurchaseInTx(
  tx: Prisma.TransactionClient,
  purchaseId: number,
  supplierId: number,
) {
  const entries = await tx.supplierLedger.findMany({
    where: { purchaseId },
    orderBy: { id: 'asc' },
  });
  if (entries.length === 0) return;

  let balanceDelta = 0;
  for (const entry of entries) {
    const amount = Number(entry.amount);
    if (entry.type === SupplierLedgerType.CREDIT) balanceDelta -= amount;
    else balanceDelta += amount;
  }

  const lastId = entries[entries.length - 1].id;
  await tx.supplierLedger.deleteMany({ where: { purchaseId } });

  if (Math.abs(balanceDelta) < 0.005) return;

  await tx.supplierLedger.updateMany({
    where: { supplierId, id: { gt: lastId } },
    data: { balance: { increment: balanceDelta } },
  });
  await tx.supplier.update({
    where: { id: supplierId },
    data: { balance: { increment: balanceDelta } },
  });
}

export async function deletePurchaseInvoice(
  purchaseId: number,
  branchId: number | undefined,
  userId: string,
) {
  const purchase = await prisma.purchase.findFirst({
    where: {
      id: purchaseId,
      ...(branchId != null ? { branchId } : {}),
    },
    include: {
      items: { include: { product: true } },
      chassis: true,
      supplier: true,
    },
  });
  if (!purchase) throw new AppError(404, 'Purchase invoice not found');
  await assertActiveFinancialYear(prisma, purchase.branchId, purchase.financialYearId);

  const soldUnits = purchase.chassis.filter((c) => c.status === ChassisStatus.SOLD);
  if (soldUnits.length > 0) {
    throw new AppError(
      409,
      `Cannot delete — chassis number(s) already sold: ${soldUnits.map((c) => c.chassisNumber).join(', ')}`,
    );
  }

  const reference = purchase.documentRef?.trim();

  await prisma.$transaction(async (tx) => {
    await tx.bikeChassisNumber.deleteMany({ where: { purchaseId: purchase.id } });

    for (const item of purchase.items) {
      if (item.partId) {
        await deductPartInventoryInTx(tx, purchase.branchId, item.partId, item.quantity);
      }
      if (item.productId && item.product?.type) {
        if (item.product.type === ProductType.BIKE || item.product.type === ProductType.PART) {
          await tx.branchProduct.updateMany({
            where: {
              branchId: purchase.branchId,
              productId: item.productId,
              stock: { gte: item.quantity },
            },
            data: { stock: { decrement: item.quantity } },
          });
        }
      }
    }

    if (reference) {
      await cancelActiveVouchersByReferenceInTx(tx, purchase.branchId, reference, userId);
    }

    await removeSupplierLedgerForPurchaseInTx(tx, purchase.id, purchase.supplierId);

    await tx.purchase.delete({ where: { id: purchase.id } });
  });
}
