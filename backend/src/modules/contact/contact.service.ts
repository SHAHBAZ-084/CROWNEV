import { ContactStatus } from '@prisma/client';
import { prisma } from '../../config/database.js';
import { AppError, getPagination, paginatedResponse } from '../../utils/helpers.js';

export async function submitContact(data: {
  name: string;
  email: string;
  phone?: string;
  message: string;
  branchId?: number;
}) {
  return prisma.contactMessage.create({ data });
}

export async function listContacts(query: {
  page?: string;
  limit?: string;
  status?: ContactStatus;
}) {
  const { page, limit, skip } = getPagination(query);
  const where = query.status ? { status: query.status } : {};

  const [messages, total] = await Promise.all([
    prisma.contactMessage.findMany({
      where,
      skip,
      take: limit,
      include: { branch: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.contactMessage.count({ where }),
  ]);

  return paginatedResponse(messages, total, page, limit);
}

export async function updateContactStatus(id: number, status: ContactStatus) {
  const msg = await prisma.contactMessage.findUnique({ where: { id } });
  if (!msg) throw new AppError(404, 'Message not found');
  return prisma.contactMessage.update({ where: { id }, data: { status } });
}
