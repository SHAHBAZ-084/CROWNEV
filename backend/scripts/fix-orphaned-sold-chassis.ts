/**
 * One-off backfill: restore chassis left SOLD after sale invoices were deleted
 * before deleteSaleInvoice restored stock/chassis status.
 *
 * Finds BikeChassisNumber rows that are still SOLD but linked to a cancelled
 * POS sale (or a missing order item). Does not touch legitimately sold units.
 *
 * Usage (from backend/):
 *   npx tsx scripts/fix-orphaned-sold-chassis.ts           # dry-run (default)
 *   npx tsx scripts/fix-orphaned-sold-chassis.ts --apply     # write changes
 *
 * Optional:
 *   --chassis HH1TE7Z08TJ102951   log/check a specific chassis number
 */
import { ChassisStatus, OrderStatus, OrderType } from '@prisma/client';
import { prisma } from '../src/config/database.js';

const TARGET_CHASSIS = 'HH1TE7Z08TJ102951';

function parseArgs() {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const chassisIdx = args.indexOf('--chassis');
  const chassis =
    chassisIdx !== -1 && args[chassisIdx + 1] ? args[chassisIdx + 1] : TARGET_CHASSIS;
  return { apply, highlightChassis: chassis };
}

type OrphanReason =
  | 'missing_order_item'
  | 'order_cancelled'
  | 'pos_invoice_removed';

function isOrphanedSoldChassis(chassis: {
  saleOrderItemId: number | null;
  saleOrderItem: {
    order: {
      status: OrderStatus;
      type: OrderType;
      invoiceGeneratedAt: Date | null;
    };
  } | null;
}): OrphanReason | null {
  if (!chassis.saleOrderItemId) return null;

  if (!chassis.saleOrderItem) {
    return 'missing_order_item';
  }

  const order = chassis.saleOrderItem.order;
  if (order.status === OrderStatus.CANCELLED) {
    return 'order_cancelled';
  }
  if (order.type === OrderType.POS && order.invoiceGeneratedAt == null) {
    return 'pos_invoice_removed';
  }

  return null;
}

async function main() {
  const { apply, highlightChassis } = parseArgs();

  console.log(
    apply
      ? 'Mode: --apply (will update matching chassis to IN_STOCK).\n'
      : 'Mode: dry-run (no writes). Pass --apply to commit changes.\n',
  );

  const sold = await prisma.bikeChassisNumber.findMany({
    where: { status: ChassisStatus.SOLD },
    include: {
      product: { select: { name: true, model: true } },
      branch: { select: { name: true } },
      saleOrderItem: {
        include: {
          order: {
            select: {
              id: true,
              status: true,
              type: true,
              invoiceGeneratedAt: true,
              saleReference: true,
            },
          },
        },
      },
    },
    orderBy: [{ branchId: 'asc' }, { chassisNumber: 'asc' }],
  });

  const orphaned = sold
    .map((row) => ({ row, reason: isOrphanedSoldChassis(row) }))
    .filter((entry): entry is { row: (typeof sold)[number]; reason: OrphanReason } => entry.reason != null);

  console.log(`Scanned ${sold.length} chassis with status SOLD.`);
  console.log(`Found ${orphaned.length} orphaned record(s) to fix.\n`);

  if (orphaned.length === 0) {
    console.log('Nothing to do.');
    return;
  }

  for (const { row, reason } of orphaned) {
    const model = row.product.model
      ? `${row.product.name} (${row.product.model})`
      : row.product.name;
    const order = row.saleOrderItem?.order;
    console.log(
      [
        `- ${row.chassisNumber}`,
        `branch: ${row.branch.name}`,
        `model: ${model}`,
        `reason: ${reason}`,
        row.saleOrderItemId != null ? `saleOrderItemId: ${row.saleOrderItemId}` : null,
        order
          ? `order: #${order.id} ${order.saleReference ?? '(no ref)'} status=${order.status}`
          : 'order: (missing)',
      ]
        .filter(Boolean)
        .join(' | '),
    );
  }

  const highlighted = orphaned.find(
    (e) => e.row.chassisNumber.toUpperCase() === highlightChassis.toUpperCase(),
  );
  console.log('');
  if (highlighted) {
    console.log(`✓ Target chassis ${highlightChassis} IS included in the fix list.`);
  } else {
    const direct = await prisma.bikeChassisNumber.findUnique({
      where: { chassisNumber: highlightChassis },
      include: {
        product: { select: { name: true, model: true } },
        branch: { select: { name: true } },
        saleOrderItem: {
          include: {
            order: {
              select: {
                id: true,
                status: true,
                type: true,
                invoiceGeneratedAt: true,
                saleReference: true,
              },
            },
          },
        },
      },
    });
    if (!direct) {
      console.log(`✗ Target chassis ${highlightChassis} was NOT found in the database.`);
    } else {
      const reason = isOrphanedSoldChassis(direct);
      console.log(
        `✗ Target chassis ${highlightChassis} was NOT included (status=${direct.status}${
          reason ? `, would-be reason=${reason}` : ', appears legitimately sold or not linked'
        }).`,
      );
      if (direct.saleOrderItem?.order) {
        const o = direct.saleOrderItem.order;
        console.log(
          `  Linked order #${o.id} status=${o.status} type=${o.type} invoiceGeneratedAt=${o.invoiceGeneratedAt?.toISOString() ?? 'null'}`,
        );
      }
    }
  }

  if (!apply) {
    console.log('\nDry-run complete. Re-run with --apply to set status=IN_STOCK and saleOrderItemId=null.');
    return;
  }

  console.log('\nApplying updates…');
  let updated = 0;
  for (const { row } of orphaned) {
    const result = await prisma.bikeChassisNumber.updateMany({
      where: {
        id: row.id,
        status: ChassisStatus.SOLD,
        saleOrderItemId: row.saleOrderItemId,
      },
      data: {
        status: ChassisStatus.IN_STOCK,
        saleOrderItemId: null,
      },
    });
    if (result.count === 1) updated += 1;
    else {
      console.warn(`  Skipped ${row.chassisNumber} (row changed since scan).`);
    }
  }

  console.log(`Updated ${updated} chassis record(s).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
