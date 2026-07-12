/**
 * Backfill financial years for all branches and tag existing records.
 * Fiscal year: July 1 → June 30 (label e.g. "2025-2026").
 *
 * Run: npx tsx scripts/backfill-financial-years.ts
 */
import { FinancialYearStatus } from '@prisma/client';
import { prisma } from '../src/config/database.js';

function fiscalYearForDate(date: Date): { label: string; startDate: Date } {
  const year = date.getFullYear();
  const month = date.getMonth();
  if (month >= 6) {
    return { label: `${year}-${year + 1}`, startDate: new Date(year, 6, 1) };
  }
  return { label: `${year - 1}-${year}`, startDate: new Date(year - 1, 6, 1) };
}

async function main() {
  const today = new Date();
  const { label, startDate } = fiscalYearForDate(today);

  const branches = await prisma.branch.findMany({ select: { id: true, name: true } });
  console.log(`Backfilling ${branches.length} branch(es) with FY "${label}"…`);

  for (const branch of branches) {
    const existing = await prisma.financialYear.findFirst({
      where: { branchId: branch.id, status: FinancialYearStatus.ACTIVE },
    });

    const financialYear =
      existing ??
      (await prisma.financialYear.create({
        data: {
          branchId: branch.id,
          label,
          startDate,
          status: FinancialYearStatus.ACTIVE,
        },
      }));

    const [vouchers, orders, purchases, serviceInvoices] = await Promise.all([
      prisma.voucher.updateMany({
        where: { branchId: branch.id, financialYearId: null },
        data: { financialYearId: financialYear.id },
      }),
      prisma.order.updateMany({
        where: { branchId: branch.id, financialYearId: null },
        data: { financialYearId: financialYear.id },
      }),
      prisma.purchase.updateMany({
        where: { branchId: branch.id, financialYearId: null },
        data: { financialYearId: financialYear.id },
      }),
      prisma.serviceInvoice.updateMany({
        where: { branchId: branch.id, financialYearId: null },
        data: { financialYearId: financialYear.id },
      }),
    ]);

    console.log(
      `  Branch ${branch.id} (${branch.name}): FY id=${financialYear.id} — ` +
        `vouchers=${vouchers.count}, orders=${orders.count}, ` +
        `purchases=${purchases.count}, serviceInvoices=${serviceInvoices.count}`,
    );
  }

  console.log('Done.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
