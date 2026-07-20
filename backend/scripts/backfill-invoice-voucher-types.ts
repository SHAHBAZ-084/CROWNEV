/**
 * Reclassify mis-typed invoice vouchers (stored as JOURNAL) to SALE / PURCHASE / SERVICE.
 * Only updates the `type` column — `number` and all other fields stay unchanged.
 *
 * Run on staging first. Take a full production backup before --apply on production.
 * Pause or lock new voucher creation during --apply to avoid races.
 *
 * Usage (from backend/):
 *   npx tsx scripts/backfill-invoice-voucher-types.ts              # dry-run (default)
 *   npx tsx scripts/backfill-invoice-voucher-types.ts --apply      # write changes
 *   npx tsx scripts/backfill-invoice-voucher-types.ts --branch 1   # limit to one branch
 */
import { VoucherType } from '@prisma/client';
import { prisma } from '../src/config/database.js';
import {
  isPurchaseVoucher,
  isSaleVoucher,
  isServiceVoucher,
} from '../src/modules/accounting/accounting.service.js';

type ProposedType = typeof VoucherType.SALE | typeof VoucherType.PURCHASE | typeof VoucherType.SERVICE;

function parseArgs() {
  const apply = process.argv.includes('--apply');
  const branchIdx = process.argv.indexOf('--branch');
  const branchId =
    branchIdx >= 0 && process.argv[branchIdx + 1]
      ? Number.parseInt(process.argv[branchIdx + 1]!, 10)
      : undefined;
  if (branchIdx >= 0 && (!branchId || Number.isNaN(branchId))) {
    throw new Error('Usage: --branch <id> requires a numeric branch id');
  }
  return { apply, branchId };
}

function classifyJournalInvoiceVoucher(voucher: {
  type: VoucherType;
  creditAccount: { name: string } | null;
  debitAccount: { name: string } | null;
}): ProposedType | null {
  if (voucher.type !== VoucherType.JOURNAL) return null;
  if (isSaleVoucher(voucher)) return VoucherType.SALE;
  if (isPurchaseVoucher(voucher)) return VoucherType.PURCHASE;
  if (isServiceVoucher(voucher)) return VoucherType.SERVICE;
  return null;
}

async function main() {
  const { apply, branchId } = parseArgs();
  console.log(apply ? 'Mode: --apply (writes enabled)\n' : 'Mode: dry-run (no writes)\n');
  if (branchId != null) console.log(`Branch filter: ${branchId}\n`);

  const vouchers = await prisma.voucher.findMany({
    where: {
      type: VoucherType.JOURNAL,
      ...(branchId != null && { branchId }),
    },
    include: {
      debitAccount: { select: { name: true } },
      creditAccount: { select: { name: true } },
      branch: { select: { id: true, name: true } },
    },
    orderBy: [{ branchId: 'asc' }, { id: 'asc' }],
  });

  const toUpdate: {
    id: number;
    branchId: number;
    branchName: string;
    number: number;
    reference: string | null;
    currentType: VoucherType;
    proposedType: ProposedType;
    debitAccount: string;
    creditAccount: string;
  }[] = [];

  for (const voucher of vouchers) {
    const proposedType = classifyJournalInvoiceVoucher(voucher);
    if (!proposedType) continue;
    toUpdate.push({
      id: voucher.id,
      branchId: voucher.branchId,
      branchName: voucher.branch.name,
      number: voucher.number,
      reference: voucher.reference,
      currentType: voucher.type,
      proposedType,
      debitAccount: voucher.debitAccount?.name ?? '(missing)',
      creditAccount: voucher.creditAccount?.name ?? '(missing)',
    });
  }

  console.log(`Scanned ${vouchers.length} JOURNAL voucher(s); ${toUpdate.length} to reclassify.\n`);

  if (toUpdate.length === 0) {
    console.log('Nothing to do.');
    return;
  }

  console.log('--- Proposed changes ---');
  for (const row of toUpdate) {
    console.log(
      JSON.stringify({
        id: row.id,
        branchId: row.branchId,
        branchName: row.branchName,
        number: row.number,
        reference: row.reference,
        currentType: row.currentType,
        proposedType: row.proposedType,
        debitAccount: row.debitAccount,
        creditAccount: row.creditAccount,
      }),
    );
  }
  console.log('--- End proposed changes ---\n');

  if (!apply) {
    console.log('Dry-run complete. Re-run with --apply after review.');
    return;
  }

  let updated = 0;
  for (const row of toUpdate) {
    const before = await prisma.voucher.findUnique({
      where: { id: row.id },
      select: { id: true, type: true, number: true, branchId: true, reference: true },
    });
    if (!before) {
      console.warn(`Skip id=${row.id}: row no longer exists`);
      continue;
    }
    if (before.type !== VoucherType.JOURNAL) {
      console.warn(
        `Skip id=${row.id}: type is already ${before.type} (idempotent)`,
      );
      continue;
    }

    const after = await prisma.voucher.update({
      where: { id: row.id },
      data: { type: row.proposedType },
      select: { id: true, type: true, number: true, branchId: true, reference: true },
    });

    console.log(
      JSON.stringify({
        action: 'updated',
        before,
        after,
      }),
    );
    updated += 1;
  }

  console.log(`\nApply complete. Updated ${updated} voucher(s).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
