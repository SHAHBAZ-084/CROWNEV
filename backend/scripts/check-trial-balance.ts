import { prisma } from '../src/config/database.js';

async function main() {
  const branchId = 1;
  const accounts = await prisma.account.findMany({
    where: { branchId },
    include: { ledger: true, category: true },
    orderBy: { name: 'asc' },
  });
  console.log('=== Accounts & ledger balances ===');
  for (const a of accounts) {
    console.log(
      JSON.stringify({
        id: a.id,
        code: a.code,
        name: a.name,
        isActive: a.isActive,
        balance: a.ledger ? Number(a.ledger.balance) : null,
        category: a.category.name,
      }),
    );
  }

  const vouchers = await prisma.voucher.findMany({
    where: { branchId, status: 'ACTIVE' },
    include: { debitAccount: true, creditAccount: true, ledgerEntries: true },
    orderBy: { id: 'desc' },
    take: 10,
  });
  console.log('\n=== Recent active vouchers ===');
  for (const v of vouchers) {
    console.log(
      JSON.stringify({
        id: v.id,
        number: v.number,
        type: v.type,
        amount: Number(v.amount),
        debit: v.debitAccount.name,
        credit: v.creditAccount.name,
        entries: v.ledgerEntries.length,
      }),
    );
  }

  const entries = await prisma.ledgerEntry.findMany({
    where: { ledger: { branchId } },
    include: { ledger: { include: { account: true } }, voucher: true },
    orderBy: { id: 'desc' },
    take: 20,
  });
  console.log('\n=== Recent ledger entries ===');
  for (const e of entries) {
    console.log(
      JSON.stringify({
        id: e.id,
        account: e.ledger.account.name,
        type: e.type,
        amount: Number(e.amount),
        balance: Number(e.balance),
        voucherId: e.voucherId,
        isReversal: e.isReversal,
      }),
    );
  }

  const ledgers = await prisma.ledger.findMany({ where: { branchId }, include: { account: true } });
  let totalDebit = 0;
  let totalCredit = 0;
  for (const l of ledgers) {
    const b = Number(l.balance);
    if (b > 0) totalDebit += b;
    if (b < 0) totalCredit += Math.abs(b);
  }
  console.log('\n=== Trial balance totals ===', { totalDebit, totalCredit, diff: totalDebit - totalCredit });

  const allEntries = await prisma.ledgerEntry.findMany({
    where: { ledger: { branchId } },
    include: { ledger: { include: { account: true } }, voucher: true },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });
  const byAccount = new Map<string, typeof allEntries>();
  for (const e of allEntries) {
    const name = e.ledger.account.name;
    if (!byAccount.has(name)) byAccount.set(name, []);
    byAccount.get(name)!.push(e);
  }
  console.log('\n=== Per-account entry sums ===');
  for (const [name, rows] of byAccount) {
    const sum = rows.reduce((s, r) => s + (r.type === 'DEBIT' ? Number(r.amount) : -Number(r.amount)), 0);
    const last = rows[rows.length - 1];
    console.log(name, 'computed', sum, 'stored', Number(last.balance), 'entries', rows.length);
  }
  const orphan = allEntries.filter((e) => !e.voucherId && !e.isOpeningBalance);
  console.log('\nNon-opening entries without voucher:', orphan.length);
  for (const e of orphan) {
    console.log({
      id: e.id,
      acct: e.ledger.account.name,
      type: e.type,
      amt: Number(e.amount),
      isReversal: e.isReversal,
    });
  }

  const opening = allEntries.filter((e) => e.isOpeningBalance);
  console.log('\nOpening balance entries:', opening.length);
  for (const e of opening) {
    console.log({
      id: e.id,
      acct: e.ledger.account.name,
      type: e.type,
      amt: Number(e.amount),
      voucherId: e.voucherId,
    });
  }

  let allDebits = 0;
  let allCredits = 0;
  for (const e of allEntries) {
    if (e.isReversal) continue;
    if (e.voucher?.status === 'CANCELLED') continue;
    if (e.type === 'DEBIT') allDebits += Number(e.amount);
    else allCredits += Number(e.amount);
  }
  console.log('\nAll active entry totals:', { allDebits, allCredits, diff: allDebits - allCredits });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
