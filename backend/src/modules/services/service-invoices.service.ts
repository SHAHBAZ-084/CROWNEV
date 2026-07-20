import { CustomerLedgerType, CustomerType, Prisma, ProductType, VoucherType } from '@prisma/client';
import { prisma } from '../../config/database.js';
import { AppError, getPagination, paginatedResponse } from '../../utils/helpers.js';
import {
  createVoucherInTx,
  ensureCustomerAccount,
  ensureServiceRevenueAccount,
  cancelActiveVouchersByReferenceInTx,
  getActiveFinancialYearId,
  assertActiveFinancialYear,
} from '../accounting/accounting.service.js';
import { deductStockForOrder, validateAndPriceItems } from '../orders/orders.service.js';
import { allocateServiceInvoiceNumber } from '../../utils/documentNumbers.js';
import { parseOptionalInvoiceDate } from '../../utils/invoiceDate.js';
import { formatCustomerNameWithFather } from '../../utils/customerName.js';

export async function listServiceInvoices(branchId: number, query: { page?: string; limit?: string }) {
  const { page, limit, skip } = getPagination(query);
  let financialYearId: number | undefined;
  try {
    financialYearId = await getActiveFinancialYearId(prisma, branchId);
  } catch {
    financialYearId = undefined;
  }
  const where = {
    branchId,
    ...(financialYearId != null && { financialYearId }),
  };

  const [invoices, total] = await Promise.all([
    prisma.serviceInvoice.findMany({
      where,
      skip,
      take: limit,
      include: { customer: { select: { name: true } } },
      orderBy: { invoiceDate: 'desc' },
    }),
    prisma.serviceInvoice.count({ where }),
  ]);

  return paginatedResponse(invoices, total, page, limit);
}

export async function createServiceInvoice(data: {
  branchId: number;
  customerId: number;
  items: { productId: string; quantity: number; unitPrice?: number }[];
  labourCost: number;
  reference?: string;
  notes?: string;
  createdById: string;
  invoiceDate?: string;
}) {
  const customer = await prisma.customer.findFirst({
    where: {
      id: data.customerId,
      branchId: data.branchId,
      type: CustomerType.WALK_IN,
      isActive: true,
    },
  });
  if (!customer) throw new AppError(404, 'Walk-in customer not found');

  const labourCost = Number(data.labourCost);
  if (!Number.isFinite(labourCost) || labourCost < 0) {
    throw new AppError(400, 'Labour cost must be zero or greater');
  }

  const productIds = data.items.map((i) => i.productId);
  if (new Set(productIds).size !== productIds.length) {
    throw new AppError(400, 'Product is already selected');
  }

  let pricedItems: Awaited<ReturnType<typeof validateAndPriceItems>> = [];
  if (data.items.length > 0) {
    pricedItems = await validateAndPriceItems(data.branchId, data.items);
  }

  const partsTotal = pricedItems.reduce((sum, i) => sum + i.total, 0);
  const total = partsTotal + labourCost;
  if (total <= 0) {
    throw new AppError(400, 'Invoice total must be greater than zero — add parts or labour cost');
  }

  return prisma.$transaction(async (tx) => {
    const reference =
      data.reference?.trim() || (await allocateServiceInvoiceNumber(tx, data.branchId));
    const financialYearId = await getActiveFinancialYearId(tx, data.branchId);
    const invoiceDate = parseOptionalInvoiceDate(data.invoiceDate);

    const invoice = await tx.serviceInvoice.create({
      data: {
        branchId: data.branchId,
        financialYearId,
        customerId: data.customerId,
        reference,
        labourCost,
        partsTotal,
        total,
        notes: data.notes,
        createdById: data.createdById,
        invoiceDate,
        items: {
          create: pricedItems.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            total: i.total,
          })),
        },
      },
      include: {
        items: { include: { product: { include: { bikePartDetails: true } } } },
        customer: true,
        branch: true,
      },
    });

    if (invoice.items.length > 0) {
      await deductStockForOrder(data.branchId, invoice.items, tx);
    }

    const newBalance = Number(customer.balance) + total;
    await tx.customer.update({
      where: { id: data.customerId },
      data: { balance: newBalance },
    });
    await tx.customerLedger.create({
      data: {
        customerId: data.customerId,
        serviceInvoiceId: invoice.id,
        type: CustomerLedgerType.DEBIT,
        amount: total,
        balance: newBalance,
        notes: `From service revenue to ${customer.name}`,
        createdAt: invoiceDate,
      },
    });

    const customerAccount = await ensureCustomerAccount(tx, data.branchId, customer);
    const revenueAccount = await ensureServiceRevenueAccount(tx, data.branchId);

    const voucher = await createVoucherInTx(tx, {
      branchId: data.branchId,
      type: VoucherType.SERVICE,
      debitAccountId: customerAccount.id,
      creditAccountId: revenueAccount.id,
      amount: total,
      reference,
      createdById: data.createdById,
      entryDate: invoiceDate,
    });

    return { invoice, voucher };
  });
}

