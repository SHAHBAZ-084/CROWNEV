import { AccountType, LedgerEntryType, Prisma, VoucherStatus, VoucherType } from '@prisma/client';
import { prisma } from '../../config/database.js';
import { AppError } from '../../utils/helpers.js';

function isBankOrCashCategory(name: string) {
  const n = name.trim().toLowerCase();
  return n.includes('bank') || n.includes('cash');
}

async function loadBranchAccounts(
  tx: Prisma.TransactionClient,
  branchId: number,
  debitAccountId: number,
  creditAccountId: number,
) {
  if (debitAccountId === creditAccountId) {
    throw new AppError(400, 'Debit and credit accounts must be different');
  }

  const [debitAccount, creditAccount] = await Promise.all([
    tx.account.findFirst({
      where: { id: debitAccountId, branchId, isActive: true },
      include: { category: true },
    }),
    tx.account.findFirst({
      where: { id: creditAccountId, branchId, isActive: true },
      include: { category: true },
    }),
  ]);

  if (!debitAccount || !creditAccount) {
    throw new AppError(400, 'One or both accounts are invalid for this branch');
  }

  return { debitAccount, creditAccount };
}

function assertVoucherAccountRules(
  type: VoucherType,
  debitAccount: { category: { name: string } },
  creditAccount: { category: { name: string } },
) {
  if (type === 'RECEIPT' && !isBankOrCashCategory(debitAccount.category.name)) {
    throw new AppError(400, 'Receipt must debit a Bank or Cash account (To side)');
  }
  if (type === 'PAYMENT' && !isBankOrCashCategory(creditAccount.category.name)) {
    throw new AppError(400, 'Payment must credit a Bank or Cash account (From side)');
  }
}

export const CUSTOMERS_CATEGORY_NAME = 'Customers';

export function isCustomersCategoryName(name: string) {
  return name.trim().toLowerCase() === CUSTOMERS_CATEGORY_NAME.toLowerCase();
}

export async function ensureCustomersCategory(branchId: number) {
  const existing = await prisma.accountCategory.findFirst({
    where: { branchId, isActive: true, name: { equals: CUSTOMERS_CATEGORY_NAME, mode: 'insensitive' } },
  });
  if (existing) return existing;
  return prisma.accountCategory.create({ data: { branchId, name: CUSTOMERS_CATEGORY_NAME } });
}

export const SUPPLIERS_CATEGORY_NAME = 'Suppliers';

export const INCOME_CATEGORY_NAME = 'Income';
export const SALE_REVENUE_ACCOUNT_NAME = 'Sale Revenue';
export const SERVICE_REVENUE_ACCOUNT_NAME = 'Service Revenue';
export const INVENTORY_CATEGORY_NAME = 'Inventory';
export const INVENTORY_ACCOUNT_NAME = 'Inventory';
export const CASH_IN_HAND_ACCOUNT_NAME = 'Cash in Hand';

export const BRANCH_DEFAULT_CATEGORY_NAMES = [
  'Assets',
  'Cash',
  'Bank',
  CUSTOMERS_CATEGORY_NAME,
  SUPPLIERS_CATEGORY_NAME,
  INVENTORY_CATEGORY_NAME,
  INCOME_CATEGORY_NAME,
  'Expenses',
  'Capital',
] as const;

export function isSuppliersCategoryName(name: string) {
  return name.trim().toLowerCase() === SUPPLIERS_CATEGORY_NAME.toLowerCase();
}

export function isInventoryCategoryName(name: string) {
  return name.trim().toLowerCase() === INVENTORY_CATEGORY_NAME.toLowerCase();
}

export function isSystemAccountCategoryName(name: string) {
  return (
    isCustomersCategoryName(name)
    || isSuppliersCategoryName(name)
    || isInventoryCategoryName(name)
  );
}

export async function ensureSuppliersCategory(branchId: number) {
  const existing = await prisma.accountCategory.findFirst({
    where: { branchId, isActive: true, name: { equals: SUPPLIERS_CATEGORY_NAME, mode: 'insensitive' } },
  });
  if (existing) return existing;
  return prisma.accountCategory.create({ data: { branchId, name: SUPPLIERS_CATEGORY_NAME } });
}

export async function ensureInventoryCategory(branchId: number) {
  const existing = await prisma.accountCategory.findFirst({
    where: { branchId, isActive: true, name: { equals: INVENTORY_CATEGORY_NAME, mode: 'insensitive' } },
  });
  if (existing) return existing;
  return prisma.accountCategory.create({ data: { branchId, name: INVENTORY_CATEGORY_NAME } });
}

export async function listAccountCategories(branchId: number) {
  await bootstrapBranchChartOfAccounts(branchId);

  const [categories, customerCount, supplierCount, inventoryAccounts] = await Promise.all([
    prisma.accountCategory.findMany({
      where: { branchId, isActive: true },
      include: { accounts: { where: { isActive: true }, include: { ledger: true } } },
      orderBy: { name: 'asc' },
    }),
    prisma.customer.count({ where: { branchId, isActive: true } }),
    prisma.supplier.count({ where: { branchId, isActive: true } }),
    prisma.account.count({
      where: {
        branchId,
        isActive: true,
        name: { equals: INVENTORY_ACCOUNT_NAME, mode: 'insensitive' },
      },
    }),
  ]);

  return categories.map((category) => {
    const isCustomers = isCustomersCategoryName(category.name);
    const isSuppliers = isSuppliersCategoryName(category.name);
    const isInventory = isInventoryCategoryName(category.name);
    return {
      ...category,
      isCustomersCategory: isCustomers,
      isSuppliersCategory: isSuppliers,
      isInventoryCategory: isInventory,
      entryCount: isCustomers
        ? customerCount
        : isSuppliers
          ? supplierCount
          : isInventory
            ? inventoryAccounts
            : category.accounts.length,
    };
  });
}

