import { CustomerLedgerType, CustomerType, VoucherType } from '@prisma/client';
import { prisma } from '../../config/database.js';
import { AppError, getPagination, paginatedResponse } from '../../utils/helpers.js';
import {
  createVoucherInTx,
  ensureCustomerAccount,
  ensureServiceRevenueAccount,
} from '../accounting/accounting.service.js';
import { deductStockForOrder, validateAndPriceItems, validateAndPriceItemsByCode } from '../orders/orders.service.js';
import { allocateServiceInvoiceNumber } from '../../utils/documentNumbers.js';

export async function listServiceInvoices(branchId: number, query: { page?: string; limit?: string }) {
  const { page, limit, skip } = getPagination(query);
  const where = { branchId };

  const [invoices, total] = await Promise.all([
    prisma.serviceInvoice.findMany({
      where,
      skip,
      take: limit,
      include: { customer: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.serviceInvoice.count({ where }),
  ]);

  return paginatedResponse(invoices, total, page, limit);
}

export async function createServiceInvoice(data: {
  branchId: number;
  customerId: number;
  items: { productId?: string; itemId?: number; quantity: number; unitPrice?: number }[];
  labourCost: number;
  reference?: string;
  notes?: string;
  createdById: string;
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

  const itemIdentifiers = data.items.map((i) => i.itemId ? `item-${i.itemId}` : `prod-${i.productId}`);
  if (new Set(itemIdentifiers).size !== itemIdentifiers.length) {
    throw new AppError(400, 'Duplicate item or product selection');
  }

  let pricedItems: {
    itemId?: number;
    productId: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }[] = [];

  if (data.items.length > 0) {
    const codeItems = data.items.filter((i) => i.itemId) as { itemId: number; quantity: number; unitPrice?: number }[];
    const prodItems = data.items.filter((i) => i.productId && !i.itemId) as { productId: string; quantity: number; unitPrice?: number }[];

    if (codeItems.length > 0) {
      const pricedCode = await validateAndPriceItemsByCode(data.branchId, codeItems);
      pricedItems.push(...pricedCode);
    }
    if (prodItems.length > 0) {
      const pricedProd = await validateAndPriceItems(data.branchId, prodItems);
      pricedItems.push(...pricedProd.map((p) => ({
        productId: p.productId,
        quantity: p.quantity,
        unitPrice: p.unitPrice,
        total: p.total,
      })));
    }
  }

  const partsTotal = pricedItems.reduce((sum, i) => sum + i.total, 0);
  const total = partsTotal + labourCost;
  if (total <= 0) {
    throw new AppError(400, 'Invoice total must be greater than zero — add parts or labour cost');
  }

  return prisma.$transaction(async (tx) => {
    const reference =
      data.reference?.trim() || (await allocateServiceInvoiceNumber(tx, data.branchId));

    const invoice = await tx.serviceInvoice.create({
      data: {
        branchId: data.branchId,
        customerId: data.customerId,
        reference,
        labourCost,
        partsTotal,
        total,
        notes: data.notes,
        createdById: data.createdById,
        items: {
          create: pricedItems.map((i) => ({
            productId: i.productId,
            itemId: i.itemId,
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
      await deductStockForOrder(data.branchId, invoice.items as any[], tx);
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
      },
    });

    const customerAccount = await ensureCustomerAccount(tx, data.branchId, customer);
    const revenueAccount = await ensureServiceRevenueAccount(tx, data.branchId);

    const voucher = await createVoucherInTx(tx, {
      branchId: data.branchId,
      type: VoucherType.JOURNAL,
      debitAccountId: customerAccount.id,
      creditAccountId: revenueAccount.id,
      amount: total,
      reference,
      createdById: data.createdById,
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
      items: { include: { product: true, item: { include: { product: { include: { brand: true, category: true } } } } } },
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
    date: invoice.createdAt,
    branch: {
      name: invoice.branch.name,
      location: invoice.branch.location,
      phone: invoice.branch.phone,
      whatsapp: invoice.branch.whatsapp,
    },
    customer: {
      name: invoice.customer.name,
      phone: invoice.customer.phone ?? undefined,
      email: invoice.customer.email ?? undefined,
      address: invoice.customer.address ?? undefined,
    },
    items: invoice.items.map((i) => {
      const name = i.item
        ? `${i.item.product.name} (${i.item.product.brand?.name ?? ''} ${i.item.product.category?.name ?? ''} ${i.item.model ?? ''})`
        : i.product?.name ?? 'Item';
      const type = i.item ? i.item.product.type : i.product?.type ?? 'PART';
      return {
        name,
        type,
        quantity: i.quantity,
        unitPrice: Number(i.unitPrice),
        total: Number(i.total),
      };
    }),
    labourCost: Number(invoice.labourCost),
    partsTotal: Number(invoice.partsTotal),
    subtotal: Number(invoice.partsTotal) + Number(invoice.labourCost),
    total: Number(invoice.total),
    notes: invoice.notes ?? undefined,
  };
}
