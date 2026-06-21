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
        user: { select: { firstName: true, lastName: true, email: true } },
        parts: { include: { part: true } },
      },
      orderBy: [{ date: 'asc' }, { time: 'asc' }],
    }),
    prisma.serviceBooking.count({ where }),
  ]);

  return paginatedResponse(bookings, total, page, limit);
}

export async function createBooking(data: {
  branchId: number;
  serviceId: number;
  userId?: string;
  customerName?: string;
  customerPhone?: string;
  date: string;
  time: string;
  notes?: string;
}) {
  return prisma.serviceBooking.create({
    data: {
      branchId: data.branchId,
      serviceId: data.serviceId,
      userId: data.userId,
      customerName: data.customerName,
      customerPhone: data.customerPhone,
      date: new Date(data.date),
      time: data.time,
      notes: data.notes,
    },
    include: { service: true },
  });
}

export async function updateBookingStatus(
  id: number,
  branchId: number,
  status: BookingStatus,
  parts?: { partId: number; quantity: number }[]
) {
  const booking = await prisma.serviceBooking.findFirst({ where: { id, branchId } });
  if (!booking) throw new AppError(404, 'Booking not found');

  if (status === BookingStatus.DONE && parts?.length) {
    await deductStock(branchId, parts);
    await prisma.serviceBookingPart.createMany({
      data: parts.map((p) => ({ bookingId: id, partId: p.partId, quantity: p.quantity })),
    });
  }

  return prisma.serviceBooking.update({
    where: { id },
    data: { status },
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
    status: booking.status,
    branch: booking.branch,
    customer: booking.user
      ? { name: `${booking.user.firstName} ${booking.user.lastName}`, phone: booking.user.phone }
      : { name: booking.customerName, phone: booking.customerPhone },
    service: {
      name: booking.service.name,
      basePrice: booking.service.basePrice,
      duration: booking.service.duration,
    },
    parts: booking.parts.map((p) => ({
      name: p.part.name,
      quantity: p.quantity,
      unitCost: p.part.costPrice,
    })),
    serviceTotal: booking.service.basePrice,
    partsTotal,
    grandTotal: Number(booking.service.basePrice) + partsTotal,
  };
}
