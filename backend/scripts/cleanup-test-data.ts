/**
 * Removes orphaned vitest / accounting test data from the database.
 * Run: npx tsx scripts/cleanup-test-data.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const TEST_USER_FILTER = {
  OR: [
    { email: { endsWith: '@test.local' } },
    { email: { startsWith: 'vitest.online.', endsWith: '@crown-eve.com' } },
  ],
};

async function deleteTestUser(userId: string, email: string) {
  const customer = await prisma.customer.findUnique({ where: { userId } });
  if (customer) {
    await prisma.customerLedger.deleteMany({ where: { customerId: customer.id } });
    await prisma.serviceInvoiceItem.deleteMany({
      where: { serviceInvoice: { customerId: customer.id } },
    });
    await prisma.serviceInvoice.deleteMany({ where: { customerId: customer.id } });
    await prisma.customer.delete({ where: { id: customer.id } }).catch(() => undefined);
  }

  await prisma.orderItem.deleteMany({ where: { order: { userId } } });
  await prisma.order.deleteMany({ where: { userId } });

  await prisma.serviceBookingPart.deleteMany({ where: { booking: { userId } } });
  await prisma.serviceBooking.deleteMany({ where: { userId } });

  await prisma.stockAdjustment.deleteMany({ where: { adjustedById: userId } });
  await prisma.trialBalanceApproval.deleteMany({ where: { approvedById: userId } });

  const voucherIds = (
    await prisma.voucher.findMany({
      where: {
        OR: [{ createdById: userId }, { modifiedById: userId }, { deletedById: userId }],
      },
      select: { id: true },
    })
  ).map((v) => v.id);

  if (voucherIds.length > 0) {
    await prisma.ledgerEntry.deleteMany({ where: { voucherId: { in: voucherIds } } });
    await prisma.voucher.deleteMany({ where: { id: { in: voucherIds } } });
  }

  await prisma.branch.updateMany({ where: { ownerId: userId }, data: { ownerId: null } });

  try {
    await prisma.user.delete({ where: { id: userId } });
    console.log(`  Deleted user: ${email}`);
  } catch {
    await prisma.user.update({
      where: { id: userId },
      data: { isActive: false, branchId: null },
    });
    console.log(`  Deactivated user (FK blocked hard delete): ${email}`);
  }
}

async function cleanupTestBranches() {
  const testBranches = await prisma.branch.findMany({
    where: { name: { startsWith: 'Accounting Test' } },
    select: { id: true, name: true },
  });

  if (testBranches.length === 0) {
    console.log('No accounting test branches found.');
    return;
  }

  console.log(`Removing ${testBranches.length} accounting test branch(es)…`);

  for (const branch of testBranches) {
    const branchId = branch.id;

    await prisma.customerLedger.deleteMany({
      where: {
        OR: [
          { customer: { branchId } },
          { order: { branchId } },
          { serviceInvoice: { branchId } },
        ],
      },
    });
    await prisma.supplierLedger.deleteMany({
      where: { OR: [{ supplier: { branchId } }, { purchase: { branchId } }] },
    });
    await prisma.ledgerEntry.deleteMany({
      where: { OR: [{ ledger: { branchId } }, { voucher: { branchId } }] },
    });
    await prisma.serviceInvoiceItem.deleteMany({ where: { serviceInvoice: { branchId } } });
    await prisma.serviceInvoice.deleteMany({ where: { branchId } });
    await prisma.orderItem.deleteMany({ where: { order: { branchId } } });
    await prisma.order.deleteMany({ where: { branchId } });
    await prisma.purchaseItem.deleteMany({ where: { purchase: { branchId } } });
    await prisma.purchase.deleteMany({ where: { branchId } });
    await prisma.serviceBookingPart.deleteMany({ where: { booking: { branchId } } });
    await prisma.serviceBooking.deleteMany({ where: { branchId } });
    await prisma.service.deleteMany({ where: { branchId } });
    await prisma.serviceCategory.deleteMany({ where: { branchId } });
    await prisma.supplier.deleteMany({ where: { branchId } });
    await prisma.voucher.deleteMany({ where: { branchId } });
    await prisma.customer.deleteMany({ where: { branchId } });
    await prisma.ledger.deleteMany({ where: { branchId } });
    await prisma.account.deleteMany({ where: { branchId } });
    await prisma.accountCategory.deleteMany({ where: { branchId } });
    await prisma.inventory.deleteMany({ where: { branchId } });
    await prisma.branchProduct.deleteMany({ where: { branchId } });
    await prisma.stockAdjustment.deleteMany({ where: { branchId } });
    await prisma.bankAccount.deleteMany({ where: { branchId } });
    await prisma.branchPaymentChannel.deleteMany({ where: { branchId } });
    await prisma.trialBalanceApproval.deleteMany({ where: { branchId } });
    await prisma.contactMessage.deleteMany({ where: { branchId } });

    await prisma.branch.update({ where: { id: branchId }, data: { ownerId: null } }).catch(() => undefined);

    const branchUsers = await prisma.user.findMany({
      where: { branchId },
      select: { id: true, email: true },
    });
    for (const u of branchUsers) {
      await deleteTestUser(u.id, u.email);
    }

    try {
      await prisma.branch.delete({ where: { id: branchId } });
      console.log(`  Deleted branch: ${branch.name}`);
    } catch {
      await prisma.branch.update({ where: { id: branchId }, data: { isActive: false } });
      console.log(`  Deactivated branch: ${branch.name}`);
    }
  }
}

async function cleanupTestUsers() {
  const testUsers = await prisma.user.findMany({
    where: TEST_USER_FILTER,
    select: { id: true, email: true },
    orderBy: { createdAt: 'asc' },
  });

  if (testUsers.length === 0) {
    console.log('No orphaned test users found.');
    return;
  }

  console.log(`Removing ${testUsers.length} test user(s)…`);
  for (const user of testUsers) {
    await deleteTestUser(user.id, user.email);
  }
}

async function main() {
  await cleanupTestBranches();
  await cleanupTestUsers();
  console.log('Done.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
