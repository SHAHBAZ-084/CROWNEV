import { TestimonialStatus } from '@prisma/client';
import { prisma } from '../../config/database.js';

export async function listTestimonials(activeOnly = true) {
  return prisma.testimonial.findMany({
    where: activeOnly ? { status: TestimonialStatus.APPROVED, isActive: true } : undefined,
    orderBy: { sortOrder: 'asc' },
  });
}

export async function listPendingTestimonials() {
  return prisma.testimonial.findMany({
    where: { status: TestimonialStatus.PENDING, isActive: true },
    orderBy: { createdAt: 'asc' },
  });
}

export async function listAllTestimonialsForAdmin() {
  return prisma.testimonial.findMany({
    where: { isActive: true },
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
  });
}

export async function submitTestimonial(data: {
  customerName: string;
  content: string;
  rating?: number;
  imageUrl?: string;
}) {
  return prisma.testimonial.create({
    data: {
      ...data,
      status: TestimonialStatus.PENDING,
      isActive: false,
    },
  });
}

export async function createTestimonial(data: {
  customerName: string;
  content: string;
  rating?: number;
  imageUrl?: string;
  sortOrder?: number;
}) {
  return prisma.testimonial.create({
    data: { ...data, status: TestimonialStatus.APPROVED, isActive: true },
  });
}

export async function approveTestimonial(id: number) {
  return prisma.testimonial.update({
    where: { id },
    data: { status: TestimonialStatus.APPROVED, isActive: true },
  });
}

export async function rejectTestimonial(id: number) {
  return prisma.testimonial.update({
    where: { id },
    data: { status: TestimonialStatus.REJECTED },
  });
}

export async function updateTestimonial(id: number, data: Record<string, unknown>) {
  return prisma.testimonial.update({ where: { id }, data });
}

export async function deleteTestimonial(id: number) {
  return prisma.testimonial.update({ where: { id }, data: { isActive: false } });
}
