import { prisma } from '../../config/database.js';
import { AppError, getPagination, paginatedResponse } from '../../utils/helpers.js';

export async function listParts(query: { page?: string; limit?: string; search?: string }) {
  const { page, limit, skip } = getPagination(query);
  const where = query.search
    ? {
        OR: [
          { name: { contains: query.search, mode: 'insensitive' as const } },
          { itemCode: { contains: query.search, mode: 'insensitive' as const } },
        ],
      }
    : {};

  const [parts, total] = await Promise.all([
    prisma.part.findMany({ where, skip, take: limit, orderBy: { name: 'asc' } }),
    prisma.part.count({ where }),
  ]);

  return paginatedResponse(parts, total, page, limit);
}

export async function getPart(id: number) {
  const part = await prisma.part.findUnique({ where: { id } });
  if (!part) throw new AppError(404, 'Part not found');
  return part;
}

export async function createPart(data: {
  itemCode: string;
  name: string;
  description?: string;
  costPrice: number;
  alertAt?: number;
}) {
  const existing = await prisma.part.findUnique({ where: { itemCode: data.itemCode } });
  if (existing) throw new AppError(409, 'Item code already exists');

  return prisma.part.create({ data });
}

export async function updatePart(id: number, data: Record<string, unknown>) {
  return prisma.part.update({ where: { id }, data });
}

export async function deletePart(id: number) {
  return prisma.part.update({ where: { id }, data: { isActive: false } });
}