export async function getServiceInvoice(id: number, branchId?: number) {
  const invoice = await prisma.serviceInvoice.findFirst({
    where: { id, ...(branchId && { branchId }) },
    include: {
      branch: true,
      customer: true,
      items: { include: { product: true } },
    },
  });
  if (!invoice) throw new AppError(404, 'Service invoice not found');
  return invoice;
}

export async function getServiceInvoiceFormatted(id: number, branchId?: number) {
  const invoice = await getServiceInvoice(id, branchId);
  const reference = invoice.reference.trim();

  return {
    invoiceType: 'SERVICE' as const,
    invoiceAvailable: true,
    currency: 'PKR' as const,
    invoiceNumber: reference,
    reference,
    date: invoice.invoiceDate,
    branch: {
      name: invoice.branch.name,
      location: invoice.branch.location,
      phone: invoice.branch.phone,
      whatsapp: invoice.branch.whatsapp,
    },
    customer: {
      name: formatCustomerNameWithFather(invoice.customer.name, invoice.customer.fatherName),
      phone: invoice.customer.phone ?? undefined,
      email: invoice.customer.email ?? undefined,
      address: invoice.customer.address ?? undefined,
    },
    items: invoice.items.map((i) => ({
      name: i.product.name,
      type: i.product.type,
      quantity: i.quantity,
      unitPrice: Number(i.unitPrice),
      total: Number(i.total),
    })),
    labourCost: Number(invoice.labourCost),
    partsTotal: Number(invoice.partsTotal),
    subtotal: Number(invoice.partsTotal) + Number(invoice.labourCost),
    total: Number(invoice.total),
    notes: invoice.notes ?? undefined,
  };
}

async function removeCustomerLedgerForServiceInvoiceInTx(
  tx: Prisma.TransactionClient,
  serviceInvoiceId: number,
  customerId: number,
) {
  const entries = await tx.customerLedger.findMany({
    where: { serviceInvoiceId },
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
  await tx.customerLedger.deleteMany({ where: { serviceInvoiceId } });

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

export async function deleteServiceInvoice(
  id: number,
  branchId: number | undefined,
  userId: string,
) {
  const invoice = await prisma.serviceInvoice.findFirst({
    where: { id, ...(branchId != null ? { branchId } : {}) },
    include: {
      items: { include: { product: true } },
      customer: true,
    },
  });
  if (!invoice) throw new AppError(404, 'Service invoice not found');
  await assertActiveFinancialYear(prisma, invoice.branchId, invoice.financialYearId);

  const reference = invoice.reference.trim();

  await prisma.$transaction(async (tx) => {
    for (const item of invoice.items) {
      if (item.product.type === ProductType.BIKE || item.product.type === ProductType.PART) {
        await tx.branchProduct.updateMany({
          where: { branchId: invoice.branchId, productId: item.productId },
          data: { stock: { increment: item.quantity } },
        });
      }
    }

    await cancelActiveVouchersByReferenceInTx(tx, invoice.branchId, reference, userId);
    await removeCustomerLedgerForServiceInvoiceInTx(tx, invoice.id, invoice.customerId);
    await tx.serviceInvoice.delete({ where: { id: invoice.id } });
  });
}
