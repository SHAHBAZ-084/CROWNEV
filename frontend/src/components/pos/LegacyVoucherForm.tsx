import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { branchApi } from '../../api/client';
import { useToast } from '../../contexts/ToastContext';
import { formatLedgerBalance } from '../../lib/format';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { SearchSelect, type SearchSelectOption } from '../ui/SearchSelect';

type Row = Record<string, unknown>;
type VoucherType = 'RECEIPT' | 'PAYMENT' | 'JOURNAL';
type VoucherVariant = 'payment' | 'receipt' | 'journal';

/** Bank / cash side: Receipt → debit (To), Payment → credit (From). */
function isBankOrCashCategory(name: string) {
  const n = name.trim().toLowerCase();
  return n.includes('bank') || n.includes('cash');
}

function categoriesForSide(all: Row[], variant: VoucherVariant, side: 'credit' | 'debit') {
  if (variant === 'journal') return all;
  const restricted =
    (variant === 'receipt' && side === 'debit') ||
    (variant === 'payment' && side === 'credit');
  if (!restricted) return all;
  return all.filter((c) => isBankOrCashCategory(String(c.name)));
}

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function accountBalance(account: Row | undefined) {
  const ledger = account?.ledger as { balance?: number | string } | undefined;
  return Number(ledger?.balance ?? 0);
}

function SideFields({
  label,
  categoryId,
  accountId,
  balance,
  categories,
  accounts,
  onCategoryChange,
  onAccountChange,
  accountRequired,
}: {
  label: string;
  categoryId: string;
  accountId: string;
  balance: string;
  categories: Row[];
  accounts: Row[];
  onCategoryChange: (id: string) => void;
  onAccountChange: (id: string) => void;
  accountRequired?: boolean;
}) {
  const categoryOptions: SearchSelectOption[] = useMemo(
    () => categories.map((c) => ({ value: String(c.id), label: String(c.name) })),
    [categories],
  );

  const accountOptions: SearchSelectOption[] = useMemo(
    () => accounts.map((a) => ({
      value: String(a.id),
      label: String(a.name),
    })),
    [accounts],
  );

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-accent">{label}</p>
      <SearchSelect
        label="Category"
        value={categoryId}
        onChange={onCategoryChange}
        options={categoryOptions}
        placeholder="Search category…"
      />
      <SearchSelect
        label="Account"
        value={accountId}
        onChange={onAccountChange}
        options={accountOptions}
        placeholder="Search account…"
        required={accountRequired}
      />
      {balance && (
        <p className="text-xs text-text-muted">
          Balance <span className="font-medium tabular-nums text-brand">{balance}</span>
        </p>
      )}
    </div>
  );
}

