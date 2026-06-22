import { CustomerType, Prisma } from '@prisma/client';
import { prisma } from '../../config/database.js';

type UserLike = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
};

export async function ensureOnlineCustomer(
  user: UserLike,
  tx: Prisma.TransactionClient = prisma,
) {
  const existing = await tx.customer.findUnique({ where: { userId: user.id } });
  if (existing) return existing;

  return tx.customer.create({
    data: {
      type: CustomerType.ONLINE,
      userId: user.id,
      name: `${user.firstName} ${user.lastName}`.trim(),
      email: user.email,
      phone: user.phone ?? undefined,
    },
  });
}
