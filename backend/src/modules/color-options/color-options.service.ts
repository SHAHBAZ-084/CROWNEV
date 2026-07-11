import { prisma } from '../../config/database.js';
import { AppError } from '../../utils/helpers.js';

export async function listColorOptions() {
  return prisma.colorOption.findMany({
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });
}

export async function findOrCreateColorOption(name: string) {
  const trimmed = name.trim();
  if (!trimmed) throw new AppError(400, 'Color name is required');

  const existing = await prisma.colorOption.findFirst({
    where: { name: { equals: trimmed, mode: 'insensitive' } },
    select: { id: true, name: true },
  });
  if (existing) return existing;

  try {
    return await prisma.colorOption.create({
      data: { name: trimmed },
      select: { id: true, name: true },
    });
  } catch (err: unknown) {
    const again = await prisma.colorOption.findFirst({
      where: { name: { equals: trimmed, mode: 'insensitive' } },
      select: { id: true, name: true },
    });
    if (again) return again;
    throw err;
  }
}