export function LegacyVoucherScreen({
  type,
  variant,
  title,
  branchId,
}: {
  type: VoucherType;
  variant: VoucherVariant;
  title: string;
  branchId: number | null;
}) {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [accounts, setAccounts] = useState<Row[]>([]);
  const [categories, setCategories] = useState<Row[]>([]);
  const [vouchers, setVouchers] = useState<Row[]>([]);
  const [saving, setSaving] = useState(false);

  const [voucherDate, setVoucherDate] = useState(todayInputValue());
  const [debitCategoryId, setDebitCategoryId] = useState('');
  const [creditCategoryId, setCreditCategoryId] = useState('');
  const [debitAccountId, setDebitAccountId] = useState('');
  const [creditAccountId, setCreditAccountId] = useState('');
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [description, setDescription] = useState('');

  const reload = useCallback(() => {
    if (!branchId) return;
    branchApi.accounts(branchId).then((r) => setAccounts(r as Row[])).catch(console.error);
    branchApi.accountingCategories(branchId).then((r) => setCategories(r as Row[])).catch(console.error);
    branchApi.vouchers(branchId).then((r) => setVouchers(r as Row[])).catch(console.error);
  }, [branchId]);

  useEffect(() => { reload(); }, [reload]);

  const nextVoucherNo = useMemo(() => {
    const ofType = vouchers.filter((v) => v.type === type);
    if (ofType.length === 0) return '1';
    return String(Math.max(...ofType.map((v) => Number(v.number ?? 0))) + 1);
  }, [vouchers, type]);

  const debitCategories = useMemo(
    () => categoriesForSide(categories, variant, 'debit'),
    [categories, variant],
  );
  const creditCategories = useMemo(
    () => categoriesForSide(categories, variant, 'credit'),
    [categories, variant],
  );

  const debitAccounts = useMemo(
    () => accounts.filter((a) => !debitCategoryId || String(a.categoryId) === debitCategoryId),
    [accounts, debitCategoryId],
  );
  const creditAccounts = useMemo(
    () => accounts.filter((a) => !creditCategoryId || String(a.categoryId) === creditCategoryId),
    [accounts, creditCategoryId],
  );

  useEffect(() => {
    if (debitCategoryId && !debitCategories.some((c) => String(c.id) === debitCategoryId)) {
      setDebitCategoryId('');
      setDebitAccountId('');
    }
    if (creditCategoryId && !creditCategories.some((c) => String(c.id) === creditCategoryId)) {
      setCreditCategoryId('');
      setCreditAccountId('');
    }
  }, [debitCategories, creditCategories, debitCategoryId, creditCategoryId]);

  const debitAccount = accounts.find((a) => String(a.id) === debitAccountId);
  const creditAccount = accounts.find((a) => String(a.id) === creditAccountId);

  const leftLabel = variant === 'journal' ? 'Debit' : 'From';
  const rightLabel = variant === 'journal' ? 'Credit' : 'To';

  function resetForm() {
    setVoucherDate(todayInputValue());
    setDebitCategoryId('');
    setCreditCategoryId('');
    setDebitAccountId('');
    setCreditAccountId('');
    setAmount('');
    setReference('');
    setDescription('');
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);
    if (!branchId || !debitAccountId || !creditAccountId || !amount) {
      toast('Fill all required fields', 'error');
      return;
    }
    if (debitAccountId === creditAccountId) {
      toast('Debit and credit accounts must be different', 'error');
      return;
    }
    if (!(parsedAmount > 0)) {
      toast('Amount must be greater than zero', 'error');
      return;
    }

    setSaving(true);
    try {
      await branchApi.createVoucher(branchId, {
        type,
        debitAccountId: parseInt(debitAccountId, 10),
        creditAccountId: parseInt(creditAccountId, 10),
        amount: parsedAmount,
        description: description || undefined,
        reference: reference || undefined,
      });
      toast(`${title} saved`, 'success');
      resetForm();
      reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="w-full max-w-5xl">
      <div className="rounded-[var(--radius-card)] border border-border bg-white p-6 shadow-sm lg:p-8">
        <form onSubmit={handleSave} className="space-y-6">
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border/60 pb-5">
            <div>
              <h1 className="font-display text-xl font-bold text-brand">{title}</h1>
              <p className="mt-0.5 text-sm text-text-muted">Voucher #{nextVoucherNo}</p>
            </div>
            <div className="w-full sm:w-48">
              <Input
                label="Date"
                type="date"
                value={voucherDate}
                onChange={(e) => setVoucherDate(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2 lg:gap-10">
            <SideFields
              label={leftLabel}
              categoryId={variant === 'journal' ? debitCategoryId : creditCategoryId}
              accountId={variant === 'journal' ? debitAccountId : creditAccountId}
              balance={
                variant === 'journal'
                  ? (debitAccount ? formatLedgerBalance(accountBalance(debitAccount)) : '')
                  : (creditAccount ? formatLedgerBalance(accountBalance(creditAccount)) : '')
              }
              categories={variant === 'journal' ? debitCategories : creditCategories}
              accounts={variant === 'journal' ? debitAccounts : creditAccounts}
              onCategoryChange={(id) => {
                if (variant === 'journal') { setDebitCategoryId(id); setDebitAccountId(''); }
                else { setCreditCategoryId(id); setCreditAccountId(''); }
              }}
              onAccountChange={variant === 'journal' ? setDebitAccountId : setCreditAccountId}
              accountRequired
            />
            <SideFields
              label={rightLabel}
              categoryId={variant === 'journal' ? creditCategoryId : debitCategoryId}
              accountId={variant === 'journal' ? creditAccountId : debitAccountId}
              balance={
                variant === 'journal'
                  ? (creditAccount ? formatLedgerBalance(accountBalance(creditAccount)) : '')
                  : (debitAccount ? formatLedgerBalance(accountBalance(debitAccount)) : '')
              }
              categories={variant === 'journal' ? creditCategories : debitCategories}
              accounts={variant === 'journal' ? creditAccounts : debitAccounts}
              onCategoryChange={(id) => {
                if (variant === 'journal') { setCreditCategoryId(id); setCreditAccountId(''); }
                else { setDebitCategoryId(id); setDebitAccountId(''); }
              }}
              onAccountChange={variant === 'journal' ? setCreditAccountId : setDebitAccountId}
              accountRequired
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2 lg:gap-6">
            <Input
              label="Amount (PKR)"
              type="number"
              step="0.01"
              min="0.01"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
            />
            <Input
              label="Ref #"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Optional"
            />
          </div>

          <Input
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional notes"
          />

          <div className="flex flex-wrap justify-end gap-3 border-t border-border/60 pt-5">
            <Button type="button" variant="ghost" size="sm" onClick={() => navigate('/branch/workspace/pos')}>
              Close
            </Button>
            <Button type="submit" variant="accent" size="sm" loading={saving}>
              Save
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
