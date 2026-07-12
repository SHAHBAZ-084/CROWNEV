import type { Prisma } from '@prisma/client';
import { getActiveFinancialYearId } from '../modules/accounting/accounting.service.js';

export async function allocateSaleInvoiceNumber(
  tx: Prisma.TransactionClient,
  branchId: number,
): Promise<string> {
  const financialYearId = await getActiveFinancialYearId(tx, branchId);
  const count = await tx.order.count({
    where: { branchId, type: 'POS', financialYearId },
  });
  return String(count + 1);
}

export async function allocatePurchaseInvoiceNumber(
  tx: Prisma.TransactionClient,
  branchId: number,
): Promise<string> {
  const financialYearId = await getActiveFinancialYearId(tx, branchId);
  const count = await tx.purchase.count({ where: { branchId, financialYearId } });
  return String(count + 1);
}

export async function allocateServiceInvoiceNumber(
  tx: Prisma.TransactionClient,
  branchId: number,
): Promise<string> {
  const financialYearId = await getActiveFinancialYearId(tx, branchId);
  const count = await tx.serviceInvoice.count({ where: { branchId, financialYearId } });
  return String(count + 1);
}

export async function previewNextDocumentNumbers(
  tx: Prisma.TransactionClient,
  branchId: number,
) {
  const [sale, purchase, service] = await Promise.all([
    allocateSaleInvoiceNumber(tx, branchId),
    allocatePurchaseInvoiceNumber(tx, branchId),
    allocateServiceInvoiceNumber(tx, branchId),
  ]);
  return { sale, purchase, service };
}
