import { AccountType, LedgerEntryType, Prisma, VoucherType } from '@prisma/client';
import { prisma } from '../../config/database.js';
import { AppError } from '../../utils/helpers.js';

export async function listAccountCategories(branchId: number) {
  return prisma.accountCategory.findMany({
    where: { branchId },
    include: { accounts: true },
    orderBy: { name: 'asc' },
  });
}

export async function createAccountCategory(branchId: number, name: string) {
  return prisma.accountCategory.create({ data: { branchId, name } });
}

export async function createAccount(data: {
  branchId: number;
  categoryId: number;
  name: string;
  code: string;
  type: AccountType;
}) {
  const account = await prisma.account.create({ data });
  await prisma.ledger.create({
    data: { branchId: data.branchId, accountId: account.id, balance: 0 },
  });
  return account;
}

export async function listAccounts(branchId: number) {
  return prisma.account.findMany({
    where: { branchId, isActive: true },
    include: { category: true, ledger: true },
    orderBy: { code: 'asc' },
  });
}

export async function createVoucher(data: {
  branchId: number;
  type: VoucherType;
  debitAccountId: number;
  creditAccountId: number;
  amount: number;
  description?: string;
  reference?: string;
  createdById: string;
}) {
  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const voucher = await tx.voucher.create({ data });

    const debitLedger = await tx.ledger.findUniqueOrThrow({
      where: { accountId: data.debitAccountId },
    });
    const creditLedger = await tx.ledger.findUniqueOrThrow({
      where: { accountId: data.creditAccountId },
    });

    const debitBalance = Number(debitLedger.balance) + data.amount;
    const creditBalance = Number(creditLedger.balance) - data.amount;

    await tx.ledgerEntry.createMany({
      data: [
        {
          ledgerId: debitLedger.id,
          voucherId: voucher.id,
          type: LedgerEntryType.DEBIT,
          amount: data.amount,
          balance: debitBalance,
          notes: data.description,
        },
        {
          ledgerId: creditLedger.id,
          voucherId: voucher.id,
          type: LedgerEntryType.CREDIT,
          amount: data.amount,
          balance: creditBalance,
          notes: data.description,
        },
      ],
    });

    await tx.ledger.update({ where: { id: debitLedger.id }, data: { balance: debitBalance } });
    await tx.ledger.update({ where: { id: creditLedger.id }, data: { balance: creditBalance } });

    return voucher;
  });
}

export async function listVouchers(branchId: number) {
  return prisma.voucher.findMany({
    where: { branchId },
    include: {
      debitAccount: true,
      creditAccount: true,
      createdBy: { select: { firstName: true, lastName: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getTrialBalance(branchId: number) {
  const ledgers = await prisma.ledger.findMany({
    where: { branchId },
    include: { account: true, entries: { orderBy: { createdAt: 'desc' }, take: 1 } },
  });

  return ledgers.map((l: (typeof ledgers)[number]) => ({
    accountId: l.accountId,
    accountCode: l.account.code,
    accountName: l.account.name,
    accountType: l.account.type,
    balance: l.balance,
  }));
}

export async function listBankAccounts(branchId: number) {
  return prisma.bankAccount.findMany({ where: { branchId, isActive: true } });
}

export async function createBankAccount(data: {
  branchId: number;
  name: string;
  accountNumber?: string;
  openingBalance?: number;
}) {
  return prisma.bankAccount.create({
    data: {
      branchId: data.branchId,
      name: data.name,
      accountNumber: data.accountNumber,
      openingBalance: data.openingBalance ?? 0,
      runningBalance: data.openingBalance ?? 0,
    },
  });
}

export async function getLedgerEntries(accountId: number, branchId: number) {
  const ledger = await prisma.ledger.findFirst({
    where: { accountId, branchId },
    include: {
      entries: { orderBy: { createdAt: 'desc' }, include: { voucher: true } },
      account: true,
    },
  });
  if (!ledger) throw new AppError(404, 'Ledger not found');
  return ledger;
}

export async function approveTrialBalance(data: {
  branchId: number;
  period: string;
  approvedById: string;
  notes?: string;
}) {
  const snapshot = await getTrialBalance(data.branchId);
  return prisma.trialBalanceApproval.upsert({
    where: { branchId_period: { branchId: data.branchId, period: data.period } },
    create: {
      branchId: data.branchId,
      period: data.period,
      approvedById: data.approvedById,
      notes: data.notes,
      snapshot,
    },
    update: {
      approvedById: data.approvedById,
      notes: data.notes,
      snapshot,
    },
    include: { approvedBy: { select: { firstName: true, lastName: true } } },
  });
}

export async function listTrialBalanceApprovals(branchId: number) {
  return prisma.trialBalanceApproval.findMany({
    where: { branchId },
    include: { approvedBy: { select: { firstName: true, lastName: true } } },
    orderBy: { period: 'desc' },
  });
}

export async function updateBankAccount(
  id: number,
  branchId: number,
  data: Partial<{ name: string; accountNumber: string; runningBalance: number; isActive: boolean }>
) {
  const bank = await prisma.bankAccount.findFirst({ where: { id, branchId } });
  if (!bank) throw new AppError(404, 'Bank account not found');
  return prisma.bankAccount.update({ where: { id }, data });
}

export async function updateAccount(
  id: number,
  branchId: number,
  data: Partial<{ name: string; code: string; isActive: boolean }>
) {
  const account = await prisma.account.findFirst({ where: { id, branchId } });
  if (!account) throw new AppError(404, 'Account not found');
  return prisma.account.update({ where: { id }, data });
}
