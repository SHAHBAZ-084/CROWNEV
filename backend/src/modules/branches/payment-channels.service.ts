import { PaymentChannelType } from '@prisma/client';
import { prisma } from '../../config/database.js';
import { AppError } from '../../utils/helpers.js';

export async function listPublicPaymentChannels(branchId: number) {
  return prisma.branchPaymentChannel.findMany({
    where: { branchId, isActive: true },
    orderBy: [{ type: 'asc' }, { name: 'asc' }],
    select: {
      id: true,
      type: true,
      name: true,
      accountTitle: true,
      accountNumber: true,
    },
  });
}

export async function listPaymentChannels(branchId: number) {
  return prisma.branchPaymentChannel.findMany({
    where: { branchId },
    orderBy: [{ type: 'asc' }, { name: 'asc' }],
  });
}

export async function createPaymentChannel(
  branchId: number,
  data: {
    type: PaymentChannelType;
    name: string;
    accountTitle?: string;
    accountNumber: string;
  }
) {
  return prisma.branchPaymentChannel.create({
    data: {
      branchId,
      type: data.type,
      name: data.name.trim(),
      accountTitle: data.accountTitle?.trim() || null,
      accountNumber: data.accountNumber.trim(),
    },
  });
}

export async function updatePaymentChannel(
  branchId: number,
  id: number,
  data: {
    type?: PaymentChannelType;
    name?: string;
    accountTitle?: string;
    accountNumber?: string;
    isActive?: boolean;
  }
) {
  const channel = await prisma.branchPaymentChannel.findFirst({ where: { id, branchId } });
  if (!channel) throw new AppError(404, 'Payment channel not found');

  return prisma.branchPaymentChannel.update({
    where: { id },
    data: {
      ...(data.type !== undefined && { type: data.type }),
      ...(data.name !== undefined && { name: data.name.trim() }),
      ...(data.accountTitle !== undefined && { accountTitle: data.accountTitle.trim() || null }),
      ...(data.accountNumber !== undefined && { accountNumber: data.accountNumber.trim() }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
    },
  });
}

export async function deletePaymentChannel(branchId: number, id: number) {
  const channel = await prisma.branchPaymentChannel.findFirst({ where: { id, branchId } });
  if (!channel) throw new AppError(404, 'Payment channel not found');
  await prisma.branchPaymentChannel.delete({ where: { id } });
}
