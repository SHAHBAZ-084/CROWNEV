import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { branchApi } from '../../api/client';
import { useToast } from '../../contexts/ToastContext';
import { LegacyVoucherScreen } from '../../components/pos/LegacyVoucherForm';
import { ViewVoucherPanel } from '../../components/pos/ViewVoucherPanel';
import { PageHeader } from '../../components/layout/PageTransition';
import { WorkspaceCloseBar } from '../../components/layout/WorkspaceCloseButton';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Input, Select } from '../../components/ui/Input';
import { DataTable } from '../../components/ui/DataTable';
import { TablePagination } from '../../components/ui/TablePagination';
import { usePagination } from '../../hooks/usePagination';
import { useDebounce } from '../../hooks/useDebounce';
import { useBranchPermission } from '../../hooks/useBranchPermission';
import { FormActions, RowActions, useDeleteConfirm } from '../../components/crud/CrudHelpers';
import { SearchSelect, type SearchSelectOption } from '../../components/ui/SearchSelect';
import { formatPKR, formatLedgerAmount, formatLedgerBalance, splitTrialBalanceAmount, formatDate } from '../../lib/format';
import { buildAccountSelectOptions, buildDedupedLabels } from '../../lib/dedupeLabel';
import { ProductItemMetaLines, productItemMetaFromProduct } from '../../lib/productItemMeta';
import { exportLedgerReport, exportTrialBalanceReport } from '../../lib/reportExport';
import {
  filterManualAccountCategories,
  isCustomersCategory,
  isProtectedCategory,
  isSuppliersCategory,
} from '../../lib/accountingCategories';
import { FileSpreadsheet, FileText, Plus, Trash2, Search, CalendarClock } from 'lucide-react';
import { InvoiceModalContent } from '../../components/invoice/SaleInvoice';
import { PurchaseInvoiceModalContent } from '../../components/invoice/PurchaseInvoice';
import { ServiceInvoiceModalContent } from '../../components/invoice/ServiceInvoice';
import { PosInvoiceRowActions } from '../../components/pos/PosInvoiceRowActions';
import { PurchaseInvoiceEditModal } from '../../components/pos/PurchaseInvoiceEditModal';
import { SaleInvoiceEditModal } from '../../components/pos/SaleInvoiceEditModal';
import {
  deletePurchaseInvoiceCompletely,
  deleteSaleInvoiceCompletely,
  deleteServiceInvoiceCompletely,
} from '../../lib/invoiceVouchers';
import type { InvoiceData, PurchaseInvoiceData, ServiceInvoiceData } from '../../types';

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
        <WorkspaceCloseBar className="mt-6" />
      </div>
    </div>
  );
}

export function PosAccountsPage() {
  const branchId = useBranchId();
  const { toast } = useToast();
  const { canDelete, restrictedTitle } = useBranchPermission();
  const [accounts, setAccounts] = useState<Row[]>([]);
  const [categories, setCategories] = useState<Row[]>([]);
  const [modal, setModal] = useState<'account' | 'category' | null>(null);
  const [viewCategory, setViewCategory] = useState<Row | null>(null);
  const [presetCategoryId, setPresetCategoryId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const viewingCustomers = isCustomersCategory(viewCategory);
  const viewingSuppliers = isSuppliersCategory(viewCategory);
  const viewingProtectedCategory = isProtectedCategory(viewCategory);

  const categoryAccounts = useMemo(() => {
    if (!viewCategory) return [];
    const categoryId = Number(viewCategory.id);
    return accounts.filter((a) => {
      const cid = a.categoryId ?? (a.category as { id?: number })?.id;
      return Number(cid) === categoryId;
    });
  }, [accounts, viewCategory]);

  const viewedAccounts = categoryAccounts;

  const manualAccountCategories = useMemo(
    () => filterManualAccountCategories(categories),
    [categories],
  );

  const presetCategoryValue = useMemo(() => {
    if (presetCategoryId == null) return '';
    return manualAccountCategories.some((c) => Number(c.id) === presetCategoryId)
      ? String(presetCategoryId)
      : '';
  }, [manualAccountCategories, presetCategoryId]);

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

  function openViewCategory(category: Row) {
    setViewCategory(category);
  }

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
              render: (r) => String(r.entryCount ?? (r.accounts as unknown[] | undefined)?.length ?? 0),
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
                    onClick={() => openViewCategory(r)}
                    className="inline-flex items-center rounded-lg border border-brand px-2 py-1 text-xs font-medium text-brand hover:bg-brand/5"
                  >
                    View Accounts
                  </button>
                  <RowActions
                    deleteLabel="Delete"
                    onDelete={() => {
                      if (isProtectedCategory(r)) {
                        toast(`The ${String(r.name)} category cannot be deleted`, 'error');
                        return;
                      }
                      categoryDelete.setTarget(r);
                    }}
                    deleteDisabled={!canDelete}
                    disabledTitle={restrictedTitle}
                  />
                </div>
              ),
            },
          ]}
          data={manualAccountCategories}
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
        {!viewingProtectedCategory && (
          <div className="mb-4 flex justify-end">
            <Button
              size="sm"
              variant="accent"
              onClick={() => viewCategory && openAddAccount(Number(viewCategory.id))}
            >
              Add Account
            </Button>
          </div>
        )}
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
            ...(!viewingProtectedCategory
              ? [{
                  key: 'actions',
                  header: '',
                  align: 'right' as const,
                  className: 'w-28',
                  render: (r: Row) => (
                    <RowActions
                      deleteLabel="Delete"
                      onDelete={() => accountDelete.setTarget(r)}
                      deleteDisabled={!canDelete}
                      disabledTitle={restrictedTitle}
                    />
                  ),
                }]
              : []),
          ]}
          data={viewedAccounts}
          emptyMessage={
            viewingCustomers
              ? 'No customer accounts yet. Add customers from the Customers menu.'
              : viewingSuppliers
                ? 'No supplier accounts yet. Add suppliers from the Suppliers menu.'
                : 'No accounts in this category yet'
          }
        />
        {accountDelete.modal}
      </Modal>

      <Modal open={modal === 'account'} onClose={closeAccountModal} title="Add Account">
        <form key={presetCategoryValue || 'new'} onSubmit={handleAccount} className="space-y-4">
          <div className="flex items-end justify-between gap-2">
            <div className="flex-1">
              <Select
                name="categoryId"
                label="Category"
                required
                defaultValue={presetCategoryValue}
              >
                <option value="">Select category</option>
                {manualAccountCategories.map((c) => (
                  <option key={String(c.id)} value={String(c.id)}>{String(c.name)}</option>
                ))}
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
      <WorkspaceCloseBar className="mt-8" />
    </div>
  );
}

const entityStatusBadge = (label: string) => (
  <span className="inline-flex rounded-full bg-surface-alt px-2.5 py-0.5 text-xs font-semibold capitalize text-brand">
    {label}
  </span>
);

const entityTableColumns = (
  thirdColumn: { key: string; header: string; render: (r: Row) => string },
  statusLabel: (r: Row) => string,
  onDelete: (r: Row) => void,
  deleteDisabled?: boolean,
  disabledTitle?: string,
  onEdit?: (r: Row) => void,
  editDisabled?: boolean,
) => [
  { key: 'name', header: 'Name' },
  { key: 'phone', header: 'Phone', render: (r: Row) => String(r.phone ?? '—') },
  thirdColumn,
  {
    key: 'status',
    header: 'Status',
    render: (r: Row) => entityStatusBadge(statusLabel(r)),
  },
  { key: 'balance', header: 'Balance', render: (r: Row) => formatPKR(Number(r.balance ?? 0)) },
  {
    key: 'actions',
    header: '',
    render: (r: Row) => (
      <RowActions
        onEdit={onEdit ? () => onEdit(r) : undefined}
        editDisabled={editDisabled}
        deleteLabel="Delete"
        onDelete={() => onDelete(r)}
        deleteDisabled={deleteDisabled}
        disabledTitle={disabledTitle}
      />
    ),
  },
];

