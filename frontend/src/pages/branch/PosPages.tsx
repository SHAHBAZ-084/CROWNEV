import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { branchApi } from '../../api/client';
import { useToast } from '../../contexts/ToastContext';
import { LegacyVoucherScreen } from '../../components/pos/LegacyVoucherForm';
import { ViewVoucherPanel } from '../../components/pos/ViewVoucherPanel';
import { PageHeader } from '../../components/layout/PageTransition';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Input, Select } from '../../components/ui/Input';
import { DataTable } from '../../components/ui/DataTable';
import { TablePagination } from '../../components/ui/TablePagination';
import { usePagination } from '../../hooks/usePagination';
import { FormActions, RowActions, useDeleteConfirm } from '../../components/crud/CrudHelpers';
import { SearchSelect, type SearchSelectOption } from '../../components/ui/SearchSelect';
import { formatPKR, formatLedgerBalance, splitTrialBalanceAmount, formatDate } from '../../lib/format';
import { exportLedgerReport, exportTrialBalanceReport } from '../../lib/reportExport';
import { FileSpreadsheet, FileText } from 'lucide-react';

type Row = Record<string, unknown>;

function useBranchId() {
  const { user } = useAuth();
  return user?.branchId ?? null;
}

export function PosReceiptVoucherPage() {
  const branchId = useBranchId();
  return <LegacyVoucherScreen type="RECEIPT" variant="receipt" title="Receipt Voucher" branchId={branchId} />;
}

export function PosPaymentVoucherPage() {
  const branchId = useBranchId();
  return <LegacyVoucherScreen type="PAYMENT" variant="payment" title="Payment Voucher" branchId={branchId} />;
}

export function PosJournalVoucherPage() {
  const branchId = useBranchId();
  return <LegacyVoucherScreen type="JOURNAL" variant="journal" title="Journal Voucher" branchId={branchId} />;
}

export function PosViewVoucherPage() {
  const branchId = useBranchId();
  const [params] = useSearchParams();
  const typeParam = params.get('type');
  const defaultType = (typeParam === 'RECEIPT' || typeParam === 'PAYMENT' || typeParam === 'JOURNAL')
    ? typeParam
    : '';

  return (
    <div className="w-full max-w-5xl">
      <div className="rounded-[var(--radius-card)] border border-border bg-white p-6 shadow-sm lg:p-8">
        <div className="mb-6 border-b border-border/60 pb-5">
          <h1 className="font-display text-xl font-bold text-brand">View Voucher</h1>
          <p className="mt-0.5 text-sm text-text-muted">Search by voucher number and category</p>
        </div>
        <ViewVoucherPanel branchId={branchId} defaultType={defaultType} />
      </div>
    </div>
  );
}

