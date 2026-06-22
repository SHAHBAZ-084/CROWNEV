import { BookingStatus, Role } from '@prisma/client';
import { prisma } from '../../config/database.js';
import { AppError, getPagination, paginatedResponse } from '../../utils/helpers.js';
import { deductStock } from '../inventory/inventory.service.js';

export async function listServices(branchId: number) {
  return prisma.service.findMany({
    where: { branchId, isActive: true },
    include: { category: true },
    orderBy: { name: 'asc' },
  });
}

export async function createService(data: {
  branchId: number;
  categoryId?: number;
  name: string;
  description?: string;
  basePrice: number;
  duration: number;
  checklist?: object;
}) {
  return prisma.service.create({ data });
}

export async function updateService(id: number, branchId: number, data: Record<string, unknown>) {
  const service = await prisma.service.findFirst({ where: { id, branchId } });
  if (!service) throw new AppError(404, 'Service not found');
  return prisma.service.update({ where: { id }, data });
}

export async function listServiceCategories(branchId: number) {
  return prisma.serviceCategory.findMany({ where: { branchId }, orderBy: { name: 'asc' } });
}

export async function createServiceCategory(branchId: number, name: string) {
  return prisma.serviceCategory.create({ data: { branchId, name } });
}

export async function listBookings(query: {
  branchId?: number;
  userId?: string;
  status?: BookingStatus;
  date?: string;
  page?: string;
  limit?: string;
}) {
  const { page, limit, skip } = getPagination(query);
  const where = {
    ...(query.branchId && { branchId: query.branchId }),
    ...(query.userId && { userId: query.userId }),
    ...(query.status && { status: query.status }),
    ...(query.date && { date: new Date(query.date) }),
  };

  const [bookings, total] = await Promise.all([
    prisma.serviceBooking.findMany({
      where,
      skip,
      take: limit,
      include: {
        service: true,
        branch: { select: { name: true } },
        user: { select: { firstName: true, lastName: true, email: true } },
        parts: { include: { part: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.serviceBooking.count({ where }),
  ]);

  return paginatedResponse(bookings, total, page, limit);
}

export async function createBooking(data: {
  branchId: number;
  userId?: string;
  customerName?: string;
  customerPhone?: string;
  notes?: string;
}) {
  return prisma.serviceBooking.create({
    data: {
      branchId: data.branchId,
      userId: data.userId,
      customerName: data.customerName,
      customerPhone: data.customerPhone,
      notes: data.notes,
    },
    include: { service: true, branch: true },
  });
}

export async function updateBookingStatus(
  id: number,
  branchId: number,
  status: BookingStatus,
  parts?: { partId: number; quantity: number }[],
  confirmedTime?: string,
  date?: string,
  serviceId?: number
) {
  const booking = await prisma.serviceBooking.findFirst({
    where: { id, branchId },
    include: { parts: true },
  });
  if (!booking) throw new AppError(404, 'Booking not found');

  const completing = status === BookingStatus.DONE && booking.status !== BookingStatus.DONE;

  if (completing) {
    if (parts?.length) {
      await prisma.serviceBookingPart.deleteMany({ where: { bookingId: id } });
      await prisma.serviceBookingPart.createMany({
        data: parts.map((p) => ({ bookingId: id, partId: p.partId, quantity: p.quantity })),
      });
    }

    const bookingParts = await prisma.serviceBookingPart.findMany({ where: { bookingId: id } });
    if (bookingParts.length) {
      await deductStock(
        branchId,
        bookingParts.map((p) => ({ partId: p.partId, quantity: p.quantity }))
      );
    }
  }

  return prisma.serviceBooking.update({
    where: { id },
    data: {
      status,
      ...(confirmedTime !== undefined && { confirmedTime }),
      ...(date !== undefined && { date: new Date(date) }),
      ...(serviceId !== undefined && { serviceId }),
    },
    include: { service: true, parts: { include: { part: true } } },
  });
}

export async function getTodayBookings(branchId: number) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  return prisma.serviceBooking.findMany({
    where: {
      branchId,
      date: { gte: today, lt: tomorrow },
      status: { not: BookingStatus.CANCELLED },
    },
    include: { service: true, user: { select: { firstName: true, lastName: true } } },
    orderBy: { time: 'asc' },
  });
}

export async function deactivateService(id: number, branchId: number) {
  const service = await prisma.service.findFirst({ where: { id, branchId } });
  if (!service) throw new AppError(404, 'Service not found');
  return prisma.service.update({ where: { id }, data: { isActive: false } });
}

export async function deleteBooking(id: number, branchId: number) {
  const booking = await prisma.serviceBooking.findFirst({ where: { id, branchId } });
  if (!booking) throw new AppError(404, 'Booking not found');
  await prisma.serviceBooking.delete({ where: { id } });
}

export async function getBookingReceipt(id: number, branchId?: number) {
  const booking = await prisma.serviceBooking.findFirst({
    where: { id, ...(branchId && { branchId }) },
    include: {
      service: true,
      parts: { include: { part: true } },
      user: { select: { firstName: true, lastName: true, email: true, phone: true } },
      branch: { select: { name: true, location: true, phone: true } },
    },
  });
  if (!booking) throw new AppError(404, 'Booking not found');

  const partsTotal = booking.parts.reduce(
    (sum, p) => sum + Number(p.part.costPrice) * p.quantity,
    0
  );

  return {
    receiptType: 'SERVICE',
    currency: 'PKR',
    bookingId: booking.id,
    date: booking.date,
    time: booking.time,
    confirmedTime: booking.confirmedTime ?? null,
    status: booking.status,
    branch: booking.branch,
    customer: booking.user
      ? { name: `${booking.user.firstName} ${booking.user.lastName}`, phone: booking.user.phone }
      : { name: booking.customerName, phone: booking.customerPhone },
    service: booking.service
      ? {
          name: booking.service.name,
          basePrice: booking.service.basePrice,
          duration: booking.service.duration,
        }
      : { name: 'Service request', basePrice: 0, duration: 0 },
    parts: booking.parts.map((p) => ({
      name: p.part.name,
      quantity: p.quantity,
      unitCost: p.part.costPrice,
    })),
    serviceTotal: booking.service?.basePrice ?? 0,
    partsTotal,
    grandTotal: Number(booking.service?.basePrice ?? 0) + partsTotal,
  };
}
