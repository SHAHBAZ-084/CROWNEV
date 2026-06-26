import { type FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { Building2, Receipt, ShoppingCart, Users } from 'lucide-react';
import { adminApi } from '../../api/client';
import { PageHeader } from '../../components/layout/PageTransition';
import { DataTable, StatusBadge } from '../../components/ui/DataTable';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Input, Select, Textarea } from '../../components/ui/Input';
import { StatCard } from '../../components/ui/StatCard';
import { FormActions, RowActions, useDeleteConfirm } from '../../components/crud/CrudHelpers';
import { BranchPhotoField } from '../../components/crud/BranchPhotoField';
import { clearPendingImages, primaryFromImages, ProductImageUpload, type ExistingImage, type PendingImage, type PrimarySelection } from '../../components/crud/ProductImageUpload';
import { EvSpecsFields } from '../../components/crud/EvSpecsFields';
import { PartDetailFields, parsePartDetailFromForm, validatePartDetailFromForm } from '../../components/crud/PartDetailFields';
import {
  parseColorOptionsFromForm,
  parseEvSpecsFromForm,
  validateEvSpecsFromForm,
} from '../../lib/evSpecs';
import {
  exportSalesSummaryPdf,
  exportToPdf,
  INVENTORY_EXPORT_COLUMNS,
  ORDER_EXPORT_COLUMNS,
  type InventoryExportRow,
  type OrderExportRow,
  type ReportColumn,
} from '../../lib/reportExport';
import { formatDate, formatPKR } from '../../lib/format';
import { resolveUploadUrl } from '../../lib/media';
import { useDebounce } from '../../hooks/useDebounce';
import { useToast } from '../../contexts/ToastContext';

const API_BASE = import.meta.env.VITE_API_URL ?? '/api';

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

