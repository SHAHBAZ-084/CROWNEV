import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { branchApi } from '../../api/client';
import { useToast } from '../../contexts/ToastContext';
import { useBranchPermission } from '../../hooks/useBranchPermission';
import { formatDate, formatPKR } from '../../lib/format';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

type Row = Record<string, unknown>;
export type VoucherType = 'RECEIPT' | 'PAYMENT' | 'JOURNAL';

export const TYPE_LABELS: Record<VoucherType, string> = {
  RECEIPT: 'Receipt',
  PAYMENT: 'Payment',
  JOURNAL: 'Journal',
};

function accountLabel(account: Row | undefined) {
  if (!account) return '';
  return String(account.name);
}

function userName(user: { firstName?: string; lastName?: string } | undefined) {
  if (!user) return null;
  return [user.firstName, user.lastName].filter(Boolean).join(' ');
}

export function VoucherDetailCard({
  voucher,
  deleting,
  updating,
  onCancel,
  onUpdateAmount,
  cancelDisabled,
  updateDisabled,
}: {
  voucher: Row;
  deleting: boolean;
  updating?: boolean;
  onCancel: () => void;
  onUpdateAmount?: (amount: number) => void | Promise<void>;
  cancelDisabled?: boolean;
  updateDisabled?: boolean;
}) {
  const voucherType = voucher.type as VoucherType;
  const status = String(voucher.status ?? 'ACTIVE');
  const isCancelled = status === 'CANCELLED';
  const debitAccount = voucher.debitAccount as Row | undefined;
  const creditAccount = voucher.creditAccount as Row | undefined;
  const createdBy = voucher.createdBy as { firstName?: string; lastName?: string } | undefined;
  const deletedBy = voucher.deletedBy as { firstName?: string; lastName?: string } | undefined;
  const modifiedBy = voucher.modifiedBy as { firstName?: string; lastName?: string } | undefined;

  const [editingAmount, setEditingAmount] = useState(false);
  const [amountDraft, setAmountDraft] = useState(String(voucher.amount ?? ''));

  useEffect(() => {
    setEditingAmount(false);
    setAmountDraft(String(voucher.amount ?? ''));
  }, [voucher.id, voucher.amount]);

  const rows = useMemo(() => {
    if (voucherType === 'JOURNAL') {
      return [
        { label: 'Debit', value: accountLabel(debitAccount) },
        { label: 'Credit', value: accountLabel(creditAccount) },
      ];
    }
    return [
      { label: 'From', value: accountLabel(creditAccount) },
      { label: 'To', value: accountLabel(debitAccount) },
    ];
  }, [voucherType, debitAccount, creditAccount]);

  const auditParts: string[] = [];
  const creator = userName(createdBy);
  if (creator) auditParts.push(`Created by ${creator}`);
  const modifier = userName(modifiedBy);
  if (modifier && voucher.updatedAt && voucher.updatedAt !== voucher.createdAt) {
    auditParts.push(`Updated by ${modifier} on ${formatDate(String(voucher.updatedAt))}`);
  }
  if (isCancelled && deletedBy) {
    const canceller = userName(deletedBy);
    if (canceller && voucher.deletedAt) {
      auditParts.push(`Cancelled by ${canceller} on ${formatDate(String(voucher.deletedAt))}`);
    }
  }

  function startEditAmount() {
    setAmountDraft(String(voucher.amount ?? ''));
    setEditingAmount(true);
  }

  function cancelEditAmount() {
    setAmountDraft(String(voucher.amount ?? ''));
    setEditingAmount(false);
  }

  async function submitAmount(e: FormEvent) {
    e.preventDefault();
    const amount = parseFloat(amountDraft);
    if (!Number.isFinite(amount) || amount <= 0) return;
    await onUpdateAmount?.(amount);
    setEditingAmount(false);
  }

  return (
    <div className="rounded-xl border border-border bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold text-text">
              {TYPE_LABELS[voucherType]} #{String(voucher.number ?? voucher.id)}
            </h2>
            {isCancelled ? (
              <span className="rounded-md bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning">
                Cancelled
              </span>
            ) : (
              <span className="rounded-md bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
                Active
              </span>
            )}
          </div>
          <p className="mt-0.5 text-sm text-text-muted">{formatDate(String(voucher.createdAt))}</p>
        </div>
        {!isCancelled && (
          <div className="flex flex-wrap items-center gap-2">
            {onUpdateAmount && !editingAmount && !updateDisabled ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={startEditAmount}
              >
                <Pencil className="h-3.5 w-3.5" />
                Update
              </Button>
            ) : null}
            {!cancelDisabled ? (
              <Button
                type="button"
                variant="danger"
                size="sm"
                loading={deleting}
                disabled={editingAmount}
                onClick={onCancel}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Cancel
              </Button>
            ) : null}
          </div>
        )}
      </div>

      <dl className="divide-y divide-border/60 px-5">
        {rows.map((row) => (
          <div key={row.label} className="grid gap-1 py-3 sm:grid-cols-[120px_1fr] sm:gap-4">
            <dt className="text-sm text-text-muted">{row.label}</dt>
            <dd className="text-sm font-medium text-text">{row.value}</dd>
          </div>
        ))}
        <div className="grid gap-1 py-3 sm:grid-cols-[120px_1fr] sm:gap-4">
          <dt className="text-sm text-text-muted">Amount</dt>
          <dd className="text-sm font-semibold text-text">
            {editingAmount ? (
              <form onSubmit={submitAmount} className="flex flex-wrap items-end gap-2">
                <div className="min-w-[160px] flex-1">
                  <Input
                    label=""
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={amountDraft}
                    onChange={(e) => setAmountDraft(e.target.value)}
                    placeholder="Amount (PKR)"
                  />
                </div>
                <Button type="submit" variant="accent" size="sm" loading={updating}>
                  Save
                </Button>
                <Button type="button" variant="secondary" size="sm" onClick={cancelEditAmount}>
                  Discard
                </Button>
              </form>
            ) : (
              <>
                {formatPKR(Number(voucher.amount))}
                <p className="mt-1 text-xs font-normal text-text-muted">
                  Debit and credit entries use the same amount; accounts cannot be changed here.
                </p>
              </>
            )}
          </dd>
        </div>
        {voucher.reference ? (
          <div className="grid gap-1 py-3 sm:grid-cols-[120px_1fr] sm:gap-4">
            <dt className="text-sm text-text-muted">Ref #</dt>
            <dd className="text-sm text-text">{String(voucher.reference)}</dd>
          </div>
        ) : null}
        {voucher.description ? (
          <div className="grid gap-1 py-3 sm:grid-cols-[120px_1fr] sm:gap-4">
            <dt className="text-sm text-text-muted">Description</dt>
            <dd className="text-sm text-text">{String(voucher.description)}</dd>
          </div>
        ) : null}
      </dl>

      {auditParts.length > 0 && (
        <p className="border-t border-border px-5 py-3 text-xs text-text-muted">
          {auditParts.join(' · ')}
        </p>
      )}
    </div>
  );
}

