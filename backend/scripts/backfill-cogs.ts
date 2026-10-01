/**
 * Historical COGS correcting vouchers (does not edit/delete existing vouchers).
 *
 * Pass A — bikes: Dr Sale Revenue / Cr Inventory per POS sale (chassis purchasePrice).
 * Pass B — parts: replay weighted-average cost per branch/product, then same correction per sale/service.
 *
 * Take a full DB backup before --commit on production (deploy/backup-db.sh).
 *
 * Usage (from backend/):
 *   npx tsx scripts/backfill-cogs.ts                    # dry-run both passes
 *   npx tsx scripts/backfill-cogs.ts --pass a           # dry-run pass A only
 *   npx tsx scripts/backfill-cogs.ts --pass b --commit  # write pass B
 *   npx tsx scripts/backfill-cogs.ts --branch 1         # limit to one branch
 */
import {
  OrderStatus,
  OrderType,
  ProductType,
  Role,
  VoucherStatus,
  VoucherType,
} from '@prisma/client';
import { prisma } from '../src/config/database.js';
import {
  computeLineCost,
  createVoucherInTx,
  ensureInventoryAccount,
  ensureSaleRevenueAccount,
  ensureServiceRevenueAccount,
  isSaleVoucher,
} from '../src/modules/accounting/accounting.service.js';

const BACKFILL_MARKER = 'COGS backfill';
const PASS_A_DESC = `${BACKFILL_MARKER} — pass A (bikes)`;
const PASS_B_DESC = `${BACKFILL_MARKER} — pass B (parts)`;
const BATCH_SIZE = 200;

function roundMoney(n: number) {
  return Math.round(n * 100) / 100;
}

function parseArgs() {
  const commit = process.argv.includes('--commit');
  const branchIdx = process.argv.indexOf('--branch');
  const branchId =
    branchIdx >= 0 && process.argv[branchIdx + 1]
      ? Number.parseInt(process.argv[branchIdx + 1]!, 10)
      : undefined;
  const passIdx = process.argv.indexOf('--pass');
  const passArg = passIdx >= 0 ? process.argv[passIdx + 1]?.toLowerCase() : undefined;
  const passA = !passArg || passArg === 'a' || passArg === 'all';
  const passB = !passArg || passArg === 'b' || passArg === 'all';
  if (branchIdx >= 0 && (!branchId || Number.isNaN(branchId))) {
    throw new Error('Usage: --branch <id> requires a numeric branch id');
  }
  if (passArg && passArg !== 'a' && passArg !== 'b' && passArg !== 'all') {
    throw new Error('Usage: --pass a|b|all');
  }
  return { commit, branchId, passA, passB };
}

async function resolveBackfillUserId(branchId: number): Promise<string> {
  const branchOwner = await prisma.user.findFirst({
    where: { branchId, isActive: true, role: Role.BRANCH_OWNER },
    select: { id: true },
  });
  if (branchOwner) return branchOwner.id;
  const admin = await prisma.user.findFirst({
    where: { isActive: true, role: Role.ADMIN },
    select: { id: true },
  });
  if (admin) return admin.id;
  throw new Error(`No active user found to attribute backfill vouchers (branch ${branchId})`);
}

async function hasBackfillForReference(
  branchId: number,
  reference: string,
  passDescription: string,
): Promise<boolean> {
  const hit = await prisma.voucher.findFirst({
    where: {
      branchId,
      reference,
      status: VoucherStatus.ACTIVE,
      description: passDescription,
    },
    select: { id: true },
  });
  return !!hit;
}

async function saleAlreadyHasCogsLeg(branchId: number, reference: string): Promise<boolean> {
  const vouchers = await prisma.voucher.findMany({
    where: {
      branchId,
      reference,
      status: VoucherStatus.ACTIVE,
      type: { in: [VoucherType.SALE, VoucherType.SERVICE] },
    },
    include: {
      creditAccount: { select: { name: true } },
      debitAccount: { select: { name: true } },
    },
  });
  return vouchers.some((v) => {
    if (v.description?.toLowerCase().includes('cost of goods sold')) return true;
    const creditsInventory = v.creditAccount.name.trim().toLowerCase() === 'inventory';
    const debitsCustomer =
      !v.debitAccount.name.trim().toLowerCase().includes('revenue') &&
      v.debitAccount.name.trim().toLowerCase() !== 'sale revenue' &&
      v.debitAccount.name.trim().toLowerCase() !== 'service revenue';
    return creditsInventory && debitsCustomer;
  });
}

