import { prisma } from '../../config/database.js';
import { AppError } from '../../utils/helpers.js';
import { Prisma } from '@prisma/client';

export async function ensureBikeDocumentRows(chassisNumberId: number) {
  const activeTypes = await prisma.documentType.findMany({ where: { isActive: true }, select: { id: true } });
  const existing = await prisma.bikeDocument.findMany({
    where: { chassisNumberId },
    select: { documentTypeId: true },
  });
  const existingTypeIds = new Set(existing.map((e) => e.documentTypeId));
  const missing = activeTypes.filter((t) => !existingTypeIds.has(t.id));

  if (missing.length > 0) {
    await prisma.bikeDocument.createMany({
      data: missing.map((t) => ({ chassisNumberId, documentTypeId: t.id })),
      skipDuplicates: true,
    });
  }
}

export async function listBikeDocuments(
  branchId: number | undefined,   // undefined = admin viewing all branches
  query: { search?: string; status?: 'PENDING_SUPPLIER' | 'PENDING_CUSTOMER' | 'ALL' },
) {
  const search = query.search?.trim();

  const chassisRows = await prisma.bikeChassisNumber.findMany({
    where: {
      ...(branchId ? { branchId } : {}),
      ...(search && {
        OR: [
          { chassisNumber: { contains: search, mode: 'insensitive' } },
          { product: { name: { contains: search, mode: 'insensitive' } } },
          { saleOrderItem: { order: { customerName: { contains: search, mode: 'insensitive' } } } },
          { saleOrderItem: { order: { customer: { name: { contains: search, mode: 'insensitive' } } } } },
        ],
      }),
    },
    include: {
      product: { select: { id: true, name: true } },
      branch: { select: { id: true, name: true } },
      documents: { include: { documentType: true }, orderBy: { documentType: { sortOrder: 'asc' } } },
      saleOrderItem: {
        select: {
          order: { select: { id: true, publicId: true, customerName: true, customer: { select: { name: true } } } },
        },
      },
    },
    orderBy: [{ product: { name: 'asc' } }, { chassisNumber: 'asc' }],
  });

  const withStatus = chassisRows.map((c) => {
    const pendingSupplier = c.documents.filter((d) => !d.receivedFromSupplier).length;
    const pendingCustomer = c.status === 'SOLD' ? c.documents.filter((d) => !d.givenToCustomer).length : 0;
    return {
      ...c,
      customerName: c.saleOrderItem?.order?.customer?.name ?? c.saleOrderItem?.order?.customerName ?? null,
      pendingSupplierCount: pendingSupplier,
      pendingCustomerCount: pendingCustomer,
    };
  });

  if (query.status === 'PENDING_SUPPLIER') return withStatus.filter((c) => c.pendingSupplierCount > 0);
  if (query.status === 'PENDING_CUSTOMER') return withStatus.filter((c) => c.pendingCustomerCount > 0);
  return withStatus;
}

export async function getBikeDocumentChecklist(chassisNumberId: number) {
  await ensureBikeDocumentRows(chassisNumberId);
  const chassis = await prisma.bikeChassisNumber.findUnique({
    where: { id: chassisNumberId },
    include: {
      product: { select: { name: true } },
      documents: { include: { documentType: true }, orderBy: { documentType: { sortOrder: 'asc' } } },
      saleOrderItem: { select: { order: { select: { publicId: true } } } },
    },
  });
  if (!chassis) throw new AppError(404, 'Bike not found');
  return chassis;
}

export async function updateBikeDocumentNotes(chassisNumberId: number, notes: string) {
  const chassis = await prisma.bikeChassisNumber.findUnique({ where: { id: chassisNumberId } });
  if (!chassis) throw new AppError(404, 'Bike not found');
  return prisma.bikeChassisNumber.update({
    where: { id: chassisNumberId },
    data: { documentNotes: notes.trim() || null },
  });
}

export async function updateBikeDocument(
  bikeDocumentId: number,
  data: {
    receivedFromSupplier?: boolean;
    receivedNotes?: string;
    givenToCustomer?: boolean;
    givenNotes?: string;
  },
  updatedById: string,
) {
  const existing = await prisma.bikeDocument.findUnique({
    where: { id: bikeDocumentId },
    include: { chassis: { select: { status: true } } },
  });
  if (!existing) throw new AppError(404, 'Document record not found');

  const willBeReceived = data.receivedFromSupplier ?? existing.receivedFromSupplier;
  const wantsGiven = data.givenToCustomer ?? existing.givenToCustomer;

  if (wantsGiven && !willBeReceived) {
    throw new AppError(400, 'Mark this document as received from the supplier before giving it to the customer');
  }
  if (wantsGiven && existing.chassis.status !== 'SOLD') {
    throw new AppError(400, 'This bike has not been sold yet — nothing to give to a customer');
  }

  return prisma.bikeDocument.update({
    where: { id: bikeDocumentId },
    data: {
      ...(data.receivedFromSupplier !== undefined && {
        receivedFromSupplier: data.receivedFromSupplier,
        receivedAt: data.receivedFromSupplier ? new Date() : null,
      }),
      ...(data.receivedNotes !== undefined && { receivedNotes: data.receivedNotes }),
      ...(data.givenToCustomer !== undefined && {
        givenToCustomer: data.givenToCustomer,
        givenAt: data.givenToCustomer ? new Date() : null,
      }),
      ...(data.givenNotes !== undefined && { givenNotes: data.givenNotes }),
      updatedById,
    },
  });
}

export async function listDocumentTypes() {
  return prisma.documentType.findMany({ orderBy: { sortOrder: 'asc' } });
}

export async function createDocumentType(name: string) {
  const maxOrder = await prisma.documentType.aggregate({ _max: { sortOrder: true } });
  return prisma.documentType.create({
    data: { name: name.trim(), sortOrder: (maxOrder._max.sortOrder ?? 0) + 1 },
  });
}

export async function setDocumentTypeActive(id: number, isActive: boolean) {
  return prisma.documentType.update({ where: { id }, data: { isActive } });
}

export async function deleteDocumentType(id: number) {
  const existing = await prisma.documentType.findUnique({ where: { id }, select: { id: true, name: true } });
  if (!existing) throw new AppError(404, 'Document type not found');

  const documentsCount = await prisma.bikeDocument.count({ where: { documentTypeId: id } });
  if (documentsCount > 0) {
    throw new AppError(
      409,
      `${documentsCount} document${documentsCount === 1 ? '' : 's'} use this type — remove/reassign them first, or deactivate instead of deleting`,
    );
  }

  await prisma.documentType.delete({ where: { id } });
}