export function ViewVoucherPanel({
  branchId,
  defaultType = '',
}: {
  branchId: number | null;
  defaultType?: VoucherType | '';
}) {
  const { toast } = useToast();
  const { canUpdate, canDelete } = useBranchPermission();
  const [vouchers, setVouchers] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [searched, setSearched] = useState(false);
  const [searchType, setSearchType] = useState<VoucherType | ''>(defaultType);
  const [searchNo, setSearchNo] = useState('');
  const [result, setResult] = useState<Row | null | 'notfound'>(null);

  const loadVouchers = useCallback(() => {
    if (!branchId) return;
    setLoading(true);
    branchApi.vouchers(branchId)
      .then((rows) => setVouchers(rows as Row[]))
      .catch(() => setVouchers([]))
      .finally(() => setLoading(false));
  }, [branchId]);

  useEffect(() => {
    loadVouchers();
  }, [loadVouchers]);

  useEffect(() => {
    setSearchType(defaultType);
  }, [defaultType]);

  function handleSearch(e: FormEvent) {
    e.preventDefault();
    const no = parseInt(searchNo.trim(), 10);
    if (!no) {
      setResult('notfound');
      setSearched(true);
      return;
    }
    const found = vouchers.find(
      (v) => Number(v.number ?? v.id) === no && (!searchType || v.type === searchType),
    );
    setResult(found ?? 'notfound');
    setSearched(true);
  }

  async function handleCancel() {
    if (!branchId || !result || result === 'notfound') return;
    const label = TYPE_LABELS[result.type as VoucherType] ?? 'Voucher';
    const voucherNo = String(result.number ?? result.id);
    if (!window.confirm(
      `Cancel ${label} #${voucherNo}? Reversal entries will be posted and account balances restored.`,
    )) return;

    setDeleting(true);
    try {
      const updated = await branchApi.deleteVoucher(branchId, Number(result.id));
      setResult(updated as Row);
      toast('Voucher cancelled. Books reversed', 'success');
      loadVouchers();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Cancel failed', 'error');
    } finally {
      setDeleting(false);
    }
  }

  async function handleUpdateAmount(amount: number) {
    if (!branchId || !result || result === 'notfound') return;
    const current = Number(result.amount);
    if (Math.abs(amount - current) < 0.005) {
      toast('Amount unchanged', 'info');
      return;
    }

    setUpdating(true);
    try {
      const updated = await branchApi.updateVoucherAmount(branchId, Number(result.id), amount);
      setResult(updated as Row);
      toast('Voucher amount updated', 'success');
      loadVouchers();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Update failed', 'error');
      throw err;
    } finally {
      setUpdating(false);
    }
  }

  const voucher = result && result !== 'notfound' ? result : null;

  return (
    <div className="space-y-6">
      <form onSubmit={handleSearch} className="grid gap-4 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
        <div className="space-y-1.5">
          <label htmlFor="view-voucher-type" className="block text-sm font-medium text-text">
            Category
          </label>
          <select
            id="view-voucher-type"
            value={searchType}
            onChange={(e) => setSearchType(e.target.value as VoucherType | '')}
            className="w-full rounded-xl border border-border bg-white px-4 py-2.5 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
          >
            <option value="">All types</option>
            <option value="RECEIPT">Receipt</option>
            <option value="PAYMENT">Payment</option>
            <option value="JOURNAL">Journal</option>
          </select>
        </div>
        <Input
          label="Voucher #"
          type="number"
          min="1"
          value={searchNo}
          onChange={(e) => setSearchNo(e.target.value)}
          placeholder="Enter voucher number"
          required
        />
        <Button type="submit" variant="accent" size="sm" loading={loading} className="lg:mb-0.5">
          Search
        </Button>
      </form>

      {searched && result === 'notfound' && (
        <p className="rounded-xl border border-border bg-surface-alt/50 px-4 py-3 text-sm text-text-muted">
          No voucher found for that number{searchType ? ` in ${TYPE_LABELS[searchType]}` : ''}.
        </p>
      )}

      {voucher && (
        <VoucherDetailCard
          voucher={voucher}
          deleting={deleting}
          updating={updating}
          onCancel={handleCancel}
          onUpdateAmount={handleUpdateAmount}
          cancelDisabled={!canDelete}
          updateDisabled={!canUpdate}
        />
      )}
    </div>
  );
}