export async function createAccountCategory(branchId: number, name: string) {
  const trimmedName = await assertUniqueCategoryName(branchId, name);
  return prisma.accountCategory.create({ data: { branchId, name: trimmedName } });
}

export async function softDeleteAccountCategory(id: number, branchId: number) {
  const category = await prisma.accountCategory.findFirst({
    where: { id, branchId, isActive: true },
    include: { accounts: { where: { isActive: true } } },
  });
  if (!category) throw new AppError(404, 'Category not found');

  if (isSystemAccountCategoryName(category.name)) {
    throw new AppError(400, `The ${category.name} category cannot be deleted`);
  }

  if (category.accounts.length > 0) {
    throw new AppError(
      400,
      `Category "${category.name}" has ${category.accounts.length} active account(s) and cannot be deleted`,
    );
  }

  return prisma.accountCategory.update({
    where: { id },
    data: { isActive: false },
  });
}

async function generateNextAccountCode(branchId: number): Promise<string> {
  const accounts = await prisma.account.findMany({
    where: { branchId },
    select: { code: true },
  });

  let max = 1000;
  for (const { code } of accounts) {
    const num = parseInt(code, 10);
    if (!Number.isNaN(num) && num > max) max = num;
  }
  return String(max + 1);
}

async function resolveAccountType(
  branchId: number,
  categoryId: number,
  explicit?: AccountType,
): Promise<AccountType> {
  if (explicit) return explicit;

  const sibling = await prisma.account.findFirst({
    where: { branchId, categoryId, isActive: true },
    select: { type: true },
  });
  return sibling?.type ?? AccountType.ASSET;
}

async function generateNextAccountCodeInTx(
  tx: Prisma.TransactionClient,
  branchId: number,
): Promise<string> {
  const accounts = await tx.account.findMany({ where: { branchId }, select: { code: true } });
  let max = 1000;
  for (const { code } of accounts) {
    const num = parseInt(code, 10);
    if (!Number.isNaN(num) && num > max) max = num;
  }
  return String(max + 1);
}

async function findOrCreateOpeningBalanceEquityAccount(
  tx: Prisma.TransactionClient,
  branchId: number,
) {
  const existing = await tx.account.findFirst({
    where: {
      branchId,
      isActive: true,
      type: AccountType.EQUITY,
      name: { equals: 'Opening Balance Equity', mode: 'insensitive' },
    },
    include: { ledger: true },
  });
  if (existing?.ledger) return existing;

  let category = await tx.accountCategory.findFirst({
    where: {
      branchId,
      isActive: true,
      name: { equals: 'Capital', mode: 'insensitive' },
    },
  });
  if (!category) {
    category = await tx.accountCategory.create({
      data: { branchId, name: 'Capital' },
    });
  }

  const account = await tx.account.create({
    data: {
      branchId,
      categoryId: category.id,
      name: 'Opening Balance Equity',
      code: await generateNextAccountCodeInTx(tx, branchId),
      type: AccountType.EQUITY,
    },
  });

  const ledger = await tx.ledger.create({
    data: { branchId, accountId: account.id, balance: 0 },
  });

  return tx.account.findUniqueOrThrow({
    where: { id: account.id },
    include: { ledger: true },
  });
}

async function postOpeningBalanceOffset(
  tx: Prisma.TransactionClient,
  branchId: number,
  accountName: string,
  amount: number,
  side: 'DR' | 'CR',
) {
  const equityAccount = await findOrCreateOpeningBalanceEquityAccount(tx, branchId);
  const equityLedger = equityAccount.ledger!;
  const offsetType = side === 'DR' ? LedgerEntryType.CREDIT : LedgerEntryType.DEBIT;
  const offsetBalance = Number(equityLedger.balance) + (side === 'DR' ? -amount : amount);

  await tx.ledgerEntry.create({
    data: {
      ledgerId: equityLedger.id,
      type: offsetType,
      amount,
      balance: offsetBalance,
      notes: `Opening Balance — offset for ${accountName}`,
      isOpeningBalance: true,
    },
  });
  await tx.ledger.update({
    where: { id: equityLedger.id },
    data: { balance: offsetBalance },
  });
}

export async function createAccount(data: {
  branchId: number;
  categoryId: number;
  name: string;
  code?: string;
  type?: AccountType;
  openingBalance?: number;
  openingBalanceSide?: 'DR' | 'CR';
}) {
  const trimmedName = await assertUniqueAccountName(data.branchId, data.name);

  if (isInventoryAccountName(trimmedName)) {
    throw new AppError(
      400,
      'The Inventory account is managed automatically under the Inventory category',
    );
  }

  const category = await prisma.accountCategory.findFirst({
    where: { id: data.categoryId, branchId: data.branchId, isActive: true },
  });
  if (!category) throw new AppError(400, 'Invalid category for this branch');

  const type = await resolveAccountType(data.branchId, data.categoryId, data.type);
  const trimmedCode = data.code
    ? await assertUniqueAccountCode(data.branchId, data.code)
    : await generateNextAccountCode(data.branchId);

  const amount = Math.abs(data.openingBalance ?? 0);
  const side = data.openingBalanceSide ?? defaultOpeningSide(type);
  const signedBalance = amount === 0 ? 0 : side === 'DR' ? amount : -amount;

  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const account = await tx.account.create({
      data: {
        branchId: data.branchId,
        categoryId: data.categoryId,
        name: trimmedName,
        code: trimmedCode,
        type,
      },
    });

    const ledger = await tx.ledger.create({
      data: { branchId: data.branchId, accountId: account.id, balance: signedBalance },
    });

    if (amount > 0 && trimmedName.toLowerCase() !== 'opening balance equity') {
      await tx.ledgerEntry.create({
        data: {
          ledgerId: ledger.id,
          type: side === 'DR' ? LedgerEntryType.DEBIT : LedgerEntryType.CREDIT,
          amount,
          balance: signedBalance,
          notes: 'Opening Balance',
          isOpeningBalance: true,
        },
      });
      await postOpeningBalanceOffset(tx, data.branchId, trimmedName, amount, side);
    }

    return tx.account.findUniqueOrThrow({
      where: { id: account.id },
      include: { category: true, ledger: true },
    });
  });
}