export function PosCustomersPage() {
  const branchId = useBranchId();
  const { toast } = useToast();
  const { canUpdate, canDelete, restrictedTitle } = useBranchPermission();
  const [customers, setCustomers] = useState<Row[]>([]);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [saving, setSaving] = useState(false);
  const [cnic, setCnic] = useState('');
  const [cnicError, setCnicError] = useState('');

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [fatherName, setFatherName] = useState('');

  const [searchInput, setSearchInput] = useState('');
  const search = useDebounce(searchInput.trim(), 300);

  const reload = useCallback(() => {
    if (!branchId) return;
    branchApi.walkInCustomers(branchId, search ? { search } : undefined)
      .then((r) => setCustomers(r.data as Row[]))
      .catch(console.error);
  }, [branchId, search]);

  useEffect(() => { reload(); }, [reload]);

  function handleSearchSubmit(e: FormEvent) {
    e.preventDefault();
  }

  function normalizeCnic(value: string) {
    return value.replace(/\D/g, '');
  }

  function validateCnic(value: string): string | null {
    const digits = normalizeCnic(value);
    if (!digits) return 'CNIC is required';
    if (digits.length !== 13 || !/^\d+$/.test(digits)) return 'CNIC must be 13 digits';
    return null;
  }

  function openModal() {
    setEditing(null);
    setFirstName('');
    setLastName('');
    setFatherName('');
    setCnic('');
    setCnicError('');
    setModal(true);
  }

  function openEditModal(row: Row) {
    setEditing(row);
    const parts = String(row.name ?? '').trim().split(/\s+/);
    setFirstName(parts[0] ?? '');
    setLastName(parts.slice(1).join(' '));
    setFatherName(String(row.fatherName ?? ''));
    setCnic(String(row.cnic ?? ''));
    setCnicError('');
    setModal(true);
  }

  function closeModal() {
    setModal(false);
    setEditing(null);
    setFirstName('');
    setLastName('');
    setFatherName('');
    setCnic('');
    setCnicError('');
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!branchId) return;

    const validationError = validateCnic(cnic);
    if (validationError) {
      setCnicError(validationError);
      return;
    }

    const fd = new FormData(e.currentTarget);
    setSaving(true);
    setCnicError('');
    try {
      const data = {
        name: `${firstName.trim()} ${lastName.trim()}`.trim(),
        fatherName: fatherName.trim() || undefined,
        phone: String(fd.get('phone') || '') || undefined,
        cnic: normalizeCnic(cnic),
        address: String(fd.get('address') || '') || undefined,
      };
      if (editing) {
        await branchApi.updateWalkInCustomer(branchId, Number(editing.id), data);
        toast('Customer updated', 'success');
      } else {
        await branchApi.createWalkInCustomer(branchId, data);
        toast('Customer added', 'success');
      }
      closeModal();
      reload();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed';
      if (message === 'A customer with this CNIC already exists.') {
        setCnicError('This CNIC is already registered.');
      } else {
        toast(message, 'error');
      }
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
      <PageHeader title="Customers" subtitle="Walk-in and online customers (same database)" action={<Button variant="accent" onClick={openModal}>Add Customer</Button>} />
      
      <form onSubmit={handleSearchSubmit} className="mb-4 flex gap-2">
        <Input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search by CNIC or name…"
          className="max-w-xs"
        />
        <Button type="submit" variant="secondary">
          <Search className="h-4 w-4" />
        </Button>
        {search && (
          <Button type="button" variant="ghost" onClick={() => setSearchInput('')}>
            Clear
          </Button>
        )}
      </form>

      <DataTable
        columns={entityTableColumns(
          {
            key: 'cnic',
            header: 'CNIC',
            render: (r) => String(r.cnic ?? '—'),
          },
          (r) => String(r.type ?? 'WALK_IN').toLowerCase().replace('_', '-'),
          (r) => customerDelete.setTarget(r),
          !canDelete,
          restrictedTitle,
          (r) => openEditModal(r),
          !canUpdate,
        )}
        data={customers}
        emptyMessage="No customers yet"
      />
      {customerDelete.modal}
      <Modal open={modal} onClose={closeModal} title={editing ? 'Edit Customer' : 'Add Customer'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input label="First Name" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
            <Input label="Last Name" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
          </div>
          <Input label="Father Name" value={fatherName} onChange={(e) => setFatherName(e.target.value)} />
          <Input name="phone" label="Phone" defaultValue={editing ? String(editing.phone ?? '') : ''} />
          <Input
            name="cnic"
            label="CNIC"
            placeholder="1234567890123"
            inputMode="numeric"
            required
            value={cnic}
            onChange={(e) => {
              setCnic(e.target.value);
              if (cnicError) setCnicError('');
            }}
            onBlur={() => {
              const validationError = validateCnic(cnic);
              if (validationError && normalizeCnic(cnic)) setCnicError(validationError);
            }}
            error={cnicError}
          />
          <Input name="address" label="Address" defaultValue={editing ? String(editing.address ?? '') : ''} />
          <FormActions onCancel={closeModal} loading={saving} />
        </form>
      </Modal>
      <WorkspaceCloseBar className="mt-8" />
    </div>
  );
}

export function PosSuppliersPage() {
  const branchId = useBranchId();
  const { toast } = useToast();
  const { canUpdate, canDelete, restrictedTitle } = useBranchPermission();
  const [suppliers, setSuppliers] = useState<Row[]>([]);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [saving, setSaving] = useState(false);

  const [searchInput, setSearchInput] = useState('');
  const search = useDebounce(searchInput.trim(), 300);

  const reload = useCallback(() => {
    if (!branchId) return;
    branchApi.suppliers(branchId, search || undefined).then((r) => setSuppliers(r.data as Row[])).catch(console.error);
  }, [branchId, search]);

  useEffect(() => { reload(); }, [reload]);

  function handleSearchSubmit(e: FormEvent) {
    e.preventDefault();
  }

  function openModal() {
    setEditing(null);
    setModal(true);
  }

  function openEditModal(row: Row) {
    setEditing(row);
    setModal(true);
  }

  function closeModal() {
    setModal(false);
    setEditing(null);
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!branchId) return;
    const fd = new FormData(e.currentTarget);
    setSaving(true);
    try {
      const data = {
        name: String(fd.get('name')),
        contactPerson: String(fd.get('contactPerson') || '') || undefined,
        phone: String(fd.get('phone') || '') || undefined,
        email: String(fd.get('email') || '') || undefined,
        address: String(fd.get('address') || '') || undefined,
      };
      if (editing) {
        await branchApi.updateSupplier(Number(editing.id), data);
        toast('Supplier updated', 'success');
      } else {
        await branchApi.createSupplier({ branchId, ...data });
        toast('Supplier added', 'success');
      }
      closeModal();
      reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed', 'error');
    } finally {
      setSaving(false);
    }
  }

  const supplierDelete = useDeleteConfirm<Row>(
    async (row) => {
      if (!branchId) return;
      await branchApi.deleteSupplier(branchId, Number(row.id));
      toast('Supplier removed', 'success');
      reload();
    },
    {
      message: (row) =>
        `Remove supplier "${String(row.name)}"? Their ledger history will be kept.`,
    },
  );

  return (
    <div>
      <PageHeader title="Suppliers" subtitle="Manage branch suppliers" action={<Button variant="accent" onClick={openModal}>Add Supplier</Button>} />

      <form onSubmit={handleSearchSubmit} className="mb-4 flex gap-2">
        <Input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search by name, contact person, or phone…"
          className="max-w-xs"
        />
        <Button type="submit" variant="secondary">
          <Search className="h-4 w-4" />
        </Button>
        {search && (
          <Button type="button" variant="ghost" onClick={() => setSearchInput('')}>
            Clear
          </Button>
        )}
      </form>

      <DataTable
        columns={entityTableColumns(
          {
            key: 'contactPerson',
            header: 'Contact',
            render: (r) => String(r.contactPerson ?? '—'),
          },
          () => 'supplier',
          (r) => supplierDelete.setTarget(r),
          !canDelete,
          restrictedTitle,
          (r) => openEditModal(r),
          !canUpdate,
        )}
        data={suppliers}
        emptyMessage="No suppliers yet"
      />
      {supplierDelete.modal}
      <Modal open={modal} onClose={closeModal} title={editing ? 'Edit Supplier' : 'Add Supplier'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input name="name" label="Name" required defaultValue={editing ? String(editing.name ?? '') : ''} />
          <Input name="contactPerson" label="Contact Person" defaultValue={editing ? String(editing.contactPerson ?? '') : ''} />
          <Input name="phone" label="Phone" defaultValue={editing ? String(editing.phone ?? '') : ''} />
          <Input name="email" label="Email" type="email" defaultValue={editing ? String(editing.email ?? '') : ''} />
          <Input name="address" label="Address" defaultValue={editing ? String(editing.address ?? '') : ''} />
          <FormActions onCancel={closeModal} loading={saving} />
        </form>
      </Modal>
      <WorkspaceCloseBar className="mt-8" />
    </div>
  );
}

type SaleProduct = {
  id: string;
  name: string;
  type: 'BIKE' | 'PART';
  stockAtBranch: number;
  unitPrice: number;
  model?: string | null;
  brand?: { name: string } | null;
  category?: { name: string } | null;
  specs?: Record<string, unknown> | null;
};

type PurchaseProduct = {
  id: string;
  name: string;
  type: 'BIKE' | 'PART';
  model?: string | null;
  brand?: { name: string } | null;
  category?: { name: string } | null;
  specs?: Record<string, unknown> | null;
};

function ProductMetaHint({ product }: { product?: SaleProduct | PurchaseProduct | null }) {
  if (!product) return null;
  const meta = productItemMetaFromProduct(product);
  return <ProductItemMetaLines item={meta} subtextClassName="text-xs text-text-muted" />;
}

type SaleLine = {
  key: string;
  productId: string;
  quantity: number;
  unitPrice?: number;
  bikeChassisNumberId?: number;
};

function newSaleLine(): SaleLine {
  return { key: `${Date.now()}-${Math.random()}`, productId: '', quantity: 1 };
}

/** One bike unit on a purchase invoice line: chassis number is always required,
 * plus a choice of either engine number or motor number (never both). */
const COLOR_OTHER = '__other__';

type BikeUnit = {
  chassisNumber: string;
  numberType: 'ENGINE' | 'MOTOR';
  engineNumber: string;
  motorNumber: string;
  colorPick: string;
  customColor: string;
  purchasePrice?: string;
  meterReading?: string;
  condition?: string;
  comments?: string;
};

function newBikeUnit(): BikeUnit {
  return {
    chassisNumber: '',
    numberType: 'MOTOR',
    engineNumber: '',
    motorNumber: '',
    colorPick: '',
    customColor: '',
    purchasePrice: '',
    meterReading: '',
    condition: '',
    comments: '',
  };
}

function resizeBikeUnits(current: BikeUnit[] | undefined, qty: number): BikeUnit[] {
  const next = [...(current ?? [])];
  while (next.length < qty) next.push(newBikeUnit());
  return next.slice(0, qty);
}

type PurchaseLine = {
  key: string;
  productId: string;
  quantity: number;
  unitCost?: number;
  bikeUnits?: BikeUnit[];
};

function newPurchaseLine(): PurchaseLine {
  return { key: `${Date.now()}-${Math.random()}`, productId: '', quantity: 1 };
}

function isBankOrCashCategory(name: string) {
  const n = name.trim().toLowerCase();
  return n.includes('bank') || n.includes('cash');
}

export function PosSaleInvoicePage() {
  const branchId = useBranchId();
  const { toast } = useToast();
  const [customers, setCustomers] = useState<Row[]>([]);
  const [products, setProducts] = useState<SaleProduct[]>([]);
  const [orders, setOrders] = useState<Row[]>([]);
  const [customerId, setCustomerId] = useState('');
  const [lines, setLines] = useState<SaleLine[]>([newSaleLine()]);
  const [nextInvoiceNo, setNextInvoiceNo] = useState('…');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [bankCashAccounts, setBankCashAccounts] = useState<Row[]>([]);
  const [receivedAmount, setReceivedAmount] = useState('');
  const [receivedAccountId, setReceivedAccountId] = useState('');
  const [customerLedger, setCustomerLedger] = useState<{
    customer: { name: string; code: string; balance: number };
    rows: LedgerRow[];
    summary: { totalDebit: number; totalCredit: number; closingBalance: number };
  } | null>(null);
  const [loadingLedger, setLoadingLedger] = useState(false);
  const [invoiceModal, setInvoiceModal] = useState<number | null>(null);
  const [invoiceData, setInvoiceData] = useState<InvoiceData | null>(null);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [editOrderId, setEditOrderId] = useState<number | null>(null);
  const [chassisOptions, setChassisOptions] = useState<
    Record<string, { id: number; chassisNumber: string; engineNumber?: string | null; motorNumber?: string | null; color?: string | null }[]>
  >({});

  const reloadOrders = useCallback(() => {
    if (!branchId) return;
    branchApi.orders({ type: 'POS', limit: '2' })
      .then((r) => setOrders(r.data as unknown as Row[]))
      .catch(console.error);
  }, [branchId]);

  const reloadNextInvoiceNo = useCallback(() => {
    if (!branchId) return;
    branchApi.nextDocumentNumbers(branchId)
      .then((n) => setNextInvoiceNo(n.sale))
      .catch(console.error);
  }, [branchId]);

  useEffect(() => {
    if (!branchId) return;
    branchApi.walkInCustomers(branchId, { limit: '100' }).then((r) => setCustomers(r.data as Row[])).catch(console.error);
    branchApi.saleProducts(branchId).then(setProducts).catch(console.error);
    branchApi.accounts(branchId)
      .then((accounts) => setBankCashAccounts((accounts as Row[]).filter((a) => isBankOrCashCategory(String((a.category as Row | undefined)?.name ?? '')))))
      .catch(console.error);
    reloadOrders();
    reloadNextInvoiceNo();
  }, [branchId, reloadOrders, reloadNextInvoiceNo]);

  useEffect(() => {
    if (!branchId || !customerId) {
      setCustomerLedger(null);
      return;
    }
    let cancelled = false;
    setLoadingLedger(true);
    branchApi.customerLedger(branchId, parseInt(customerId, 10))
      .then((data) => {
        if (!cancelled) setCustomerLedger(data);
      })
      .catch((err) => {
        if (cancelled) return;
        toast(err instanceof Error ? err.message : 'Failed to load customer ledger', 'error');
        setCustomerLedger(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingLedger(false);
      });
    return () => { cancelled = true; };
  }, [branchId, customerId, toast]);

  const customerLabels = useMemo(
    () => buildDedupedLabels(customers, (c) => [
      c.cnic ? String(c.cnic) : '',
      c.fatherName ? `(S/O ${c.fatherName})` : '',
    ]),
    [customers],
  );
  const customerOptions: SearchSelectOption[] = useMemo(
    () => customers.map((c) => ({
      value: String(c.id),
      label: customerLabels.get(c.id) ?? String(c.name),
    })),
    [customers, customerLabels],
  );

  const productById = useMemo(
    () => new Map(products.map((p) => [p.id, p])),
    [products],
  );

  const lineDetails = useMemo(
    () => lines.map((line) => {
      const product = productById.get(line.productId);
      const qty = Math.max(1, line.quantity);
      const unitPrice = line.unitPrice ?? product?.unitPrice ?? 0;
      const maxQty = product?.stockAtBranch ?? 0;
      return {
        ...line,
        product,
        qty,
        unitPrice,
        maxQty,
        lineTotal: unitPrice * qty,
      };
    }),
    [lines, productById],
  );

  const grandTotal = useMemo(
    () => lineDetails.reduce((sum, l) => sum + (l.product ? l.lineTotal : 0), 0),
    [lineDetails],
  );

  function selectProductForLine(lineKey: string, productId: string) {
    if (!productId) {
      updateLine(lineKey, { productId: '', unitPrice: undefined, bikeChassisNumberId: undefined });
      setChassisOptions((prev) => {
        const next = { ...prev };
        delete next[lineKey];
        return next;
      });
      return;
    }
    const currentLine = lines.find((l) => l.key === lineKey);
    if (currentLine?.productId === productId) return;
    const product = productById.get(productId);
    if (product?.type === 'BIKE') {
      updateLine(lineKey, { productId, unitPrice: product.unitPrice, quantity: 1, bikeChassisNumberId: undefined });
      if (branchId) {
        branchApi.availableChassis(branchId, productId)
          .then((opts) => setChassisOptions((prev) => ({ ...prev, [lineKey]: opts })))
          .catch(console.error);
      }
      return;
    }
    const alreadySelected = lines.some((l) => l.key !== lineKey && l.productId === productId);
    if (alreadySelected) {
      toast('Product is already selected', 'error');
      return;
    }
    updateLine(lineKey, { productId, unitPrice: product?.unitPrice, bikeChassisNumberId: undefined });
  }

  function productOptionsForLine(lineKey: string): SearchSelectOption[] {
    const selectedPartIds = new Set(
      lines
        .filter((l) => l.key !== lineKey && l.productId)
        .map((l) => l.productId)
        .filter((id) => productById.get(id)?.type === 'PART'),
    );
    return products
      .filter((p) => p.type === 'BIKE' || !selectedPartIds.has(p.id))
      .map((p) => ({
        value: p.id,
        label: `${p.name} [${p.type}]`,
      }));
  }

  function updateLine(key: string, patch: Partial<SaleLine>) {
    setLines((prev) => prev.map((l) => {
      if (l.key !== key) return l;
      const next = { ...l, ...patch };
      if (productById.get(next.productId)?.type === 'BIKE' && patch.quantity !== undefined) {
        next.quantity = 1;
      }
      return next;
    }));
  }

  function removeLine(key: string) {
    setLines((prev) => (prev.length <= 1 ? prev : prev.filter((l) => l.key !== key)));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!branchId) return;
    if (!customerId) {
      toast('Select a customer', 'error');
      return;
    }
    const items = lineDetails
      .filter((l) => l.product)
      .map((l) => ({
        productId: l.productId,
        quantity: l.qty,
        unitPrice: Number(l.unitPrice),
        ...(l.product?.type === 'BIKE' && l.bikeChassisNumberId
          ? { bikeChassisNumberId: l.bikeChassisNumberId }
          : {}),
      }));
    if (items.length === 0) {
      toast('Add at least one product', 'error');
      return;
    }
    for (const l of lineDetails) {
      if (!l.product) continue;
      if (l.product.type === 'BIKE') {
        if (!l.bikeChassisNumberId) {
          toast(`Select a chassis number for ${l.product.name}`, 'error');
          return;
        }
        if (l.qty !== 1) {
          toast('Bike quantity must be 1 per line', 'error');
          return;
        }
      } else if (l.qty > l.maxQty) {
        toast(`Insufficient stock for ${l.product.name}. Available: ${l.maxQty}`, 'error');
        return;
      }
      if (l.unitPrice <= 0) {
        toast(`Enter a valid price for ${l.product.name}`, 'error');
        return;
      }
    }
    const chassisIds = lineDetails.map((l) => l.bikeChassisNumberId).filter(Boolean);
    if (new Set(chassisIds).size !== chassisIds.length) {
      toast('Duplicate chassis number selection', 'error');
      return;
    }
    const receivedNum = receivedAmount ? Number(receivedAmount) : 0;
    if (receivedNum > 0) {
      if (receivedNum > grandTotal) {
        toast('Received amount cannot exceed the invoice total', 'error');
        return;
      }
      if (!receivedAccountId) {
        toast('Select the bank or cash account the payment was received into', 'error');
        return;
      }
    }

    setSaving(true);
    try {
      const result = await branchApi.createSaleInvoice({
        branchId,
        customerId: parseInt(customerId, 10),
        items,
        notes: notes.trim() || undefined,
        receivedAmount: receivedNum > 0 ? receivedNum : undefined,
        receivedAccountId: receivedNum > 0 ? Number(receivedAccountId) : undefined,
      });
      const invoiceNo = String((result.order as { saleReference?: string }).saleReference ?? nextInvoiceNo);
      toast(
        receivedNum > 0
          ? `Sale saved. Invoice #${invoiceNo} — Rs. ${receivedNum.toLocaleString()} received`
          : `Sale saved. Invoice #${invoiceNo}`,
        'success',
      );
      setLines([newSaleLine()]);
      setNotes('');
      setReceivedAmount('');
      setReceivedAccountId('');
      branchApi.saleProducts(branchId).then(setProducts).catch(console.error);
      reloadOrders();
      reloadNextInvoiceNo();
      branchApi.customerLedger(branchId, parseInt(customerId, 10)).then(setCustomerLedger).catch(console.error);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to save sale', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function openInvoice(id: number) {
    setInvoiceModal(id);
    setInvoiceData(null);
    setInvoiceLoading(true);
    try {
      const inv = await branchApi.orderInvoice(id);
      setInvoiceData(inv);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to load invoice', 'error');
      setInvoiceModal(null);
    } finally {
      setInvoiceLoading(false);
    }
  }

  function bumpInvoiceLists() {
    reloadOrders();
    if (customerId && branchId) {
      branchApi.customerLedger(branchId, parseInt(customerId, 10)).then(setCustomerLedger).catch(console.error);
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Sale Invoice"
        subtitle="Create a sale. Customer debited, sale revenue credited, stock updated"
      />

      <form onSubmit={handleSubmit} className="rounded-[var(--radius-card)] border border-border bg-white p-6 shadow-sm">
        <div className="mb-6 grid gap-4 lg:grid-cols-3">
          <SearchSelect
            label="Customer account"
            value={customerId}
            onChange={setCustomerId}
            options={customerOptions}
            placeholder="Search customer…"
          />
          <Input
            label="Invoice #"
            value={nextInvoiceNo}
            readOnly
            disabled
            title="Auto-assigned on save"
          />
          <Input
            label="Notes (optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Invoice notes"
          />
        </div>

        <div className="mb-6 grid gap-4 lg:grid-cols-2">
          <Input
            label="Received amount (optional)"
            type="number"
            min={0}
            max={grandTotal || undefined}
            step={1}
            value={receivedAmount}
            onChange={(e) => setReceivedAmount(e.target.value)}
            placeholder="Leave blank if not paid now"
          />
          <SearchSelect
            label="Received into (Bank/Cash account)"
            value={receivedAccountId}
            onChange={setReceivedAccountId}
            options={bankCashAccounts.map((a) => ({ value: String(a.id), label: String(a.name) }))}
            placeholder="Select account"
            disabled={!receivedAmount || Number(receivedAmount) <= 0}
          />
        </div>

        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-sm font-bold text-brand">Line items</h2>
          <Button type="button" size="sm" variant="secondary" onClick={() => setLines((p) => [...p, newSaleLine()])}>
            <Plus className="mr-1 h-4 w-4" />
            Add line
          </Button>
        </div>

        <div className="space-y-3">
          {lineDetails.map((line, idx) => (
            <div
              key={line.key}
              className="space-y-3 rounded-lg border border-border/60 bg-surface-alt/40 p-4"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const target = e.target as HTMLElement;
                  if (target.tagName !== 'TEXTAREA') {
                    e.preventDefault();
                    setLines((p) => [...p, newSaleLine()]);
                  }
                }
              }}
            >
              <div className="grid gap-3 lg:grid-cols-[1fr_140px_100px_140px_auto] lg:items-end">
              <div>
                <SearchSelect
                  label="Product"
                  value={line.productId}
                  onChange={(id) => selectProductForLine(line.key, id)}
                  options={productOptionsForLine(line.key)}
                  placeholder="Search bike or part…"
                  autoFocus={idx === lines.length - 1 && lines.length > 1}
                />
                <ProductMetaHint product={line.product} />
              </div>
              <Input
                label="Unit price (PKR)"
                type="number"
                min={1}
                step={1}
                value={line.product ? line.unitPrice || '' : ''}
                disabled={!line.product}
                onChange={(e) => updateLine(line.key, { unitPrice: parseFloat(e.target.value) || 0 })}
              />
              <Input
                label="Qty"
                type="number"
                min={1}
                max={line.product?.type === 'BIKE' ? 1 : line.maxQty || undefined}
                value={line.product?.type === 'BIKE' ? 1 : line.qty}
                disabled={line.product?.type === 'BIKE'}
                onChange={(e) => updateLine(line.key, { quantity: parseInt(e.target.value, 10) || 1 })}
              />
              <div>
                <p className="mb-1 text-xs font-medium text-text-muted">Line total</p>
                <p className="text-sm font-semibold text-brand">
                  {line.product ? formatPKR(line.lineTotal) : '—'}
                </p>
                {line.product && (
                  <p className="text-xs text-text-muted">Stock: {line.maxQty}</p>
                )}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="self-end"
                disabled={lines.length <= 1}
                onClick={() => removeLine(line.key)}
                aria-label="Remove line"
              >
                <Trash2 className="h-4 w-4 text-red-600" />
              </Button>
              </div>
              {line.product?.type === 'BIKE' && (
                <SearchSelect
                  label="Chassis number (in stock)"
                  value={line.bikeChassisNumberId ? String(line.bikeChassisNumberId) : ''}
                  onChange={(id) => updateLine(line.key, { bikeChassisNumberId: id ? parseInt(id, 10) : undefined })}
                  options={(chassisOptions[line.key] ?? []).map((c) => {
                    const idParts = c.engineNumber
                      ? `Engine: ${c.engineNumber}`
                      : c.motorNumber
                        ? `Motor: ${c.motorNumber}`
                        : null;
                    const label = [c.chassisNumber, idParts, c.color ? `Color: ${c.color}` : null]
                      .filter(Boolean)
                      .join(' · ');
                    return { value: String(c.id), label };
                  })}
                  placeholder={
                    (chassisOptions[line.key]?.length ?? 0) === 0
                      ? 'No chassis numbers in stock for this model'
                      : 'Search chassis number…'
                  }
                />
              )}
            </div>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-border/60 pt-4">
          <p className="text-lg font-bold text-brand">Total: {formatPKR(grandTotal)}</p>
          <Button type="submit" variant="accent" loading={saving} disabled={!customerId || grandTotal <= 0}>
            Save sale invoice
          </Button>
        </div>
      </form>

      {customerId && (
        <div className="rounded-[var(--radius-card)] border border-border bg-white p-6 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-sm font-bold text-brand">
              Customer ledger
              {customerLedger?.customer && (
                <span className="ml-2 font-normal text-text-muted">
                  {customerLedger.customer.code} · {customerLedger.customer.name}
                </span>
              )}
            </h2>
            {customerLedger && (
              <p className="text-sm text-text-muted">
                Balance: <strong>{formatLedgerBalance(customerLedger.summary.closingBalance)}</strong>
              </p>
            )}
          </div>
          {loadingLedger ? (
            <p className="text-sm text-text-muted">Loading ledger…</p>
          ) : (
            <DataTable
              compact
              columns={[
                { key: 'date', header: 'Date', render: (r) => formatDate(String(r.date)) },
                { key: 'voucherNo', header: 'Ref #' },
                { key: 'type', header: 'Type' },
                { key: 'description', header: 'Description' },
                {
                  key: 'debit',
                  header: 'Debit',
                  render: (r) => (Number(r.debit) > 0 ? formatLedgerAmount(Number(r.debit)) : '—'),
                },
                {
                  key: 'credit',
                  header: 'Credit',
                  render: (r) => (Number(r.credit) > 0 ? formatLedgerAmount(Number(r.credit)) : '—'),
                },
                {
                  key: 'balance',
                  header: 'Balance',
                  render: (r) => formatLedgerBalance(Number(r.balance)),
                },
              ]}
              data={(customerLedger?.rows ?? []) as Row[]}
              emptyMessage="No ledger entries for this customer yet"
            />
          )}
        </div>
      )}

      <div>
        <h2 className="mb-4 font-display text-sm font-bold text-brand">Recent sale invoices</h2>
        <DataTable
          columns={[
            { key: 'saleReference', header: 'Invoice #', render: (r) => String(r.saleReference ?? '—') },
            {
              key: 'customer',
              header: 'Customer',
              render: (r) => String((r.customer as { name?: string })?.name ?? '—'),
            },
            { key: 'total', header: 'Total', render: (r) => formatPKR(Number(r.total)) },
            { key: 'createdAt', header: 'Date', render: (r) => String(r.createdAt).slice(0, 10) },
            {
              key: 'actions',
              header: '',
              render: (r) => {
                const ref = String(r.saleReference ?? r.id);
                return (
                  <PosInvoiceRowActions
                    reference={ref}
                    onView={() => openInvoice(Number(r.id))}
                    onEdit={() => setEditOrderId(Number(r.id))}
                    onDelete={() => deleteSaleInvoiceCompletely(Number(r.id))}
                    onChanged={bumpInvoiceLists}
                  />
                );
              },
            },
          ]}
          data={orders}
          emptyMessage="No sale invoices yet"
        />
      </div>

      <Modal
        open={invoiceModal !== null}
        onClose={() => { setInvoiceModal(null); setInvoiceData(null); }}
        title="Sale Invoice"
        size="lg"
        tallContent
      >
        <InvoiceModalContent loading={invoiceLoading} invoice={invoiceData} />
      </Modal>
      <SaleInvoiceEditModal
        open={editOrderId !== null}
        orderId={editOrderId}
        onClose={() => setEditOrderId(null)}
        onSaved={bumpInvoiceLists}
      />
      <WorkspaceCloseBar className="mt-8" />
    </div>
  );
}

export function PosPurchaseInvoicePage() {
  const branchId = useBranchId();
  const { toast } = useToast();
  const [suppliers, setSuppliers] = useState<Row[]>([]);
  const [products, setProducts] = useState<PurchaseProduct[]>([]);
  const [purchases, setPurchases] = useState<Row[]>([]);
  const [supplierId, setSupplierId] = useState('');
  const [lines, setLines] = useState<PurchaseLine[]>([newPurchaseLine()]);
  const [nextInvoiceNo, setNextInvoiceNo] = useState('…');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [purchaseType, setPurchaseType] = useState<'NEW' | 'OLD'>('NEW');
  const [supplierLedger, setSupplierLedger] = useState<{
    supplier: { name: string; code: string; balance: number };
    rows: LedgerRow[];
    summary: { totalDebit: number; totalCredit: number; closingBalance: number };
  } | null>(null);
  const [loadingLedger, setLoadingLedger] = useState(false);
  const [invoiceModal, setInvoiceModal] = useState<number | null>(null);
  const [invoiceData, setInvoiceData] = useState<PurchaseInvoiceData | null>(null);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [colorOptions, setColorOptions] = useState<{ id: number; name: string }[]>([]);
  const [editPurchaseId, setEditPurchaseId] = useState<number | null>(null);

  const reloadPurchases = useCallback(() => {
    if (!branchId) return;
    branchApi.purchases(branchId, { limit: '2' })
      .then((r) => setPurchases(r.data as Row[]))
      .catch(console.error);
  }, [branchId]);

  const reloadNextInvoiceNo = useCallback(() => {
    if (!branchId) return;
    branchApi.nextDocumentNumbers(branchId)
      .then((n) => setNextInvoiceNo(n.purchase))
      .catch(console.error);
  }, [branchId]);

  useEffect(() => {
    if (!branchId) return;
    branchApi.branchSuppliers(branchId).then((r) => setSuppliers(r.data as Row[])).catch(console.error);
    branchApi.purchaseProducts(branchId).then(setProducts).catch(console.error);
    branchApi.colorOptions().then(setColorOptions).catch(console.error);
    reloadPurchases();
    reloadNextInvoiceNo();
  }, [branchId, reloadPurchases, reloadNextInvoiceNo]);

  useEffect(() => {
    if (!branchId || !supplierId) {
      setSupplierLedger(null);
      return;
    }
    setLoadingLedger(true);
    branchApi.supplierLedger(branchId, parseInt(supplierId, 10))
      .then(setSupplierLedger)
      .catch((err) => {
        toast(err instanceof Error ? err.message : 'Failed to load supplier ledger', 'error');
        setSupplierLedger(null);
      })
      .finally(() => setLoadingLedger(false));
  }, [branchId, supplierId, toast]);

  const supplierLabels = useMemo(
    () => buildDedupedLabels(suppliers, (s) => [
      s.phone ? String(s.phone) : '',
      s.contactPerson ? `(${s.contactPerson})` : '',
    ]),
    [suppliers],
  );
  const supplierOptions: SearchSelectOption[] = useMemo(
    () => suppliers.map((s) => ({
      value: String(s.id),
      label: supplierLabels.get(s.id) ?? String(s.name),
    })),
    [suppliers, supplierLabels],
  );

  const productById = useMemo(
    () => new Map(products.map((p) => [p.id, p])),
    [products],
  );

  const lineDetails = useMemo(
    () => lines.map((line) => {
      const product = productById.get(line.productId);
      const qty = Math.max(1, line.quantity);
      const isOldBikeLine = purchaseType === 'OLD' && product?.type === 'BIKE';
      const unitsSum = isOldBikeLine
        ? resizeBikeUnits(line.bikeUnits, qty).reduce((sum, u) => sum + (Number(u.purchasePrice) || 0), 0)
        : undefined;
      const unitCost = isOldBikeLine ? undefined : (line.unitCost ?? 0);
      return {
        ...line,
        product,
        qty,
        unitCost: unitCost ?? 0,
        lineTotal: isOldBikeLine ? unitsSum! : (unitCost ?? 0) * qty,
      };
    }),
    [lines, productById, purchaseType],
  );

  const grandTotal = useMemo(
    () => lineDetails.reduce((sum, l) => sum + (l.product ? l.lineTotal : 0), 0),
    [lineDetails],
  );

  function selectProductForLine(lineKey: string, productId: string) {
    if (!productId) {
      updateLine(lineKey, { productId: '', unitCost: undefined, bikeUnits: undefined });
      return;
    }
    const currentLine = lines.find((l) => l.key === lineKey);
    if (currentLine?.productId === productId) return;
    const alreadySelected = lines.some((l) => l.key !== lineKey && l.productId === productId);
    if (alreadySelected) {
      toast('Product is already selected', 'error');
      return;
    }
    const product = productById.get(productId);
    const qty = lines.find((l) => l.key === lineKey)?.quantity ?? 1;
    updateLine(lineKey, {
      productId,
      unitCost: undefined,
      bikeUnits: product?.type === 'BIKE' ? resizeBikeUnits(undefined, Math.max(1, qty)) : undefined,
    });
  }

  function productOptionsForLine(lineKey: string): SearchSelectOption[] {
    const selectedElsewhere = new Set(
      lines.filter((l) => l.key !== lineKey && l.productId).map((l) => l.productId),
    );
    return products
      .filter((p) => !selectedElsewhere.has(p.id))
      .map((p) => ({ value: p.id, label: `${p.name} [${p.type}]` }));
  }

  function updateLine(key: string, patch: Partial<PurchaseLine>) {
    setLines((prev) => prev.map((l) => {
      if (l.key !== key) return l;
      const next = { ...l, ...patch };
      const product = productById.get(next.productId);
      if (product?.type === 'BIKE') {
        if (patch.quantity !== undefined) {
          next.bikeUnits = resizeBikeUnits(next.bikeUnits, Math.max(1, next.quantity));
        }
      } else {
        next.bikeUnits = undefined;
      }
      return next;
    }));
  }

  function updateBikeUnit(lineKey: string, index: number, patch: Partial<BikeUnit>) {
    setLines((prev) => prev.map((l) => {
      if (l.key !== lineKey) return l;
      const units = resizeBikeUnits(l.bikeUnits, l.quantity);
      units[index] = { ...units[index], ...patch };
      return { ...l, bikeUnits: units };
    }));
  }

  function removeLine(key: string) {
    setLines((prev) => (prev.length <= 1 ? prev : prev.filter((l) => l.key !== key)));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!branchId) return;
    if (!supplierId) {
      toast('Select a supplier', 'error');
      return;
    }
    for (const l of lineDetails) {
      if (!l.product) continue;
      if (l.product.type === 'BIKE') {
        const units = resizeBikeUnits(l.bikeUnits, l.qty);
        for (const u of units) {
          if (!u.chassisNumber.trim()) {
            toast(`Enter chassis number for all ${l.qty} unit(s) of ${l.product.name}`, 'error');
            return;
          }
          const numberValue = u.numberType === 'ENGINE' ? u.engineNumber : u.motorNumber;
          if (!numberValue?.trim()) {
            toast(
              `Enter ${u.numberType === 'ENGINE' ? 'engine' : 'motor'} number for every unit of ${l.product.name}`,
              'error',
            );
            return;
          }
          if (purchaseType === 'OLD') {
            const price = parseFloat(u.purchasePrice || '');
            if (Number.isNaN(price) || price <= 0) {
              toast(`Enter a valid price for every unit of ${l.product.name}`, 'error');
              return;
            }
          }
        }
        const chassisNums = units.map((u) => u.chassisNumber.trim().toUpperCase());
        if (new Set(chassisNums).size !== chassisNums.length) {
          toast('Duplicate chassis numbers on this invoice', 'error');
          return;
        }
        const engineNums = units.filter((u) => u.numberType === 'ENGINE').map((u) => u.engineNumber.trim().toUpperCase());
        if (new Set(engineNums).size !== engineNums.length) {
          toast('Duplicate engine numbers on this invoice', 'error');
          return;
        }
        const motorNums = units.filter((u) => u.numberType === 'MOTOR').map((u) => u.motorNumber.trim().toUpperCase());
        if (new Set(motorNums).size !== motorNums.length) {
          toast('Duplicate motor numbers on this invoice', 'error');
          return;
        }
      }
    }
    const allBikeUnits = lineDetails.flatMap((l) =>
      l.product?.type === 'BIKE'
        ? resizeBikeUnits(l.bikeUnits, l.qty).map((u) => ({
            chassisNumber: u.chassisNumber.trim(),
            engineNumber: u.numberType === 'ENGINE' ? u.engineNumber.trim() : undefined,
            motorNumber: u.numberType === 'MOTOR' ? u.motorNumber.trim() : undefined,
          }))
        : [],
    );
    if (allBikeUnits.length > 0) {
      try {
        await branchApi.validateBikeUnits(branchId, allBikeUnits);
      } catch (err) {
        toast(err instanceof Error ? err.message : 'Chassis/engine/motor number validation failed', 'error');
        return;
      }
    }

    const resolvedUnitColors = new Map<string, string | undefined>();
    for (const l of lineDetails) {
      if (l.product?.type !== 'BIKE') continue;
      const units = resizeBikeUnits(l.bikeUnits, l.qty);
      for (let idx = 0; idx < units.length; idx++) {
        const unit = units[idx];
        const mapKey = `${l.key}-${idx}`;
        try {
          if (unit.colorPick === COLOR_OTHER) {
            const raw = unit.customColor.trim();
            if (raw) {
              const created = await branchApi.createColorOption(raw);
              resolvedUnitColors.set(mapKey, created.name);
            } else {
              resolvedUnitColors.set(mapKey, undefined);
            }
          } else {
            resolvedUnitColors.set(mapKey, unit.colorPick.trim() || undefined);
          }
        } catch (err) {
          toast(err instanceof Error ? err.message : 'Failed to save custom color', 'error');
          return;
        }
      }
    }

    const items = lineDetails
      .filter((l) => l.product)
      .map((l) => {
        const isOldBike = purchaseType === 'OLD' && l.product?.type === 'BIKE';
        return {
          productId: l.productId,
          quantity: l.qty,
          unitCost: isOldBike
            ? resizeBikeUnits(l.bikeUnits, l.qty).reduce((sum, u) => sum + (parseFloat(u.purchasePrice || '') || 0), 0) / l.qty
            : Number(l.unitCost),
          ...(l.product?.type === 'BIKE'
            ? {
                bikeUnits: resizeBikeUnits(l.bikeUnits, l.qty).map((u, idx) => ({
                  chassisNumber: u.chassisNumber.trim(),
                  engineNumber: u.numberType === 'ENGINE' ? u.engineNumber.trim() : undefined,
                  motorNumber: u.numberType === 'MOTOR' ? u.motorNumber.trim() : undefined,
                  color: resolvedUnitColors.get(`${l.key}-${idx}`),
                  ...(purchaseType === 'OLD' && {
                    isUsed: true,
                    purchasePrice: parseFloat(u.purchasePrice || '') || 0,
                    meterReading: u.meterReading ? parseInt(u.meterReading, 10) : undefined,
                    condition: u.condition || undefined,
                    comments: u.comments || undefined,
                  }),
                })),
              }
            : {}),
        };
      });
    if (items.length === 0) {
      toast('Add at least one product', 'error');
      return;
    }
    if (new Set(items.map((i) => i.productId)).size !== items.length) {
      toast('Product is already selected', 'error');
      return;
    }
    for (const l of lineDetails) {
      if (!l.product) continue;
      if (purchaseType === 'OLD' && l.product.type === 'BIKE') {
        continue;
      }
      if (l.unitCost <= 0) {
        toast(`Enter a valid purchase cost for ${l.product.name}`, 'error');
        return;
      }
    }
    setSaving(true);
    try {
      const result = await branchApi.createPurchaseInvoice({
        branchId,
        supplierId: parseInt(supplierId, 10),
        items,
        notes: notes.trim() || undefined,
      });
      const invoiceNo = String((result.purchase as { documentRef?: string }).documentRef ?? nextInvoiceNo);
      toast(`Purchase saved. Invoice #${invoiceNo}`, 'success');
      setLines([newPurchaseLine()]);
      setNotes('');
      setPurchaseType('NEW');
      branchApi.purchaseProducts(branchId).then(setProducts).catch(console.error);
      reloadPurchases();
      reloadNextInvoiceNo();
      branchApi.supplierLedger(branchId, parseInt(supplierId, 10)).then(setSupplierLedger).catch(console.error);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to save purchase', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function openInvoice(id: number) {
    setInvoiceModal(id);
    setInvoiceData(null);
    setInvoiceLoading(true);
    try {
      const inv = await branchApi.purchaseInvoice(id);
      setInvoiceData(inv);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to load invoice', 'error');
      setInvoiceModal(null);
    } finally {
      setInvoiceLoading(false);
    }
  }

  function bumpInvoiceLists() {
    reloadPurchases();
    if (supplierId && branchId) {
      branchApi.supplierLedger(branchId, parseInt(supplierId, 10)).then(setSupplierLedger).catch(console.error);
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Purchase Invoice"
        subtitle="Create a purchase. Inventory debited, supplier credited, stock increased"
      />

      <form onSubmit={handleSubmit} className="rounded-[var(--radius-card)] border border-border bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center gap-2">
          <span className="text-sm font-medium text-slate-700">Purchase type:</span>
          <div className="inline-flex rounded-lg border border-border p-1">
            <button
              type="button"
              onClick={() => setPurchaseType('NEW')}
              className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                purchaseType === 'NEW' ? 'bg-accent text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              New
            </button>
            <button
              type="button"
              onClick={() => setPurchaseType('OLD')}
              className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                purchaseType === 'OLD' ? 'bg-accent text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Old
            </button>
          </div>
        </div>

        <div className="mb-6 grid gap-4 lg:grid-cols-3">
          <SearchSelect
            label="Supplier account"
            value={supplierId}
            onChange={setSupplierId}
            options={supplierOptions}
            placeholder="Search supplier…"
          />
          <Input
            label="Invoice #"
            value={nextInvoiceNo}
            readOnly
            disabled
            title="Auto-assigned on save"
          />
          <Input
            label="Notes (optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Invoice notes"
          />
        </div>

        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-sm font-bold text-brand">Line items</h2>
          <Button type="button" size="sm" variant="secondary" onClick={() => setLines((p) => [...p, newPurchaseLine()])}>
            <Plus className="mr-1 h-4 w-4" />
            Add line
          </Button>
        </div>

        <div className="space-y-3">
          {lineDetails.map((line, idx) => (
            <div
              key={line.key}
              className="space-y-3 rounded-lg border border-border/60 bg-surface-alt/40 p-4"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const target = e.target as HTMLElement;
                  if (target.tagName !== 'TEXTAREA') {
                    e.preventDefault();
                    setLines((p) => [...p, newPurchaseLine()]);
                  }
                }
              }}
            >
              <div className="grid gap-3 lg:grid-cols-[1fr_140px_100px_140px_auto] lg:items-end">
              <div>
                <SearchSelect
                  label="Product"
                  value={line.productId}
                  onChange={(id) => selectProductForLine(line.key, id)}
                  options={productOptionsForLine(line.key)}
                  placeholder="Search bike or part…"
                  autoFocus={idx === lines.length - 1 && lines.length > 1}
                />
                <ProductMetaHint product={line.product} />
              </div>
              {purchaseType === 'OLD' && line.product?.type === 'BIKE' ? (
                <div className="w-[140px]" />
              ) : (
                <Input
                  label="Unit cost (PKR)"
                  type="number"
                  min={1}
                  step={1}
                  value={line.product ? (line.unitCost || '') : ''}
                  disabled={!line.product}
                  placeholder="Purchase cost"
                  onChange={(e) => updateLine(line.key, { unitCost: parseFloat(e.target.value) || 0 })}
                />
              )}
              <Input
                label="Qty"
                type="number"
                min={1}
                value={line.qty}
                onChange={(e) => updateLine(line.key, { quantity: parseInt(e.target.value, 10) || 1 })}
              />
              <div>
                <p className="mb-1 text-xs font-medium text-text-muted">Line total</p>
                <p className="text-sm font-semibold text-brand">
                  {line.product && line.lineTotal > 0 ? formatPKR(line.lineTotal) : '—'}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="self-end"
                disabled={lines.length <= 1}
                onClick={() => removeLine(line.key)}
                aria-label="Remove line"
              >
                <Trash2 className="h-4 w-4 text-red-600" />
              </Button>
              </div>
              {line.product?.type === 'BIKE' && (
                <div className="space-y-3">
                  {resizeBikeUnits(line.bikeUnits, line.qty).map((unit, idx) => (
                    <div
                      key={`${line.key}-unit-${idx}`}
                      className="rounded-xl border border-border/60 p-3"
                    >
                      <p className="mb-2 text-xs font-semibold text-text-muted">Bike unit {idx + 1}</p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <Input
                          label="Chassis number"
                          value={unit.chassisNumber}
                          required
                          placeholder="Unique chassis number"
                          onChange={(e) => updateBikeUnit(line.key, idx, { chassisNumber: e.target.value })}
                        />
                        <div>
                          <p className="mb-1 text-xs font-medium text-text-muted">Engine or motor number</p>
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant={unit.numberType === 'MOTOR' ? 'accent' : 'secondary'}
                              onClick={() => updateBikeUnit(line.key, idx, { numberType: 'MOTOR' })}
                            >
                              Motor Number
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant={unit.numberType === 'ENGINE' ? 'accent' : 'secondary'}
                              onClick={() => updateBikeUnit(line.key, idx, { numberType: 'ENGINE' })}
                            >
                              Engine Number
                            </Button>
                          </div>
                        </div>
                      </div>
                      <div className="mt-2">
                        {unit.numberType === 'ENGINE' ? (
                          <Input
                            label="Engine number"
                            value={unit.engineNumber}
                            required
                            placeholder="Unique engine number"
                            onChange={(e) => updateBikeUnit(line.key, idx, { engineNumber: e.target.value })}
                          />
                        ) : (
                          <Input
                            label="Motor number"
                            value={unit.motorNumber}
                            required
                            placeholder="Unique motor number"
                            onChange={(e) => updateBikeUnit(line.key, idx, { motorNumber: e.target.value })}
                          />
                        )}
                      </div>
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        <Select
                          label="Color"
                          value={unit.colorPick}
                          onChange={(e) => updateBikeUnit(line.key, idx, { colorPick: e.target.value })}
                          placeholder="Select color"
                        >
                          {colorOptions.map((c) => (
                            <option key={c.id} value={c.name}>
                              {c.name}
                            </option>
                          ))}
                          <option value={COLOR_OTHER}>Other</option>
                        </Select>
                        {unit.colorPick === COLOR_OTHER && (
                          <Input
                            label="Custom color"
                            placeholder="e.g. Pearl White"
                            value={unit.customColor}
                            onChange={(e) => updateBikeUnit(line.key, idx, { customColor: e.target.value })}
                          />
                        )}
                      </div>
                      {purchaseType === 'OLD' && (
                        <div className="mt-2 grid gap-2 sm:grid-cols-4">
                          <Input
                            label="Price"
                            type="number"
                            min={0}
                            value={unit.purchasePrice ?? ''}
                            onChange={(e) => updateBikeUnit(line.key, idx, { purchasePrice: e.target.value })}
                            required
                          />
                          <Input
                            label="Meter reading (km)"
                            type="number"
                            min={0}
                            value={unit.meterReading ?? ''}
                            onChange={(e) => updateBikeUnit(line.key, idx, { meterReading: e.target.value })}
                          />
                          <Select
                            label="Condition"
                            value={unit.condition ?? ''}
                            onChange={(e) => updateBikeUnit(line.key, idx, { condition: e.target.value })}
                          >
                            <option value="">Select condition</option>
                            <option value="Excellent">Excellent</option>
                            <option value="Good">Good</option>
                            <option value="Fair">Fair</option>
                            <option value="Poor">Poor</option>
                          </Select>
                          <Input
                            label="Comments"
                            value={unit.comments ?? ''}
                            onChange={(e) => updateBikeUnit(line.key, idx, { comments: e.target.value })}
                            placeholder="Optional notes"
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-border/60 pt-4">
          <p className="text-lg font-bold text-brand">Total: {formatPKR(grandTotal)}</p>
          <Button type="submit" variant="accent" loading={saving} disabled={!supplierId || grandTotal <= 0}>
            Save purchase invoice
          </Button>
        </div>
      </form>

      {supplierId && (
        <div className="rounded-[var(--radius-card)] border border-border bg-white p-6 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-sm font-bold text-brand">
              Supplier ledger
              {supplierLedger?.supplier && (
                <span className="ml-2 font-normal text-text-muted">
                  {supplierLedger.supplier.code} · {supplierLedger.supplier.name}
                </span>
              )}
            </h2>
            {supplierLedger && (
              <p className="text-sm text-text-muted">
                Balance: <strong>{formatLedgerBalance(supplierLedger.summary.closingBalance)}</strong>
              </p>
            )}
          </div>
          {loadingLedger ? (
            <p className="text-sm text-text-muted">Loading ledger…</p>
          ) : (
            <DataTable
              compact
              columns={[
                { key: 'date', header: 'Date', render: (r) => formatDate(String(r.date)) },
                { key: 'voucherNo', header: 'Ref #' },
                { key: 'type', header: 'Type' },
                { key: 'description', header: 'Description' },
                {
                  key: 'debit',
                  header: 'Debit',
                  render: (r) => (Number(r.debit) > 0 ? formatLedgerAmount(Number(r.debit)) : '—'),
                },
                {
                  key: 'credit',
                  header: 'Credit',
                  render: (r) => (Number(r.credit) > 0 ? formatLedgerAmount(Number(r.credit)) : '—'),
                },
                {
                  key: 'balance',
                  header: 'Balance',
                  render: (r) => formatLedgerBalance(Number(r.balance)),
                },
              ]}
              data={(supplierLedger?.rows ?? []) as Row[]}
              emptyMessage="No ledger entries for this supplier yet"
            />
          )}
        </div>
      )}

      <div>
        <h2 className="mb-4 font-display text-sm font-bold text-brand">Recent purchase invoices</h2>
        <DataTable
          columns={[
            { key: 'documentRef', header: 'Invoice #', render: (r) => String(r.documentRef ?? r.invoiceNumber ?? '—') },
            { key: 'supplier', header: 'Supplier', render: (r) => (r.supplier as { name: string })?.name ?? '' },
            { key: 'total', header: 'Total', render: (r) => formatPKR(Number(r.total ?? 0)) },
            { key: 'createdAt', header: 'Date', render: (r) => String(r.createdAt).slice(0, 10) },
            {
              key: 'actions',
              header: '',
              render: (r) => {
                const ref = String(r.documentRef ?? r.invoiceNumber ?? r.id);
                return (
                  <PosInvoiceRowActions
                    reference={ref}
                    onView={() => openInvoice(Number(r.id))}
                    onEdit={() => setEditPurchaseId(Number(r.id))}
                    onDelete={() => deletePurchaseInvoiceCompletely(Number(r.id))}
                    onChanged={bumpInvoiceLists}
                  />
                );
              },
            },
          ]}
          data={purchases}
          emptyMessage="No purchase invoices yet"
        />
      </div>

      <Modal
        open={invoiceModal !== null}
        onClose={() => { setInvoiceModal(null); setInvoiceData(null); }}
        title="Purchase Invoice"
        size="lg"
        tallContent
      >
        <PurchaseInvoiceModalContent loading={invoiceLoading} invoice={invoiceData} />
      </Modal>
      <PurchaseInvoiceEditModal
        open={editPurchaseId !== null}
        purchaseId={editPurchaseId}
        onClose={() => setEditPurchaseId(null)}
        onSaved={bumpInvoiceLists}
      />
      <WorkspaceCloseBar className="mt-8" />
    </div>
  );
}

export function PosServiceInvoicePage() {
  const branchId = useBranchId();
  const { toast } = useToast();
  const [customers, setCustomers] = useState<Row[]>([]);
  const [products, setProducts] = useState<SaleProduct[]>([]);
  const [invoices, setInvoices] = useState<Row[]>([]);
  const [customerId, setCustomerId] = useState('');
  const [lines, setLines] = useState<SaleLine[]>([newSaleLine()]);
  const [labourCost, setLabourCost] = useState('');
  const [nextInvoiceNo, setNextInvoiceNo] = useState('…');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [customerLedger, setCustomerLedger] = useState<{
    customer: { name: string; code: string; balance: number };
    rows: LedgerRow[];
    summary: { totalDebit: number; totalCredit: number; closingBalance: number };
  } | null>(null);
  const [loadingLedger, setLoadingLedger] = useState(false);
  const [invoiceModal, setInvoiceModal] = useState<number | null>(null);
  const [invoiceData, setInvoiceData] = useState<ServiceInvoiceData | null>(null);
  const [invoiceLoading, setInvoiceLoading] = useState(false);

  const reloadInvoices = useCallback(() => {
    if (!branchId) return;
    branchApi.serviceInvoices(branchId, { limit: '5' })
      .then((r) => setInvoices(r.data as unknown as Row[]))
      .catch(console.error);
  }, [branchId]);

  const reloadNextInvoiceNo = useCallback(() => {
    if (!branchId) return;
    branchApi.nextDocumentNumbers(branchId)
      .then((n) => setNextInvoiceNo(n.service))
      .catch(console.error);
  }, [branchId]);

  useEffect(() => {
    if (!branchId) return;
    branchApi.walkInCustomers(branchId, { limit: '100' }).then((r) => setCustomers(r.data as Row[])).catch(console.error);
    branchApi.saleProducts(branchId).then(setProducts).catch(console.error);
    reloadInvoices();
    reloadNextInvoiceNo();
  }, [branchId, reloadInvoices, reloadNextInvoiceNo]);

  useEffect(() => {
    if (!branchId || !customerId) {
      setCustomerLedger(null);
      return;
    }
    let cancelled = false;
    setLoadingLedger(true);
    branchApi.customerLedger(branchId, parseInt(customerId, 10))
      .then((data) => {
        if (!cancelled) setCustomerLedger(data);
      })
      .catch((err) => {
        if (cancelled) return;
        toast(err instanceof Error ? err.message : 'Failed to load customer ledger', 'error');
        setCustomerLedger(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingLedger(false);
      });
    return () => { cancelled = true; };
  }, [branchId, customerId, toast]);

  const customerLabels = useMemo(
    () => buildDedupedLabels(customers, (c) => [
      c.cnic ? String(c.cnic) : '',
      c.fatherName ? `(S/O ${c.fatherName})` : '',
    ]),
    [customers],
  );
  const customerOptions: SearchSelectOption[] = useMemo(
    () => customers.map((c) => ({
      value: String(c.id),
      label: customerLabels.get(c.id) ?? String(c.name),
    })),
    [customers, customerLabels],
  );

  const productById = useMemo(
    () => new Map(products.map((p) => [p.id, p])),
    [products],
  );

  const lineDetails = useMemo(
    () => lines.map((line) => {
      const product = productById.get(line.productId);
      const qty = Math.max(1, line.quantity);
      const unitPrice = line.unitPrice ?? product?.unitPrice ?? 0;
      const maxQty = product?.stockAtBranch ?? 0;
      return {
        ...line,
        product,
        qty,
        unitPrice,
        maxQty,
        lineTotal: unitPrice * qty,
      };
    }),
    [lines, productById],
  );

  const partsTotal = useMemo(
    () => lineDetails.reduce((sum, l) => sum + (l.product ? l.lineTotal : 0), 0),
    [lineDetails],
  );

  const labourAmount = parseFloat(labourCost) || 0;
  const grandTotal = partsTotal + labourAmount;

  function selectProductForLine(lineKey: string, productId: string) {
    if (!productId) {
      updateLine(lineKey, { productId: '', unitPrice: undefined });
      return;
    }
    const currentLine = lines.find((l) => l.key === lineKey);
    if (currentLine?.productId === productId) return;
    const alreadySelected = lines.some((l) => l.key !== lineKey && l.productId === productId);
    if (alreadySelected) {
      toast('Product is already selected', 'error');
      return;
    }
    const product = productById.get(productId);
    updateLine(lineKey, { productId, unitPrice: product?.unitPrice });
  }

  function productOptionsForLine(lineKey: string): SearchSelectOption[] {
    const selectedElsewhere = new Set(
      lines.filter((l) => l.key !== lineKey && l.productId).map((l) => l.productId),
    );
    return products
      .filter((p) => !selectedElsewhere.has(p.id))
      .map((p) => ({
        value: p.id,
        label: `${p.name} [${p.type}]`,
      }));
  }

  function updateLine(key: string, patch: Partial<SaleLine>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function removeLine(key: string) {
    setLines((prev) => (prev.length <= 1 ? prev : prev.filter((l) => l.key !== key)));
  }

  async function openInvoice(id: number) {
    setInvoiceModal(id);
    setInvoiceData(null);
    setInvoiceLoading(true);
    try {
      const inv = await branchApi.serviceInvoice(id);
      setInvoiceData(inv);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to load invoice', 'error');
      setInvoiceModal(null);
    } finally {
      setInvoiceLoading(false);
    }
  }

  function bumpInvoiceLists() {
    reloadInvoices();
    if (customerId && branchId) {
      branchApi.customerLedger(branchId, parseInt(customerId, 10)).then(setCustomerLedger).catch(console.error);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!branchId) return;
    if (!customerId) {
      toast('Select a customer', 'error');
      return;
    }
    if (labourAmount < 0) {
      toast('Labour cost cannot be negative', 'error');
      return;
    }
    const items = lineDetails
      .filter((l) => l.product)
      .map((l) => ({
        productId: l.productId,
        quantity: l.qty,
        unitPrice: Number(l.unitPrice),
      }));
    if (items.length === 0 && labourAmount <= 0) {
      toast('Add parts or enter a labour cost', 'error');
      return;
    }
    if (new Set(items.map((i) => i.productId)).size !== items.length) {
      toast('Product is already selected', 'error');
      return;
    }
    for (const l of lineDetails) {
      if (!l.product) continue;
      if (l.qty > l.maxQty) {
        toast(`Insufficient stock for ${l.product.name}. Available: ${l.maxQty}`, 'error');
        return;
      }
      if (l.unitPrice <= 0) {
        toast(`Enter a valid price for ${l.product.name}`, 'error');
        return;
      }
    }
    setSaving(true);
    try {
      const result = await branchApi.createServiceInvoice({
        branchId,
        customerId: parseInt(customerId, 10),
        labourCost: labourAmount,
        items,
        notes: notes.trim() || undefined,
      });
      const invoiceNo = String((result.invoice as { reference?: string }).reference ?? nextInvoiceNo);
      toast(`Service invoice saved. Invoice #${invoiceNo}`, 'success');
      setLines([newSaleLine()]);
      setLabourCost('');
      setNotes('');
      branchApi.saleProducts(branchId).then(setProducts).catch(console.error);
      reloadInvoices();
      reloadNextInvoiceNo();
      branchApi.customerLedger(branchId, parseInt(customerId, 10)).then(setCustomerLedger).catch(console.error);
      const invoiceId = (result.invoice as { id: number }).id;
      if (invoiceId) openInvoice(invoiceId);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to save service invoice', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Service Invoice"
        subtitle="Bill for service work. Customer debited, service revenue credited, parts stock updated"
      />

      <form onSubmit={handleSubmit} className="rounded-[var(--radius-card)] border border-border bg-white p-6 shadow-sm">
        <div className="mb-6 grid gap-4 lg:grid-cols-3">
          <SearchSelect
            label="Customer account"
            value={customerId}
            onChange={setCustomerId}
            options={customerOptions}
            placeholder="Search customer…"
          />
          <Input
            label="Invoice #"
            value={nextInvoiceNo}
            readOnly
            disabled
            title="Auto-assigned on save"
          />
          <Input
            label="Notes (optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Service notes"
          />
        </div>

        <div className="mb-6 max-w-xs">
          <Input
            label="Labour cost (PKR)"
            type="number"
            min={0}
            step={1}
            value={labourCost}
            onChange={(e) => setLabourCost(e.target.value)}
            placeholder="0"
          />
        </div>

        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-sm font-bold text-brand">Parts used</h2>
          <Button type="button" size="sm" variant="secondary" onClick={() => setLines((p) => [...p, newSaleLine()])}>
            <Plus className="mr-1 h-4 w-4" />
            Add line
          </Button>
        </div>

        <div className="space-y-3">
          {lineDetails.map((line, idx) => (
            <div
              key={line.key}
              className="grid gap-3 rounded-lg border border-border/60 bg-surface-alt/40 p-4 lg:grid-cols-[1fr_140px_100px_140px_auto] lg:items-end"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const target = e.target as HTMLElement;
                  if (target.tagName !== 'TEXTAREA') {
                    e.preventDefault();
                    setLines((p) => [...p, newSaleLine()]);
                  }
                }
              }}
            >
              <div>
                <SearchSelect
                  label="Product"
                  value={line.productId}
                  onChange={(id) => selectProductForLine(line.key, id)}
                  options={productOptionsForLine(line.key)}
                  placeholder="Search bike or part…"
                  autoFocus={idx === lines.length - 1 && lines.length > 1}
                />
                <ProductMetaHint product={line.product} />
              </div>
              <Input
                label="Unit price (PKR)"
                type="number"
                min={1}
                step={1}
                value={line.product ? line.unitPrice || '' : ''}
                disabled={!line.product}
                onChange={(e) => updateLine(line.key, { unitPrice: parseFloat(e.target.value) || 0 })}
              />
              <Input
                label="Qty"
                type="number"
                min={1}
                max={line.maxQty || undefined}
                value={line.qty}
                onChange={(e) => updateLine(line.key, { quantity: parseInt(e.target.value, 10) || 1 })}
              />
              <div>
                <p className="mb-1 text-xs font-medium text-text-muted">Line total</p>
                <p className="text-sm font-semibold text-brand">
                  {line.product ? formatPKR(line.lineTotal) : '—'}
                </p>
                {line.product && (
                  <p className="text-xs text-text-muted">Stock: {line.maxQty}</p>
                )}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="self-end"
                disabled={lines.length <= 1}
                onClick={() => removeLine(line.key)}
                aria-label="Remove line"
              >
                <Trash2 className="h-4 w-4 text-red-600" />
              </Button>
            </div>
          ))}
        </div>

        <div className="mt-6 space-y-1 border-t border-border/60 pt-4 text-sm">
          {partsTotal > 0 && (
            <p className="text-text-muted">Parts: <span className="font-medium text-text">{formatPKR(partsTotal)}</span></p>
          )}
          {labourAmount > 0 && (
            <p className="text-text-muted">Labour: <span className="font-medium text-text">{formatPKR(labourAmount)}</span></p>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
          <p className="text-lg font-bold text-brand">Total: {formatPKR(grandTotal)}</p>
          <Button type="submit" variant="accent" loading={saving} disabled={!customerId || grandTotal <= 0}>
            Save service invoice
          </Button>
        </div>
      </form>

      {customerId && (
        <div className="rounded-[var(--radius-card)] border border-border bg-white p-6 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-sm font-bold text-brand">
              Customer ledger
              {customerLedger?.customer && (
                <span className="ml-2 font-normal text-text-muted">
                  {customerLedger.customer.code} · {customerLedger.customer.name}
                </span>
              )}
            </h2>
            {customerLedger && (
              <p className="text-sm text-text-muted">
                Balance: <strong>{formatLedgerBalance(customerLedger.summary.closingBalance)}</strong>
              </p>
            )}
          </div>
          {loadingLedger ? (
            <p className="text-sm text-text-muted">Loading ledger…</p>
          ) : (
            <DataTable
              compact
              columns={[
                { key: 'date', header: 'Date', render: (r) => formatDate(String(r.date)) },
                { key: 'voucherNo', header: 'Ref #' },
                { key: 'type', header: 'Type' },
                { key: 'description', header: 'Description' },
                {
                  key: 'debit',
                  header: 'Debit',
                  render: (r) => (Number(r.debit) > 0 ? formatLedgerAmount(Number(r.debit)) : '—'),
                },
                {
                  key: 'credit',
                  header: 'Credit',
                  render: (r) => (Number(r.credit) > 0 ? formatLedgerAmount(Number(r.credit)) : '—'),
                },
                {
                  key: 'balance',
                  header: 'Balance',
                  render: (r) => formatLedgerBalance(Number(r.balance)),
                },
              ]}
              data={(customerLedger?.rows ?? []) as Row[]}
              emptyMessage="No ledger entries for this customer yet"
            />
          )}
        </div>
      )}

      <div>
        <h2 className="mb-4 font-display text-sm font-bold text-brand">Recent service invoices</h2>
        <DataTable
          columns={[
            { key: 'reference', header: 'Invoice #' },
            {
              key: 'customer',
              header: 'Customer',
              render: (r) => String((r.customer as { name?: string })?.name ?? '—'),
            },
            { key: 'total', header: 'Total', render: (r) => formatPKR(Number(r.total)) },
            { key: 'createdAt', header: 'Date', render: (r) => String(r.createdAt).slice(0, 10) },
            {
              key: 'actions',
              header: '',
              render: (r) => {
                const ref = String(r.reference ?? r.id);
                return (
                  <PosInvoiceRowActions
                    reference={ref}
                    canEdit={false}
                    onView={() => openInvoice(Number(r.id))}
                    onDelete={() => deleteServiceInvoiceCompletely(Number(r.id))}
                    onChanged={bumpInvoiceLists}
                  />
                );
              },
            },
          ]}
          data={invoices}
          emptyMessage="No service invoices yet"
        />
      </div>

      <Modal
        open={invoiceModal !== null}
        onClose={() => { setInvoiceModal(null); setInvoiceData(null); }}
        title="Service Invoice"
        size="lg"
        tallContent
      >
        <ServiceInvoiceModalContent loading={invoiceLoading} invoice={invoiceData} />
      </Modal>
      <WorkspaceCloseBar className="mt-8" />
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
  const [customers, setCustomers] = useState<Row[]>([]);
  const [suppliers, setSuppliers] = useState<Row[]>([]);
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
      branchApi.branchCustomers(branchId, { limit: '100' }),
      branchApi.branchSuppliers(branchId, { limit: '100' }),
    ])
      .then(([cats, accts, custs, sups]) => {
        setCategories(cats as Row[]);
        setAccounts(accts as Row[]);
        setCustomers(custs.data as Row[]);
        setSuppliers(sups.data as Row[]);
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
    () => buildAccountSelectOptions(
      filteredAccounts.map((a) => ({
        id: Number(a.id),
        name: String(a.name),
        code: a.code,
      })),
      customers,
      suppliers,
    ),
    [filteredAccounts, customers, suppliers],
  );

  function handleCategoryChange(id: string) {
    if (id === categoryId) return;
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

  const rows = useMemo(() => (ledger?.rows as LedgerRow[]) ?? [], [ledger]);
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
            if (id === accountId) return;
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
                      key={`${r.voucherNo}-${r.date}-${r.description}-${ledgerRangeStart + i}`}
                      className={`border-b border-border/40 ${r.isOpeningRow ? 'bg-surface-alt/20 font-medium' : ''}`}
                    >
                      <td className="px-3 py-2.5 whitespace-nowrap">{r.date ? formatDate(r.date) : ''}</td>
                      <td className="px-3 py-2.5 font-mono text-xs">{r.voucherNo}</td>
                      <td className="px-3 py-2.5 text-text-muted">{r.ref || ''}</td>
                      <td className="px-3 py-2.5">{r.type}</td>
                      <td className="px-3 py-2.5 text-text-muted">{r.description || ''}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{r.debit > 0 ? formatLedgerAmount(r.debit) : ''}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{r.credit > 0 ? formatLedgerAmount(r.credit) : ''}</td>
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
                    <td className="px-3 py-3 text-right tabular-nums">{formatLedgerAmount(summary?.totalDebit ?? 0)}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{formatLedgerAmount(summary?.totalCredit ?? 0)}</td>
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
      <WorkspaceCloseBar className="mt-8" />
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

  const activeRows = useMemo(
    () => rows.filter((r) => {
      const d = Number(r.debit ?? splitTrialBalanceAmount(r.balance as number | string).debit);
      const c = Number(r.credit ?? splitTrialBalanceAmount(r.balance as number | string).credit);
      return d > 0 || c > 0;
    }),
    [rows],
  );

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
      <WorkspaceCloseBar className="mt-8" />
    </div>
  );
}

type FinancialYearRow = {
  id: number;
  label: string;
  startDate: string;
  endDate: string | null;
  status: 'ACTIVE' | 'CLOSED';
  closedAt: string | null;
};

function nextFiscalYearLabel(label: string): string {
  const startYear = parseInt(label.split('-')[0] ?? '', 10);
  return `${startYear + 1}-${startYear + 2}`;
}

export function FinancialYearPage() {
  const { user } = useAuth();
  const { canDelete, restrictedTitle } = useBranchPermission();
  const canManageFinancialYear = user?.role === 'ADMIN' || canDelete;
  const branchId = useBranchId();
  const { toast } = useToast();
  const [years, setYears] = useState<FinancialYearRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [closing, setClosing] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const activeYear = years.find((y) => y.status === 'ACTIVE');

  const loadYears = useCallback(async () => {
    if (!branchId || !canManageFinancialYear) return;
    setLoading(true);
    try {
      const data = await branchApi.financialYears(branchId);
      setYears(data as FinancialYearRow[]);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to load financial years', 'error');
    } finally {
      setLoading(false);
    }
  }, [branchId, toast, canManageFinancialYear]);

  useEffect(() => {
    loadYears();
  }, [loadYears]);

  if (!canManageFinancialYear) {
    return (
      <div>
        <PageHeader title="Financial Year" />
        <p className="text-sm text-text-muted">{restrictedTitle}</p>
        <WorkspaceCloseBar className="mt-8" />
      </div>
    );
  }

  async function handleCloseYear() {
    if (!branchId || !activeYear) return;
    setClosing(true);
    try {
      const result = await branchApi.closeFinancialYear(branchId);
      toast(
        `Closed ${result.closedYear.label}. New year ${result.newYear.label} is now active.`,
        'success',
      );
      setConfirmOpen(false);
      await loadYears();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to close financial year', 'error');
    } finally {
      setClosing(false);
    }
  }

  const nextLabel = activeYear ? nextFiscalYearLabel(activeYear.label) : '';

  return (
    <div>
      <PageHeader
        title="Financial Year"
        subtitle="Close the current year to snapshot balances and start fresh invoice numbering"
      />

      {loading ? (
        <p className="text-sm text-text-muted">Loading…</p>
      ) : activeYear ? (
        <div className="mb-8 rounded-xl border border-border bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Current active year</p>
              <p className="mt-1 font-display text-2xl font-bold text-brand">{activeYear.label}</p>
              <p className="mt-1 text-sm text-text-muted">
                Started {formatDate(activeYear.startDate)}
              </p>
            </div>
            <Button type="button" variant="accent" onClick={() => setConfirmOpen(true)}>
              <CalendarClock className="h-4 w-4" />
              Save Financial Year
            </Button>
          </div>
        </div>
      ) : (
        <p className="mb-8 text-sm text-warning">No active financial year found for this branch.</p>
      )}

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-muted">All years</h2>
      <div className="overflow-hidden rounded-xl border border-border bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-alt/60 text-left text-xs uppercase tracking-wide text-text-muted">
              <th className="px-4 py-3">Label</th>
              <th className="px-4 py-3">Start</th>
              <th className="px-4 py-3">End</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {years.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-text-muted">No financial years yet</td>
              </tr>
            ) : (
              years.map((y) => (
                <tr key={y.id} className="border-b border-border/40">
                  <td className="px-4 py-3 font-medium">{y.label}</td>
                  <td className="px-4 py-3 text-text-muted">{formatDate(y.startDate)}</td>
                  <td className="px-4 py-3 text-text-muted">{y.endDate ? formatDate(y.endDate) : '—'}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-medium ${
                        y.status === 'ACTIVE'
                          ? 'bg-success/10 text-success'
                          : 'bg-surface-alt text-text-muted'
                      }`}
                    >
                      {y.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {y.status === 'CLOSED' && (
                      <Link
                        to={`/branch/workspace/financial-year/${y.id}/ledger`}
                        className="text-sm font-medium text-brand hover:underline"
                      >
                        View Ledger Report
                      </Link>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal
        open={confirmOpen}
        onClose={() => !closing && setConfirmOpen(false)}
        title="Save Financial Year"
      >
        <p className="text-sm text-text-muted leading-relaxed">
          This will permanently close <strong>{activeYear?.label}</strong>. No voucher or invoice from
          this year can be edited or deleted afterward. A new year, <strong>{nextLabel}</strong>, will
          begin immediately with all voucher and invoice numbers restarting from 1. Account balances are
          not changed — this only saves a record and starts fresh counting. This cannot be undone.
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <Button type="button" variant="secondary" disabled={closing} onClick={() => setConfirmOpen(false)}>
            Cancel
          </Button>
          <Button type="button" variant="accent" disabled={closing} onClick={handleCloseYear}>
            {closing ? 'Saving…' : 'Confirm — close year'}
          </Button>
        </div>
      </Modal>

      <WorkspaceCloseBar className="mt-8" />
    </div>
  );
}

export function FinancialYearLedgerReportPage() {
  const { user } = useAuth();
  const { canDelete, restrictedTitle } = useBranchPermission();
  const canManageFinancialYear = user?.role === 'ADMIN' || canDelete;
  const branchId = useBranchId();
  const { financialYearId } = useParams<{ financialYearId: string }>();
  const { toast } = useToast();
  const [yearMeta, setYearMeta] = useState<FinancialYearRow | null>(null);
  const [categories, setCategories] = useState<Row[]>([]);
  const [accounts, setAccounts] = useState<Row[]>([]);
  const [customers, setCustomers] = useState<Row[]>([]);
  const [suppliers, setSuppliers] = useState<Row[]>([]);
  const [categoryId, setCategoryId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [ledger, setLedger] = useState<Row | null>(null);
  const [loading, setLoading] = useState(false);

  const yearId = financialYearId ? parseInt(financialYearId, 10) : NaN;

  useEffect(() => {
    if (!branchId || !Number.isFinite(yearId) || !canManageFinancialYear) return;
    branchApi.financialYears(branchId).then((years) => {
      const match = (years as FinancialYearRow[]).find((y) => y.id === yearId) ?? null;
      setYearMeta(match);
    }).catch(console.error);
    Promise.all([
      branchApi.accountingCategories(branchId),
      branchApi.accounts(branchId),
      branchApi.branchCustomers(branchId, { limit: '100' }),
      branchApi.branchSuppliers(branchId, { limit: '100' }),
    ])
      .then(([cats, accts, custs, sups]) => {
        setCategories(cats as Row[]);
        setAccounts(accts as Row[]);
        setCustomers(custs.data as Row[]);
        setSuppliers(sups.data as Row[]);
      })
      .catch(console.error);
  }, [branchId, yearId, canManageFinancialYear]);

  const categoryOptions: SearchSelectOption[] = useMemo(
    () => categories.map((c) => ({ value: String(c.id), label: String(c.name) })),
    [categories],
  );

  const filteredAccounts = useMemo(
    () => (categoryId ? accounts.filter((a) => String(a.categoryId) === categoryId) : []),
    [accounts, categoryId],
  );

  const accountOptions: SearchSelectOption[] = useMemo(
    () => buildAccountSelectOptions(
      filteredAccounts.map((a) => ({
        id: Number(a.id),
        name: String(a.name),
        code: a.code,
      })),
      customers,
      suppliers,
    ),
    [filteredAccounts, customers, suppliers],
  );

  async function loadLedger() {
    if (!branchId || !accountId || !Number.isFinite(yearId)) {
      setLedger(null);
      return;
    }
    setLoading(true);
    try {
      const params: { fromDate?: string; toDate?: string; financialYearId: string } = {
        financialYearId: String(yearId),
      };
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

  const rows = useMemo(() => (ledger?.rows as LedgerRow[]) ?? [], [ledger]);
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
      `${yearMeta?.label ?? 'FY'} — ${accountLabel}`,
      rows,
      {
        totalDebit: summary?.totalDebit ?? 0,
        totalCredit: summary?.totalCredit ?? 0,
        closingBalance: summary?.closingBalance ?? Number(ledger.balance ?? 0),
      },
      { from: fromDate || undefined, to: toDate || undefined },
    );
  }

  if (!canManageFinancialYear) {
    return (
      <div>
        <PageHeader title="Financial Year Ledger Report" />
        <p className="text-sm text-text-muted">{restrictedTitle}</p>
      </div>
    );
  }

  return (
    <div>
      {yearMeta && (
        <div className="mb-6 rounded-xl border border-border bg-surface-alt/40 px-4 py-3 text-sm text-text-muted">
          Viewing <strong className="text-brand">{yearMeta.label}</strong>
          {yearMeta.closedAt && (
            <> — Closed {formatDate(yearMeta.closedAt)}</>
          )}
          {' '}— Read-only historical record.
        </div>
      )}

      <PageHeader
        title="Financial Year Ledger Report"
        subtitle="Read-only ledger entries for a closed financial year"
      />

      <div className="mb-6 grid gap-4 lg:grid-cols-[1fr_1fr_auto_auto_auto] lg:items-end">
        <SearchSelect
          label="Category"
          value={categoryId}
          onChange={(id) => {
            setCategoryId(id);
            setAccountId('');
            setLedger(null);
          }}
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
          Load report
        </Button>
      </div>

      {loading && <p className="text-sm text-text-muted">Loading ledger…</p>}

      {!loading && ledger && (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            {account && (
              <p className="text-sm text-text-muted">
                {String(account.name)}
                {summary?.periodOpening != null && (
                  <span className="ml-3">
                    Opening: {formatLedgerBalance(summary.periodOpening)}
                  </span>
                )}
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
                    rows.map((r, i) => (
                      <tr
                        key={`${r.voucherNo}-${r.date}-${r.description}-${i}`}
                        className={`border-b border-border/40 ${r.isOpeningRow ? 'bg-surface-alt/20 font-medium' : ''}`}
                      >
                        <td className="px-3 py-2.5 whitespace-nowrap">{r.date ? formatDate(r.date) : ''}</td>
                        <td className="px-3 py-2.5 font-mono text-xs">{r.voucherNo}</td>
                        <td className="px-3 py-2.5 text-text-muted">{r.ref || ''}</td>
                        <td className="px-3 py-2.5">{r.type}</td>
                        <td className="px-3 py-2.5 text-text-muted">{r.description || ''}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{r.debit > 0 ? formatLedgerAmount(r.debit) : ''}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{r.credit > 0 ? formatLedgerAmount(r.credit) : ''}</td>
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
                      <td className="px-3 py-3 text-right tabular-nums">{formatLedgerAmount(summary?.totalDebit ?? 0)}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{formatLedgerAmount(summary?.totalCredit ?? 0)}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-brand">
                        {formatLedgerBalance(summary?.closingBalance ?? Number(ledger.balance ?? 0))}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </>
      )}

      <div className="mt-8">
        <Link to="/branch/workspace/financial-year" className="text-sm font-medium text-brand hover:underline">
          ← Back to Financial Year
        </Link>
      </div>
    </div>
  );
}
