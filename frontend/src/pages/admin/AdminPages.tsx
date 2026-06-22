import { type FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { adminApi } from '../../api/client';
import { PageHeader } from '../../components/layout/PageTransition';
import { DataTable, StatusBadge } from '../../components/ui/DataTable';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Input, Select, Textarea } from '../../components/ui/Input';
import { FormActions, RowActions, useDeleteConfirm } from '../../components/crud/CrudHelpers';
import { clearPendingImages, primaryFromImages, ProductImageUpload, type ExistingImage, type PendingImage, type PrimarySelection } from '../../components/crud/ProductImageUpload';
import { EvSpecsFields } from '../../components/crud/EvSpecsFields';
import { parseEvSpecsFromForm } from '../../lib/evSpecs';
import { exportToPdf, type ReportColumn } from '../../lib/reportExport';
import { useToast } from '../../contexts/ToastContext';

type Row = Record<string, unknown>;

function CatalogActiveBadge({ active }: { active: boolean }) {
  return (
    <Badge variant={active ? 'success' : 'danger'}>
      {active ? 'Active' : 'Inactive'}
    </Badge>
  );
}

function parseFormPrice(value: FormDataEntryValue | null, label: string): number {
  const raw = String(value ?? '').trim();
  if (!raw) throw new Error(`${label} is required`);
  const n = parseFloat(raw);
  if (!Number.isFinite(n) || n <= 0 || n >= 10_000_000_000) {
    throw new Error(`${label} must be a valid amount under 10 billion PKR`);
  }
  return n;
}

function parseOptionalFormPrice(value: FormDataEntryValue | null, label: string): number | undefined {
  const raw = String(value ?? '').trim();
  if (!raw) return undefined;
  const n = parseFloat(raw);
  if (!Number.isFinite(n) || n <= 0 || n >= 10_000_000_000) {
    throw new Error(`${label} must be a valid amount under 10 billion PKR`);
  }
  return n;
}

