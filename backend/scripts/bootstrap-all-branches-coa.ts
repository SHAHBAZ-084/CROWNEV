/**
 * Backfill chart of accounts for all existing branches.
 * Run: npx tsx scripts/bootstrap-all-branches-coa.ts
 */
import { PrismaClient } from '@prisma/client';
import { bootstrapBranchChartOfAccounts } from '../src/modules/accounting/accounting.service.js';

const prisma = new PrismaClient();

async function main() {
  const branches = await prisma.branch.findMany({
    where: { NOT: { name: { startsWith: 'Accounting Test' } } },
    select: { id: true, name: true },
    orderBy: { id: 'asc' },
  });

  for (const branch of branches) {
    await bootstrapBranchChartOfAccounts(branch.id);
    const count = await prisma.accountCategory.count({
      where: { branchId: branch.id, isActive: true },
    });
    console.log(`  ${branch.name}: ${count} categories`);
  }

  console.log('Done.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
