import { BookingStatus } from '@prisma/client';
import { prisma } from '../../config/database.js';
import { env } from '../../config/env.js';
import { AppError, getPagination, paginatedResponse } from '../../utils/helpers.js';
import { sendBookingConfirmationEmail } from '../../utils/email.js';

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
  confirmedTime?: string,
  date?: string,
  serviceId?: number,
) {
  const booking = await prisma.serviceBooking.findFirst({
    where: { id, branchId },
  });
  if (!booking) throw new AppError(404, 'Booking not found');

  const visitDate = date?.trim();
  const visitTime = confirmedTime?.trim();
  const isScheduled = status === BookingStatus.SCHEDULED;

  if (isScheduled && (!visitDate || !visitTime)) {
    throw new AppError(400, 'Visit date and time are required for scheduled bookings');
  }

  return prisma.serviceBooking
    .update({
      where: { id },
      data: {
        status,
        date: isScheduled && visitDate ? new Date(visitDate) : null,
        confirmedTime: isScheduled && visitTime ? visitTime : null,
        ...(serviceId !== undefined && { serviceId }),
      },
      include: {
        service: true,
        parts: { include: { part: true } },
        user: { select: { email: true, firstName: true, lastName: true } },
        branch: { select: { name: true, location: true, phone: true } },
      },
    })
    .then(async (updated) => {
      try {
        await maybeNotifyBookingVisitScheduled(booking, updated);
      } catch (err) {
        console.error('[booking] Failed to send schedule notification:', err);
      }
      return updated;
    });
}

function bookingDateKey(value: Date | null | undefined): string | null {
  if (!value) return null;
  return value.toISOString().slice(0, 10);
}

async function maybeNotifyBookingVisitScheduled(
  previous: {
    status: BookingStatus;
    date: Date | null;
    confirmedTime: string | null;
  },
  updated: {
    id: number;
    status: BookingStatus;
    date: Date | null;
    confirmedTime: string | null;
    customerName: string | null;
    user: { email: string; firstName: string; lastName: string } | null;
    branch: { name: string; location: string; phone: string | null };
    service: { name: string } | null;
  },
) {
  if (updated.status !== BookingStatus.SCHEDULED || !updated.date || !updated.confirmedTime) {
    return;
  }

  const scheduleChanged =
    previous.status !== BookingStatus.SCHEDULED ||
    !previous.date ||
    !previous.confirmedTime ||
    bookingDateKey(previous.date) !== bookingDateKey(updated.date) ||
    previous.confirmedTime !== updated.confirmedTime;

  if (!scheduleChanged) return;

  const email = updated.user?.email;
  if (!email) return;

  const customerName = updated.user
    ? `${updated.user.firstName} ${updated.user.lastName}`.trim()
    : (updated.customerName ?? 'Customer');

  await sendBookingConfirmationEmail({
    to: email,
    customerName,
    bookingId: updated.id,
    visitDate: updated.date,
    visitTime: updated.confirmedTime,
    branch: updated.branch,
    serviceName: updated.service?.name ?? null,
    dashboardUrl: env.appUrl,
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
      status: BookingStatus.SCHEDULED,
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

export async function getBookingReceipt(
  id: number,
  scope?: { branchId?: number; userId?: string },
) {
  const booking = await prisma.serviceBooking.findFirst({
    where: {
      id,
      ...(scope?.branchId && { branchId: scope.branchId }),
      ...(scope?.userId && { userId: scope.userId }),
    },
    include: {
      service: true,
      parts: { include: { part: true } },
      user: { select: { firstName: true, lastName: true, email: true, phone: true } },
      branch: { select: { name: true, location: true, phone: true } },
    },
  });
  if (!booking) throw new AppError(404, 'Booking not found');

  return buildBookingReceipt(booking);
}

export async function getPublicBookingTicket(id: number, email: string) {
  const normalized = email.trim().toLowerCase();
  const booking = await prisma.serviceBooking.findFirst({
    where: { id },
    include: {
      service: true,
      parts: { include: { part: true } },
      user: { select: { firstName: true, lastName: true, email: true, phone: true } },
      branch: { select: { name: true, location: true, phone: true } },
    },
  });
  if (!booking) throw new AppError(404, 'Booking not found');

  const bookingEmail = booking.user?.email?.toLowerCase();
  if (!bookingEmail || bookingEmail !== normalized) {
    throw new AppError(403, 'Email does not match this booking');
  }
  if (!booking.date || !booking.confirmedTime) {
    throw new AppError(400, 'Visit time is not scheduled yet');
  }

  return buildBookingReceipt(booking);
}

function buildBookingReceipt(booking: {
  id: number;
  date: Date | null;
  time: string | null;
  confirmedTime: string | null;
  status: BookingStatus;
  customerName: string | null;
  customerPhone: string | null;
  service: { name: string; basePrice: unknown; duration: number } | null;
  branch: { name: string; location: string; phone: string | null };
  user: { firstName: string; lastName: string; email: string; phone: string | null } | null;
  parts: { quantity: number; part: { name: string; costPrice: unknown } }[];
}) {
  const partsTotal = booking.parts.reduce(
    (sum, p) => sum + Number(p.part.costPrice) * p.quantity,
    0,
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