function defaultOpeningSide(type: AccountType): 'DR' | 'CR' {
  return type === 'ASSET' || type === 'EXPENSE' ? 'DR' : 'CR';
}

function normalizeLabel(value: string) {
  return value.trim();
}

async function assertUniqueCategoryName(branchId: number, name: string) {
  const trimmed = normalizeLabel(name);
  if (!trimmed) throw new AppError(400, 'Category name is required');

  const existing = await prisma.accountCategory.findFirst({
    where: { branchId, isActive: true, name: { equals: trimmed, mode: 'insensitive' } },
  });
  if (existing) {
    throw new AppError(400, `Category "${existing.name}" already exists`);
  }
  return trimmed;
}

async function assertUniqueAccountName(branchId: number, name: string) {
  const trimmed = normalizeLabel(name);
  if (!trimmed) throw new AppError(400, 'Account name is required');

  const existing = await prisma.account.findFirst({
    where: { branchId, name: { equals: trimmed, mode: 'insensitive' } },
  });
  if (existing) {
    throw new AppError(400, `Account "${existing.name}" already exists`);
  }
  return trimmed;
}

async function assertUniqueAccountCode(branchId: number, code: string) {
  const trimmed = normalizeLabel(code);
  if (!trimmed) throw new AppError(400, 'Account code is required');

  const existing = await prisma.account.findFirst({
    where: { branchId, code: { equals: trimmed, mode: 'insensitive' } },
  });
  if (existing) {
    throw new AppError(400, `Account code "${existing.code}" already exists`);
  }
  return trimmed;
}

function isSaleRevenueAccountName(name?: string | null) {
  return name?.trim().toLowerCase() === SALE_REVENUE_ACCOUNT_NAME.toLowerCase();
}

function isInventoryAccountName(name?: string | null) {
  return name?.trim().toLowerCase() === INVENTORY_ACCOUNT_NAME.toLowerCase();
}

function isSaleVoucher(voucher: {
  type?: VoucherType | null;
  creditAccount?: { name: string } | null;
  debitAccount?: { name: string } | null;
} | null) {
  if (!voucher || voucher.type !== VoucherType.JOURNAL) return false;
  return isSaleRevenueAccountName(voucher.creditAccount?.name) && !!voucher.debitAccount?.name;
}

function isPurchaseVoucher(voucher: {
  type?: VoucherType | null;
  creditAccount?: { name: string } | null;
  debitAccount?: { name: string } | null;
} | null) {
  if (!voucher || voucher.type !== VoucherType.JOURNAL) return false;
  return (
    isInventoryAccountName(voucher.debitAccount?.name)
    && !!voucher.creditAccount?.name
    && !isSaleRevenueAccountName(voucher.creditAccount?.name)
  );
}

function voucherTypeLabel(
  voucher: {
    type?: VoucherType | null;
    creditAccount?: { name: string } | null;
    debitAccount?: { name: string } | null;
  } | null,
  isReversal: boolean,
) {
  if (isSaleVoucher(voucher)) {
    return isReversal ? 'Sale (Reversal)' : 'Sale';
  }
  if (isPurchaseVoucher(voucher)) {
    return isReversal ? 'Purchase (Reversal)' : 'Purchase';
  }
  const type = voucher?.type;
  if (!type) return isReversal ? 'Journal (Reversal)' : 'Journal';
  const base =
    type === 'PAYMENT' ? 'Payment'
      : type === 'RECEIPT' ? 'Receipt'
        : 'Journal';
  return isReversal ? `${base} (Reversal)` : base;
}

function voucherDisplayNo(_type: VoucherType | null | undefined, number: number | null | undefined) {
  if (!number) return '0';
  return String(number);
}

function buildLedgerEntryDescription(
  e: { isOpeningBalance: boolean; notes?: string | null },
  voucher: {
    type?: VoucherType | null;
    description?: string | null;
    creditAccount?: { name: string } | null;
    debitAccount?: { name: string } | null;
  } | null,
): string {
  if (e.isOpeningBalance) return 'Opening Balance';
  if (!voucher?.creditAccount || !voucher?.debitAccount) {
    return e.notes?.trim() || voucher?.description?.trim() || '';
  }

  if (isSaleVoucher(voucher)) {
    return `From sale revenue to ${voucher.debitAccount.name}`;
  }

  if (isPurchaseVoucher(voucher)) {
    return `From ${voucher.creditAccount.name} to inventory`;
  }

  const auto = `From ${voucher.creditAccount.name} to ${voucher.debitAccount.name}`;
  const custom = voucher.description?.trim();
  return custom ? `${auto} — ${custom}` : auto;
}

async function nextVoucherNumber(
  tx: Prisma.TransactionClient,
  branchId: number,
  type: VoucherType,
): Promise<number> {
  const { _max } = await tx.voucher.aggregate({
    where: { branchId, type },
    _max: { number: true },
  });
  return (_max.number ?? 0) + 1;
}

function parseDateStart(value: string) {
  const d = new Date(value);
  d.setHours(0, 0, 0, 0);
  return d;
}

function parseDateEnd(value: string) {
  const d = new Date(value);
  d.setHours(23, 59, 59, 999);
  return d;
}

