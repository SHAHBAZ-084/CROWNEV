import { ChassisStatus, ProductType, Prisma } from '@prisma/client';
import { prisma } from '../../config/database.js';
import { AppError } from '../../utils/helpers.js';

/** A single bike unit being purchased: chassis number is always required,
 * plus exactly one of engineNumber / motorNumber. */
export type BikeUnitInput = {
  chassisNumber: string;
  engineNumber?: string;
  motorNumber?: string;
  color?: string;
  isUsed?: boolean;
  purchasePrice?: number;
  meterReading?: number;
  condition?: string;
  comments?: string;
};

export function normalizeChassisNumber(value: string): string {
  return value.trim().toUpperCase();
}

/** Same normalization rule applied to engine/motor numbers. */
export function normalizeIdentifierNumber(value: string): string {
  return value.trim().toUpperCase();
}

function normalizeBikeUnit(unit: BikeUnitInput): BikeUnitInput {
  return {
    chassisNumber: normalizeChassisNumber(unit.chassisNumber),
    engineNumber: unit.engineNumber ? normalizeIdentifierNumber(unit.engineNumber) : undefined,
    motorNumber: unit.motorNumber ? normalizeIdentifierNumber(unit.motorNumber) : undefined,
    color: unit.color?.trim() || undefined,
    isUsed: unit.isUsed,
    purchasePrice: unit.purchasePrice,
    meterReading: unit.meterReading,
    condition: unit.condition?.trim(),
    comments: unit.comments?.trim(),
  };
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

/** Checks a full list of bike units for duplicate chassis, engine, or motor numbers within the same invoice. */
export function assertNoDuplicateBikeUnitsInList(units: BikeUnitInput[]) {
  assertNoDuplicateChassisInList(units.map((u) => u.chassisNumber));

  const engineSeen = new Set<string>();
  const engineDuplicates = new Set<string>();
  const motorSeen = new Set<string>();
  const motorDuplicates = new Set<string>();

  for (const unit of units) {
    if (unit.engineNumber) {
      const num = normalizeIdentifierNumber(unit.engineNumber);
      if (engineSeen.has(num)) engineDuplicates.add(num);
      engineSeen.add(num);
    }
    if (unit.motorNumber) {
      const num = normalizeIdentifierNumber(unit.motorNumber);
      if (motorSeen.has(num)) motorDuplicates.add(num);
      motorSeen.add(num);
    }
  }

  if (engineDuplicates.size > 0) {
    throw new AppError(400, `Duplicate engine number(s) in this invoice: ${[...engineDuplicates].join(', ')}`);
  }
  if (motorDuplicates.size > 0) {
    throw new AppError(400, `Duplicate motor number(s) in this invoice: ${[...motorDuplicates].join(', ')}`);
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

/** Finds any chassis/engine/motor numbers from the given units that already exist in the system. */
export async function findExistingBikeUnitNumbers(units: BikeUnitInput[]) {
  const chassisNumbers = [...new Set(units.map((u) => normalizeChassisNumber(u.chassisNumber)))];
  const engineNumbers = [
    ...new Set(units.filter((u) => u.engineNumber).map((u) => normalizeIdentifierNumber(u.engineNumber!))),
  ];
  const motorNumbers = [
    ...new Set(units.filter((u) => u.motorNumber).map((u) => normalizeIdentifierNumber(u.motorNumber!))),
  ];

  const existing = await prisma.bikeChassisNumber.findMany({
    where: {
      OR: [
        chassisNumbers.length > 0 ? { chassisNumber: { in: chassisNumbers } } : undefined,
        engineNumbers.length > 0 ? { engineNumber: { in: engineNumbers } } : undefined,
        motorNumbers.length > 0 ? { motorNumber: { in: motorNumbers } } : undefined,
      ].filter(Boolean) as Prisma.BikeChassisNumberWhereInput[],
    },
    select: { chassisNumber: true, engineNumber: true, motorNumber: true },
  });

  const conflicts: string[] = [];
  for (const row of existing) {
    if (chassisNumbers.includes(row.chassisNumber)) conflicts.push(row.chassisNumber);
    if (row.engineNumber && engineNumbers.includes(row.engineNumber)) conflicts.push(row.engineNumber);
    if (row.motorNumber && motorNumbers.includes(row.motorNumber)) conflicts.push(row.motorNumber);
  }
  return [...new Set(conflicts)];
}

export async function validateChassisNumbersAvailable(chassisNumbers: string[]) {
  assertNoDuplicateChassisInList(chassisNumbers);
  const conflicts = await findExistingChassisNumbers(chassisNumbers);
  if (conflicts.length > 0) {
    throw new AppError(409, `Chassis number(s) already exist: ${conflicts.join(', ')}`);
  }
}

/** Validates a full set of bike units (chassis + engine/motor) are unique and unused. */
export async function validateBikeUnitsAvailable(units: BikeUnitInput[]) {
  assertNoDuplicateBikeUnitsInList(units);
  const conflicts = await findExistingBikeUnitNumbers(units);
  if (conflicts.length > 0) {
    throw new AppError(409, `Chassis/engine/motor number(s) already exist: ${conflicts.join(', ')}`);
  }
}

export async function listAvailableChassis(branchId: number, productId: string) {
  return prisma.bikeChassisNumber.findMany({
    where: {
      branchId,
      productId,
      status: { in: [ChassisStatus.IN_STOCK, ChassisStatus.RESERVED] },
    },
    select: {
      id: true,
      chassisNumber: true,
      engineNumber: true,
      motorNumber: true,
      color: true,
      productId: true,
      purchaseId: true,
      createdAt: true,
      isUsed: true,
      purchasePrice: true,
      meterReading: true,
      condition: true,
      comments: true,
      status: true,
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
    records: { productId: string; units: BikeUnitInput[] }[];
  },
) {
  const allUnits = data.records.flatMap((r) => r.units.map(normalizeBikeUnit));
  assertNoDuplicateBikeUnitsInList(allUnits);

  const conflicts = await findExistingBikeUnitNumbers(allUnits);
  if (conflicts.length > 0) {
    throw new AppError(409, `Chassis/engine/motor number(s) already exist: ${conflicts.join(', ')}`);
  }

  const rows = data.records.flatMap((record) =>
    record.units.map((unit) => {
      const normalized = normalizeBikeUnit(unit);
      return {
        chassisNumber: normalized.chassisNumber,
        engineNumber: normalized.engineNumber ?? null,
        motorNumber: normalized.motorNumber ?? null,
        color: normalized.color ?? null,
        productId: record.productId,
        branchId: data.branchId,
        purchaseId: data.purchaseId,
        status: ChassisStatus.IN_STOCK,
        isUsed: normalized.isUsed ?? false,
        purchasePrice: normalized.purchasePrice ?? null,
        meterReading: normalized.meterReading ?? null,
        condition: normalized.condition ?? null,
        comments: normalized.comments ?? null,
      };
    }),
  );

  if (rows.length > 0) {
    await tx.bikeChassisNumber.createMany({ data: rows });

    const created = await tx.bikeChassisNumber.findMany({
      where: { chassisNumber: { in: rows.map((r) => r.chassisNumber) } },
      select: { id: true },
    });

    const activeTypes = await tx.documentType.findMany({ where: { isActive: true }, select: { id: true } });

    if (activeTypes.length > 0 && created.length > 0) {
      await tx.bikeDocument.createMany({
        data: created.flatMap((chassis) =>
          activeTypes.map((type) => ({ chassisNumberId: chassis.id, documentTypeId: type.id }))
        ),
        skipDuplicates: true,
      });
    }
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
    throw new AppError(409, 'Selected chassis number is not available for sale');
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
    throw new AppError(409, 'Selected chassis number is not available for sale');
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

/**
 * Validates bike units for a purchase invoice line: every unit needs a chassis number,
 * plus exactly one of engineNumber / motorNumber (never both, never neither).
 */
export function validateBikePurchaseUnits(
  productType: ProductType,
  quantity: number,
  units?: BikeUnitInput[],
) {
  if (productType !== ProductType.BIKE) return;

  const list = units ?? [];
  if (list.length !== quantity) {
    throw new AppError(400, `Enter details for ${quantity} bike unit(s) on this line`);
  }

  for (const unit of list) {
    const chassisNumber = unit.chassisNumber?.trim();
    if (!chassisNumber) {
      throw new AppError(400, 'Chassis number is required for every bike unit');
    }
    const hasEngine = !!unit.engineNumber?.trim();
    const hasMotor = !!unit.motorNumber?.trim();
    if (hasEngine && hasMotor) {
      throw new AppError(400, 'Enter either engine number or motor number for each bike unit, not both');
    }
    if (!hasEngine && !hasMotor) {
      throw new AppError(400, 'Enter either engine number or motor number for each bike unit');
    }
  }

  assertNoDuplicateBikeUnitsInList(
    list.map((u) => ({
      chassisNumber: u.chassisNumber,
      engineNumber: u.engineNumber,
      motorNumber: u.motorNumber,
    })),
  );
}

/** Auto-picks one available chassis for a product/branch and reserves it for an online order item. */
export async function reserveChassisInTx(
  tx: Prisma.TransactionClient,
  data: { branchId: number; productId: string; saleOrderItemId: number },
) {
  // Oldest unit first (FIFO)
  const candidate = await tx.bikeChassisNumber.findFirst({
    where: { branchId: data.branchId, productId: data.productId, status: ChassisStatus.IN_STOCK },
    orderBy: { createdAt: 'asc' },
  });
  if (!candidate) {
    throw new AppError(409, 'No chassis available for this bike — stock may have just sold out');
  }

  const claimed = await tx.bikeChassisNumber.updateMany({
    where: { id: candidate.id, status: ChassisStatus.IN_STOCK },
    data: { status: ChassisStatus.RESERVED, saleOrderItemId: data.saleOrderItemId },
  });
  if (claimed.count !== 1) {
    throw new AppError(409, 'Selected chassis was just reserved by another order, please retry');
  }

  return tx.bikeChassisNumber.findUniqueOrThrow({ where: { id: candidate.id } });
}

/** RESERVED → SOLD, once an online order's payment is confirmed. */
export async function finalizeChassisReservationInTx(tx: Prisma.TransactionClient, saleOrderItemId: number) {
  await tx.bikeChassisNumber.updateMany({
    where: { saleOrderItemId, status: ChassisStatus.RESERVED },
    data: { status: ChassisStatus.SOLD },
  });
}

/** RESERVED → IN_STOCK, if an online order is cancelled/rejected before payment completes. */
export async function releaseChassisReservationInTx(tx: Prisma.TransactionClient, saleOrderItemId: number) {
  await tx.bikeChassisNumber.updateMany({
    where: { saleOrderItemId, status: ChassisStatus.RESERVED },
    data: { status: ChassisStatus.IN_STOCK, saleOrderItemId: null },
  });
}
