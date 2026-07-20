/**
 * One-off: fix HH1TE7Z08TJ102951 stuck SOLD after partial sale-invoice delete.
 * Sale journal (voucher 82) was cancelled but order #36 was never soft-cancelled
 * and chassis was not restored. Does NOT cancel purchase voucher 81 (same ref "1").
 *
 * Usage (from backend/):
 *   npx tsx scripts/fix-firefly-chassis-HH1TE7Z08TJ102951.ts           # dry-run
 *   npx tsx scripts/fix-firefly-chassis-HH1TE7Z08TJ102951.ts --apply
 */
import { ChassisStatus, CustomerLedgerType, OrderStatus, ProductType } from '@prisma/client';
import { prisma } from '../src/config/database.js';

const CHASSIS_NUMBER = 'HH1TE7Z08TJ102951';
const ORDER_ID = 36;

function parseArgs() {
  return { apply: process.argv.includes('--apply') };
}

async function removeCustomerLedgerForOrderInTx(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  orderId: number,
  customerId: number,
) {
  const entries = await tx.customerLedger.findMany({
    where: { orderId },
    orderBy: { id: 'asc' },
  });
  if (entries.length === 0) return;

  let balanceDelta = 0;
  for (const entry of entries) {
    const amount = Number(entry.amount);
    if (entry.type === CustomerLedgerType.DEBIT) balanceDelta -= amount;
    else balanceDelta += amount;
  }

  const lastId = entries[entries.length - 1].id;
  await tx.customerLedger.deleteMany({ where: { orderId } });

  if (Math.abs(balanceDelta) < 0.005) return;

  await tx.customerLedger.updateMany({
    where: { customerId, id: { gt: lastId } },
    data: { balance: { increment: balanceDelta } },
  });
  await tx.customer.update({
    where: { id: customerId },
    data: { balance: { increment: balanceDelta } },
  });
}

async function main() {
  const { apply } = parseArgs();
  console.log(apply ? 'Mode: --apply\n' : 'Mode: dry-run\n');

  const chassis = await prisma.bikeChassisNumber.findUnique({
    where: { chassisNumber: CHASSIS_NUMBER },
    include: {
      product: { select: { name: true, model: true, type: true } },
      branch: { select: { name: true } },
      saleOrderItem: {
        include: {
          order: {
            select: {
              id: true,
              status: true,
              customerId: true,
              branchId: true,
              saleReference: true,
              invoiceGeneratedAt: true,
            },
          },
        },
      },
    },
  });

  if (!chassis) {
    console.error(`Chassis ${CHASSIS_NUMBER} not found.`);
    process.exit(1);
  }

  const order = chassis.saleOrderItem?.order;
  console.log('Current state:');
  console.log(`  chassis: ${chassis.chassisNumber} status=${chassis.status} saleOrderItemId=${chassis.saleOrderItemId}`);
  console.log(`  model: ${chassis.product.name} (${chassis.product.model ?? 'n/a'})`);
  console.log(`  branch: ${chassis.branch.name}`);
  if (order) {
    console.log(`  order #${order.id} status=${order.status} ref=${order.saleReference} invoiceGeneratedAt=${order.invoiceGeneratedAt?.toISOString() ?? 'null'}`);
  }

  if (chassis.status !== ChassisStatus.SOLD) {
    console.log('\nChassis is not SOLD — nothing to do.');
    return;
  }

  if (!order || order.id !== ORDER_ID) {
    console.error(`\nExpected linked order #${ORDER_ID}; aborting.`);
    process.exit(1);
  }

  if (!order.customerId) {
    console.error('\nOrder has no customerId; aborting.');
    process.exit(1);
  }

  const planned = [
    `Set ${CHASSIS_NUMBER} → IN_STOCK, clear saleOrderItemId`,
    `Increment branchProduct stock +1 for product ${chassis.productId} at branch ${chassis.branchId}`,
    `Remove customer ledger entries for order #${ORDER_ID} and adjust customer #${order.customerId} balance`,
    `Set order #${ORDER_ID} → CANCELLED, invoiceGeneratedAt=null`,
    'Leave purchase voucher #81 (ref "1") untouched',
  ];

  console.log('\nPlanned changes:');
  for (const step of planned) console.log(`  - ${step}`);

  if (!apply) {
    console.log('\nDry-run complete. Re-run with --apply to commit.');
    return;
  }

  await prisma.$transaction(async (tx) => {
    const updatedChassis = await tx.bikeChassisNumber.updateMany({
      where: { id: chassis.id, status: ChassisStatus.SOLD, saleOrderItemId: chassis.saleOrderItemId },
      data: { status: ChassisStatus.IN_STOCK, saleOrderItemId: null },
    });
    if (updatedChassis.count !== 1) throw new Error('Chassis row changed during apply');

    if (chassis.product.type === ProductType.BIKE || chassis.product.type === ProductType.PART) {
      await tx.branchProduct.upsert({
        where: {
          branchId_productId: { branchId: chassis.branchId, productId: chassis.productId },
        },
        create: {
          branchId: chassis.branchId,
          productId: chassis.productId,
          stock: chassis.saleOrderItem?.quantity ?? 1,
          isListed: true,
        },
        update: { stock: { increment: chassis.saleOrderItem?.quantity ?? 1 } },
      });
    }

    await removeCustomerLedgerForOrderInTx(tx, ORDER_ID, order.customerId);
    await tx.order.update({
      where: { id: ORDER_ID },
      data: { status: OrderStatus.CANCELLED, invoiceGeneratedAt: null },
    });
  });

  const after = await prisma.bikeChassisNumber.findUnique({
    where: { chassisNumber: CHASSIS_NUMBER },
    select: { status: true, saleOrderItemId: true },
  });
  console.log('\nApplied successfully.');
  console.log(`  chassis now: status=${after?.status} saleOrderItemId=${after?.saleOrderItemId ?? 'null'}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