function entryDebitCredit(type: LedgerEntryType, amount: number) {
  if (type === LedgerEntryType.DEBIT) return { debit: amount, credit: 0 };
  return { debit: 0, credit: amount };
}

/** Reversal rows and cancelled vouchers are bookkeeping only — omit from reports. */
function isReportableLedgerEntry(e: {
  isReversal: boolean;
  voucher: { status: VoucherStatus } | null;
}) {
  if (e.isReversal) return false;
  if (e.voucher?.status === VoucherStatus.CANCELLED) return false;
  return true;
}

function reportBalanceFromEntries(
  entries: { type: LedgerEntryType; amount: number | Prisma.Decimal; isReversal: boolean; voucher: { status: VoucherStatus } | null }[],
) {
  return entries
    .filter(isReportableLedgerEntry)
    .reduce((sum, e) => {
      const { debit, credit } = entryDebitCredit(e.type, Number(e.amount));
      return sum + debit - credit;
    }, 0);
}

export async function listAccounts(branchId: number) {
  await prisma.$transaction(async (tx) => {
    await consolidateDuplicateInventoryAccounts(tx, branchId);
    await syncCustomerSupplierAccountsInTx(tx, branchId);
  });

  const accounts = await prisma.account.findMany({
    where: { branchId, isActive: true },
    include: { category: true, ledger: true },
    orderBy: { code: 'asc' },
  });

  return accounts.map(({ ledger, ...account }) => ({
    ...account,
    ledger: ledger
      ? { ...ledger, balance: Number(ledger.balance) }
      : null,
  }));
}

async function ensureCustomersCategoryInTx(tx: Prisma.TransactionClient, branchId: number) {
  const existing = await tx.accountCategory.findFirst({
    where: { branchId, isActive: true, name: { equals: CUSTOMERS_CATEGORY_NAME, mode: 'insensitive' } },
  });
  if (existing) return existing;
  return tx.accountCategory.create({ data: { branchId, name: CUSTOMERS_CATEGORY_NAME } });
}

export async function ensureSaleRevenueAccount(tx: Prisma.TransactionClient, branchId: number) {
  let category = await tx.accountCategory.findFirst({
    where: { branchId, isActive: true, name: { equals: INCOME_CATEGORY_NAME, mode: 'insensitive' } },
  });
  if (!category) {
    category = await tx.accountCategory.create({ data: { branchId, name: INCOME_CATEGORY_NAME } });
  }

  const existing = await tx.account.findFirst({
    where: {
      branchId,
      isActive: true,
      categoryId: category.id,
      name: { equals: SALE_REVENUE_ACCOUNT_NAME, mode: 'insensitive' },
    },
    include: { ledger: true },
  });
  if (existing?.ledger) return existing;

  const account = await tx.account.create({
    data: {
      branchId,
      categoryId: category.id,
      name: SALE_REVENUE_ACCOUNT_NAME,
      code: await generateNextAccountCodeInTx(tx, branchId),
      type: AccountType.REVENUE,
    },
  });
  await tx.ledger.create({ data: { branchId, accountId: account.id, balance: 0 } });
  return tx.account.findUniqueOrThrow({ where: { id: account.id }, include: { ledger: true } });
}

export async function ensureServiceRevenueAccount(tx: Prisma.TransactionClient, branchId: number) {
  let category = await tx.accountCategory.findFirst({
    where: { branchId, isActive: true, name: { equals: INCOME_CATEGORY_NAME, mode: 'insensitive' } },
  });
  if (!category) {
    category = await tx.accountCategory.create({ data: { branchId, name: INCOME_CATEGORY_NAME } });
  }

  const existing = await tx.account.findFirst({
    where: {
      branchId,
      isActive: true,
      categoryId: category.id,
      name: { equals: SERVICE_REVENUE_ACCOUNT_NAME, mode: 'insensitive' },
    },
    include: { ledger: true },
  });
  if (existing?.ledger) return existing;

  const account = await tx.account.create({
    data: {
      branchId,
      categoryId: category.id,
      name: SERVICE_REVENUE_ACCOUNT_NAME,
      code: await generateNextAccountCodeInTx(tx, branchId),
      type: AccountType.REVENUE,
    },
  });
  await tx.ledger.create({ data: { branchId, accountId: account.id, balance: 0 } });
  return tx.account.findUniqueOrThrow({ where: { id: account.id }, include: { ledger: true } });
}

export async function ensureCustomerAccount(
  tx: Prisma.TransactionClient,
  branchId: number,
  customer: { id: number; name: string },
) {
  const category = await ensureCustomersCategoryInTx(tx, branchId);
  const code = `C${String(customer.id).padStart(4, '0')}`;

  const existing = await tx.account.findFirst({
    where: { branchId, isActive: true, code },
    include: { ledger: true },
  });
  if (existing) {
    if (!existing.ledger) {
      await tx.ledger.create({ data: { branchId, accountId: existing.id, balance: 0 } });
    }
    if (existing.name !== customer.name) {
      await tx.account.update({ where: { id: existing.id }, data: { name: customer.name } });
    }
    return tx.account.findUniqueOrThrow({ where: { id: existing.id }, include: { ledger: true } });
  }

  const account = await tx.account.create({
    data: {
      branchId,
      categoryId: category.id,
      name: customer.name,
      code,
      type: AccountType.ASSET,
    },
  });
  await tx.ledger.create({ data: { branchId, accountId: account.id, balance: 0 } });
  return tx.account.findUniqueOrThrow({ where: { id: account.id }, include: { ledger: true } });
}

async function ensureSuppliersCategoryInTx(tx: Prisma.TransactionClient, branchId: number) {
  const existing = await tx.accountCategory.findFirst({
    where: { branchId, isActive: true, name: { equals: SUPPLIERS_CATEGORY_NAME, mode: 'insensitive' } },
  });
  if (existing) return existing;
  return tx.accountCategory.create({ data: { branchId, name: SUPPLIERS_CATEGORY_NAME } });
}

