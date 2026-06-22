import { AccountType, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { prisma } from '../../../config/database.js';
import {
  cancelVoucher,
  createAccount,
  createAccountCategory,
  createVoucher,
  getLedgerEntries,
  getTrialBalance,
} from '../accounting.service.js';
import { AppError } from '../../../utils/helpers.js';

export type AccountingTestContext = {
  branchId: number;
  userId: string;
  categories: {
    cash: number;
    bank: number;
    customers: number;
    expenses: number;
    capital: number;
  };
};

/** Matches frontend formatLedgerBalance — positive = Dr, negative = Cr. */
export function formatLedgerBalance(balance: number): string {
  const abs = Math.abs(balance).toLocaleString('en-PK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return balance >= 0 ? `${abs} Dr` : `${abs} Cr`;
}

export async function getSignedBalance(accountId: number): Promise<number> {
  const ledger = await prisma.ledger.findUnique({ where: { accountId } });
  return Number(ledger?.balance ?? 0);
}

export function assertSignedBalance(actual: number, expected: number, label?: string) {
  const prefix = label ? `${label}: ` : '';
  expect(actual, `${prefix}signed balance`).toBeCloseTo(expected, 2);
}

export function assertDisplayBalance(actual: number, expectedDisplay: string, label?: string) {
  const prefix = label ? `${label}: ` : '';
  expect(formatLedgerBalance(actual), `${prefix}display`).toBe(expectedDisplay);
}

export async function assertTrialBalanceBalanced(branchId: number) {
  const tb = await getTrialBalance(branchId);
  expect(tb.isBalanced, 'trial balance must be balanced').toBe(true);
  expect(Math.abs(tb.totalDebit - tb.totalCredit)).toBeLessThan(0.01);
  return tb;
}

export async function createAccountingTestContext(): Promise<AccountingTestContext> {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const branch = await prisma.branch.create({
    data: {
      name: `Accounting Test ${suffix}`,
      location: 'Test Location',
      phone: '+920000000000',
      isActive: false,
    },
  });

  const user = await prisma.user.create({
    data: {
      email: `acct-test-${suffix}@test.local`,
      passwordHash: await bcrypt.hash('Test@123', 8),
      firstName: 'Test',
      lastName: 'Accountant',
      role: Role.BRANCH_OWNER,
      branchId: branch.id,
      isVerified: true,
    },
  });

  const [cash, bank, customers, expenses, capital] = await Promise.all([
    createAccountCategory(branch.id, 'Cash'),
    createAccountCategory(branch.id, 'Bank'),
    createAccountCategory(branch.id, 'Customers'),
    createAccountCategory(branch.id, 'Expenses'),
    createAccountCategory(branch.id, 'Capital'),
  ]);

  return {
    branchId: branch.id,
    userId: user.id,
    categories: {
      cash: cash.id,
      bank: bank.id,
      customers: customers.id,
      expenses: expenses.id,
      capital: capital.id,
    },
  };
}

export async function makeAccount(
  ctx: AccountingTestContext,
  opts: {
    code: string;
    name: string;
    type: AccountType;
    categoryKey: keyof AccountingTestContext['categories'];
    openingBalance?: number;
    openingBalanceSide?: 'DR' | 'CR';
  },
) {
  const account = await createAccount({
    branchId: ctx.branchId,
    categoryId: ctx.categories[opts.categoryKey],
    code: opts.code,
    name: opts.name,
    type: opts.type,
    openingBalance: opts.openingBalance,
    openingBalanceSide: opts.openingBalanceSide,
  });
  return account;
}

/** Pair a debit opening with capital credit so trial balance stays balanced. */
export async function openBalancedBooks(
  ctx: AccountingTestContext,
  entries: Array<{
    code: string;
    name: string;
    type: AccountType;
    categoryKey: keyof AccountingTestContext['categories'];
    amount: number;
    side: 'DR' | 'CR';
  }>,
) {
  const accounts = [];
  for (const e of entries) {
    const account = await makeAccount(ctx, {
      code: e.code,
      name: e.name,
      type: e.type,
      categoryKey: e.categoryKey,
      openingBalance: e.amount,
      openingBalanceSide: e.side,
    });
    accounts.push(account);
  }

  return accounts;
}

export async function destroyAccountingTestContext(ctx: AccountingTestContext) {
  const branchId = ctx.branchId;

  await prisma.ledgerEntry.deleteMany({ where: { ledger: { branchId } } });
  await prisma.voucher.deleteMany({ where: { branchId } });
  await prisma.ledger.deleteMany({ where: { branchId } });
  await prisma.account.deleteMany({ where: { branchId } });
  await prisma.accountCategory.deleteMany({ where: { branchId } });

  await prisma.branch.update({ where: { id: branchId }, data: { ownerId: null } }).catch(() => undefined);
  await prisma.user.delete({ where: { id: ctx.userId } }).catch(() => undefined);
  await prisma.branch.delete({ where: { id: branchId } }).catch(() => undefined);
}

export async function postReceipt(
  ctx: AccountingTestContext,
  opts: { fromAccountId: number; toAccountId: number; amount: number; description?: string },
) {
  return createVoucher({
    branchId: ctx.branchId,
    type: 'RECEIPT',
    debitAccountId: opts.toAccountId,
    creditAccountId: opts.fromAccountId,
    amount: opts.amount,
    description: opts.description,
    createdById: ctx.userId,
  });
}

export async function postPayment(
  ctx: AccountingTestContext,
  opts: { fromAccountId: number; toAccountId: number; amount: number },
) {
  return createVoucher({
    branchId: ctx.branchId,
    type: 'PAYMENT',
    debitAccountId: opts.toAccountId,
    creditAccountId: opts.fromAccountId,
    amount: opts.amount,
    createdById: ctx.userId,
  });
}

export async function postJournal(
  ctx: AccountingTestContext,
  opts: { debitAccountId: number; creditAccountId: number; amount: number },
) {
  return createVoucher({
    branchId: ctx.branchId,
    type: 'JOURNAL',
    debitAccountId: opts.debitAccountId,
    creditAccountId: opts.creditAccountId,
    amount: opts.amount,
    createdById: ctx.userId,
  });
}

export async function expectAppError(fn: () => Promise<unknown>, statusCode: number, messagePart?: string) {
  try {
    await fn();
    throw new Error('Expected AppError but succeeded');
  } catch (err) {
    expect(err).toBeInstanceOf(AppError);
    const appErr = err as AppError;
    expect(appErr.statusCode).toBe(statusCode);
    if (messagePart) {
      expect(appErr.message.toLowerCase()).toContain(messagePart.toLowerCase());
    }
  }
}

export {
  cancelVoucher,
  createAccountCategory,
  createVoucher,
  getLedgerEntries,
  getTrialBalance,
};