type CorrectionMeta = {
  branchId: number;
  reference: string;
  entryDate: Date;
  financialYearId: number | null;
  revenueAccountKind: 'sale' | 'service';
  amount: number;
};

async function postCorrection(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  meta: CorrectionMeta,
  description: string,
  createdById: string,
) {
  const amount = roundMoney(meta.amount);
  if (amount <= 0) return;

  const inventoryAccount = await ensureInventoryAccount(tx, meta.branchId);
  const revenueAccount =
    meta.revenueAccountKind === 'service'
      ? await ensureServiceRevenueAccount(tx, meta.branchId)
      : await ensureSaleRevenueAccount(tx, meta.branchId);

  await createVoucherInTx(tx, {
    branchId: meta.branchId,
    type: VoucherType.JOURNAL,
    debitAccountId: revenueAccount.id,
    creditAccountId: inventoryAccount.id,
    amount,
    reference: meta.reference,
    description,
    createdById,
    entryDate: meta.entryDate,
    financialYearId: meta.financialYearId ?? undefined,
  });
}

async function runPassA(commit: boolean, branchFilter?: number) {
  console.log('\n=== Pass A (bikes) ===\n');
  const branches = await prisma.branch.findMany({
    where: branchFilter != null ? { id: branchFilter } : undefined,
    select: { id: true, name: true },
    orderBy: { id: 'asc' },
  });

  for (const branch of branches) {
    let branchTotal = 0;
    let branchPosted = 0;
    let branchSkipped = 0;
    const createdById = await resolveBackfillUserId(branch.id);

    let cursor: number | undefined;
    for (;;) {
      const orders = await prisma.order.findMany({
        where: {
          branchId: branch.id,
          type: OrderType.POS,
          status: { not: OrderStatus.CANCELLED },
          saleReference: { not: null },
          ...(cursor != null && { id: { gt: cursor } }),
        },
        include: {
          items: { include: { product: true } },
        },
        orderBy: { id: 'asc' },
        take: BATCH_SIZE,
      });
      if (orders.length === 0) break;
      cursor = orders[orders.length - 1]!.id;

      const toPost: CorrectionMeta[] = [];

      for (const order of orders) {
        const reference = order.saleReference!.trim();
        if (!reference) continue;

        if (await hasBackfillForReference(branch.id, reference, PASS_A_DESC)) {
          branchSkipped++;
          continue;
        }
        if (await saleAlreadyHasCogsLeg(branch.id, reference)) {
          branchSkipped++;
          continue;
        }

        const origVoucher = await prisma.voucher.findFirst({
          where: {
            branchId: branch.id,
            reference,
            status: VoucherStatus.ACTIVE,
            type: { in: [VoucherType.SALE, VoucherType.JOURNAL] },
          },
          include: {
            creditAccount: { select: { name: true } },
            debitAccount: { select: { name: true } },
          },
          orderBy: { id: 'asc' },
        });
        if (!origVoucher || !isSaleVoucher(origVoucher)) {
          branchSkipped++;
          continue;
        }

        let bikeCost = 0;
        for (const item of order.items) {
          if (item.product.type !== ProductType.BIKE) continue;
          bikeCost += await computeLineCost(prisma, branch.id, {
            productId: item.productId,
            quantity: item.quantity,
            chassisNumber: item.chassisNumber,
            productType: ProductType.BIKE,
          });
        }
        bikeCost = Math.min(bikeCost, Number(order.subtotal));
        bikeCost = roundMoney(bikeCost);
        if (bikeCost <= 0) {
          branchSkipped++;
          continue;
        }

        branchTotal += bikeCost;
        toPost.push({
          branchId: branch.id,
          reference,
          entryDate: origVoucher.createdAt,
          financialYearId: origVoucher.financialYearId,
          revenueAccountKind: 'sale',
          amount: bikeCost,
        });

        if (!commit) {
          console.log(
            `[dry-run] branch ${branch.id} order #${order.id} ref=${reference} bike COGS=${bikeCost}`,
          );
        }
      }

      if (commit && toPost.length > 0) {
        await prisma.$transaction(async (tx) => {
          for (const meta of toPost) {
            await postCorrection(tx, meta, PASS_A_DESC, createdById);
            branchPosted++;
          }
        });
      } else if (!commit) {
        branchPosted += toPost.length;
      }
    }

    console.log(
      `Branch ${branch.id} (${branch.name}): pass A ` +
        `${commit ? 'posted' : 'would post'}=${branchPosted}, skipped=${branchSkipped}, ` +
        `total bike COGS=${roundMoney(branchTotal)}`,
    );
  }
}

