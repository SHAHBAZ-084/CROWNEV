/**
 * Run before applying 20260720120000_branch_scoped_uniques migration.
 * Reports rows that would violate the new composite unique constraints.
 */
import { prisma } from '../src/config/database.js';

async function main() {
  const customerDupes = await prisma.$queryRaw<
    { branchId: number | null; cnic: string; count: bigint }[]
  >`
    SELECT "branchId", "cnic", COUNT(*)::bigint AS count
    FROM "Customer"
    WHERE "cnic" IS NOT NULL
    GROUP BY "branchId", "cnic"
    HAVING COUNT(*) > 1
    ORDER BY count DESC
  `;

  const supplierDupes = await prisma.$queryRaw<
    { branchId: number; phone: string; count: bigint }[]
  >`
    SELECT "branchId", "phone", COUNT(*)::bigint AS count
    FROM "Supplier"
    WHERE "phone" IS NOT NULL
    GROUP BY "branchId", "phone"
    HAVING COUNT(*) > 1
    ORDER BY count DESC
  `;

  const bankDupes = await prisma.$queryRaw<
    { branchId: number; name: string; count: bigint }[]
  >`
    SELECT "branchId", "name", COUNT(*)::bigint AS count
    FROM "BankAccount"
    GROUP BY "branchId", "name"
    HAVING COUNT(*) > 1
    ORDER BY count DESC
  `;

  let blocked = false;

  if (customerDupes.length) {
    blocked = true;
    console.error('\n❌ Customer (branchId, cnic) duplicates:');
    for (const row of customerDupes) {
      console.error(`  branchId=${row.branchId} cnic=${row.cnic} count=${row.count}`);
    }
  }

  if (supplierDupes.length) {
    blocked = true;
    console.error('\n❌ Supplier (branchId, phone) duplicates:');
    for (const row of supplierDupes) {
      console.error(`  branchId=${row.branchId} phone=${row.phone} count=${row.count}`);
    }
  }

  if (bankDupes.length) {
    blocked = true;
    console.error('\n❌ BankAccount (branchId, name) duplicates:');
    for (const row of bankDupes) {
      console.error(`  branchId=${row.branchId} name=${row.name} count=${row.count}`);
    }
  }

  if (blocked) {
    console.error('\nResolve duplicates before running the migration.');
    process.exit(1);
  }

  console.log('✓ No duplicate rows would block branch-scoped unique constraints.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
