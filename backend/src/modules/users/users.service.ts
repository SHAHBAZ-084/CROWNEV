import { Role } from '@prisma/client';
import { prisma } from '../../config/database.js';
import { AppError, getPagination, paginatedResponse } from '../../utils/helpers.js';
import { hashPassword } from '../../utils/crypto.js';

export async function listUsers(query: { page?: string; limit?: string; role?: Role; search?: string }) {
  const { page, limit, skip } = getPagination(query);
  const where = {
    isVerified: true,
    ...(query.role && { role: query.role }),
    ...(query.search && {
      OR: [
        { email: { contains: query.search, mode: 'insensitive' as const } },
        { firstName: { contains: query.search, mode: 'insensitive' as const } },
        { lastName: { contains: query.search, mode: 'insensitive' as const } },
      ],
    }),
  };

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take: limit,
      select: {
        id: true,
        email: true,
        role: true,
        firstName: true,
        lastName: true,
        phone: true,
        city: true,
        branchId: true,
        isVerified: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.user.count({ where }),
  ]);

  return paginatedResponse(users, total, page, limit);
}

export async function createUser(data: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: Role;
  phone?: string;
  city?: string;
  branchId?: number;
}) {
  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) throw new AppError(409, 'Email already exists');

  if (data.role === Role.BRANCH_OWNER) {
    if (!data.branchId) throw new AppError(400, 'Branch required for BRANCH_OWNER');
    const branch = await prisma.branch.findUnique({ where: { id: data.branchId } });
    if (!branch) throw new AppError(404, 'Branch not found');
    if (branch.ownerId) throw new AppError(409, 'Branch already has an owner');
  }

  const passwordHash = await hashPassword(data.password);
  const user = await prisma.user.create({
    data: {
      email: data.email,
      passwordHash,
      firstName: data.firstName,
      lastName: data.lastName,
      role: data.role,
      phone: data.phone,
      city: data.city,
      branchId: data.role === Role.BRANCH_OWNER ? data.branchId : undefined,
      isVerified: true,
    },
  });

  if (data.role === Role.BRANCH_OWNER && data.branchId) {
    await prisma.branch.update({
      where: { id: data.branchId },
      data: { ownerId: user.id },
    });
  }

  return user;
}

export async function updateUser(
  id: string,
  data: Partial<{
    firstName: string;
    lastName: string;
    phone: string;
    city: string;
    role: Role;
    branchId: number;
    isActive: boolean;
  }>
) {
  return prisma.user.update({ where: { id }, data });
}

export async function deleteUser(id: string) {
  return prisma.user.update({ where: { id }, data: { isActive: false } });
}
