/**
 * Repair historical single-sided opening balances by posting the missing
 * Opening Balance Equity offset. Also cancels a bad repair journal if present.
 */
import { prisma } from '../src/config/database.js';
import { cancelVoucher, getTrialBalance } from '../src/modules/accounting/accounting.service.js';
import { LedgerEntryType } from '@prisma/client';

async function findOrCreateEquity(branchId: number) {
  let equity = await prisma.account.findFirst({
    where: {
      branchId,
      isActive: true,
      type: 'EQUITY',
      name: { equals: 'Opening Balance Equity', mode: 'insensitive' },
    },
    include: { ledger: true },
  });
  if (equity?.ledger) return equity;

  let category = await prisma.accountCategory.findFirst({
    where: { branchId, isActive: true, name: { equals: 'Capital', mode: 'insensitive' } },
  });
  if (!category) {
    category = await prisma.accountCategory.create({ data: { branchId, name: 'Capital' } });
  }

  const maxCode = await prisma.account.findMany({ where: { branchId }, select: { code: true } });
  let max = 0;
  for (const { code } of maxCode) {
    if (!/^\d+$/.test(code)) continue;
    const n = parseInt(code, 10);
    if (!Number.isNaN(n) && n > max) max = n;
  }

  return prisma.account.create({
    data: {
      branchId,
      categoryId: category.id,
      name: 'Opening Balance Equity',
      code: String(max + 1),
      type: 'EQUITY',
      ledger: { create: { branchId, balance: 0 } },
    },
    include: { ledger: true },
  });
}

async function postEquityOffset(
  branchId: number,
  accountName: string,
  amount: number,
  side: 'DR' | 'CR',
) {
  const equity = await findOrCreateEquity(branchId);
  const equityLedger = equity.ledger!;
  const offsetType = side === 'DR' ? LedgerEntryType.CREDIT : LedgerEntryType.DEBIT;
  const offsetBalance = Number(equityLedger.balance) + (side === 'DR' ? -amount : amount);

  await prisma.ledgerEntry.create({
    data: {
      ledgerId: equityLedger.id,
      type: offsetType,
      amount,
      balance: offsetBalance,
      notes: `Opening Balance — offset for ${accountName}`,
      isOpeningBalance: true,
    },
  });
  await prisma.ledger.update({
    where: { id: equityLedger.id },
    data: { balance: offsetBalance },
  });
}

async function main() {
  const branchId = 1;
  const user = await prisma.user.findFirst({ where: { role: 'ADMIN' }, orderBy: { createdAt: 'asc' } });
  if (!user) throw new Error('No admin user');

  const badRepair = await prisma.voucher.findFirst({
    where: {
      branchId,
      status: 'ACTIVE',
      description: 'Trial balance repair — offset unpaired opening balance',
    },
  });
  if (badRepair) {
    await cancelVoucher(branchId, badRepair.id, user.id);
    console.log('Cancelled incorrect repair journal #' + badRepair.number);
  }

  const orphanOpenings = (await prisma.ledgerEntry.findMany({
    where: {
      isOpeningBalance: true,
      ledger: { branchId },
    },
    include: { ledger: { include: { account: true } } },
  })).filter(
    (e) => e.ledger.account.name.toLowerCase() !== 'opening balance equity',
  );

  for (const entry of orphanOpenings) {
    const accountName = entry.ledger.account.name;
    const amount = Number(entry.amount);
    const side = entry.type === 'DEBIT' ? 'DR' : 'CR';

    const existingOffset = await prisma.ledgerEntry.findFirst({
      where: {
        isOpeningBalance: true,
        notes: { contains: accountName, mode: 'insensitive' },
        ledger: { account: { name: { equals: 'Opening Balance Equity', mode: 'insensitive' } } },
      },
    });
    if (existingOffset) {
      console.log('Offset already exists for', accountName);
      continue;
    }

    await postEquityOffset(branchId, accountName, amount, side as 'DR' | 'CR');
    console.log(`Posted opening offset for ${accountName}: ${amount} ${side}`);
  }

  const after = await getTrialBalance(branchId);
  console.log('After repair:', {
    totalDebit: after.totalDebit,
    totalCredit: after.totalCredit,
    isBalanced: after.isBalanced,
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
