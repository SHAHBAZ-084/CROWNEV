import { ChassisStatus, ProductType, Prisma } from '@prisma/client';
import { prisma } from '../../config/database.js';
import { AppError } from '../../utils/helpers.js';

export function normalizeChassisNumber(value: string): string {
  return value.trim().toUpperCase();
}

export function assertNoDuplicateChassisInList(chassisNumbers: string[]) {
  const normalized = chassisNumbers.map(normalizeChassisNumber);
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const num of normalized) {
    if (seen.has(num)) duplicates.add(num);
    seen.add(num);
  }
  if (duplicates.size > 0) {
    throw new AppError(400, `Duplicate chassis number(s) in this invoice: ${[...duplicates].join(', ')}`);
  }
}

export async function findExistingChassisNumbers(chassisNumbers: string[]) {
  const normalized = [...new Set(chassisNumbers.map(normalizeChassisNumber))];
  if (normalized.length === 0) return [];

  const existing = await prisma.bikeChassisNumber.findMany({
    where: { chassisNumber: { in: normalized } },
    select: { chassisNumber: true },
  });
  return existing.map((row: { chassisNumber: string }) => row.chassisNumber);
}

export async function validateChassisNumbersAvailable(chassisNumbers: string[]) {
  assertNoDuplicateChassisInList(chassisNumbers);
  const conflicts = await findExistingChassisNumbers(chassisNumbers);
  if (conflicts.length > 0) {
    throw new AppError(409, `Chassis number(s) already exist: ${conflicts.join(', ')}`);
  }
}

export async function listAvailableChassis(branchId: number, productId: string) {
  return prisma.bikeChassisNumber.findMany({
    where: {
      branchId,
      productId,
      status: ChassisStatus.IN_STOCK,
    },
    select: {
      id: true,
      chassisNumber: true,
      productId: true,
      purchaseId: true,
      createdAt: true,
    },
    orderBy: { chassisNumber: 'asc' },
  });
}

export async function listBranchChassis(
  branchId: number,
  query: { productId?: string; status?: ChassisStatus },
) {
  return prisma.bikeChassisNumber.findMany({
    where: {
      branchId,
      ...(query.productId ? { productId: query.productId } : {}),
      ...(query.status ? { status: query.status } : {}),
    },
    include: {
      product: { select: { id: true, name: true, type: true } },
      purchase: { select: { id: true, documentRef: true, invoiceNumber: true, createdAt: true } },
      saleOrderItem: {
        select: {
          id: true,
          order: { select: { id: true, saleReference: true, publicId: true, createdAt: true } },
        },
      },
    },
    orderBy: [{ product: { name: 'asc' } }, { chassisNumber: 'asc' }],
  });
}

export async function countInStockChassis(branchId: number, productId: string) {
  return prisma.bikeChassisNumber.count({
    where: { branchId, productId, status: ChassisStatus.IN_STOCK },
  });
}

export async function createChassisRecordsInTx(
  tx: Prisma.TransactionClient,
  data: {
    branchId: number;
    purchaseId: number;
    records: { productId: string; chassisNumbers: string[] }[];
  },
) {
  const allNumbers = data.records.flatMap((r) => r.chassisNumbers.map(normalizeChassisNumber));
  assertNoDuplicateChassisInList(allNumbers);

  const conflicts = await tx.bikeChassisNumber.findMany({
    where: { chassisNumber: { in: allNumbers } },
    select: { chassisNumber: true },
  });
  if (conflicts.length > 0) {
    throw new AppError(
      409,
      `Chassis number(s) already exist: ${conflicts.map((c: { chassisNumber: string }) => c.chassisNumber).join(', ')}`,
    );
  }

  const rows = data.records.flatMap((record) =>
    record.chassisNumbers.map((chassisNumber) => ({
      chassisNumber: normalizeChassisNumber(chassisNumber),
      productId: record.productId,
      branchId: data.branchId,
      purchaseId: data.purchaseId,
      status: ChassisStatus.IN_STOCK,
    })),
  );

  if (rows.length > 0) {
    await tx.bikeChassisNumber.createMany({ data: rows });
  }
}

export async function markChassisSoldInTx(
  tx: Prisma.TransactionClient,
  data: {
    bikeChassisNumberId: number;
    branchId: number;
    productId: string;
    saleOrderItemId: number;
  },
) {
  const chassis = await tx.bikeChassisNumber.findFirst({
    where: {
      id: data.bikeChassisNumberId,
      branchId: data.branchId,
      productId: data.productId,
      status: ChassisStatus.IN_STOCK,
    },
  });
  if (!chassis) {
    throw new AppError(409, 'Selected chassis is not available for sale');
  }

  const updated = await tx.bikeChassisNumber.updateMany({
    where: {
      id: data.bikeChassisNumberId,
      status: ChassisStatus.IN_STOCK,
      saleOrderItemId: null,
    },
    data: {
      status: ChassisStatus.SOLD,
      saleOrderItemId: data.saleOrderItemId,
    },
  });

  if (updated.count !== 1) {
    throw new AppError(409, 'Selected chassis is not available for sale');
  }

  return chassis;
}

export function validateBikePurchaseChassis(
  productType: ProductType,
  quantity: number,
  chassisNumbers?: string[],
) {
  if (productType !== ProductType.BIKE) return;

  const numbers = chassisNumbers?.map(normalizeChassisNumber).filter(Boolean) ?? [];
  if (numbers.length !== quantity) {
    throw new AppError(400, `Enter ${quantity} chassis number(s) for this bike line`);
  }
  assertNoDuplicateChassisInList(numbers);
}
