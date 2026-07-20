/**
 * Read-only: find customer(s) by name (includes soft-deleted / inactive).
 * Does NOT modify any data.
 *
 * Usage (from backend/):
 *   npx tsx scripts/inspect-customer-by-name.ts "Muhammad Abbas"
 *   npx tsx scripts/inspect-customer-by-name.ts "Muhammad Abbas" --branch 1
 */
import { prisma } from '../src/config/database.js';

function parseArgs() {
  const argv = process.argv.slice(2);
  const branchIdx = argv.indexOf('--branch');
  let branchId: number | undefined;
  if (branchIdx >= 0) {
    branchId = Number.parseInt(argv[branchIdx + 1] ?? '', 10);
    if (!Number.isFinite(branchId)) {
      throw new Error('Usage: --branch <id> requires a numeric branch id');
    }
  }
  const nameParts = argv.filter((a, i) => a !== '--branch' && (branchIdx < 0 || i !== branchIdx + 1));
  const name = nameParts.join(' ').trim();
  if (!name) throw new Error('Usage: npx tsx scripts/inspect-customer-by-name.ts "<name>" [--branch <id>]');
  return { name, branchId };
}

async function main() {
  const { name, branchId } = parseArgs();
  console.log('Mode: read-only (no writes)\n');
  console.log(`Searching for customer name containing: "${name}"`);
  if (branchId != null) console.log(`Branch filter: ${branchId}`);
  console.log('');

  const rows = await prisma.customer.findMany({
    where: {
      ...(branchId != null && { branchId }),
      name: { contains: name, mode: 'insensitive' },
    },
    include: {
      branch: { select: { id: true, name: true } },
    },
    orderBy: [{ branchId: 'asc' }, { id: 'asc' }],
  });

  if (rows.length === 0) {
    console.log('No customer rows found (active or inactive).');
    console.log('POS customer page would NOT show this name.');
    return;
  }

  console.log(`Found ${rows.length} row(s):\n`);

  for (const c of rows) {
    const visibleOnPos = c.isActive;
    console.log(JSON.stringify({
      id: c.id,
      branchId: c.branchId,
      branchName: c.branch.name,
      name: c.name,
      fatherName: c.fatherName,
      cnic: c.cnic,
      phone: c.phone,
      isActive: c.isActive,
      visibleOnPosCustomerPage: visibleOnPos,
      posListReason: visibleOnPos
        ? 'Shown — isActive is true (matches listWalkInCustomers / listBranchCustomers filter)'
        : 'Hidden — soft-deleted (isActive false); excluded from POS customer lists',
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    }, null, 2));
    console.log('');
  }

  const activeCount = rows.filter((c) => c.isActive).length;
  const inactiveCount = rows.length - activeCount;
  console.log('--- Summary ---');
  console.log(`Total matches: ${rows.length}`);
  console.log(`Active (visible on POS): ${activeCount}`);
  console.log(`Inactive / deleted (hidden on POS): ${inactiveCount}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
