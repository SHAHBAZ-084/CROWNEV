import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { branchApi } from '../../api/client';
import { useToast } from '../../contexts/ToastContext';
import { useBranchPermission } from '../../hooks/useBranchPermission';
import { formatLedgerBalance, formatPKR } from '../../lib/format';
import { AccountAsyncSearchSelect } from '../ui/EntityAsyncSearchSelect';
import { Button } from '../ui/Button';
import { WorkspaceCloseBar, WorkspaceCloseButton } from '../layout/WorkspaceCloseButton';
import { DataTable } from '../ui/DataTable';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { SearchSelect, type SearchSelectOption } from '../ui/SearchSelect';
import { TYPE_LABELS, VoucherDetailCard } from './ViewVoucherPanel';
import { formatInvoiceListDate } from './InvoiceDateField';

type Row = Record<string, unknown>;
type VoucherType = 'RECEIPT' | 'PAYMENT' | 'JOURNAL';
type VoucherVariant = 'payment' | 'receipt' | 'journal';

const RECENT_HEADINGS: Record<VoucherVariant, string> = {
  receipt: 'Recent receipt vouchers',
  payment: 'Recent payment vouchers',
  journal: 'Recent journal vouchers',
};

function voucherPartyLabel(voucher: Row, variant: VoucherVariant) {
  const debit = String((voucher.debitAccount as Row | undefined)?.name ?? '—');
  const credit = String((voucher.creditAccount as Row | undefined)?.name ?? '—');
  if (variant === 'journal') return `${debit} / ${credit}`;
  return `${credit} → ${debit}`;
}

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
  branchId,
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
  branchId: number | null;
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

  const categoryName = useMemo(
    () => String(categories.find((c) => String(c.id) === categoryId)?.name ?? ''),
    [categories, categoryId],
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
      <AccountAsyncSearchSelect
        branchId={branchId}
        label="Account"
        categoryId={categoryId}
        categoryName={categoryName}
        accounts={accounts}
        value={accountId}
        onChange={onAccountChange}
        placeholder="Search account…"
        required={accountRequired}
        disabled={!categoryId}
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
  const { toast } = useToast();
  const { canUpdate, canDelete } = useBranchPermission();

  const [accounts, setAccounts] = useState<Row[]>([]);
  const [categories, setCategories] = useState<Row[]>([]);
  const [vouchers, setVouchers] = useState<Row[]>([]);
  const [saving, setSaving] = useState(false);
  const [viewVoucher, setViewVoucher] = useState<Row | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [updating, setUpdating] = useState(false);

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

  const recentVouchers = useMemo(
    () => vouchers.filter((v) => v.type === type).slice(0, 2),
    [vouchers, type],
  );

  const debitCategories = useMemo(
    () => categoriesForSide(categories, variant, 'debit'),
    [categories, variant],
  );
  const creditCategories = useMemo(
    () => categoriesForSide(categories, variant, 'credit'),
    [categories, variant],
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

  async function handleCancelVoucher() {
    if (!branchId || !viewVoucher) return;
    const label = TYPE_LABELS[viewVoucher.type as VoucherType] ?? 'Voucher';
    const voucherNo = String(viewVoucher.number ?? viewVoucher.id);
    if (!window.confirm(
      `Cancel ${label} #${voucherNo}? Reversal entries will be posted and account balances restored.`,
    )) return;

    setDeleting(true);
    try {
      const updated = await branchApi.deleteVoucher(branchId, Number(viewVoucher.id));
      setViewVoucher(updated as Row);
      toast('Voucher cancelled. Books reversed', 'success');
      reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Cancel failed', 'error');
    } finally {
      setDeleting(false);
    }
  }

  async function handleUpdateVoucherAmount(amount: number) {
    if (!branchId || !viewVoucher) return;
    const current = Number(viewVoucher.amount);
    if (Math.abs(amount - current) < 0.005) {
      toast('Amount unchanged', 'info');
      return;
    }

    setUpdating(true);
    try {
      const updated = await branchApi.updateVoucherAmount(branchId, Number(viewVoucher.id), amount);
      setViewVoucher(updated as Row);
      toast('Voucher amount updated', 'success');
      reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Update failed', 'error');
      throw err;
    } finally {
      setUpdating(false);
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
              branchId={branchId}
              categoryId={variant === 'journal' ? debitCategoryId : creditCategoryId}
              accountId={variant === 'journal' ? debitAccountId : creditAccountId}
              balance={
                variant === 'journal'
                  ? (debitAccount ? formatLedgerBalance(accountBalance(debitAccount)) : '')
                  : (creditAccount ? formatLedgerBalance(accountBalance(creditAccount)) : '')
              }
              categories={variant === 'journal' ? debitCategories : creditCategories}
              accounts={accounts}
              onCategoryChange={(id) => {
                if (variant === 'journal') { setDebitCategoryId(id); setDebitAccountId(''); }
                else { setCreditCategoryId(id); setCreditAccountId(''); }
              }}
              onAccountChange={variant === 'journal' ? setDebitAccountId : setCreditAccountId}
              accountRequired
            />
            <SideFields
              label={rightLabel}
              branchId={branchId}
              categoryId={variant === 'journal' ? creditCategoryId : debitCategoryId}
              accountId={variant === 'journal' ? creditAccountId : debitAccountId}
              balance={
                variant === 'journal'
                  ? (creditAccount ? formatLedgerBalance(accountBalance(creditAccount)) : '')
                  : (debitAccount ? formatLedgerBalance(accountBalance(debitAccount)) : '')
              }
              categories={variant === 'journal' ? creditCategories : debitCategories}
              accounts={accounts}
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
            <WorkspaceCloseButton />
            <Button type="submit" variant="accent" size="sm" loading={saving}>
              Save
            </Button>
          </div>
        </form>
      </div>

      <div className="mt-8">
        <h2 className="mb-4 font-display text-sm font-bold text-brand">{RECENT_HEADINGS[variant]}</h2>
        <DataTable
          columns={[
            { key: 'number', header: 'Voucher #', render: (r) => String(r.number ?? r.id) },
            {
              key: 'parties',
              header: variant === 'journal' ? 'Debit / Credit' : 'From / To',
              render: (r) => voucherPartyLabel(r, variant),
            },
            { key: 'amount', header: 'Amount', render: (r) => formatPKR(Number(r.amount)) },
            { key: 'createdAt', header: 'Date', render: (r) => formatInvoiceListDate(r) },
            {
              key: 'actions',
              header: '',
              render: (r) => (
                <Button size="sm" variant="secondary" onClick={() => setViewVoucher(r)}>
                  View Voucher
                </Button>
              ),
            },
          ]}
          data={recentVouchers}
          emptyMessage={`No ${variant} vouchers yet`}
        />
      </div>

      <Modal
        open={viewVoucher !== null}
        onClose={() => setViewVoucher(null)}
        title={viewVoucher ? `${TYPE_LABELS[viewVoucher.type as VoucherType]} Voucher` : 'Voucher'}
        size="lg"
      >
        {viewVoucher && (
          <VoucherDetailCard
            voucher={viewVoucher}
            deleting={deleting}
            updating={updating}
            onCancel={handleCancelVoucher}
            onUpdateAmount={handleUpdateVoucherAmount}
            cancelDisabled={!canDelete}
            updateDisabled={!canUpdate}
          />
        )}
      </Modal>

      <WorkspaceCloseBar className="mt-8" />
    </div>
  );
}
