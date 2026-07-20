/**
 * Hard-delete a single inactive (soft-deleted) walk-in customer and its linked
 * accounting account when safe (no orders, service invoices, or ledger history).
 *
 * Usage (from backend/):
 *   npx tsx scripts/hard-delete-inactive-customer.ts --id 50              # dry-run
 *   npx tsx scripts/hard-delete-inactive-customer.ts --id 50 --apply
 */
import { prisma } from '../src/config/database.js';

function customerAccountCode(id: number): string {
  return `C${String(id).padStart(4, '0')}`;
}

function parseArgs() {
  const apply = process.argv.includes('--apply');
  const idIdx = process.argv.indexOf('--id');
  const id = idIdx >= 0 ? Number.parseInt(process.argv[idIdx + 1] ?? '', 10) : NaN;
  if (!Number.isFinite(id)) {
    throw new Error('Usage: npx tsx scripts/hard-delete-inactive-customer.ts --id <customerId> [--apply]');
  }
  return { apply, id };
}

async function main() {
  const { apply, id } = parseArgs();
  console.log(apply ? 'Mode: --apply\n' : 'Mode: dry-run (no writes)\n');

  const customer = await prisma.customer.findUnique({
    where: { id },
    include: { branch: { select: { id: true, name: true } } },
  });

  if (!customer) {
    console.error(`Customer id=${id} not found.`);
    process.exit(1);
  }

  const [orderCount, invoiceCount, ledgerCount] = await Promise.all([
    prisma.order.count({ where: { customerId: id } }),
    prisma.serviceInvoice.count({ where: { customerId: id } }),
    prisma.customerLedger.count({ where: { customerId: id } }),
  ]);

  const code = customerAccountCode(id);
  const account = customer.branchId != null
    ? await prisma.account.findFirst({
        where: { branchId: customer.branchId, code },
        include: { ledger: true },
      })
    : null;

  const accountBalance = account?.ledger ? Number(account.ledger.balance) : 0;
  const ledgerEntryCount = account
    ? await prisma.ledgerEntry.count({ where: { ledgerId: account.ledger!.id } })
    : 0;

  const report = {
    customer: {
      id: customer.id,
      branchId: customer.branchId,
      branchName: customer.branch?.name ?? null,
      name: customer.name,
      fatherName: customer.fatherName,
      cnic: customer.cnic,
      phone: customer.phone,
      isActive: customer.isActive,
    },
    linkedAccount: account
      ? {
          id: account.id,
          code: account.code,
          name: account.name,
          isActive: account.isActive,
          balance: accountBalance,
          ledgerEntryCount,
        }
      : null,
    references: {
      orders: orderCount,
      serviceInvoices: invoiceCount,
      customerLedgerEntries: ledgerCount,
    },
  };

  console.log(JSON.stringify(report, null, 2));
  console.log('');

  const blockers: string[] = [];
  if (customer.isActive) blockers.push('Customer is still active — only inactive (soft-deleted) rows are eligible.');
  if (orderCount > 0) blockers.push(`${orderCount} order(s) reference this customer.`);
  if (invoiceCount > 0) blockers.push(`${invoiceCount} service invoice(s) reference this customer.`);
  if (ledgerCount > 0) blockers.push(`${ledgerCount} customer ledger entry(ies) on record.`);
  if (account && Math.abs(accountBalance) >= 0.005) {
    blockers.push(`Linked account balance is ${accountBalance} (must be zero).`);
  }
  if (account && ledgerEntryCount > 0) {
    blockers.push(`Linked account has ${ledgerEntryCount} ledger entry(ies).`);
  }

  if (blockers.length > 0) {
    console.error('Cannot hard-delete:\n- ' + blockers.join('\n- '));
    process.exit(1);
  }

  if (!apply) {
    console.log('Dry-run OK. Re-run with --apply to permanently delete this customer row'
      + (account ? ' and its linked account.' : '.'));
    return;
  }

  await prisma.$transaction(async (tx) => {
    if (account) {
      if (account.ledger) {
        await tx.ledgerEntry.deleteMany({ where: { ledgerId: account.ledger.id } });
        await tx.ledger.delete({ where: { id: account.ledger.id } });
      }
      await tx.account.delete({ where: { id: account.id } });
      console.log(`Deleted account id=${account.id} code=${account.code}`);
    }
    await tx.customer.delete({ where: { id } });
    console.log(`Deleted customer id=${id} name="${customer.name}" branchId=${customer.branchId}`);
  });

  console.log('\nHard-delete complete.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