export function PosAccountsPage() {
  const branchId = useBranchId();
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<Row[]>([]);
  const [categories, setCategories] = useState<Row[]>([]);
  const [modal, setModal] = useState<'account' | 'category' | null>(null);
  const [viewCategory, setViewCategory] = useState<Row | null>(null);
  const [presetCategoryId, setPresetCategoryId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const categoryAccounts = useMemo(() => {
    if (!viewCategory) return [];
    const categoryId = Number(viewCategory.id);
    return accounts.filter((a) => {
      const cid = a.categoryId ?? (a.category as { id?: number })?.id;
      return Number(cid) === categoryId;
    });
  }, [accounts, viewCategory]);

  function openAddAccount(categoryId?: number) {
    setPresetCategoryId(categoryId ?? null);
    setModal('account');
  }

  function closeAccountModal() {
    setModal(null);
    setPresetCategoryId(null);
  }

  const reload = useCallback(() => {
    if (!branchId) return;
    branchApi.accounts(branchId).then((r) => setAccounts(r as Row[])).catch((err) => {
      toast(err instanceof Error ? err.message : 'Failed to load accounts', 'error');
    });
    branchApi.accountingCategories(branchId).then((r) => setCategories(r as Row[])).catch((err) => {
      toast(err instanceof Error ? err.message : 'Failed to load categories', 'error');
    });
  }, [branchId, toast]);

  useEffect(() => { reload(); }, [reload]);

  async function handleAccount(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!branchId) return;
    const fd = new FormData(e.currentTarget);
    setSaving(true);
    try {
      await branchApi.createAccount(branchId, {
        categoryId: parseInt(String(fd.get('categoryId')), 10),
        name: String(fd.get('name')),
        openingBalance: parseFloat(String(fd.get('openingBalance') || '0')) || 0,
      });
      toast('Account created', 'success');
      closeAccountModal();
      reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleCategory(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!branchId) return;
    const fd = new FormData(e.currentTarget);
    setSaving(true);
    try {
      await branchApi.createAccountCategory(branchId, String(fd.get('name')));
      toast('Category added', 'success');
      setModal(null);
      reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed', 'error');
    } finally {
      setSaving(false);
    }
  }

  const accountDelete = useDeleteConfirm<Row>(
    async (row) => {
      if (!branchId) return;
      await branchApi.deleteAccount(branchId, Number(row.id));
      toast('Account removed', 'success');
      reload();
    },
    {
      message: (row) =>
        `Remove account "${String(row.name)}" from the chart? Ledger entries will be kept; only voucher cancellation removes entries.`,
    },
  );

  const categoryDelete = useDeleteConfirm<Row>(
    async (row) => {
      if (!branchId) return;
      await branchApi.deleteAccountCategory(branchId, Number(row.id));
      toast('Category removed', 'success');
      if (viewCategory?.id === row.id) setViewCategory(null);
      reload();
    },
    {
      message: (row) =>
        `Remove category "${String(row.name)}"? It must have no active accounts.`,
    },
  );

  return (
    <div>
      <PageHeader
        title="Accounts"
        subtitle="Chart of accounts for this branch"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => setModal('category')}>+ Category</Button>
            <Button variant="accent" size="sm" onClick={() => openAddAccount()}>Add Account</Button>
          </div>
        }
      />
      <div className="mb-6">
        <h2 className="mb-3 text-sm font-semibold text-text">Categories</h2>
        <DataTable
          compact
          columns={[
            { key: 'name', header: 'Name' },
            {
              key: 'accounts',
              header: 'Accounts',
              className: 'w-24',
              render: (r) => String((r.accounts as unknown[] | undefined)?.length ?? 0),
            },
            {
              key: 'actions',
              header: '',
              align: 'right',
              className: 'w-44',
              render: (r) => (
                <div className="flex items-center justify-end gap-1">
                  <button
                    type="button"
                    onClick={() => setViewCategory(r)}
                    className="inline-flex items-center rounded-lg border border-brand px-2 py-1 text-xs font-medium text-brand hover:bg-brand/5"
                  >
                    View Accounts
                  </button>
                  <RowActions
                    deleteLabel="Delete"
                    onDelete={() => categoryDelete.setTarget(r)}
                  />
                </div>
              ),
            },
          ]}
          data={categories}
          emptyMessage="No categories yet. Click + Category to add one"
        />
        {categoryDelete.modal}
      </div>

      <Modal
        open={!!viewCategory}
        onClose={() => setViewCategory(null)}
        title={viewCategory ? `Accounts: ${String(viewCategory.name)}` : 'Accounts'}
        size="lg"
      >
        <div className="mb-4 flex justify-end">
          <Button
            size="sm"
            variant="accent"
            onClick={() => viewCategory && openAddAccount(Number(viewCategory.id))}
          >
            Add Account
          </Button>
        </div>
        <DataTable
          compact
          columns={[
            { key: 'code', header: 'Code' },
            { key: 'name', header: 'Name' },
            { key: 'type', header: 'Type' },
            {
              key: 'balance',
              header: 'Balance',
              render: (r) => formatLedgerBalance(Number((r.ledger as { balance: number })?.balance ?? 0)),
            },
            {
              key: 'actions',
              header: '',
              align: 'right',
              className: 'w-28',
              render: (r) => (
                <RowActions
                  deleteLabel="Delete"
                  onDelete={() => accountDelete.setTarget(r)}
                />
              ),
            },
          ]}
          data={categoryAccounts}
          emptyMessage="No accounts in this category yet"
        />
        {accountDelete.modal}
      </Modal>

      <Modal open={modal === 'account'} onClose={closeAccountModal} title="Add Account">
        <form key={presetCategoryId ?? 'new'} onSubmit={handleAccount} className="space-y-4">
          <div className="flex items-end justify-between gap-2">
            <div className="flex-1">
              <Select
                name="categoryId"
                label="Category"
                required
                defaultValue={presetCategoryId ? String(presetCategoryId) : ''}
              >
                <option value="">Select category</option>
                {categories.map((c) => <option key={String(c.id)} value={String(c.id)}>{String(c.name)}</option>)}
              </Select>
            </div>
            <Button type="button" variant="secondary" size="sm" className="mb-0.5 shrink-0" onClick={() => setModal('category')}>+ Category</Button>
          </div>
          <Input name="name" label="Account Name" required />
          <Input name="openingBalance" label="Opening Balance" type="number" step="0.01" min="0" defaultValue="0" />
          <FormActions onCancel={closeAccountModal} loading={saving} />
        </form>
      </Modal>

      <Modal open={modal === 'category'} onClose={() => setModal(null)} title="Add Category">
        <form onSubmit={handleCategory} className="space-y-4">
          <Input name="name" label="Category Name" required placeholder="e.g. Current Assets" />
          <FormActions onCancel={() => setModal(null)} loading={saving} />
        </form>
      </Modal>
    </div>
  );
}

