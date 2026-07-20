import { prisma } from '../config/database.js';
import { AppError } from './helpers.js';

export async function assertNoCustomerLedgerHistory(
  customerId: number,
  tx: typeof prisma = prisma,
) {
  const count = await tx.customerLedger.count({ where: { customerId } });
  if (count > 0) {
    const entryLabel = count === 1 ? 'entry' : 'entries';
    throw new AppError(
      409,
      `Cannot delete customer — ${count} ledger ${entryLabel} on record.`,
    );
  }
}

export async function assertNoSupplierLedgerHistory(
  supplierId: number,
  tx: typeof prisma = prisma,
) {
  const count = await tx.supplierLedger.count({ where: { supplierId } });
  if (count > 0) {
    const entryLabel = count === 1 ? 'entry' : 'entries';
    throw new AppError(
      409,
      `Cannot delete supplier — ${count} ledger ${entryLabel} on record.`,
    );
  }
}
