/**
 * Removes orphaned accounting test branches left in the database.
 * Run: npx tsx scripts/cleanup-test-branches.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const deactivated = await prisma.branch.updateMany({
    where: { name: { startsWith: 'Accounting Test' } },
    data: { isActive: false },
  });
  console.log(`Deactivated ${deactivated.count} test branch(es) on public site.`);

  const testBranches = await prisma.branch.findMany({
    where: { name: { startsWith: 'Accounting Test' } },
    select: { id: true, name: true },
  });

  if (testBranches.length === 0) return;

  console.log(`Removing ${testBranches.length} test branch(es) from database…`);

  for (const branch of testBranches) {
    const branchId = branch.id;

    await prisma.ledgerEntry.deleteMany({ where: { ledger: { branchId } } });
    await prisma.voucher.deleteMany({ where: { branchId } });
    await prisma.ledger.deleteMany({ where: { branchId } });
    await prisma.account.deleteMany({ where: { branchId } });
    await prisma.accountCategory.deleteMany({ where: { branchId } });

    await prisma.branch.update({ where: { id: branchId }, data: { ownerId: null } }).catch(() => undefined);
    await prisma.user.deleteMany({ where: { branchId } });

    try {
      await prisma.branch.delete({ where: { id: branchId } });
      console.log(`  Deleted: ${branch.name}`);
    } catch {
      console.log(`  Left deactivated: ${branch.name}`);
    }
  }

  console.log('Done.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
