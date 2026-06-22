import { describe, it, expect, afterEach } from 'vitest';
import {
  assertDisplayBalance,
  assertSignedBalance,
  assertTrialBalanceBalanced,
  cancelVoucher,
  createAccountCategory,
  createAccountingTestContext,
  destroyAccountingTestContext,
  expectAppError,
  formatLedgerBalance,
  getLedgerEntries,
  getSignedBalance,
  getTrialBalance,
  makeAccount,
  openBalancedBooks,
  postJournal,
  postPayment,
  postReceipt,
  type AccountingTestContext,
} from './helpers.js';

describe('Accounting Engine', () => {
  let ctx: AccountingTestContext;

  afterEach(async () => {
    if (ctx) await destroyAccountingTestContext(ctx);
  });

  describe('Receipt Voucher Tests', () => {
    it('Test 1: Simple Receipt — debits Cash, credits customer, trial balance stays balanced', async () => {
      ctx = await createAccountingTestContext();

      const [cash, ahmad] = await openBalancedBooks(ctx, [
        { code: 'CASH-1', name: 'Cash', type: 'ASSET', categoryKey: 'cash', amount: 0, side: 'DR' },
        { code: 'AHMAD-1', name: 'Ahmad Corp', type: 'ASSET', categoryKey: 'customers', amount: 50_000, side: 'DR' },
      ]);

      await postReceipt(ctx, {
        fromAccountId: ahmad.id,
        toAccountId: cash.id,
        amount: 10_000,
      });

      assertSignedBalance(await getSignedBalance(cash.id), 10_000, 'Cash');
      assertSignedBalance(await getSignedBalance(ahmad.id), 40_000, 'Ahmad Corp');
      assertDisplayBalance(await getSignedBalance(cash.id), '10,000.00 Dr', 'Cash');
      assertDisplayBalance(await getSignedBalance(ahmad.id), '40,000.00 Dr', 'Ahmad Corp');

      const cashLedger = await getLedgerEntries(cash.id, ctx.branchId);
      const creditRow = cashLedger.rows.find((r) => r.credit > 0);
      expect(creditRow).toBeUndefined();
      const debitRow = cashLedger.rows.find((r) => r.debit === 10_000);
      expect(debitRow).toBeDefined();

      const ahmadLedger = await getLedgerEntries(ahmad.id, ctx.branchId);
      const ahmadCredit = ahmadLedger.rows.find((r) => r.credit === 10_000 && r.type === 'Receipt');
      expect(ahmadCredit).toBeDefined();

      await assertTrialBalanceBalanced(ctx.branchId);
    });

    it('Test 2: Receipt creates credit balance — displays 5,000 Cr not -5,000 Dr', async () => {
      ctx = await createAccountingTestContext();

      const cash = await makeAccount(ctx, {
        code: 'CASH-2',
        name: 'Cash',
        type: 'ASSET',
        categoryKey: 'cash',
      });
      const ahmad = await makeAccount(ctx, {
        code: 'AHMAD-2',
        name: 'Ahmad Corp',
        type: 'ASSET',
        categoryKey: 'customers',
        openingBalance: 5_000,
        openingBalanceSide: 'DR',
      });

      await postReceipt(ctx, {
        fromAccountId: ahmad.id,
        toAccountId: cash.id,
        amount: 10_000,
      });

      const ahmadBalance = await getSignedBalance(ahmad.id);
      assertSignedBalance(ahmadBalance, -5_000);
      assertDisplayBalance(ahmadBalance, '5,000.00 Cr');
      expect(formatLedgerBalance(ahmadBalance)).not.toContain('-');
      expect(formatLedgerBalance(ahmadBalance)).not.toMatch(/-\d.*Dr/);
    });

    it('assigns sequential voucher numbers per type within a branch', async () => {
      ctx = await createAccountingTestContext();

      const cash = await makeAccount(ctx, {
        code: 'CASH-SEQ',
        name: 'Cash',
        type: 'ASSET',
        categoryKey: 'cash',
      });
      const ahmad = await makeAccount(ctx, {
        code: 'AHMAD-SEQ',
        name: 'Ahmad Corp',
        type: 'ASSET',
        categoryKey: 'customers',
      });
      const rent = await makeAccount(ctx, {
        code: 'RENT-SEQ',
        name: 'Rent',
        type: 'EXPENSE',
        categoryKey: 'expenses',
      });

      const receipt1 = await postReceipt(ctx, {
        fromAccountId: ahmad.id,
        toAccountId: cash.id,
        amount: 1_000,
      });
      const receipt2 = await postReceipt(ctx, {
        fromAccountId: ahmad.id,
        toAccountId: cash.id,
        amount: 2_000,
      });
      const payment1 = await postPayment(ctx, {
        fromAccountId: cash.id,
        toAccountId: rent.id,
        amount: 500,
      });

      expect(receipt1.number).toBe(1);
      expect(receipt2.number).toBe(2);
      expect(payment1.number).toBe(1);

      const cashLedger = await getLedgerEntries(cash.id, ctx.branchId);
      const voucherNos = cashLedger.rows.filter((r) => !r.isOpeningRow).map((r) => r.voucherNo);
      expect(voucherNos).toContain('1');
      expect(voucherNos).toContain('2');
    });

    it('ledger description shows from/to accounts and optional custom note', async () => {
      ctx = await createAccountingTestContext();

      const cash = await makeAccount(ctx, {
        code: 'CASH-DESC',
        name: 'Meezan Bank',
        type: 'ASSET',
        categoryKey: 'cash',
      });
      const ahmad = await makeAccount(ctx, {
        code: 'AHMAD-DESC',
        name: 'Shahbaz2',
        type: 'ASSET',
        categoryKey: 'customers',
      });

      await postReceipt(ctx, {
        fromAccountId: ahmad.id,
        toAccountId: cash.id,
        amount: 2_000,
        description: 'Monthly payment',
      });

      const cashLedger = await getLedgerEntries(cash.id, ctx.branchId);
      const row = cashLedger.rows.find((r) => r.type === 'Receipt');
      expect(row?.description).toBe('From Shahbaz2 to Meezan Bank — Monthly payment');

      const ahmadLedger = await getLedgerEntries(ahmad.id, ctx.branchId);
      const ahmadRow = ahmadLedger.rows.find((r) => r.type === 'Receipt');
      expect(ahmadRow?.description).toBe('From Shahbaz2 to Meezan Bank — Monthly payment');
    });
  });

  describe('Payment Voucher Tests', () => {
    it('Test 3: Simple Payment — debits expense, credits cash, ledgers correct', async () => {
      ctx = await createAccountingTestContext();

      const [cash, rent] = await openBalancedBooks(ctx, [
        { code: 'CASH-3', name: 'Cash', type: 'ASSET', categoryKey: 'cash', amount: 100_000, side: 'DR' },
        { code: 'RENT-3', name: 'Rent Expense', type: 'EXPENSE', categoryKey: 'expenses', amount: 0, side: 'DR' },
      ]);

      await postPayment(ctx, {
        fromAccountId: cash.id,
        toAccountId: rent.id,
        amount: 20_000,
      });

      assertSignedBalance(await getSignedBalance(cash.id), 80_000, 'Cash');
      assertSignedBalance(await getSignedBalance(rent.id), 20_000, 'Rent Expense');

      const cashLedger = await getLedgerEntries(cash.id, ctx.branchId);
      expect(cashLedger.rows.some((r) => r.credit === 20_000 && r.type === 'Payment')).toBe(true);

      const rentLedger = await getLedgerEntries(rent.id, ctx.branchId);
      expect(rentLedger.rows.some((r) => r.debit === 20_000 && r.type === 'Payment')).toBe(true);

      await assertTrialBalanceBalanced(ctx.branchId);
    });

    it('Test 4: Payment exceeds available balance — allows credit (negative) balance', async () => {
      ctx = await createAccountingTestContext();

      const cash = await makeAccount(ctx, {
        code: 'CASH-4',
        name: 'Cash',
        type: 'ASSET',
        categoryKey: 'cash',
        openingBalance: 10_000,
        openingBalanceSide: 'DR',
      });
      const rent = await makeAccount(ctx, {
        code: 'RENT-4',
        name: 'Rent Expense',
        type: 'EXPENSE',
        categoryKey: 'expenses',
      });

      await postPayment(ctx, {
        fromAccountId: cash.id,
        toAccountId: rent.id,
        amount: 15_000,
      });

      const cashBalance = await getSignedBalance(cash.id);
      assertSignedBalance(cashBalance, -5_000);
      assertDisplayBalance(cashBalance, '5,000.00 Cr');
    });
  });

  describe('Journal Voucher Tests', () => {
    it('Test 5: Bank to Cash transfer — balances and trial balance correct', async () => {
      ctx = await createAccountingTestContext();

      const [bank, cash] = await openBalancedBooks(ctx, [
        { code: 'BANK-5', name: 'Bank', type: 'ASSET', categoryKey: 'bank', amount: 100_000, side: 'DR' },
        { code: 'CASH-5', name: 'Cash', type: 'ASSET', categoryKey: 'cash', amount: 20_000, side: 'DR' },
      ]);

      await postJournal(ctx, {
        debitAccountId: cash.id,
        creditAccountId: bank.id,
        amount: 25_000,
      });

      assertSignedBalance(await getSignedBalance(cash.id), 45_000, 'Cash');
      assertSignedBalance(await getSignedBalance(bank.id), 75_000, 'Bank');
      await assertTrialBalanceBalanced(ctx.branchId);
    });

    it('Test 6: Same account not allowed — validation error', async () => {
      ctx = await createAccountingTestContext();

      const cash = await makeAccount(ctx, {
        code: 'CASH-6',
        name: 'Cash',
        type: 'ASSET',
        categoryKey: 'cash',
        openingBalance: 10_000,
        openingBalanceSide: 'DR',
      });

      await expectAppError(
        () =>
          postJournal(ctx, {
            debitAccountId: cash.id,
            creditAccountId: cash.id,
            amount: 10_000,
          }),
        400,
        'debit and credit accounts must be different',
      );
    });
  });

  describe('Voucher Deletion Tests', () => {
    it('Test 7: Cancel receipt voucher — balances restored, trial balance balanced', async () => {
      ctx = await createAccountingTestContext();

      const [cash, ahmad] = await openBalancedBooks(ctx, [
        { code: 'CASH-7', name: 'Cash', type: 'ASSET', categoryKey: 'cash', amount: 0, side: 'DR' },
        { code: 'AHMAD-7', name: 'Ahmad Corp', type: 'ASSET', categoryKey: 'customers', amount: 50_000, side: 'DR' },
      ]);

      const cashBefore = await getSignedBalance(cash.id);
      const ahmadBefore = await getSignedBalance(ahmad.id);

      const voucher = await postReceipt(ctx, {
        fromAccountId: ahmad.id,
        toAccountId: cash.id,
        amount: 10_000,
      });

      assertSignedBalance(await getSignedBalance(cash.id), cashBefore + 10_000);
      assertSignedBalance(await getSignedBalance(ahmad.id), ahmadBefore - 10_000);

      await cancelVoucher(ctx.branchId, voucher.id, ctx.userId);

      assertSignedBalance(await getSignedBalance(cash.id), cashBefore, 'Cash after cancel');
      assertSignedBalance(await getSignedBalance(ahmad.id), ahmadBefore, 'Ahmad after cancel');

      const cashLedger = await getLedgerEntries(cash.id, ctx.branchId);
      expect(cashLedger.rows.some((r) => r.type.includes('Reversal'))).toBe(false);
      expect(cashLedger.rows.filter((r) => r.type === 'Receipt')).toHaveLength(0);

      await assertTrialBalanceBalanced(ctx.branchId);
    });

    it('Test 8: Cancel payment voucher — expense and cash restored', async () => {
      ctx = await createAccountingTestContext();

      const [cash, rent] = await openBalancedBooks(ctx, [
        { code: 'CASH-8', name: 'Cash', type: 'ASSET', categoryKey: 'cash', amount: 100_000, side: 'DR' },
        { code: 'RENT-8', name: 'Rent Expense', type: 'EXPENSE', categoryKey: 'expenses', amount: 0, side: 'DR' },
      ]);

      const cashBefore = await getSignedBalance(cash.id);
      const rentBefore = await getSignedBalance(rent.id);

      const voucher = await postPayment(ctx, {
        fromAccountId: cash.id,
        toAccountId: rent.id,
        amount: 20_000,
      });

      await cancelVoucher(ctx.branchId, voucher.id, ctx.userId);

      assertSignedBalance(await getSignedBalance(cash.id), cashBefore);
      assertSignedBalance(await getSignedBalance(rent.id), rentBefore);

      const rentLedger = await getLedgerEntries(rent.id, ctx.branchId);
      expect(rentLedger.rows.filter((r) => r.type === 'Payment')).toHaveLength(0);

      await assertTrialBalanceBalanced(ctx.branchId);
    });
  });

  describe('Ledger Tests', () => {
    it('Test 9: Running balance — 50,000 Dr +10,000 -5,000 -70,000 = 15,000 Cr', async () => {
      ctx = await createAccountingTestContext();

      const [main] = await openBalancedBooks(ctx, [
        { code: 'MAIN-9', name: 'Main Account', type: 'ASSET', categoryKey: 'cash', amount: 50_000, side: 'DR' },
      ]);
      const counterA = await makeAccount(ctx, {
        code: 'CTR-A-9',
        name: 'Counter A',
        type: 'ASSET',
        categoryKey: 'bank',
      });
      const counterB = await makeAccount(ctx, {
        code: 'CTR-B-9',
        name: 'Counter B',
        type: 'ASSET',
        categoryKey: 'bank',
      });
      const counterC = await makeAccount(ctx, {
        code: 'CTR-C-9',
        name: 'Counter C',
        type: 'ASSET',
        categoryKey: 'bank',
      });

      // Debit 10,000 (journal: debit main, credit counterA)
      await postJournal(ctx, { debitAccountId: main.id, creditAccountId: counterA.id, amount: 10_000 });
      // Credit 5,000 (journal: debit counterB, credit main)
      await postJournal(ctx, { debitAccountId: counterB.id, creditAccountId: main.id, amount: 5_000 });
      // Credit 70,000
      await postJournal(ctx, { debitAccountId: counterC.id, creditAccountId: main.id, amount: 70_000 });

      const ledger = await getLedgerEntries(main.id, ctx.branchId);
      const lastRow = ledger.rows[ledger.rows.length - 1];

      assertSignedBalance(lastRow.balance, -15_000);
      assertDisplayBalance(lastRow.balance, '15,000.00 Cr');
      expect(formatLedgerBalance(lastRow.balance)).not.toMatch(/-\d.*Dr/);
      expect(ledger.summary.closingBalance).toBeCloseTo(-15_000, 2);
    });
  });

  describe('Trial Balance Tests', () => {
    it('Test 10: Full validation — Cash 80k Dr, Rent 20k Dr, Capital 100k Cr', async () => {
      ctx = await createAccountingTestContext();

      const cash = await makeAccount(ctx, {
        code: 'CASH-10',
        name: 'Cash',
        type: 'ASSET',
        categoryKey: 'cash',
      });
      const capital = await makeAccount(ctx, {
        code: 'CAP-10',
        name: 'Capital',
        type: 'EQUITY',
        categoryKey: 'capital',
      });
      const rent = await makeAccount(ctx, {
        code: 'RENT-10',
        name: 'Rent Expense',
        type: 'EXPENSE',
        categoryKey: 'expenses',
      });

      await postJournal(ctx, {
        debitAccountId: cash.id,
        creditAccountId: capital.id,
        amount: 100_000,
      });
      await postPayment(ctx, {
        fromAccountId: cash.id,
        toAccountId: rent.id,
        amount: 20_000,
      });

      const tb = await assertTrialBalanceBalanced(ctx.branchId);

      const byName = (name: string) => tb.accounts.find((a) => a.accountName === name)!;

      expect(byName('Cash').debit).toBeCloseTo(80_000, 2);
      expect(byName('Cash').credit).toBeCloseTo(0, 2);
      expect(byName('Rent Expense').debit).toBeCloseTo(20_000, 2);
      expect(byName('Capital').credit).toBeCloseTo(100_000, 2);
      expect(tb.totalDebit).toBeCloseTo(100_000, 2);
      expect(tb.totalCredit).toBeCloseTo(100_000, 2);
    });
  });

  describe('Opening Balance Tests', () => {
    it('Test 11: Opening balance appears in ledger as 50,000 Cr', async () => {
      ctx = await createAccountingTestContext();

      ctx = await createAccountingTestContext();

      const ahmad = await makeAccount(ctx, {
        code: 'AHMAD-11',
        name: 'Ahmad Corp',
        type: 'LIABILITY',
        categoryKey: 'customers',
        openingBalance: 50_000,
        openingBalanceSide: 'CR',
      });

      assertSignedBalance(await getSignedBalance(ahmad.id), -50_000);
      assertDisplayBalance(await getSignedBalance(ahmad.id), '50,000.00 Cr');

      const ledger = await getLedgerEntries(ahmad.id, ctx.branchId);
      expect(ledger.rows).toHaveLength(1);

      const opening = ledger.rows[0];
      expect(opening.type).toBe('Opening Balance');
      expect(opening.voucherNo).toBe('0');
      expect(opening.debit).toBe(0);
      expect(opening.credit).toBe(50_000);
      assertDisplayBalance(opening.balance, '50,000.00 Cr');

      await assertTrialBalanceBalanced(ctx.branchId);
    });
  });

  describe('Duplicate Name Validation', () => {
    it('rejects duplicate category name (case-insensitive)', async () => {
      ctx = await createAccountingTestContext();
      await createAccountCategory(ctx.branchId, 'Suppliers');

      await expectAppError(
        () => createAccountCategory(ctx.branchId, 'suppliers'),
        400,
        'already exists',
      );
      await expectAppError(
        () => createAccountCategory(ctx.branchId, '  Suppliers  '),
        400,
        'already exists',
      );
    });

    it('rejects duplicate account name (case-insensitive)', async () => {
      ctx = await createAccountingTestContext();
      await makeAccount(ctx, {
        code: 'ACC-1',
        name: 'Cash in Hand',
        type: 'ASSET',
        categoryKey: 'cash',
      });

      await expectAppError(
        () =>
          makeAccount(ctx, {
            code: 'ACC-2',
            name: 'cash in hand',
            type: 'ASSET',
            categoryKey: 'cash',
          }),
        400,
        'already exists',
      );
    });

    it('rejects duplicate account code (case-insensitive)', async () => {
      ctx = await createAccountingTestContext();
      await makeAccount(ctx, {
        code: '1001',
        name: 'Cash A',
        type: 'ASSET',
        categoryKey: 'cash',
      });

      await expectAppError(
        () =>
          makeAccount(ctx, {
            code: '1001',
            name: 'Cash B',
            type: 'ASSET',
            categoryKey: 'cash',
          }),
        400,
        'already exists',
      );
    });

    it('auto-generates account code and infers type from category', async () => {
      const { createAccount } = await import('../accounting.service.js');
      ctx = await createAccountingTestContext();

      await makeAccount(ctx, {
        code: '2001',
        name: 'Petty Cash',
        type: 'ASSET',
        categoryKey: 'cash',
      });

      const second = await createAccount({
        branchId: ctx.branchId,
        categoryId: ctx.categories.cash,
        name: 'Main Cash',
      });

      expect(second.code).toBe('2002');
      expect(second.type).toBe('ASSET');
    });

    it('soft-deletes empty category and blocks delete when accounts exist', async () => {
      ctx = await createAccountingTestContext();
      const empty = await createAccountCategory(ctx.branchId, 'Empty Cat');
      await makeAccount(ctx, {
        code: 'USED-1',
        name: 'Used Account',
        type: 'ASSET',
        categoryKey: 'cash',
      });

      const { softDeleteAccountCategory } = await import('../accounting.service.js');
      await softDeleteAccountCategory(empty.id, ctx.branchId);

      const categories = await createAccountCategory(ctx.branchId, 'Another');
      expect(categories.name).toBe('Another');

      await expectAppError(
        () => softDeleteAccountCategory(ctx.categories.cash, ctx.branchId),
        400,
        'cannot be deleted',
      );
    });
  });
});
