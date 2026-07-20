import { prisma } from '../config/database.js';
import { AppError } from './helpers.js';

export async function assertNoCustomerLedgerHistory(
  customerId: number,
  tx: typeof prisma = prisma,
) {
  const count = await tx.customerLedger.count({ where: { customerId } });
  if (count > 0) {
    throw new AppError(409, 'Customer has transaction history and cannot be deleted');
  }
}

export async function assertNoSupplierLedgerHistory(
  supplierId: number,
  tx: typeof prisma = prisma,
) {
  const count = await tx.supplierLedger.count({ where: { supplierId } });
  if (count > 0) {
    throw new AppError(409, 'Supplier has transaction history and cannot be deleted');
  }
}