export function PosCustomersPage() {
  const branchId = useBranchId();
  const { toast } = useToast();
  const [customers, setCustomers] = useState<Row[]>([]);
  const [modal, setModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const reload = useCallback(() => {
    if (!branchId) return;
    branchApi.walkInCustomers(branchId).then((r) => setCustomers(r.data as Row[])).catch(console.error);
  }, [branchId]);

  useEffect(() => { reload(); }, [reload]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!branchId) return;
    const fd = new FormData(e.currentTarget);
    setSaving(true);
    try {
      await branchApi.createWalkInCustomer(branchId, {
        name: String(fd.get('name')),
        phone: String(fd.get('phone') || '') || undefined,
        cnic: String(fd.get('cnic') || '') || undefined,
        address: String(fd.get('address') || '') || undefined,
      });
      toast('Customer added', 'success');
      setModal(false);
      reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed', 'error');
    } finally {
      setSaving(false);
    }
  }

  const customerDelete = useDeleteConfirm<Row>(
    async (row) => {
      if (!branchId) return;
      await branchApi.deleteWalkInCustomer(branchId, Number(row.id));
      toast('Customer removed', 'success');
      reload();
    },
    {
      message: (row) =>
        `Remove customer "${String(row.name)}"? Their ledger history will be kept.`,
    },
  );

  return (
    <div>
      <PageHeader title="Customers" subtitle="Walk in and POS customers" action={<Button variant="accent" onClick={() => setModal(true)}>Add Customer</Button>} />
      <DataTable
        columns={[
          { key: 'name', header: 'Name' },
          { key: 'phone', header: 'Phone' },
          { key: 'cnic', header: 'CNIC' },
          { key: 'balance', header: 'Balance', render: (r) => formatPKR(Number(r.balance ?? 0)) },
          {
            key: 'actions',
            header: '',
            render: (r) => (
              <RowActions
                deleteLabel="Delete"
                onDelete={() => customerDelete.setTarget(r)}
              />
            ),
          },
        ]}
        data={customers}
        emptyMessage="No customers yet"
      />
      {customerDelete.modal}
      <Modal open={modal} onClose={() => setModal(false)} title="Add Customer">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input name="name" label="Full Name" required />
          <Input name="phone" label="Phone" />
          <Input name="cnic" label="CNIC" placeholder="12345-1234567-1" />
          <Input name="address" label="Address" />
          <FormActions onCancel={() => setModal(false)} loading={saving} />
        </form>
      </Modal>
    </div>
  );
}