type TimelineEvent =
  | {
      kind: 'purchase';
      at: Date;
      productId: string;
      quantity: number;
      unitCost: number;
    }
  | {
      kind: 'sale';
      at: Date;
      productId: string;
      quantity: number;
      reference: string;
      revenueAccountKind: 'sale' | 'service';
      financialYearId: number | null;
      capAmount: number;
    };

async function runPassB(commit: boolean, branchFilter?: number) {
  console.log('\n=== Pass B (parts — weighted average replay) ===\n');
  const branches = await prisma.branch.findMany({
    where: branchFilter != null ? { id: branchFilter } : undefined,
    select: { id: true, name: true },
    orderBy: { id: 'asc' },
  });

  for (const branch of branches) {
    const createdById = await resolveBackfillUserId(branch.id);
    const correctionMap = new Map<string, CorrectionMeta>();

    const partProducts = await prisma.product.findMany({
      where: {
        type: ProductType.PART,
        OR: [
          { purchaseItems: { some: { purchase: { branchId: branch.id } } } },
          { orderItems: { some: { order: { branchId: branch.id, type: OrderType.POS } } } },
          { serviceInvoiceItems: { some: { serviceInvoice: { branchId: branch.id } } } },
        ],
      },
      select: { id: true },
    });

    for (const { id: productId } of partProducts) {
      const events: TimelineEvent[] = [];

      const purchaseLines = await prisma.purchaseItem.findMany({
        where: { productId, purchase: { branchId: branch.id } },
        include: { purchase: { select: { invoiceDate: true } } },
      });
      for (const line of purchaseLines) {
        events.push({
          kind: 'purchase',
          at: line.purchase.invoiceDate,
          productId,
          quantity: line.quantity,
          unitCost: Number(line.unitCost),
        });
      }

      const orderLines = await prisma.orderItem.findMany({
        where: {
          productId,
          order: {
            branchId: branch.id,
            type: OrderType.POS,
            status: { not: OrderStatus.CANCELLED },
          },
        },
        include: {
          order: { select: { saleReference: true, invoiceDate: true, subtotal: true, financialYearId: true } },
        },
      });
      for (const line of orderLines) {
        const reference = line.order.saleReference?.trim();
        if (!reference) continue;
        events.push({
          kind: 'sale',
          at: line.order.invoiceDate,
          productId,
          quantity: line.quantity,
          reference,
          revenueAccountKind: 'sale',
          financialYearId: line.order.financialYearId,
          capAmount: Number(line.order.subtotal),
        });
      }

      const serviceLines = await prisma.serviceInvoiceItem.findMany({
        where: { productId, serviceInvoice: { branchId: branch.id } },
        include: {
          serviceInvoice: {
            select: { reference: true, invoiceDate: true, total: true, financialYearId: true },
          },
        },
      });
      for (const line of serviceLines) {
        events.push({
          kind: 'sale',
          at: line.serviceInvoice.invoiceDate,
          productId,
          quantity: line.quantity,
          reference: line.serviceInvoice.reference.trim(),
          revenueAccountKind: 'service',
          financialYearId: line.serviceInvoice.financialYearId,
          capAmount: Number(line.serviceInvoice.total),
        });
      }

      events.sort((a, b) => a.at.getTime() - b.at.getTime() || (a.kind === 'purchase' ? -1 : 1));

      let runStock = 0;
      let runAvg = 0;

      for (const ev of events) {
        if (ev.kind === 'purchase') {
          const newStock = runStock + ev.quantity;
          runAvg =
            newStock > 0
              ? (runStock * runAvg + ev.quantity * ev.unitCost) / newStock
              : ev.unitCost;
          runStock = newStock;
          continue;
        }

        const lineCost = roundMoney(runAvg * ev.quantity);
        runStock = Math.max(0, runStock - ev.quantity);

        if (lineCost <= 0) continue;

        const key = `${ev.revenueAccountKind}:${ev.reference}`;
        const existing = correctionMap.get(key);
        if (existing) {
          existing.amount += lineCost;
        } else {
          correctionMap.set(key, {
            branchId: branch.id,
            reference: ev.reference,
            entryDate: ev.at,
            financialYearId: ev.financialYearId,
            revenueAccountKind: ev.revenueAccountKind,
            amount: lineCost,
          });
        }
      }
    }

    const entries = [...correctionMap.values()];
    for (const meta of entries) {
      if (meta.revenueAccountKind === 'sale') {
        const order = await prisma.order.findFirst({
          where: { branchId: branch.id, saleReference: meta.reference },
          select: { subtotal: true },
        });
        if (order) meta.amount = Math.min(meta.amount, Number(order.subtotal));
      } else {
        const invoice = await prisma.serviceInvoice.findFirst({
          where: { branchId: branch.id, reference: meta.reference },
          select: { total: true },
        });
        if (invoice) meta.amount = Math.min(meta.amount, Number(invoice.total));
      }
      meta.amount = roundMoney(meta.amount);
    }

    let branchPosted = 0;
    let branchSkipped = 0;
    let branchTotal = 0;

    for (let i = 0; i < entries.length; i += BATCH_SIZE) {
      const chunk = entries.slice(i, i + BATCH_SIZE);
      const toPost: CorrectionMeta[] = [];

      for (const meta of chunk) {
        if (await hasBackfillForReference(branch.id, meta.reference, PASS_B_DESC)) {
          branchSkipped++;
          continue;
        }
        if (await saleAlreadyHasCogsLeg(branch.id, meta.reference)) {
          branchSkipped++;
          continue;
        }

        const origVoucher = await prisma.voucher.findFirst({
          where: {
            branchId: branch.id,
            reference: meta.reference,
            status: VoucherStatus.ACTIVE,
          },
          include: {
            creditAccount: { select: { name: true } },
            debitAccount: { select: { name: true } },
          },
          orderBy: { id: 'asc' },
        });
        if (!origVoucher) {
          branchSkipped++;
          continue;
        }

        const amount = roundMoney(meta.amount);
        if (amount <= 0) {
          branchSkipped++;
          continue;
        }

        branchTotal += amount;
        toPost.push({
          ...meta,
          amount,
          entryDate: origVoucher.createdAt,
          financialYearId: origVoucher.financialYearId ?? meta.financialYearId,
        });

        if (!commit) {
          console.log(
            `[dry-run] branch ${branch.id} ref=${meta.reference} (${meta.revenueAccountKind}) parts COGS=${amount}`,
          );
        }
      }

      if (commit && toPost.length > 0) {
        await prisma.$transaction(async (tx) => {
          for (const meta of toPost) {
            await postCorrection(tx, meta, PASS_B_DESC, createdById);
            branchPosted++;
          }
        });
      } else if (!commit) {
        branchPosted += toPost.length;
      }
    }

    console.log(
      `Branch ${branch.id} (${branch.name}): pass B ` +
        `${commit ? 'posted' : 'would post'}=${branchPosted}, skipped=${branchSkipped}, ` +
        `total parts COGS=${roundMoney(branchTotal)}`,
    );
  }
}

async function main() {
  const { commit, branchId, passA, passB } = parseArgs();
  console.log(commit ? 'Mode: --commit (writes enabled)\n' : 'Mode: dry-run (no writes)\n');
  if (branchId != null) console.log(`Branch filter: ${branchId}\n`);

  if (passA) await runPassA(commit, branchId);
  if (passB) await runPassB(commit, branchId);

  console.log('\nDone.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
