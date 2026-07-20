/**
 * One-off recovery: restore a single soft-deleted customer (sets isActive = true only).
 * Does not modify ledger, balance, CNIC, or any other table.
 *
 * Usage (from backend/):
 *   npx tsx scripts/restore-customer.ts
 *   npx tsx scripts/restore-customer.ts --confirm
 *
 * Optional:
 *   --name "Muhammad Abdullah"   override search name (default below)
 */
import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { prisma } from '../src/config/database.js';

const DEFAULT_NAME = 'Muhammad Abdullah';

function parseArgs() {
  const args = process.argv.slice(2);
  const confirm = args.includes('--confirm');
  const nameIdx = args.indexOf('--name');
  const name =
    nameIdx !== -1 && args[nameIdx + 1] ? args[nameIdx + 1] : DEFAULT_NAME;
  return { confirm, name };
}

function formatCustomerRow(c: {
  id: number;
  branchId: number | null;
  cnic: string | null;
  phone: string | null;
  createdAt: Date;
  _count: { ledger: number };
}) {
  return {
    id: c.id,
    branchId: c.branchId,
    cnic: c.cnic ?? '(null)',
    phone: c.phone ?? '(null)',
    createdAt: c.createdAt.toISOString(),
    ledgerEntryCount: c._count.ledger,
  };
}

async function askYesNo(question: string): Promise<boolean> {
  const rl = readline.createInterface({ input, output });
  try {
    const answer = (await rl.question(`${question} [y/N]: `)).trim().toLowerCase();
    return answer === 'y' || answer === 'yes';
  } finally {
    rl.close();
  }
}

async function main() {
  const { confirm, name } = parseArgs();

  console.log(`Searching for inactive customers with name containing "${name}" (case-insensitive)...`);
  console.log(confirm ? 'Mode: --confirm passed (will restore if exactly one match).\n' : 'Mode: dry-run (no writes unless you pass --confirm or confirm at prompt).\n');

  const matches = await prisma.customer.findMany({
    where: {
      isActive: false,
      name: { contains: name, mode: 'insensitive' },
    },
    include: {
      _count: { select: { ledger: true } },
    },
    orderBy: { id: 'asc' },
  });

  if (matches.length === 0) {
    console.log('No inactive customers matched. Nothing to do.');
    return;
  }

  if (matches.length > 1) {
    console.log(`Found ${matches.length} matches — stopping without changes. Pick the correct id and re-run with a narrower --name if needed.\n`);
    for (const c of matches) {
      console.log(JSON.stringify(formatCustomerRow(c), null, 2));
      console.log('');
    }
    process.exit(1);
  }

  const customer = matches[0];
  const ledgerCount = customer._count.ledger;

  console.log('Exactly one match — review before restoring:\n');
  console.log(
    JSON.stringify(
      {
        id: customer.id,
        branchId: customer.branchId,
        userId: customer.userId,
        type: customer.type,
        name: customer.name,
        fatherName: customer.fatherName,
        cnic: customer.cnic,
        phone: customer.phone,
        email: customer.email,
        address: customer.address,
        balance: customer.balance.toString(),
        isActive: customer.isActive,
        createdAt: customer.createdAt.toISOString(),
        updatedAt: customer.updatedAt.toISOString(),
        ledgerEntryCount: ledgerCount,
      },
      null,
      2,
    ),
  );

  if (customer.cnic == null) {
    console.log('\nNote: cnic is null (cleared on soft-delete). This script only sets isActive = true; it does not restore cnic.');
  }

  if (ledgerCount === 0) {
    console.log('\nWarning: this customer has no CustomerLedger rows.');
  } else {
    console.log(`\nCustomerLedger entries: ${ledgerCount} (ledger rows are untouched by this script).`);
  }

  let shouldRestore = confirm;
  if (!shouldRestore) {
    if (input.isTTY) {
      shouldRestore = await askYesNo('\nRestore this customer (set isActive = true)?');
    } else {
      console.log('\nNon-interactive session — pass --confirm to perform the restore.');
      return;
    }
  }

  if (!shouldRestore) {
    console.log('\nAborted — no changes made.');
    return;
  }

  const before = customer.isActive;
  const updated = await prisma.customer.update({
    where: { id: customer.id },
    data: { isActive: true },
    select: { id: true, isActive: true },
  });

  console.log('\n--- Recovery log ---');
  console.log(`customerId: ${updated.id}`);
  console.log(`isActive: ${before} → ${updated.isActive}`);
  console.log('No other tables or columns were modified.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