export function PosSaleInvoicePage() {
  const { toast } = useToast();
  const [orders, setOrders] = useState<Row[]>([]);

  useEffect(() => {
    branchApi.orders().then((r) => setOrders(r.data as unknown as Row[])).catch(console.error);
  }, []);

  async function viewInvoice(id: number) {
    try {
      const inv = await branchApi.orderInvoice(id);
      const w = window.open('', '_blank');
      if (w) {
        w.document.write(`<pre style="font-family:sans-serif;padding:24px">${JSON.stringify(inv, null, 2)}</pre>`);
        w.document.close();
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to load invoice', 'error');
    }
  }

  return (
    <div>
      <PageHeader title="Sale Invoice" subtitle="Sales and POS order invoices" />
      <DataTable
        columns={[
          { key: 'trackingId', header: 'Tracking' },
          { key: 'type', header: 'Type' },
          { key: 'total', header: 'Total', render: (r) => formatPKR(Number(r.total)) },
          { key: 'createdAt', header: 'Date', render: (r) => String(r.createdAt).slice(0, 10) },
          {
            key: 'actions',
            header: '',
            render: (r) => (
              <Button size="sm" variant="secondary" onClick={() => viewInvoice(Number(r.id))}>View Invoice</Button>
            ),
          },
        ]}
        data={orders}
      />
    </div>
  );
}

export function PosPurchaseInvoicePage() {
  const branchId = useBranchId();
  const [purchases, setPurchases] = useState<Row[]>([]);

  useEffect(() => {
    if (!branchId) return;
    branchApi.purchases(branchId).then((r) => setPurchases(r.data as Row[])).catch(console.error);
  }, [branchId]);

  return (
    <div>
      <PageHeader title="Purchase Invoice" subtitle="Supplier purchase invoices" />
      <DataTable
        columns={[
          { key: 'invoiceNumber', header: 'Invoice #' },
          { key: 'supplier', header: 'Supplier', render: (r) => (r.supplier as { name: string })?.name ?? '' },
          { key: 'total', header: 'Total', render: (r) => formatPKR(Number(r.total ?? 0)) },
          { key: 'createdAt', header: 'Date', render: (r) => String(r.createdAt).slice(0, 10) },
        ]}
        data={purchases}
        emptyMessage="No purchase invoices yet"
      />
    </div>
  );
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

export function PosAccountLedgerPage() {
  const branchId = useBranchId();
  const { toast } = useToast();
  const [categories, setCategories] = useState<Row[]>([]);
  const [accounts, setAccounts] = useState<Row[]>([]);
  const [categoryId, setCategoryId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [ledger, setLedger] = useState<Row | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!branchId) return;
    Promise.all([
      branchApi.accountingCategories(branchId),
      branchApi.accounts(branchId),
    ])
      .then(([cats, accts]) => {
        setCategories(cats as Row[]);
        setAccounts(accts as Row[]);
      })
      .catch(console.error);
  }, [branchId]);

  const categoryOptions: SearchSelectOption[] = useMemo(
    () => categories.map((c) => ({ value: String(c.id), label: String(c.name) })),
    [categories],
  );

  const filteredAccounts = useMemo(
    () => (categoryId ? accounts.filter((a) => String(a.categoryId) === categoryId) : []),
    [accounts, categoryId],
  );

  const accountOptions: SearchSelectOption[] = useMemo(
    () => filteredAccounts.map((a) => ({
      value: String(a.id),
      label: String(a.name),
    })),
    [filteredAccounts],
  );

  function handleCategoryChange(id: string) {
    setCategoryId(id);
    setAccountId('');
    setLedger(null);
  }

  async function loadLedger() {
    if (!branchId || !accountId) {
      setLedger(null);
      return;
    }
    setLoading(true);
    try {
      const params: { fromDate?: string; toDate?: string } = {};
      if (fromDate) params.fromDate = fromDate;
      if (toDate) params.toDate = toDate;
      const data = await branchApi.ledger(branchId, parseInt(accountId, 10), params);
      setLedger(data as Row);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to load ledger', 'error');
      setLedger(null);
    } finally {
      setLoading(false);
    }
  }

  const rows = (ledger?.rows as LedgerRow[]) ?? [];
  const {
    page: ledgerPage,
    setPage: setLedgerPage,
    paginatedItems: paginatedLedgerRows,
    totalPages: ledgerTotalPages,
    totalItems: ledgerTotalItems,
    rangeStart: ledgerRangeStart,
    rangeEnd: ledgerRangeEnd,
    hasMultiplePages: ledgerHasMultiplePages,
  } = usePagination(rows);
  const summary = ledger?.summary as {
    periodOpening?: number;
    totalDebit?: number;
    totalCredit?: number;
    closingBalance?: number;
  } | undefined;
  const account = ledger?.account as { code?: string; name?: string; type?: string } | undefined;
  const accountLabel = account ? String(account.name) : 'Account';

  async function handleExport(format: 'excel' | 'pdf') {
    if (!ledger || rows.length === 0) return;
    await exportLedgerReport(
      format,
      accountLabel,
      rows,
      {
        totalDebit: summary?.totalDebit ?? 0,
        totalCredit: summary?.totalCredit ?? 0,
        closingBalance: summary?.closingBalance ?? Number(ledger.balance ?? 0),
      },
      { from: fromDate || undefined, to: toDate || undefined },
    );
  }

  return (
    <div>
      <PageHeader title="Account Ledger" subtitle="All transactions with running Dr / Cr balance" />
      <div className="mb-6 grid gap-4 lg:grid-cols-[1fr_1fr_auto_auto_auto] lg:items-end">
        <SearchSelect
          label="Category"
          value={categoryId}
          onChange={handleCategoryChange}
          options={categoryOptions}
          placeholder="Search category…"
        />
        <SearchSelect
          label="Account"
          value={accountId}
          onChange={(id) => {
            setAccountId(id);
            setLedger(null);
          }}
          options={accountOptions}
          placeholder={categoryId ? 'Search account…' : 'Choose category first'}
          disabled={!categoryId}
        />
        <Input label="From date" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
        <Input label="To date" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
        <Button type="button" variant="accent" size="sm" disabled={!accountId || loading} onClick={loadLedger}>
          Load ledger
        </Button>
      </div>
      {loading && <p className="text-sm text-text-muted">Loading ledger…</p>}
      {!loading && ledger && (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            {account && (
              <p className="text-sm text-text-muted">
                {String(account.name)}
                {account.type && <span className="ml-2 rounded bg-surface-alt px-2 py-0.5 text-xs">{String(account.type)}</span>}
              </p>
            )}
            {rows.length > 0 && (
              <div className="flex gap-2">
                <Button type="button" variant="secondary" size="sm" onClick={() => handleExport('excel')}>
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  Excel
                </Button>
                <Button type="button" variant="secondary" size="sm" onClick={() => handleExport('pdf')}>
                  <FileText className="h-3.5 w-3.5" />
                  PDF
                </Button>
              </div>
            )}
          </div>
          <div className="overflow-hidden rounded-xl border border-border bg-white">
            <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-alt/60 text-left text-xs uppercase tracking-wide text-text-muted">
                  <th className="px-3 py-3">Date</th>
                  <th className="px-3 py-3">Voucher#</th>
                  <th className="px-3 py-3">Ref#</th>
                  <th className="px-3 py-3">Type</th>
                  <th className="px-3 py-3">Description</th>
                  <th className="px-3 py-3 text-right">Debit</th>
                  <th className="px-3 py-3 text-right">Credit</th>
                  <th className="px-3 py-3 text-right">Balance</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-text-muted">No entries in this period</td>
                  </tr>
                ) : (
                  paginatedLedgerRows.map((r, i) => (
                    <tr
                      key={`${r.voucherNo}-${r.date}-${i}`}
                      className={`border-b border-border/40 ${r.isOpeningRow ? 'bg-surface-alt/20 font-medium' : ''}`}
                    >
                      <td className="px-3 py-2.5 whitespace-nowrap">{r.date ? formatDate(r.date) : ''}</td>
                      <td className="px-3 py-2.5 font-mono text-xs">{r.voucherNo}</td>
                      <td className="px-3 py-2.5 text-text-muted">{r.ref || ''}</td>
                      <td className="px-3 py-2.5">{r.type}</td>
                      <td className="px-3 py-2.5 text-text-muted">{r.description || ''}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{r.debit > 0 ? formatPKR(r.debit) : ''}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{r.credit > 0 ? formatPKR(r.credit) : ''}</td>
                      <td className="px-3 py-2.5 text-right font-medium tabular-nums text-brand">
                        {formatLedgerBalance(r.balance)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {rows.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-border bg-surface-alt/40 font-semibold">
                    <td className="px-3 py-3" colSpan={5}>Total / Closing</td>
                    <td className="px-3 py-3 text-right tabular-nums">{formatPKR(summary?.totalDebit ?? 0)}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{formatPKR(summary?.totalCredit ?? 0)}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-brand">
                      {formatLedgerBalance(summary?.closingBalance ?? Number(ledger.balance ?? 0))}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
            </div>
            {ledgerHasMultiplePages && (
              <TablePagination
                page={ledgerPage}
                totalPages={ledgerTotalPages}
                totalItems={ledgerTotalItems}
                rangeStart={ledgerRangeStart}
                rangeEnd={ledgerRangeEnd}
                onPageChange={setLedgerPage}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}

export function PosDetailTrialBalancePage() {
  const branchId = useBranchId();
  const [rows, setRows] = useState<Row[]>([]);
  const [totals, setTotals] = useState({ totalDebit: 0, totalCredit: 0, isBalanced: true });

  useEffect(() => {
    if (!branchId) return;
    branchApi.trialBalance(branchId).then((r) => {
      const data = r as Row & { accounts?: Row[]; totalDebit?: number; totalCredit?: number; isBalanced?: boolean };
      const accounts = Array.isArray(data) ? data : (data.accounts ?? []);
      setRows(accounts as Row[]);
      if (!Array.isArray(data)) {
        setTotals({
          totalDebit: Number(data.totalDebit ?? 0),
          totalCredit: Number(data.totalCredit ?? 0),
          isBalanced: Boolean(data.isBalanced ?? true),
        });
      } else {
        const totalDebit = accounts.reduce((s, row) => s + Number(row.debit ?? splitTrialBalanceAmount(row.balance).debit), 0);
        const totalCredit = accounts.reduce((s, row) => s + Number(row.credit ?? splitTrialBalanceAmount(row.balance).credit), 0);
        setTotals({ totalDebit, totalCredit, isBalanced: Math.abs(totalDebit - totalCredit) < 0.01 });
      }
    }).catch(console.error);
  }, [branchId]);

  const activeRows = rows.filter((r) => {
    const d = Number(r.debit ?? splitTrialBalanceAmount(r.balance as number | string).debit);
    const c = Number(r.credit ?? splitTrialBalanceAmount(r.balance as number | string).credit);
    return d > 0 || c > 0;
  });

  const {
    page: trialPage,
    setPage: setTrialPage,
    paginatedItems: paginatedTrialRows,
    totalPages: trialTotalPages,
    totalItems: trialTotalItems,
    rangeStart: trialRangeStart,
    rangeEnd: trialRangeEnd,
    hasMultiplePages: trialHasMultiplePages,
  } = usePagination(activeRows);

  const exportRows = activeRows.map((r) => ({
    accountCode: String(r.accountCode),
    accountName: String(r.accountName),
    accountType: String(r.accountType),
    debit: Number(r.debit ?? splitTrialBalanceAmount(r.balance as number | string).debit),
    credit: Number(r.credit ?? splitTrialBalanceAmount(r.balance as number | string).credit),
  }));

  async function handleExport(format: 'excel' | 'pdf') {
    if (exportRows.length === 0) return;
    await exportTrialBalanceReport(format, exportRows, totals);
  }

  return (
    <div>
      <PageHeader title="Detail Trial Balance" subtitle="Total Debit must equal Total Credit across all accounts" />
      {activeRows.length > 0 && (
        <div className="mb-4 flex justify-end gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={() => handleExport('excel')}>
            <FileSpreadsheet className="h-3.5 w-3.5" />
            Excel
          </Button>
          <Button type="button" variant="secondary" size="sm" onClick={() => handleExport('pdf')}>
            <FileText className="h-3.5 w-3.5" />
            PDF
          </Button>
        </div>
      )}
      <div className="overflow-hidden rounded-xl border border-border bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-alt/60 text-left text-xs uppercase tracking-wide text-text-muted">
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Account</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3 text-right">Debit (Dr)</th>
              <th className="px-4 py-3 text-right">Credit (Cr)</th>
            </tr>
          </thead>
          <tbody>
            {activeRows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-text-muted">No accounts with balance</td>
              </tr>
            ) : (
              paginatedTrialRows.map((r) => {
                const d = Number(r.debit ?? splitTrialBalanceAmount(r.balance as number | string).debit);
                const c = Number(r.credit ?? splitTrialBalanceAmount(r.balance as number | string).credit);
                return (
                  <tr key={String(r.accountId ?? r.accountCode)} className="border-b border-border/40">
                    <td className="px-4 py-2.5 font-mono text-xs">{String(r.accountCode)}</td>
                    <td className="px-4 py-2.5">{String(r.accountName)}</td>
                    <td className="px-4 py-2.5 text-text-muted">{String(r.accountType)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{d > 0 ? formatPKR(d) : ''}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{c > 0 ? formatPKR(c) : ''}</td>
                  </tr>
                );
              })
            )}
          </tbody>
          {activeRows.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-border bg-surface-alt/40 font-bold">
                <td className="px-4 py-3" colSpan={3}>Total</td>
                <td className="px-4 py-3 text-right tabular-nums text-brand">{formatPKR(totals.totalDebit)}</td>
                <td className="px-4 py-3 text-right tabular-nums text-brand">{formatPKR(totals.totalCredit)}</td>
              </tr>
            </tfoot>
          )}
        </table>
        {trialHasMultiplePages && (
          <TablePagination
            page={trialPage}
            totalPages={trialTotalPages}
            totalItems={trialTotalItems}
            rangeStart={trialRangeStart}
            rangeEnd={trialRangeEnd}
            onPageChange={setTrialPage}
          />
        )}
      </div>
      {activeRows.length > 0 && (
        <div className={`mt-4 rounded-xl border px-4 py-3 text-sm ${totals.isBalanced ? 'border-success/30 bg-success/5 text-success' : 'border-warning/30 bg-warning/5 text-warning'}`}>
          {totals.isBalanced
            ? 'Trial balance is balanced. Total Debit equals Total Credit.'
            : 'Trial balance is out of balance. Review vouchers and ledger entries.'}
        </div>
      )}
    </div>
  );
}