export async function ensureSupplierAccount(
  tx: Prisma.TransactionClient,
  branchId: number,
  supplier: { id: number; name: string },
) {
  const category = await ensureSuppliersCategoryInTx(tx, branchId);
  const code = `S${String(supplier.id).padStart(4, '0')}`;

  const existing = await tx.account.findFirst({
    where: { branchId, isActive: true, code },
    include: { ledger: true },
  });
  if (existing) {
    if (!existing.ledger) {
      await tx.ledger.create({ data: { branchId, accountId: existing.id, balance: 0 } });
    }
    if (existing.name !== supplier.name) {
      await tx.account.update({ where: { id: existing.id }, data: { name: supplier.name } });
    }
    return tx.account.findUniqueOrThrow({ where: { id: existing.id }, include: { ledger: true } });
  }

  const account = await tx.account.create({
    data: {
      branchId,
      categoryId: category.id,
      name: supplier.name,
      code,
      type: AccountType.LIABILITY,
    },
  });
  await tx.ledger.create({ data: { branchId, accountId: account.id, balance: 0 } });
  return tx.account.findUniqueOrThrow({ where: { id: account.id }, include: { ledger: true } });
}

async function syncCustomerSupplierAccountsInTx(tx: Prisma.TransactionClient, branchId: number) {
  const [customers, suppliers] = await Promise.all([
    tx.customer.findMany({
      where: { branchId, isActive: true },
      select: { id: true, name: true },
    }),
    tx.supplier.findMany({
      where: { branchId, isActive: true },
      select: { id: true, name: true },
    }),
  ]);

  for (const customer of customers) {
    await ensureCustomerAccount(tx, branchId, customer);
  }
  for (const supplier of suppliers) {
    await ensureSupplierAccount(tx, branchId, supplier);
  }
}

export async function syncCustomerSupplierAccounts(branchId: number) {
  await prisma.$transaction(async (tx) => {
    await syncCustomerSupplierAccountsInTx(tx, branchId);
  });
}

export async function ensureInventoryAccount(tx: Prisma.TransactionClient, branchId: number) {
  const category = await ensureInventoryCategoryInTx(tx, branchId);

  const allNamed = await tx.account.findMany({
    where: {
      branchId,
      isActive: true,
      name: { equals: INVENTORY_ACCOUNT_NAME, mode: 'insensitive' },
    },
    include: { ledger: true },
    orderBy: { id: 'asc' },
  });

  let canonical =
    allNamed.find((a) => a.categoryId === category.id && a.ledger) ??
    allNamed.find((a) => a.categoryId === category.id) ??
    allNamed.find((a) => a.ledger) ??
    allNamed[0] ??
    null;

  if (canonical && canonical.categoryId !== category.id) {
    canonical = await tx.account.update({
      where: { id: canonical.id },
      data: { categoryId: category.id, type: AccountType.ASSET },
      include: { ledger: true },
    });
  }

  if (canonical && !canonical.ledger) {
    await tx.ledger.create({ data: { branchId, accountId: canonical.id, balance: 0 } });
    canonical = await tx.account.findUniqueOrThrow({
      where: { id: canonical.id },
      include: { ledger: true },
    });
  }

  if (!canonical) {
    const account = await tx.account.create({
      data: {
        branchId,
        categoryId: category.id,
        name: INVENTORY_ACCOUNT_NAME,
        code: await generateNextAccountCodeInTx(tx, branchId),
        type: AccountType.ASSET,
      },
    });
    await tx.ledger.create({ data: { branchId, accountId: account.id, balance: 0 } });
    return tx.account.findUniqueOrThrow({ where: { id: account.id }, include: { ledger: true } });
  }

  return canonical;
}

async function mergeInventoryAccountIntoCanonical(
  tx: Prisma.TransactionClient,
  canonical: { id: number; ledger: { id: number } | null },
  duplicate: { id: number; ledger: { id: number; balance: unknown } | null },
) {
  if (duplicate.id === canonical.id) return;

  if (duplicate.ledger) {
    await tx.ledgerEntry.updateMany({
      where: { ledgerId: duplicate.ledger.id },
      data: { ledgerId: canonical.ledger!.id },
    });

    await tx.voucher.updateMany({
      where: { debitAccountId: duplicate.id },
      data: { debitAccountId: canonical.id },
    });
    await tx.voucher.updateMany({
      where: { creditAccountId: duplicate.id },
      data: { creditAccountId: canonical.id },
    });

    const entries = await tx.ledgerEntry.findMany({
      where: { ledgerId: canonical.ledger!.id },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });

    let balance = 0;
    for (const entry of entries) {
      balance +=
        entry.type === LedgerEntryType.DEBIT ? Number(entry.amount) : -Number(entry.amount);
      await tx.ledgerEntry.update({ where: { id: entry.id }, data: { balance } });
    }

    await tx.ledger.update({
      where: { id: canonical.ledger!.id },
      data: { balance },
    });

    await tx.ledger.update({
      where: { id: duplicate.ledger.id },
      data: { balance: 0 },
    });
  }

  await tx.account.update({
    where: { id: duplicate.id },
    data: { isActive: false },
  });
}

/** Keep a single Inventory account under the Inventory category; merge/remove duplicates. */
export async function consolidateDuplicateInventoryAccounts(
  tx: Prisma.TransactionClient,
  branchId: number,
) {
  const canonical = await ensureInventoryAccount(tx, branchId);

  const duplicates = await tx.account.findMany({
    where: {
      branchId,
      isActive: true,
      id: { not: canonical.id },
      name: { equals: INVENTORY_ACCOUNT_NAME, mode: 'insensitive' },
    },
    include: { ledger: true },
  });

  for (const dup of duplicates) {
    await mergeInventoryAccountIntoCanonical(tx, canonical, dup);
  }

  return canonical;
}