function useCrudList(loader: () => Promise<unknown>, deps: readonly unknown[] = []) {
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(() => {
    setLoading(true);
    loaderRef.current()
      .then((r) => {
        const list = Array.isArray(r) ? r : (r as { data: unknown[] }).data;
        setRows(list as Row[]);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reload, ...deps]);

  return { rows, setRows, loading, reload };
}

// ─── Branches ────────────────────────────────────────────────────────────────

export function AdminBranchesPage() {
  const { toast } = useToast();
  const { rows, reload } = useCrudList(() => adminApi.branches() as Promise<Row[]>);
  const [modal, setModal] = useState<'create' | 'edit' | null>(null);
  const [edit, setEdit] = useState<Row | null>(null);
  const [saving, setSaving] = useState(false);
  const del = useDeleteConfirm<Row>(
    async (item) => {
      const result = await adminApi.deleteBranch(Number(item.id));
      toast(
        result.deactivated
          ? 'Branch deactivated (orders/history kept on file)'
          : 'Branch deleted',
        'success'
      );
      setModal(null);
      setEdit(null);
      reload();
    },
    {
      message: (item) =>
        `Delete branch "${String(item.name)}"? Branches with orders or history will be deactivated instead of permanently removed.`,
    }
  );

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const body = {
      name: String(fd.get('name')),
      location: String(fd.get('location')),
      phone: String(fd.get('phone')),
      whatsapp: String(fd.get('whatsapp') || '') || undefined,
      description: String(fd.get('description') || '') || undefined,
      ...(modal === 'edit' && { isActive: fd.get('isActive') === 'true' }),
    };
    setSaving(true);
    try {
      if (modal === 'edit' && edit) await adminApi.updateBranch(Number(edit.id), body);
      else await adminApi.createBranch(body as { name: string; location: string; phone: string; whatsapp?: string });
      toast(modal === 'edit' ? 'Branch updated' : 'Branch created', 'success');
      setModal(null);
      reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader title="Branches" subtitle="Manage all Crown Eve branches" action={<Button variant="accent" onClick={() => { setEdit(null); setModal('create'); }}>Add Branch</Button>} />
      <DataTable
        columns={[
          { key: 'name', header: 'Name' },
          { key: 'location', header: 'Location' },
          { key: 'phone', header: 'Phone' },
          { key: 'isActive', header: 'Status', render: (r) => <StatusBadge status={r.isActive ? 'CONFIRMED' : 'CANCELLED'} /> },
          { key: 'actions', header: 'Actions', className: 'whitespace-nowrap w-28', render: (r) => (
            <RowActions
              onEdit={() => { setEdit(r); setModal('edit'); }}
              onDelete={() => del.setTarget(r)}
              deleteLabel="Delete"
            />
          ) },
        ]}
        data={rows}
      />
      {del.modal}
      <Modal open={!!modal} onClose={() => setModal(null)} title={modal === 'edit' ? 'Edit Branch' : 'New Branch'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input name="name" label="Name" required defaultValue={String(edit?.name ?? '')} />
          <Input name="location" label="Location" required defaultValue={String(edit?.location ?? '')} />
          <Input name="phone" label="Phone" required defaultValue={String(edit?.phone ?? '')} />
          <Input name="whatsapp" label="WhatsApp" defaultValue={String(edit?.whatsapp ?? '')} />
          <Textarea name="description" label="About-page description (shown on About Us)" rows={3} defaultValue={String(edit?.description ?? '')} />
          {modal === 'edit' && (
            <Select name="isActive" label="Active" defaultValue={String(edit?.isActive ?? true)}>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </Select>
          )}
          {modal === 'edit' ? (
            <div className="mt-6 flex items-center justify-between gap-2">
              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={() => edit && del.setTarget(edit)}
              >
                Delete Branch
              </Button>
              <div className="flex gap-2">
                <Button type="button" variant="secondary" onClick={() => setModal(null)}>Cancel</Button>
                <Button type="submit" variant="accent" loading={saving}>Save</Button>
              </div>
            </div>
          ) : (
            <FormActions onCancel={() => setModal(null)} loading={saving} />
          )}
        </form>
      </Modal>
    </div>
  );
}

// ─── Catalog (Bikes + Parts unified) ─────────────────────────────────────────

type CatalogTab = 'bikes' | 'parts';

export function AdminProductsPage() {
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab: CatalogTab = searchParams.get('tab') === 'parts' ? 'parts' : 'bikes';
  const productType = tab === 'bikes' ? 'BIKE' : 'PART';

  const loadProducts = useCallback(
    () => adminApi.products({ type: productType }),
    [productType]
  );
  const { rows, reload } = useCrudList(loadProducts, [productType]);

  const [modal, setModal] = useState<'create' | 'edit' | null>(null);
  const [edit, setEdit] = useState<Row | null>(null);
  const [saving, setSaving] = useState(false);
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const [existingImages, setExistingImages] = useState<ExistingImage[]>([]);
  const [primarySelection, setPrimarySelection] = useState<PrimarySelection | null>(null);
  const del = useDeleteConfirm<Row>(
    async (item) => {
      await adminApi.deleteProduct(String(item.id));
      toast('Removed from catalog', 'success');
      reload();
    },
    { message: (row) => `Delete "${String(row.name)}"? It will be removed from the shop and hidden from this list.` },
  );

  function resetImageState() {
    setPendingImages((prev) => {
      clearPendingImages(prev);
      return [];
    });
    setExistingImages([]);
    setPrimarySelection(null);
  }

  function closeModal() {
    resetImageState();
    setModal(null);
    setEdit(null);
  }

  function switchTab(next: CatalogTab) {
    closeModal();
    if (next === 'parts') setSearchParams({ tab: 'parts' });
    else setSearchParams({});
  }

  function openCreateModal() {
    resetImageState();
    setEdit(null);
    setModal('create');
  }

  function openEditModal(row: Row) {
    resetImageState();
    const imgs = (row.images as ExistingImage[] | undefined) ?? [];
    setExistingImages(imgs);
    setPrimarySelection(primaryFromImages(imgs, []));
    setEdit(row);
    setModal('edit');
  }

  async function removeExistingImage(imageId: number) {
    if (!edit) return;
    try {
      await adminApi.deleteProductImage(String(edit.id), imageId);
      const next = existingImages.filter((i) => i.id !== imageId);
      setExistingImages(next);
      if (primarySelection?.type === 'existing' && primarySelection.id === imageId) {
        setPrimarySelection(primaryFromImages(next, pendingImages));
      }
      toast('Image removed', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to remove image', 'error');
    }
  }

  async function attachImages(
    productId: string,
    files: PendingImage[],
    existingCount: number,
    primary: PrimarySelection | null
  ) {
    if (!files.length) return;
    const { urls } = await adminApi.uploadProductImages(files.map((f) => f.file));
    const pendingPrimaryId = primary?.type === 'pending' ? primary.id : null;
    for (let i = 0; i < urls.length; i++) {
      const pendingId = files[i].id;
      const isPrimary = pendingPrimaryId === pendingId;
      await adminApi.addProductImage(productId, urls[i], isPrimary, existingCount + i);
    }
  }

  async function applyPrimarySelection(productId: string, primary: PrimarySelection | null) {
    if (!primary || primary.type !== 'existing') return;
    await adminApi.setProductImagePrimary(productId, primary.id);
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    let body: Record<string, unknown>;
    try {
      const salePrice = parseOptionalFormPrice(fd.get('salePrice'), 'Sale price');
      body = {
        name: String(fd.get('name')).trim(),
        type: productType,
        price: parseFormPrice(fd.get('price'), 'Price'),
        description: String(fd.get('description') || '').trim() || undefined,
        ...(salePrice !== undefined && { salePrice }),
        ...(tab === 'bikes' && { specs: parseEvSpecsFromForm(fd) }),
        ...(modal === 'edit' && { isActive: fd.get('isActive') === 'true' }),
      };
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Invalid form values', 'error');
      return;
    }
    setSaving(true);
    try {
      let productId = edit ? String(edit.id) : '';
      if (modal === 'edit' && edit) {
        await adminApi.updateProduct(String(edit.id), body);
      } else {
        const created = await adminApi.createProduct(body);
        productId = String(created.id);
      }
      if (tab === 'bikes') {
        const existingCount = modal === 'edit' ? existingImages.length : 0;
        if (pendingImages.length) {
          await attachImages(productId, pendingImages, existingCount, primarySelection);
        }
        if (primarySelection?.type === 'existing') {
          await applyPrimarySelection(productId, primarySelection);
        }
      }
      toast(modal === 'edit' ? 'Saved' : 'Created', 'success');
      closeModal();
      reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed', 'error');
    } finally {
      setSaving(false);
    }
  }

  const tabLabel = tab === 'bikes' ? 'Electric Bikes' : 'Parts & Accessories';

  return (
    <div>
      <PageHeader
        title="Catalog"
        subtitle="One catalog for everything. Switch between electric bikes and parts"
        action={
          <Button variant="accent" onClick={openCreateModal}>
            {tab === 'bikes' ? 'Add Bike' : 'Add Part'}
          </Button>
        }
      />

      <div className="mb-6 flex flex-wrap gap-2">
        <Button
          type="button"
          variant={tab === 'bikes' ? 'accent' : 'secondary'}
          size="sm"
          onClick={() => switchTab('bikes')}
        >
          Electric Bikes
        </Button>
        <Button
          type="button"
          variant={tab === 'parts' ? 'accent' : 'secondary'}
          size="sm"
          onClick={() => switchTab('parts')}
        >
          Parts & Accessories
        </Button>
      </div>

      <p className="mb-4 text-sm text-text-muted">
        Showing <strong className="text-brand">{tabLabel}</strong>, same as the public shop filter (Bikes / Parts).
      </p>

      <DataTable
        columns={[
          ...(tab === 'bikes' ? [{
            key: 'image',
            header: 'Image',
            render: (r: Row) => {
              const imgs = r.images as { url: string; isPrimary?: boolean }[] | undefined;
              const url = imgs?.find((i) => i.isPrimary)?.url ?? imgs?.[0]?.url;
              return url ? (
                <img src={url} alt="" className="h-10 w-10 rounded-lg object-cover" />
              ) : (
                <span className="text-xs text-text-muted"></span>
              );
            },
          }] : []),
          { key: 'name', header: 'Name' },
          { key: 'price', header: 'Price', render: (r) => `PKR ${Number(r.price).toLocaleString()}` },
          {
            key: 'salePrice',
            header: 'Sale',
            render: (r) => r.salePrice ? `PKR ${Number(r.salePrice).toLocaleString()}` : '',
          },
          { key: 'isActive', header: 'Status', render: (r) => <CatalogActiveBadge active={Boolean(r.isActive)} /> },
          {
            key: 'actions',
            header: '',
            render: (r) => (
              <RowActions
                onEdit={() => openEditModal(r)}
                onDelete={() => del.setTarget(r)}
              />
            ),
          },
        ]}
        data={rows}
        emptyMessage={tab === 'bikes' ? 'No bikes in catalog yet' : 'No parts in catalog yet'}
      />
      {del.modal}
      <Modal
        open={!!modal}
        onClose={closeModal}
        title={modal === 'edit' ? `Edit ${tab === 'bikes' ? 'Bike' : 'Part'}` : `New ${tab === 'bikes' ? 'Bike' : 'Part'}`}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="flex flex-col">
          <div className="space-y-4">
            {tab === 'bikes' && (
              <ProductImageUpload
                pending={pendingImages}
                existing={existingImages}
                primary={primarySelection}
                onPendingChange={setPendingImages}
                onPrimaryChange={setPrimarySelection}
                onRemoveExisting={modal === 'edit' ? removeExistingImage : undefined}
              />
            )}
            <Input name="name" label="Name" required defaultValue={String(edit?.name ?? '')} />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input name="price" label="Price (PKR)" type="number" step="0.01" required defaultValue={String(edit?.price ?? '')} />
              <Input name="salePrice" label="Sale Price (optional)" type="number" step="0.01" defaultValue={String(edit?.salePrice ?? '')} />
            </div>
            <Textarea name="description" label="Description" rows={3} defaultValue={String(edit?.description ?? '')} />
            {tab === 'bikes' && (
              <EvSpecsFields specs={edit?.specs as Record<string, string> | undefined} />
            )}
            {modal === 'edit' && (
              <Select name="isActive" label="Active" defaultValue={String(edit?.isActive ?? true)}>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </Select>
            )}
          </div>
          <div className="sticky bottom-0 mt-6 border-t border-border bg-white pt-4">
            <FormActions onCancel={closeModal} loading={saving} />
          </div>
        </form>
      </Modal>
    </div>
  );
}

/** @deprecated Use /admin/products?tab=parts */
export function AdminPartsPage() {
  return <Navigate to="/admin/products?tab=parts" replace />;
}

// ─── Users ───────────────────────────────────────────────────────────────────

export function AdminUsersPage() {
  const { toast } = useToast();
  const { rows, reload } = useCrudList(() => adminApi.users());
  const [modal, setModal] = useState<'create' | 'edit' | null>(null);
  const [edit, setEdit] = useState<Row | null>(null);
  const [saving, setSaving] = useState(false);
  const del = useDeleteConfirm<Row>(async (item) => {
    await adminApi.deleteUser(String(item.id));
    toast('User deleted', 'success');
    reload();
  });

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const body: Record<string, unknown> = {
      firstName: String(fd.get('firstName')),
      lastName: String(fd.get('lastName')),
      role: String(fd.get('role')),
      phone: String(fd.get('phone') || '') || undefined,
      city: String(fd.get('city') || '') || undefined,
      ...(fd.get('branchId') && { branchId: parseInt(String(fd.get('branchId')), 10) }),
      ...(modal === 'edit' && { isActive: fd.get('isActive') === 'true' }),
    };
    if (modal === 'create') {
      body.email = String(fd.get('email'));
      body.password = String(fd.get('password'));
    }
    setSaving(true);
    try {
      if (modal === 'edit' && edit) await adminApi.updateUser(String(edit.id), body);
      else await adminApi.createUser(body);
      toast(modal === 'edit' ? 'User updated' : 'User created', 'success');
      setModal(null);
      reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader title="Users" subtitle="Manage accounts and roles" action={<Button variant="accent" onClick={() => { setEdit(null); setModal('create'); }}>Add User</Button>} />
      <DataTable
        columns={[
          { key: 'email', header: 'Email' },
          { key: 'firstName', header: 'Name', render: (r) => `${r.firstName} ${r.lastName}` },
          { key: 'role', header: 'Role' },
          { key: 'isVerified', header: 'Verified', render: (r) => r.isVerified ? 'Yes' : 'No' },
          { key: 'actions', header: '', render: (r) => <RowActions onEdit={() => { setEdit(r); setModal('edit'); }} onDelete={() => del.setTarget(r)} /> },
        ]}
        data={rows}
      />
      {del.modal}
      <Modal open={!!modal} onClose={() => setModal(null)} title={modal === 'edit' ? 'Edit User' : 'New User'} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          {modal === 'create' && (
            <>
              <Input name="email" label="Email" type="email" required />
              <Input name="password" label="Password" type="password" required minLength={8} />
            </>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input name="firstName" label="First Name" required defaultValue={String(edit?.firstName ?? '')} />
            <Input name="lastName" label="Last Name" required defaultValue={String(edit?.lastName ?? '')} />
          </div>
          <Select name="role" label="Role" required defaultValue={String(edit?.role ?? 'CUSTOMER')}>
            <option value="ADMIN">Admin</option>
            <option value="BRANCH_OWNER">Branch Owner</option>
            <option value="CUSTOMER">Customer</option>
          </Select>
          <Input name="branchId" label="Branch ID (for branch owner)" type="number" defaultValue={String(edit?.branchId ?? '')} />
          <Input name="phone" label="Phone" defaultValue={String(edit?.phone ?? '')} />
          <Input name="city" label="City" defaultValue={String(edit?.city ?? '')} />
          {modal === 'edit' && (
            <Select name="isActive" label="Active" defaultValue={String(edit?.isActive ?? true)}>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </Select>
          )}
          <FormActions onCancel={() => setModal(null)} loading={saving} />
        </form>
      </Modal>
    </div>
  );
}

// ─── Orders ──────────────────────────────────────────────────────────────────

type OrderExportRow = {
  trackingId: string;
  branch: string;
  customer: string;
  type: string;
  status: string;
  total: string | number;
  paymentMethod: string;
  paymentStatus: string;
  createdAt: string;
};

const ORDER_EXPORT_COLUMNS: ReportColumn<OrderExportRow>[] = [
  { header: 'Tracking', value: (r) => r.trackingId },
  { header: 'Branch', value: (r) => r.branch },
  { header: 'Customer', value: (r) => r.customer },
  { header: 'Type', value: (r) => r.type },
  { header: 'Status', value: (r) => r.status },
  { header: 'Total (PKR)', value: (r) => Number(r.total).toLocaleString() },
  { header: 'Payment', value: (r) => r.paymentMethod },
  { header: 'Pay Status', value: (r) => r.paymentStatus },
  { header: 'Date', value: (r) => new Date(r.createdAt).toLocaleDateString() },
];

export function AdminOrdersPage() {
  const { toast } = useToast();
  const [branches, setBranches] = useState<Row[]>([]);
  const [branchFilter, setBranchFilter] = useState('');
  const [downloading, setDownloading] = useState(false);

  const loadOrders = useCallback(
    () => adminApi.orders(branchFilter ? { branchId: branchFilter } : undefined),
    [branchFilter],
  );
  const { rows, loading } = useCrudList(loadOrders, [branchFilter]);

  useEffect(() => {
    adminApi.branches().then((b) => setBranches(b as Row[])).catch(console.error);
  }, []);

  async function downloadOrdersPdf() {
    setDownloading(true);
    try {
      const data = await adminApi.exportOrders(branchFilter ? { branchId: branchFilter } : undefined);
      const exportRows: OrderExportRow[] = data.map((row) => ({
        trackingId: String(row.trackingId ?? ''),
        branch: String(row.branch ?? ''),
        customer: String(row.customer ?? ''),
        type: String(row.type ?? ''),
        status: String(row.status ?? ''),
        total: row.total as string | number,
        paymentMethod: String(row.paymentMethod ?? ''),
        paymentStatus: String(row.paymentStatus ?? ''),
        createdAt: String(row.createdAt ?? ''),
      }));
      const branchName = branchFilter
        ? String(branches.find((b) => String(b.id) === branchFilter)?.name ?? 'branch')
        : 'all-branches';
      await exportToPdf(`orders_${branchName}`, ORDER_EXPORT_COLUMNS, exportRows, {
        title: 'Orders Report',
        subtitle: branchFilter
          ? `Branch: ${branches.find((b) => String(b.id) === branchFilter)?.name ?? branchFilter}`
          : 'All branches',
      });
      toast('PDF downloaded', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to download PDF', 'error');
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="All Orders"
        subtitle="View only. Branch owners update order status"
        action={
          <Button variant="accent" size="sm" loading={downloading} onClick={downloadOrdersPdf}>
            Download PDF
          </Button>
        }
      />

      <div className="mb-4 max-w-xs">
        <Select
          label="Filter by branch"
          value={branchFilter}
          onChange={(e) => setBranchFilter(e.target.value)}
        >
          <option value="">All branches</option>
          {branches.map((b) => (
            <option key={String(b.id)} value={String(b.id)}>{String(b.name)}</option>
          ))}
        </Select>
      </div>

      <DataTable
        columns={[
          { key: 'trackingId', header: 'Tracking' },
          { key: 'branch', header: 'Branch', render: (r) => (r.branch as { name: string })?.name ?? '' },
          { key: 'type', header: 'Type' },
          { key: 'status', header: 'Status', render: (r) => <StatusBadge status={String(r.status)} /> },
          { key: 'total', header: 'Total', render: (r) => `PKR ${Number(r.total).toLocaleString()}` },
        ]}
        data={rows}
        emptyMessage={loading ? 'Loading…' : 'No orders found'}
      />
    </div>
  );
}

// ─── Bookings ────────────────────────────────────────────────────────────────

type BookingExportRow = {
  id: string | number;
  branch: string;
  service: string;
  customer: string;
  date: string;
  time: string;
  status: string;
  price: string | number;
};

const BOOKING_EXPORT_COLUMNS: ReportColumn<BookingExportRow>[] = [
  { header: 'ID', value: (r) => r.id },
  { header: 'Branch', value: (r) => r.branch },
  { header: 'Service', value: (r) => r.service },
  { header: 'Customer', value: (r) => r.customer },
  { header: 'Date', value: (r) => r.date },
  { header: 'Time', value: (r) => r.time ?? '' },
  { header: 'Status', value: (r) => r.status },
  { header: 'Price (PKR)', value: (r) => Number(r.price).toLocaleString() },
];

export function AdminBookingsPage() {
  const { toast } = useToast();
  const [branches, setBranches] = useState<Row[]>([]);
  const [branchFilter, setBranchFilter] = useState('');
  const [downloading, setDownloading] = useState(false);

  const loadBookings = useCallback(
    () => adminApi.bookings(branchFilter ? { branchId: branchFilter } : undefined),
    [branchFilter],
  );
  const { rows, loading } = useCrudList(loadBookings, [branchFilter]);

  useEffect(() => {
    adminApi.branches().then((b) => setBranches(b as Row[])).catch(console.error);
  }, []);

  async function downloadBookingsPdf() {
    setDownloading(true);
    try {
      const data = await adminApi.exportBookings(branchFilter ? { branchId: branchFilter } : undefined);
      const exportRows: BookingExportRow[] = data.map((row) => ({
        id: row.id as string | number,
        branch: String(row.branch ?? ''),
        service: String(row.service ?? ''),
        customer: String(row.customer ?? ''),
        date: String(row.date ?? ''),
        time: String(row.time ?? ''),
        status: String(row.status ?? ''),
        price: row.price as string | number,
      }));
      const branchName = branchFilter
        ? String(branches.find((b) => String(b.id) === branchFilter)?.name ?? 'branch')
        : 'all-branches';
      await exportToPdf(`bookings_${branchName}`, BOOKING_EXPORT_COLUMNS, exportRows, {
        title: 'Service Bookings Report',
        subtitle: branchFilter
          ? `Branch: ${branches.find((b) => String(b.id) === branchFilter)?.name ?? branchFilter}`
          : 'All branches',
      });
      toast('PDF downloaded', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to download PDF', 'error');
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Service Bookings"
        subtitle="View only. Branch owners update booking status"
        action={
          <Button variant="accent" size="sm" loading={downloading} onClick={downloadBookingsPdf}>
            Download PDF
          </Button>
        }
      />

      <div className="mb-4 max-w-xs">
        <Select
          label="Filter by branch"
          value={branchFilter}
          onChange={(e) => setBranchFilter(e.target.value)}
        >
          <option value="">All branches</option>
          {branches.map((b) => (
            <option key={String(b.id)} value={String(b.id)}>{String(b.name)}</option>
          ))}
        </Select>
      </div>

      <DataTable
        columns={[
          { key: 'id', header: 'ID' },
          { key: 'branch', header: 'Branch', render: (r) => (r.branch as { name: string })?.name ?? '' },
          { key: 'service', header: 'Service', render: (r) => (r.service as { name: string })?.name ?? '' },
          { key: 'date', header: 'Date', render: (r) => (r.date ? String(r.date).slice(0, 10) : '') },
          { key: 'status', header: 'Status', render: (r) => <StatusBadge status={String(r.status)} /> },
        ]}
        data={rows}
        emptyMessage={loading ? 'Loading…' : 'No bookings found'}
      />
    </div>
  );
}

// ─── Testimonials ────────────────────────────────────────────────────────────

export function AdminTestimonialsPage() {
  const { toast } = useToast();
  const { rows, reload, loading } = useCrudList(() => adminApi.testimonialsAll());
  const [modal, setModal] = useState<'create' | 'edit' | null>(null);
  const [edit, setEdit] = useState<Row | null>(null);
  const [saving, setSaving] = useState(false);
  const del = useDeleteConfirm<Row>(async (item) => {
    await adminApi.deleteTestimonial(Number(item.id));
    toast('Testimonial deleted', 'success');
    reload();
  });

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const body = {
      customerName: String(fd.get('customerName')),
      content: String(fd.get('content')),
      rating: parseInt(String(fd.get('rating') || '5'), 10),
    };
    setSaving(true);
    try {
      if (modal === 'edit' && edit) await adminApi.updateTestimonial(Number(edit.id), body);
      else await adminApi.createTestimonial(body);
      toast(modal === 'edit' ? 'Updated' : 'Created', 'success');
      setModal(null);
      reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function approve(id: number, approved: boolean) {
    try {
      if (approved) await adminApi.approveTestimonial(id);
      else await adminApi.rejectTestimonial(id);
      toast(approved ? 'Approved' : 'Rejected', 'success');
      reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed', 'error');
    }
  }

  return (
    <div>
      <PageHeader
        title="Testimonials"
        subtitle="Manage customer testimonials"
        action={<Button variant="accent" onClick={() => { setEdit(null); setModal('create'); }}>Add Testimonial</Button>}
      />
      <DataTable
        columns={[
          { key: 'customerName', header: 'Customer' },
          { key: 'content', header: 'Content', render: (r) => <span className="line-clamp-2 max-w-xs">{String(r.content)}</span> },
          { key: 'rating', header: 'Rating', render: (r) => `${String(r.rating ?? 5)} ★` },
          {
            key: 'actions',
            header: '',
            render: (r) => (
              <RowActions
                onEdit={() => { setEdit(r); setModal('edit'); }}
                onDelete={() => del.setTarget(r)}
                extra={r.status === 'PENDING' ? (
                  <>
                    <Button size="sm" variant="accent" onClick={() => approve(Number(r.id), true)}>Approve</Button>
                    <Button size="sm" variant="danger" onClick={() => approve(Number(r.id), false)}>Reject</Button>
                  </>
                ) : undefined}
              />
            ),
          },
        ]}
        data={rows}
        emptyMessage={loading ? 'Loading…' : 'No testimonials yet'}
      />
      {del.modal}
      <Modal open={!!modal} onClose={() => setModal(null)} title={modal === 'edit' ? 'Edit Testimonial' : 'New Testimonial'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input name="customerName" label="Customer Name" required defaultValue={String(edit?.customerName ?? '')} />
          <Textarea name="content" label="Content" rows={4} required defaultValue={String(edit?.content ?? '')} />
          <Input name="rating" label="Rating (1-5)" type="number" min={1} max={5} defaultValue={String(edit?.rating ?? 5)} />
          <FormActions onCancel={() => setModal(null)} loading={saving} />
        </form>
      </Modal>
    </div>
  );
}

// ─── Reports ─────────────────────────────────────────────────────────────────

export function AdminReportsPage() {
  const token = localStorage.getItem('token');
  const reports = [
    { label: 'Orders Report', href: '/api/reports/export/orders?format=csv' },
    { label: 'Bookings Report', href: '/api/reports/export/bookings?format=csv' },
    { label: 'Inventory Report', href: '/api/reports/export/inventory?format=csv' },
  ];

  async function download(href: string, label: string) {
    const res = await fetch(href, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    if (!res.ok) return;
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${label.toLowerCase().replace(/\s/g, '-')}.csv`;
    a.click();
  }

  return (
    <div>
      <PageHeader title="Reports & Export" subtitle="Download cross-branch reports as CSV" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {reports.map((r) => (
          <button
            key={r.label}
            type="button"
            onClick={() => download(r.href, r.label)}
            className="rounded-[var(--radius-card)] border border-border bg-white p-6 text-left shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-card-hover)] transition-shadow"
          >
            <p className="font-semibold text-brand">{r.label}</p>
            <p className="text-sm text-text-muted mt-1">Download CSV</p>
          </button>
        ))}
      </div>
    </div>
  );
}