function parseCoord(value: FormDataEntryValue | null): number | null | undefined {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  const n = parseFloat(raw);
  if (!Number.isFinite(n)) return undefined;
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

function ClearBranchDataModal({
  branch,
  open,
  onClose,
  onCleared,
}: {
  branch: Row | null;
  open: boolean;
  onClose: () => void;
  onCleared: () => void;
}) {
  const { toast } = useToast();
  const [preview, setPreview] = useState<{ branchName: string; counts: Record<string, number> } | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [confirmName, setConfirmName] = useState('');
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    if (!open || !branch) {
      setPreview(null);
      setConfirmName('');
      return;
    }
    setLoadingPreview(true);
    adminApi
      .branchClearPreview(Number(branch.id))
      .then((data) => setPreview({ branchName: data.branchName, counts: data.counts }))
      .catch((err) => toast(err instanceof Error ? err.message : 'Failed to load preview', 'error'))
      .finally(() => setLoadingPreview(false));
  }, [open, branch, toast]);

  const branchName = String(preview?.branchName ?? branch?.name ?? '');
  const canConfirm = confirmName.trim() === branchName.trim() && !clearing;

  async function handleClear() {
    if (!branch || !canConfirm) return;
    setClearing(true);
    try {
      const result = await adminApi.clearBranchData(Number(branch.id), confirmName.trim());
      const total = Object.values(result.deleted).reduce((sum, n) => sum + n, 0);
      toast(`Branch data cleared (${total} records removed). Catalog parts/bikes were kept.`, 'success');
      onClose();
      onCleared();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to clear branch data', 'error');
    } finally {
      setClearing(false);
    }
  }

  const previewLines = preview
    ? [
        ['Sales & orders', preview.counts.orders],
        ['Customers', preview.counts.customers],
        ['Suppliers', preview.counts.suppliers],
        ['Purchases', preview.counts.purchases],
        ['Service invoices', preview.counts.serviceInvoices],
        ['Vouchers', preview.counts.vouchers],
        ['Part stock rows', preview.counts.inventory],
        ['Product listings', preview.counts.branchProducts],
        ['Service bookings', preview.counts.bookings],
        ['Accounts', preview.counts.accounts],
      ].filter(([, n]) => n > 0)
    : [];

  return (
    <Modal open={open} onClose={onClose} title="Clear branch data" size="md">
      <div className="space-y-4">
        <p className="text-sm text-text-muted">
          Permanently removes all operational data for <strong>{branchName}</strong>: POS sales, customers,
          suppliers, purchases, vouchers, accounting entries, inventory stock, and branch product listings.
          Global parts and bikes in the admin catalog are <strong>not</strong> deleted.
        </p>
        {loadingPreview ? (
          <p className="text-sm text-text-muted">Loading record counts…</p>
        ) : previewLines.length > 0 ? (
          <ul className="rounded-lg border border-border bg-surface-muted/40 px-4 py-3 text-sm">
            {previewLines.map(([label, count]) => (
              <li key={String(label)} className="flex justify-between gap-4 py-0.5">
                <span>{label}</span>
                <span className="font-medium tabular-nums">{count}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-text-muted">No branch data found to clear.</p>
        )}
        <Input
          label={`Type "${branchName}" to confirm`}
          value={confirmName}
          onChange={(e) => setConfirmName(e.target.value)}
          placeholder={branchName}
          autoComplete="off"
        />
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={clearing}>
            Cancel
          </Button>
          <Button variant="danger" loading={clearing} disabled={!canConfirm} onClick={handleClear}>
            Clear branch data
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export function AdminBranchesPage() {
  const { toast } = useToast();
  const { rows, reload } = useCrudList(() => adminApi.branches() as Promise<Row[]>);
  const [modal, setModal] = useState<'create' | 'edit' | null>(null);
  const [edit, setEdit] = useState<Row | null>(null);
  const [clearTarget, setClearTarget] = useState<Row | null>(null);
  const [saving, setSaving] = useState(false);
  const [branchImageUrl, setBranchImageUrl] = useState<string | null>(null);
  const [pendingBranchPhoto, setPendingBranchPhoto] = useState<File | null>(null);

  useEffect(() => {
    if (!modal) {
      setBranchImageUrl(null);
      setPendingBranchPhoto(null);
      return;
    }
    setBranchImageUrl(edit?.imageUrl ? String(edit.imageUrl) : null);
    setPendingBranchPhoto(null);
  }, [modal, edit]);
  const del = useDeleteConfirm<Row>(
    async (item) => {
      await adminApi.deleteBranch(Number(item.id));
      toast('Branch deleted permanently', 'success');
      setModal(null);
      setEdit(null);
      reload();
    },
    {
      message: (item) =>
        `Permanently delete branch "${String(item.name)}"? Clear branch data first if it still has sales, customers, or vouchers. This cannot be undone.`,
    }
  );

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const body: Record<string, unknown> = {
      name: String(fd.get('name')),
      location: String(fd.get('location')),
      phone: String(fd.get('phone')),
      whatsapp: String(fd.get('whatsapp') || '') || undefined,
      description: String(fd.get('description') || '') || undefined,
      ...(parseCoord(fd.get('latitude')) !== undefined && { latitude: parseCoord(fd.get('latitude')) }),
      ...(parseCoord(fd.get('longitude')) !== undefined && { longitude: parseCoord(fd.get('longitude')) }),
      ...(modal === 'edit' && { isActive: fd.get('isActive') === 'true' }),
    };
    setSaving(true);
    try {
      if (pendingBranchPhoto) {
        const { url } = await adminApi.uploadBranchImage(pendingBranchPhoto);
        body.imageUrl = url;
      } else if (modal === 'edit') {
        body.imageUrl = branchImageUrl;
      } else if (branchImageUrl) {
        body.imageUrl = branchImageUrl;
      }

      if (modal === 'edit' && edit) await adminApi.updateBranch(Number(edit.id), body);
      else {
        await adminApi.createBranch(body as {
          name: string;
          location: string;
          phone: string;
          whatsapp?: string;
          description?: string;
          imageUrl?: string;
          latitude?: number | null;
          longitude?: number | null;
        });
      }
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
      <PageHeader title="Branches" subtitle="Manage all Crown Ev branches" action={<Button variant="accent" onClick={() => { setEdit(null); setModal('create'); }}>Add Branch</Button>} />
      <DataTable
        columns={[
          {
            key: 'imageUrl',
            header: 'Photo',
            className: 'w-24',
            render: (r) => {
              const src = resolveUploadUrl(r.imageUrl ? String(r.imageUrl) : null);
              const name = String(r.name ?? 'Branch');
              return src ? (
                <img
                  src={src}
                  alt={name}
                  className="h-12 w-[4.5rem] rounded-lg border border-border object-cover"
                />
              ) : (
                <div
                  className="flex h-12 w-[4.5rem] items-center justify-center rounded-lg border border-dashed border-border bg-surface-alt text-text-muted"
                  title="No photo uploaded"
                >
                  <Building2 className="h-5 w-5" aria-hidden />
                  <span className="sr-only">No photo for {name}</span>
                </div>
              );
            },
          },
          { key: 'name', header: 'Name' },
          { key: 'location', header: 'Location' },
          { key: 'phone', header: 'Phone' },
          { key: 'isActive', header: 'Status', render: (r) => <StatusBadge status={r.isActive ? 'CONFIRMED' : 'CANCELLED'} /> },
          { key: 'actions', header: 'Actions', className: 'whitespace-nowrap w-40', render: (r) => (
            <RowActions
              onEdit={() => { setEdit(r); setModal('edit'); }}
              onDelete={() => del.setTarget(r)}
              deleteLabel="Delete"
              extra={
                <button
                  type="button"
                  onClick={() => setClearTarget(r)}
                  className="rounded-lg px-2 py-1 text-xs font-medium text-warning hover:bg-red-50"
                  title="Clear all branch data"
                >
                  Clear data
                </button>
              }
            />
          ) },
        ]}
        data={rows}
      />
      {del.modal}
      <ClearBranchDataModal
        branch={clearTarget}
        open={!!clearTarget}
        onClose={() => setClearTarget(null)}
        onCleared={reload}
      />
      <Modal open={!!modal} onClose={() => setModal(null)} title={modal === 'edit' ? 'Edit Branch' : 'New Branch'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input name="name" label="Name" required defaultValue={String(edit?.name ?? '')} />
          <Input name="location" label="Location" required defaultValue={String(edit?.location ?? '')} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              name="latitude"
              label="Latitude"
              type="number"
              step="any"
              placeholder="29.995378"
              defaultValue={edit?.latitude != null ? String(edit.latitude) : ''}
            />
            <Input
              name="longitude"
              label="Longitude"
              type="number"
              step="any"
              placeholder="73.242815"
              defaultValue={edit?.longitude != null ? String(edit.longitude) : ''}
            />
          </div>
          <Input name="phone" label="Phone" required defaultValue={String(edit?.phone ?? '')} />
          <Input name="whatsapp" label="WhatsApp" defaultValue={String(edit?.whatsapp ?? '')} />
          <BranchPhotoField
            value={branchImageUrl}
            onChange={setBranchImageUrl}
            pendingFile={pendingBranchPhoto}
            onPendingFileChange={setPendingBranchPhoto}
          />
          <Textarea name="description" label="About-page description (shown on About Us)" rows={3} defaultValue={String(edit?.description ?? '')} />
          {modal === 'edit' && (
            <Select name="isActive" label="Active" defaultValue={String(edit?.isActive ?? true)}>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </Select>
          )}
          {modal === 'edit' ? (
            <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  onClick={() => edit && del.setTarget(edit)}
                >
                  Delete Branch
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  onClick={() => {
                    if (edit) {
                      setModal(null);
                      setClearTarget(edit);
                    }
                  }}
                >
                  Clear branch data
                </Button>
              </div>
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
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);

  const loadProducts = useCallback(
    () =>
      adminApi.products({
        type: productType,
        ...(debouncedSearch.trim() ? { search: debouncedSearch.trim() } : {}),
      }),
    [productType, debouncedSearch],
  );
  const { rows, reload } = useCrudList(loadProducts, [productType, debouncedSearch]);

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

    if (tab === 'bikes') {
      const specError = validateEvSpecsFromForm(fd);
      if (specError) {
        toast(specError, 'error');
        return;
      }
    } else {
      const partError = validatePartDetailFromForm(fd);
      if (partError) {
        toast(partError, 'error');
        return;
      }
    }

    let body: Record<string, unknown>;
    try {
      const salePrice = parseOptionalFormPrice(fd.get('salePrice'), 'Sale price');
      body = {
        name: String(fd.get('name')).trim(),
        type: productType,
        price: parseFormPrice(fd.get('price'), 'Price'),
        description: String(fd.get('description') || '').trim() || undefined,
        ...(salePrice !== undefined && { salePrice }),
        ...(tab === 'bikes' && {
          specs: parseEvSpecsFromForm(fd),
          colorOptions: parseColorOptionsFromForm(fd),
        }),
        ...(tab === 'parts' && { specs: parsePartDetailFromForm(fd) }),
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

      <div className="mb-4 max-w-md">
        <Input
          label="Search catalog"
          placeholder="Search by name or description…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

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
            {tab === 'parts' && (
              <PartDetailFields detail={edit?.specs as Parameters<typeof PartDetailFields>[0]['detail']} />
            )}
            {tab === 'bikes' && (
              <EvSpecsFields
                specs={edit?.specs as Record<string, string> | undefined}
                colorOptions={edit?.colorOptions as string[] | undefined}
              />
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
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const loadUsers = useCallback(
    () =>
      adminApi.users(debouncedSearch.trim() ? { search: debouncedSearch.trim() } : undefined),
    [debouncedSearch],
  );
  const { rows, reload } = useCrudList(loadUsers, [debouncedSearch]);
  const [modal, setModal] = useState<'create' | 'edit' | null>(null);
  const [edit, setEdit] = useState<Row | null>(null);
  const [saving, setSaving] = useState(false);
  const [branches, setBranches] = useState<Row[]>([]);
  const del = useDeleteConfirm<Row>(async (item) => {
    await adminApi.deleteUser(String(item.id));
    toast('User deleted', 'success');
    reload();
  });

  useEffect(() => {
    if (!modal) return;
    adminApi.branches().then((b) => setBranches(b as Row[])).catch(console.error);
  }, [modal]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const branchRaw = String(fd.get('branchId') ?? '').trim();
    if (!branchRaw) {
      toast('Select a branch for the branch owner', 'error');
      return;
    }

    const body: Record<string, unknown> = {
      firstName: String(fd.get('firstName')),
      lastName: String(fd.get('lastName')),
      role: 'BRANCH_OWNER',
      branchId: parseInt(branchRaw, 10),
      branchPermission: String(fd.get('branchPermission') || 'WRITE_UPDATE_DELETE'),
      phone: String(fd.get('phone') || '') || undefined,
      city: String(fd.get('city') || '') || undefined,
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
      toast(modal === 'edit' ? 'Branch owner updated' : 'Branch owner created', 'success');
      setModal(null);
      reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed', 'error');
    } finally {
      setSaving(false);
    }
  }

  const editingAdmin = modal === 'edit' && edit?.role === 'ADMIN';
  const canManage = (role: unknown) => role === 'BRANCH_OWNER';

  return (
    <div>
      <PageHeader
        title="Users"
        subtitle="Create and manage branch owner accounts"
        action={<Button variant="accent" onClick={() => { setEdit(null); setModal('create'); }}>Add Branch Owner</Button>}
      />
      <div className="mb-4 max-w-md">
        <Input
          label="Search users"
          placeholder="Search by name, email, or phone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <DataTable
        columns={[
          { key: 'email', header: 'Email' },
          { key: 'firstName', header: 'Name', render: (r) => `${r.firstName} ${r.lastName}` },
          { key: 'phone', header: 'Phone', render: (r) => (r.phone ? String(r.phone) : '—') },
          { key: 'role', header: 'Role' },
          {
            key: 'branchPermission',
            header: 'Permission',
            render: (r) => (r.role === 'BRANCH_OWNER' ? String(r.branchPermission ?? 'WRITE_UPDATE_DELETE').replace(/_/g, ' ') : '—'),
          },
          { key: 'isVerified', header: 'Verified', render: (r) => r.isVerified ? 'Yes' : 'No' },
          { key: 'actions', header: '', render: (r) => (
            <RowActions
              onEdit={canManage(r.role) ? () => { setEdit(r); setModal('edit'); } : undefined}
              onDelete={canManage(r.role) ? () => del.setTarget(r) : undefined}
            />
          ) },
        ]}
        data={rows}
      />
      {del.modal}
      <Modal open={!!modal} onClose={() => setModal(null)} title={modal === 'edit' ? 'Edit Branch Owner' : 'New Branch Owner'} size="lg">
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
          {editingAdmin ? (
            <div className="rounded-xl border border-border bg-surface-muted/40 px-4 py-3 text-sm text-text-muted">
              This is a system admin account. Role and branch cannot be changed here.
            </div>
          ) : (
            <Select
              name="branchId"
              label="Branch"
              required
              defaultValue={String(edit?.branchId ?? '')}
            >
              <option value="">Select branch…</option>
              {branches.map((b) => {
                const owner = b.owner as { email?: string } | null | undefined;
                const isCurrentOwner =
                  modal === 'edit' && owner?.email && String(edit?.email) === owner.email;
                const unavailable = !!owner && !isCurrentOwner;
                return (
                  <option key={String(b.id)} value={String(b.id)} disabled={unavailable}>
                    {String(b.name)}
                    {owner?.email ? ` (owner: ${owner.email})` : ' (no owner)'}
                  </option>
                );
              })}
            </Select>
          )}
          <Select
            name="branchPermission"
            label="Branch Permission"
            defaultValue={String(edit?.branchPermission ?? 'WRITE_UPDATE_DELETE')}
          >
            <option value="WRITE_ONLY">Write Only (view + create)</option>
            <option value="WRITE_UPDATE">Write &amp; Update (view + create + edit)</option>
            <option value="WRITE_UPDATE_DELETE">Full Access (write + update + delete)</option>
          </Select>
          <Input name="phone" label="Phone" defaultValue={String(edit?.phone ?? '')} />
          <Input name="city" label="City" defaultValue={String(edit?.city ?? '')} />
          {modal === 'edit' && !editingAdmin && (
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

function orderRowCustomer(r: Row): string {
  const customer = r.customer as { name?: string } | undefined;
  if (customer?.name) return customer.name;
  const user = r.user as { firstName?: string; lastName?: string } | undefined;
  if (user?.firstName) return `${user.firstName} ${user.lastName}`.trim();
  if (r.customerName) return String(r.customerName);
  return '—';
}

function branchOrderCount(branch: Row): number {
  const count = branch._count as { orders?: number } | undefined;
  return count?.orders ?? 0;
}

export function AdminOrdersPage() {
  const { toast } = useToast();
  const [branches, setBranches] = useState<Row[]>([]);
  const [branchFilter, setBranchFilter] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [totalOrders, setTotalOrders] = useState(0);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  const totalAllBranches = branches.reduce((sum, b) => sum + branchOrderCount(b), 0);
  const selectedBranchName = branchFilter
    ? String(branches.find((b) => String(b.id) === branchFilter)?.name ?? '')
    : '';

  useEffect(() => {
    adminApi.branches().then((b) => setBranches(b as Row[])).catch(console.error);
  }, []);

  useEffect(() => {
    setLoading(true);
    const params: Record<string, string> = { limit: '200' };
    if (branchFilter) params.branchId = branchFilter;
    adminApi
      .orders(params)
      .then((result) => {
        setRows(result.data as Row[]);
        setTotalOrders(result.pagination.total);
      })
      .catch((err) => {
        toast(err instanceof Error ? err.message : 'Failed to load orders', 'error');
        setRows([]);
        setTotalOrders(0);
      })
      .finally(() => setLoading(false));
  }, [branchFilter, toast]);

  async function downloadOrdersPdf() {
    setDownloading(true);
    try {
      const data = await adminApi.exportOrders(branchFilter ? { branchId: branchFilter } : undefined);
      const exportRows: OrderExportRow[] = data.map((row) => ({
        id: row.id as string | number,
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
        subtitle={
          loading
            ? 'Loading orders…'
            : branchFilter
              ? `${totalOrders} order${totalOrders === 1 ? '' : 's'} · ${selectedBranchName}`
              : `${totalOrders} order${totalOrders === 1 ? '' : 's'} across all branches`
        }
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
          <option value="">All branches ({totalAllBranches})</option>
          {branches.map((b) => (
            <option key={String(b.id)} value={String(b.id)}>
              {String(b.name)} ({branchOrderCount(b)})
            </option>
          ))}
        </Select>
      </div>

      <DataTable
        columns={[
          {
            key: 'sr',
            header: '#',
            className: 'w-12 tabular-nums text-text-muted',
            render: (_r, meta) => meta?.serial ?? '',
          },
          { key: 'branch', header: 'Branch', render: (r) => (r.branch as { name: string })?.name ?? '' },
          { key: 'customer', header: 'Customer', render: (r) => orderRowCustomer(r) },
          { key: 'type', header: 'Type' },
          { key: 'status', header: 'Status', render: (r) => <StatusBadge status={String(r.status)} /> },
          { key: 'total', header: 'Total', render: (r) => `PKR ${Number(r.total).toLocaleString()}` },
          {
            key: 'createdAt',
            header: 'Date',
            render: (r) => (r.createdAt ? formatDate(String(r.createdAt)) : ''),
          },
        ]}
        data={rows}
        emptyMessage={
          loading
            ? 'Loading…'
            : branchFilter
              ? `No orders for ${selectedBranchName}. Select "All branches" to see orders from every branch.`
              : 'No orders found'
        }
      />
    </div>
  );
}

// ─── Bookings ────────────────────────────────────────────────────────────────

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

type ReportPeriod = 'daily' | 'weekly' | 'monthly' | 'yearly';

const REPORT_PERIOD_OPTIONS: { id: ReportPeriod; label: string }[] = [
  { id: 'daily', label: 'Daily' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
  { id: 'yearly', label: 'Yearly' },
];

type SalesSummary = {
  period: ReportPeriod;
  label: string;
  from: string;
  to: string;
  branchId: number | null;
  totalSales: number;
  onlineSales: number;
  walkInSales: number;
  posSales: number;
  serviceSales: number;
  onlineOrders: number;
  walkInOrders: number;
  serviceInvoices: number;
  totalOrders: number;
};

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

export function AdminReportsPage() {
  const { toast } = useToast();
  const token = localStorage.getItem('token');
  const [branches, setBranches] = useState<Row[]>([]);
  const [branchFilter, setBranchFilter] = useState('');
  const [period, setPeriod] = useState<ReportPeriod>('monthly');
  const [summary, setSummary] = useState<SalesSummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);

  const selectedBranchName = branchFilter
    ? String(branches.find((b) => String(b.id) === branchFilter)?.name ?? '')
    : 'All branches';

  useEffect(() => {
    adminApi.branches().then((b) => setBranches(b as Row[])).catch(console.error);
  }, []);

  useEffect(() => {
    setLoadingSummary(true);
    adminApi
      .salesSummary(period, branchFilter || undefined)
      .then(setSummary)
      .catch((err) => {
        toast(err instanceof Error ? err.message : 'Failed to load sales summary', 'error');
        setSummary(null);
      })
      .finally(() => setLoadingSummary(false));
  }, [period, branchFilter, toast]);

  const periodSubtitle = summary
    ? `${selectedBranchName} · ${summary.label} · ${formatDate(summary.from)} – ${formatDate(summary.to)}`
    : '';

  function exportParams() {
    const params = new URLSearchParams({ format: 'csv' });
    if (branchFilter) params.set('branchId', branchFilter);
    if (summary) {
      params.set('from', summary.from.slice(0, 10));
      params.set('to', summary.to.slice(0, 10));
    }
    return params.toString();
  }

  async function downloadCsv(path: string, name: string) {
    setDownloading(`csv-${name}`);
    try {
      const res = await fetch(`${API_BASE}${path}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name;
      a.click();
      URL.revokeObjectURL(a.href);
      toast('CSV downloaded', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Download failed', 'error');
    } finally {
      setDownloading(null);
    }
  }

  async function downloadOrdersPdf() {
    if (!summary) return;
    setDownloading('pdf-orders');
    try {
      const data = await adminApi.exportOrders({
        branchId: branchFilter || undefined,
        from: summary.from.slice(0, 10),
        to: summary.to.slice(0, 10),
      });
      const exportRows: OrderExportRow[] = data.map((row) => ({
        id: row.id as string | number,
        branch: String(row.branch ?? ''),
        customer: String(row.customer ?? ''),
        type: String(row.type ?? ''),
        status: String(row.status ?? ''),
        total: row.total as string | number,
        paymentMethod: String(row.paymentMethod ?? ''),
        paymentStatus: String(row.paymentStatus ?? ''),
        createdAt: String(row.createdAt ?? ''),
      }));
      await exportToPdf(`orders_${period}_${summary.from.slice(0, 10)}`, ORDER_EXPORT_COLUMNS, exportRows, {
        title: 'Orders Report',
        subtitle: periodSubtitle,
      });
      toast('PDF downloaded', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'PDF export failed', 'error');
    } finally {
      setDownloading(null);
    }
  }

  async function downloadBookingsPdf() {
    if (!summary) return;
    setDownloading('pdf-bookings');
    try {
      const data = await adminApi.exportBookings({
        branchId: branchFilter || undefined,
        from: summary.from.slice(0, 10),
        to: summary.to.slice(0, 10),
      });
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
      await exportToPdf(`bookings_${period}_${summary.from.slice(0, 10)}`, BOOKING_EXPORT_COLUMNS, exportRows, {
        title: 'Bookings Report',
        subtitle: periodSubtitle,
      });
      toast('PDF downloaded', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'PDF export failed', 'error');
    } finally {
      setDownloading(null);
    }
  }

  async function downloadInventoryPdf() {
    setDownloading('pdf-inventory');
    try {
      const data = await adminApi.exportInventory(branchFilter ? { branchId: branchFilter } : undefined);
      const exportRows: InventoryExportRow[] = data.map((row) => ({
        branch: String(row.branch ?? ''),
        itemCode: String(row.itemCode ?? ''),
        partName: String(row.partName ?? ''),
        quantity: Number(row.quantity ?? 0),
        alertAt: Number(row.alertAt ?? 0),
        lowStock: String(row.lowStock ?? ''),
      }));
      await exportToPdf('inventory_report', INVENTORY_EXPORT_COLUMNS, exportRows, {
        title: 'Inventory Report',
        subtitle: `${selectedBranchName} · ${formatDate(new Date())}`,
      });
      toast('PDF downloaded', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'PDF export failed', 'error');
    } finally {
      setDownloading(null);
    }
  }

  async function downloadSalesSummaryPdf() {
    if (!summary) return;
    setDownloading('pdf-summary');
    try {
      const rows = [
        { metric: 'Total sales', value: formatPKR(summary.totalSales) },
        { metric: 'Online sales', value: `${formatPKR(summary.onlineSales)} (${summary.onlineOrders} orders)` },
        {
          metric: 'Walk-in sales (POS + service)',
          value: `${formatPKR(summary.walkInSales)} (${summary.walkInOrders} POS + ${summary.serviceInvoices} service)`,
        },
        { metric: 'POS product sales', value: formatPKR(summary.posSales) },
        { metric: 'Service invoice sales', value: formatPKR(summary.serviceSales) },
      ];
      await exportSalesSummaryPdf(`sales_summary_${period}`, rows, {
        title: 'Sales Summary',
        subtitle: periodSubtitle,
      });
      toast('PDF downloaded', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'PDF export failed', 'error');
    } finally {
      setDownloading(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="Reports & Export"
        subtitle="Branch-wise sales overview and cross-branch exports"
      />

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end">
        <Select
          label="Branch"
          value={branchFilter}
          onChange={(e) => setBranchFilter(e.target.value)}
          className="max-w-xs"
        >
          <option value="">All branches</option>
          {branches.map((b) => (
            <option key={String(b.id)} value={String(b.id)}>
              {String(b.name)}
            </option>
          ))}
        </Select>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {REPORT_PERIOD_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => setPeriod(opt.id)}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
              period === opt.id
                ? 'bg-accent text-white shadow-sm'
                : 'border border-border bg-white text-text-muted hover:border-accent/40 hover:text-brand'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {loadingSummary ? (
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-[var(--radius-card)] bg-surface-alt" />
          ))}
        </div>
      ) : summary ? (
        <>
          <p className="mb-4 text-sm text-text-muted">{periodSubtitle}</p>
          <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard label="Total sales" value={summary.totalSales} icon={ShoppingCart} prefix="PKR " />
            <StatCard
              label="Online sales"
              value={summary.onlineSales}
              icon={Receipt}
              prefix="PKR "
              trend={`${summary.onlineOrders} orders`}
            />
            <StatCard
              label="Walk-in sales"
              value={summary.walkInSales}
              icon={Users}
              prefix="PKR "
              trend={`${summary.walkInOrders} POS · ${summary.serviceInvoices} service`}
            />
          </div>
        </>
      ) : null}

      <h2 className="mb-3 text-sm font-semibold text-text">Download reports</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-[var(--radius-card)] border border-border bg-white p-5 shadow-[var(--shadow-card)]">
          <p className="font-semibold text-slate-900">Sales summary</p>
          <p className="mt-1 text-sm text-text-muted">Totals for selected branch and period</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              variant="accent"
              size="sm"
              loading={downloading === 'pdf-summary'}
              disabled={!summary}
              onClick={downloadSalesSummaryPdf}
            >
              PDF
            </Button>
          </div>
        </div>

        <div className="rounded-[var(--radius-card)] border border-border bg-white p-5 shadow-[var(--shadow-card)]">
          <p className="font-semibold text-slate-900">Orders</p>
          <p className="mt-1 text-sm text-text-muted">Online and walk-in orders in period</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              variant="secondary"
              size="sm"
              loading={downloading === 'csv-orders.csv'}
              disabled={!summary}
              onClick={() => downloadCsv(`/reports/export/orders?${exportParams()}`, `orders_${period}.csv`)}
            >
              CSV
            </Button>
            <Button
              variant="accent"
              size="sm"
              loading={downloading === 'pdf-orders'}
              disabled={!summary}
              onClick={downloadOrdersPdf}
            >
              PDF
            </Button>
          </div>
        </div>

        <div className="rounded-[var(--radius-card)] border border-border bg-white p-5 shadow-[var(--shadow-card)]">
          <p className="font-semibold text-slate-900">Bookings</p>
          <p className="mt-1 text-sm text-text-muted">Service appointments in period</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              variant="secondary"
              size="sm"
              loading={downloading === 'csv-bookings.csv'}
              disabled={!summary}
              onClick={() => downloadCsv(`/reports/export/bookings?${exportParams()}`, `bookings_${period}.csv`)}
            >
              CSV
            </Button>
            <Button
              variant="accent"
              size="sm"
              loading={downloading === 'pdf-bookings'}
              disabled={!summary}
              onClick={downloadBookingsPdf}
            >
              PDF
            </Button>
          </div>
        </div>

        <div className="rounded-[var(--radius-card)] border border-border bg-white p-5 shadow-[var(--shadow-card)]">
          <p className="font-semibold text-slate-900">Inventory</p>
          <p className="mt-1 text-sm text-text-muted">Current part stock levels</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              variant="secondary"
              size="sm"
              loading={downloading === 'csv-inventory.csv'}
              onClick={() =>
                downloadCsv(
                  `/reports/export/inventory?format=csv${branchFilter ? `&branchId=${branchFilter}` : ''}`,
                  'inventory.csv',
                )
              }
            >
              CSV
            </Button>
            <Button
              variant="accent"
              size="sm"
              loading={downloading === 'pdf-inventory'}
              onClick={downloadInventoryPdf}
            >
              PDF
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