async function ensureCategoryInTx(tx: Prisma.TransactionClient, branchId: number, name: string) {
  const existing = await tx.accountCategory.findFirst({
    where: { branchId, isActive: true, name: { equals: name, mode: 'insensitive' } },
  });
  if (existing) return existing;
  return tx.accountCategory.create({ data: { branchId, name } });
}

async function ensureDefaultAccountInTx(
  tx: Prisma.TransactionClient,
  branchId: number,
  categoryId: number,
  accountName: string,
  type: AccountType,
  preferredCode?: string,
) {
  const existing = await tx.account.findFirst({
    where: {
      branchId,
      isActive: true,
      name: { equals: accountName, mode: 'insensitive' },
    },
    include: { ledger: true },
  });

  if (existing) {
    if (!existing.ledger) {
      await tx.ledger.create({ data: { branchId, accountId: existing.id, balance: 0 } });
    }
    if (existing.categoryId !== categoryId) {
      await tx.account.update({
        where: { id: existing.id },
        data: { categoryId, type },
      });
    }
    return existing;
  }

  let code = preferredCode;
  if (code) {
    const codeTaken = await tx.account.findFirst({ where: { branchId, code } });
    if (codeTaken) code = undefined;
  }
  if (!code) code = await generateNextAccountCodeInTx(tx, branchId);

  const account = await tx.account.create({
    data: { branchId, categoryId, name: accountName, code, type },
  });
  await tx.ledger.create({ data: { branchId, accountId: account.id, balance: 0 } });
  return account;
}

async function consolidateDuplicateInventoryCategories(tx: Prisma.TransactionClient, branchId: number) {
  const categories = await tx.accountCategory.findMany({
    where: {
      branchId,
      isActive: true,
      name: { equals: INVENTORY_CATEGORY_NAME, mode: 'insensitive' },
    },
    include: { accounts: { where: { isActive: true } } },
    orderBy: { id: 'asc' },
  });

  if (categories.length <= 1) return categories[0] ?? null;

  const [canonical, ...duplicates] = categories;
  for (const dup of duplicates) {
    for (const account of dup.accounts) {
      await tx.account.update({
        where: { id: account.id },
        data: { categoryId: canonical.id, type: AccountType.ASSET },
      });
    }
    await tx.accountCategory.update({ where: { id: dup.id }, data: { isActive: false } });
  }
  return canonical;
}

/** Create default chart-of-accounts categories and core accounts for a branch. Idempotent. */
export async function bootstrapBranchChartOfAccounts(branchId: number) {
  await prisma.$transaction(async (tx) => {
    for (const name of BRANCH_DEFAULT_CATEGORY_NAMES) {
      await ensureCategoryInTx(tx, branchId, name);
    }

    await consolidateDuplicateInventoryCategories(tx, branchId);

    const cashCategory = await ensureCategoryInTx(tx, branchId, 'Cash');
    await ensureDefaultAccountInTx(
      tx,
      branchId,
      cashCategory.id,
      CASH_IN_HAND_ACCOUNT_NAME,
      AccountType.ASSET,
      '1001',
    );

    await ensureInventoryAccount(tx, branchId);
    await ensureSaleRevenueAccount(tx, branchId);
    await ensureServiceRevenueAccount(tx, branchId);
    await consolidateDuplicateInventoryAccounts(tx, branchId);
  });
}

async function ensureInventoryCategoryInTx(tx: Prisma.TransactionClient, branchId: number) {
  const existing = await tx.accountCategory.findFirst({
    where: { branchId, isActive: true, name: { equals: INVENTORY_CATEGORY_NAME, mode: 'insensitive' } },
  });
  if (existing) return existing;
  return tx.accountCategory.create({ data: { branchId, name: INVENTORY_CATEGORY_NAME } });
}

export async function createVoucherInTx(
  tx: Prisma.TransactionClient,
  data: {
    branchId: number;
    type: VoucherType;
    debitAccountId: number;
    creditAccountId: number;
    amount: number;
    description?: string;
    reference?: string;
    createdById: string;
  },
) {
  if (data.amount <= 0) {
    throw new AppError(400, 'Amount must be greater than zero');
  }

  const { debitAccount, creditAccount } = await loadBranchAccounts(
    tx,
    data.branchId,
    data.debitAccountId,
    data.creditAccountId,
  );
  assertVoucherAccountRules(data.type, debitAccount, creditAccount);

  const number = await nextVoucherNumber(tx, data.branchId, data.type);

  const voucher = await tx.voucher.create({
    data: { ...data, number, status: VoucherStatus.ACTIVE },
  });

  await postVoucherLedgerEntries(
    tx,
    voucher.id,
    data.debitAccountId,
    data.creditAccountId,
    data.amount,
    data.description,
    false,
  );

  return voucher;
}

export async function createVoucher(data: {
  branchId: number;
  type: VoucherType;
  debitAccountId: number;
  creditAccountId: number;
  amount: number;
  description?: string;
  reference?: string;
  createdById: string;
}) {
  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const voucher = await createVoucherInTx(tx, data);
    return tx.voucher.findUniqueOrThrow({ where: { id: voucher.id }, include: voucherInclude });
  });
}

async function postVoucherLedgerEntries(
  tx: Prisma.TransactionClient,
  voucherId: number,
  debitAccountId: number,
  creditAccountId: number,
  amount: number,
  notes: string | null | undefined,
  isReversal: boolean,
) {
  const debitLedger = await tx.ledger.findUniqueOrThrow({ where: { accountId: debitAccountId } });
  const creditLedger = await tx.ledger.findUniqueOrThrow({ where: { accountId: creditAccountId } });

  const debitBalance = Number(debitLedger.balance) + amount;
  const creditBalance = Number(creditLedger.balance) - amount;

  await tx.ledgerEntry.createMany({
    data: [
      {
        ledgerId: debitLedger.id,
        voucherId,
        type: LedgerEntryType.DEBIT,
        amount,
        balance: debitBalance,
        notes: notes ?? undefined,
        isReversal,
      },
      {
        ledgerId: creditLedger.id,
        voucherId,
        type: LedgerEntryType.CREDIT,
        amount,
        balance: creditBalance,
        notes: notes ?? undefined,
        isReversal,
      },
    ],
  });

  await tx.ledger.update({ where: { id: debitLedger.id }, data: { balance: debitBalance } });
  await tx.ledger.update({ where: { id: creditLedger.id }, data: { balance: creditBalance } });
}

async function reverseVoucherLedgerEntries(
  tx: Prisma.TransactionClient,
  voucher: { id: number; debitAccountId: number; creditAccountId: number; amount: Prisma.Decimal },
  notes: string,
) {
  const amount = Number(voucher.amount);

  const debitLedger = await tx.ledger.findUniqueOrThrow({
    where: { accountId: voucher.debitAccountId },
  });
  const creditLedger = await tx.ledger.findUniqueOrThrow({
    where: { accountId: voucher.creditAccountId },
  });

  const debitBalanceAfter = Number(debitLedger.balance) - amount;
  await tx.ledgerEntry.create({
    data: {
      ledgerId: debitLedger.id,
      voucherId: voucher.id,
      type: LedgerEntryType.CREDIT,
      amount,
      balance: debitBalanceAfter,
      notes,
      isReversal: true,
    },
  });
  await tx.ledger.update({ where: { id: debitLedger.id }, data: { balance: debitBalanceAfter } });

  const creditBalanceAfter = Number(creditLedger.balance) + amount;
  await tx.ledgerEntry.create({
    data: {
      ledgerId: creditLedger.id,
      voucherId: voucher.id,
      type: LedgerEntryType.DEBIT,
      amount,
      balance: creditBalanceAfter,
      notes,
      isReversal: true,
    },
  });
  await tx.ledger.update({ where: { id: creditLedger.id }, data: { balance: creditBalanceAfter } });
}

const voucherInclude = {
  debitAccount: true,
  creditAccount: true,
  createdBy: { select: { firstName: true, lastName: true } },
  modifiedBy: { select: { firstName: true, lastName: true } },
  deletedBy: { select: { firstName: true, lastName: true } },
} as const;

export async function listVouchers(branchId: number) {
  return prisma.voucher.findMany({
    where: { branchId },
    include: voucherInclude,
    orderBy: { createdAt: 'desc' },
  });
}

export async function cancelVoucher(branchId: number, voucherId: number, userId: string) {
  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const voucher = await tx.voucher.findFirst({
      where: { id: voucherId, branchId },
    });
    if (!voucher) throw new AppError(404, 'Voucher not found');
    if (voucher.status === VoucherStatus.CANCELLED) {
      throw new AppError(400, 'Voucher is already cancelled');
    }

    await reverseVoucherLedgerEntries(
      tx,
      voucher,
      `Reversal — cancelled voucher #${voucher.number}`,
    );

    const now = new Date();
    return tx.voucher.update({
      where: { id: voucher.id },
      data: {
        status: VoucherStatus.CANCELLED,
        deletedById: userId,
        deletedAt: now,
        modifiedById: userId,
      },
      include: voucherInclude,
    });
  });
}

export async function restoreVoucher(branchId: number, voucherId: number, userId: string) {
  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const voucher = await tx.voucher.findFirst({
      where: { id: voucherId, branchId },
    });
    if (!voucher) throw new AppError(404, 'Voucher not found');
    if (voucher.status !== VoucherStatus.CANCELLED) {
      throw new AppError(400, 'Only cancelled vouchers can be restored');
    }

    await postVoucherLedgerEntries(
      tx,
      voucher.id,
      voucher.debitAccountId,
      voucher.creditAccountId,
      Number(voucher.amount),
      undefined,
      false,
    );

    return tx.voucher.update({
      where: { id: voucher.id },
      data: {
        status: VoucherStatus.ACTIVE,
        deletedById: null,
        deletedAt: null,
        modifiedById: userId,
      },
      include: voucherInclude,
    });
  });
}

/** @deprecated Use cancelVoucher — kept for route compatibility */
export async function deleteVoucher(branchId: number, voucherId: number, userId: string) {
  return cancelVoucher(branchId, voucherId, userId);
}

export async function getTrialBalance(branchId: number) {
  const ledgers = await prisma.ledger.findMany({
    where: { branchId },
    include: { account: true },
    orderBy: [{ account: { type: 'asc' } }, { account: { code: 'asc' } }],
  });

  const accounts = ledgers.map((l: (typeof ledgers)[number]) => {
    const balance = Number(l.balance);
    return {
      accountId: l.accountId,
      accountCode: l.account.code,
      accountName: l.account.name,
      accountType: l.account.type,
      balance,
      debit: balance > 0 ? balance : 0,
      credit: balance < 0 ? Math.abs(balance) : 0,
    };
  });

  const totalDebit = accounts.reduce((s, a) => s + a.debit, 0);
  const totalCredit = accounts.reduce((s, a) => s + a.credit, 0);

  return {
    accounts,
    totalDebit,
    totalCredit,
    isBalanced: Math.abs(totalDebit - totalCredit) < 0.01,
  };
}

export async function listBankAccounts(branchId: number) {
  return prisma.bankAccount.findMany({ where: { branchId, isActive: true } });
}

export async function createBankAccount(data: {
  branchId: number;
  name: string;
  accountNumber?: string;
  openingBalance?: number;
}) {
  return prisma.bankAccount.create({
    data: {
      branchId: data.branchId,
      name: data.name,
      accountNumber: data.accountNumber,
      openingBalance: data.openingBalance ?? 0,
      runningBalance: data.openingBalance ?? 0,
    },
  });
}

export async function getLedgerEntries(
  accountId: number,
  branchId: number,
  fromDate?: string,
  toDate?: string,
) {
  let ledger = await prisma.ledger.findFirst({
    where: { accountId, branchId },
    include: {
      entries: {
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        include: {
          voucher: { include: { debitAccount: true, creditAccount: true } },
        },
      },
      account: true,
    },
  });

  if (!ledger) {
    const account = await prisma.account.findFirst({
      where: { id: accountId, branchId, isActive: true },
    });
    if (!account) throw new AppError(404, 'Ledger not found');
    await prisma.ledger.create({ data: { branchId, accountId, balance: 0 } });
    ledger = await prisma.ledger.findFirst({
      where: { accountId, branchId },
      include: {
        entries: {
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          include: {
            voucher: { include: { debitAccount: true, creditAccount: true } },
          },
        },
        account: true,
      },
    });
  }

  if (!ledger) throw new AppError(404, 'Ledger not found');

  const from = fromDate ? parseDateStart(fromDate) : null;
  const to = toDate ? parseDateEnd(toDate) : null;

  let periodOpening = 0;
  const periodEntries: typeof ledger.entries = [];

  for (const e of ledger.entries) {
    if (!isReportableLedgerEntry(e)) continue;

    const { debit, credit } = entryDebitCredit(e.type, Number(e.amount));
    const at = new Date(e.createdAt);

    if (from && at < from) {
      periodOpening += debit - credit;
      continue;
    }
    if (to && at > to) continue;

    periodEntries.push(e);
  }

  type LedgerRow = {
    date: string;
    voucherNo: string;
    ref: string | null;
    type: string;
    description: string;
    debit: number;
    credit: number;
    balance: number;
    isOpeningRow?: boolean;
  };

  const rows: LedgerRow[] = [];
  let running = periodOpening;
  let totalDebit = 0;
  let totalCredit = 0;

  if (from) {
    rows.push({
      date: fromDate!,
      voucherNo: '0',
      ref: null,
      type: 'Opening Balance',
      description: 'Opening Balance',
      debit: 0,
      credit: 0,
      balance: periodOpening,
      isOpeningRow: true,
    });
    running = periodOpening;
  }

  for (const e of periodEntries) {
    const { debit, credit } = entryDebitCredit(e.type, Number(e.amount));
    running += debit - credit;
    totalDebit += debit;
    totalCredit += credit;

    const voucher = e.voucher;
    rows.push({
      date: e.createdAt.toISOString(),
      voucherNo: e.isOpeningBalance
        ? '0'
        : voucherDisplayNo(voucher?.type ?? null, voucher?.number),
      ref: voucher?.reference ?? null,
      type: e.isOpeningBalance
        ? 'Opening Balance'
        : voucherTypeLabel(voucher ?? null, false),
      description: buildLedgerEntryDescription(e, voucher ?? null),
      debit,
      credit,
      balance: running,
    });
  }

  const closingBalance = from || to ? running : reportBalanceFromEntries(ledger.entries);

  return {
    account: ledger.account,
    balance: closingBalance,
    rows,
    summary: {
      periodOpening,
      totalDebit,
      totalCredit,
      closingBalance,
    },
  };
}

export async function approveTrialBalance(data: {
  branchId: number;
  period: string;
  approvedById: string;
  notes?: string;
}) {
  const snapshot = await getTrialBalance(data.branchId);
  return prisma.trialBalanceApproval.upsert({
    where: { branchId_period: { branchId: data.branchId, period: data.period } },
    create: {
      branchId: data.branchId,
      period: data.period,
      approvedById: data.approvedById,
      notes: data.notes,
      snapshot,
    },
    update: {
      approvedById: data.approvedById,
      notes: data.notes,
      snapshot,
    },
    include: { approvedBy: { select: { firstName: true, lastName: true } } },
  });
}

export async function listTrialBalanceApprovals(branchId: number) {
  return prisma.trialBalanceApproval.findMany({
    where: { branchId },
    include: { approvedBy: { select: { firstName: true, lastName: true } } },
    orderBy: { period: 'desc' },
  });
}

export async function updateBankAccount(
  id: number,
  branchId: number,
  data: Partial<{ name: string; accountNumber: string; runningBalance: number; isActive: boolean }>
) {
  const bank = await prisma.bankAccount.findFirst({ where: { id, branchId } });
  if (!bank) throw new AppError(404, 'Bank account not found');
  return prisma.bankAccount.update({ where: { id }, data });
}

export async function updateAccount(
  id: number,
  branchId: number,
  data: Partial<{ name: string; code: string; isActive: boolean }>
) {
  const account = await prisma.account.findFirst({ where: { id, branchId } });
  if (!account) throw new AppError(404, 'Account not found');
  return prisma.account.update({ where: { id }, data });
}

/** Soft-delete: hides account from lists; ledger entries are kept until vouchers are cancelled. */
export async function softDeleteAccount(id: number, branchId: number) {
  const account = await prisma.account.findFirst({ where: { id, branchId, isActive: true } });
  if (!account) throw new AppError(404, 'Account not found');
  if (isInventoryAccountName(account.name)) {
    throw new AppError(400, 'The Inventory account cannot be deleted');
  }
  return prisma.account.update({
    where: { id },
    data: { isActive: false },
    include: { category: true, ledger: true },
  });
}
