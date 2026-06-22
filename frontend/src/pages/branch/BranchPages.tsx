import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { branchApi, adminApi } from '../../api/client';
import { useToast } from '../../contexts/ToastContext';
import { Receipt, ShoppingCart, Users } from 'lucide-react';
import { PageHeader } from '../../components/layout/PageTransition';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Input, Select, Textarea } from '../../components/ui/Input';
import { DataTable, StatusBadge } from '../../components/ui/DataTable';
import { FormActions, RowActions, useDeleteConfirm } from '../../components/crud/CrudHelpers';
import { InvoiceModalContent } from '../../components/invoice/SaleInvoice';
import {
  clearPendingImages,
  primaryFromImages,
  ProductImageUpload,
  type ExistingImage,
  type PendingImage,
  type PrimarySelection,
} from '../../components/crud/ProductImageUpload';
import { EvSpecsFields } from '../../components/crud/EvSpecsFields';
import { parseEvSpecsFromForm } from '../../lib/evSpecs';
import { formatPKR, formatLedgerBalance, formatDate, formatTime } from '../../lib/format';
import { StatCard } from '../../components/ui/StatCard';
import { ProductGridSkeleton } from '../../components/ui/Skeleton';

type Row = Record<string, unknown>;

const ORDER_STATUSES = ['PENDING', 'CONFIRMED', 'DELIVERED', 'CANCELLED'];
const BOOKING_STATUSES = ['PENDING', 'CONFIRMED', 'DONE', 'CANCELLED'];
const BOOKING_STATUS_ORDER: Record<string, number> = {
  PENDING: 0,
  CONFIRMED: 1,
  DONE: 2,
  CANCELLED: 3,
};
const ADJUST_REASONS = ['CORRECTION', 'DAMAGE', 'THEFT', 'RETURN', 'OTHER'];

function useBranchId() {
  const { user } = useAuth();
  return user?.branchId ?? null;
}

// ─── POS ─────────────────────────────────────────────────────────────────────

function isToday(date: string | Date) {
  const d = new Date(date);
  const now = new Date();
  return d.getFullYear() === now.getFullYear()
    && d.getMonth() === now.getMonth()
    && d.getDate() === now.getDate();
}

function StockBadge({ stock }: { stock: number }) {
  if (stock <= 0) {
    return <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-500">Out of Stock</span>;
  }
  if (stock <= 3) {
    return <span className="inline-flex rounded-full bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-700">Low Stock: {stock} left</span>;
  }
  return <span className="inline-flex rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">In Stock: {stock}</span>;
}

export function BranchPOSPage() {
  const branchId = useBranchId();
  const { toast } = useToast();
  const [todayVouchers, setTodayVouchers] = useState(0);
  const [todayCustomers, setTodayCustomers] = useState(0);
  const [todaySales, setTodaySales] = useState(0);
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Row[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [cart, setCart] = useState<{ productId: string; name: string; price: number; quantity: number; stock: number }[]>([]);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  useEffect(() => {
    if (!branchId) return;
    setLoading(true);
    Promise.all([
      branchApi.vouchers(branchId),
      branchApi.walkInCustomers(branchId),
      branchApi.orders({ limit: '500' }),
    ])
      .then(([vouchers, customersRes, ordersRes]) => {
        setTodayVouchers((vouchers as Row[]).filter((v) => isToday(String(v.createdAt)) && v.status !== 'CANCELLED').length);
        setTodayCustomers((customersRes.data as Row[]).filter((c) => isToday(String(c.createdAt))).length);
        const salesToday = (ordersRes.data as unknown as Row[]).filter(
          (o) => isToday(String(o.createdAt)) && o.status !== 'CANCELLED',
        );
        setTodaySales(salesToday.reduce((sum, o) => sum + Number(o.total ?? 0), 0));
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [branchId]);

  useEffect(() => {
    if (!branchId) return;
    setProductsLoading(true);
    adminApi
      .products({ type: 'BIKE' })
      .then((r) => setProducts(r.data as unknown as Row[]))
      .catch(console.error)
      .finally(() => setProductsLoading(false));
  }, [branchId]);

  function addToCart(product: Row) {
    const stock = Number(product.stockAtBranch ?? 0);
    if (stock <= 0) return;
    const productId = String(product.id);
    const price = Number(product.salePrice ?? product.price);
    setCart((prev) => {
      const existing = prev.find((i) => i.productId === productId);
      if (existing) {
        if (existing.quantity >= stock) {
          toast(`Only ${stock} in stock`, 'error');
          return prev;
        }
        return prev.map((i) =>
          i.productId === productId ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, { productId, name: String(product.name), price, quantity: 1, stock }];
    });
  }

  async function completeSale() {
    if (!branchId || cart.length === 0) return;
    setCheckoutLoading(true);
    try {
      await branchApi.posOrder({
        branchId,
        paymentMethod: 'CASH',
        items: cart.map((i) => ({ productId: i.productId, quantity: i.quantity })),
        isPaid: true,
      });
      toast('Sale completed', 'success');
      setCart([]);
      const refreshed = await adminApi.products({ type: 'BIKE' });
      setProducts(refreshed.data as unknown as Row[]);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Sale failed', 'error');
    } finally {
      setCheckoutLoading(false);
    }
  }

  const cartTotal = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);

  return (
    <div className="space-y-8">
      <PageHeader title="Point of Sale" subtitle="Today's activity and quick bike sales" />
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-36 animate-pulse rounded-[var(--radius-card)] border border-border bg-white" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard label="Today Vouchers" value={todayVouchers} icon={Receipt} />
          <StatCard label="Today Customers" value={todayCustomers} icon={Users} />
          <StatCard label="Today Sales" value={todaySales} icon={ShoppingCart} prefix="PKR " />
        </div>
      )}

      <div>
        <h2 className="mb-4 font-display text-lg font-semibold text-brand">Sell Bikes</h2>
        {productsLoading ? (
          <ProductGridSkeleton count={4} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {products.map((product) => {
              const stock = Number(product.stockAtBranch ?? 0);
              const outOfStock = stock <= 0;
              const imgs = product.images as { url: string; isPrimary?: boolean }[] | undefined;
              const image = imgs?.find((i) => i.isPrimary)?.url ?? imgs?.[0]?.url;
              return (
                <div
                  key={String(product.id)}
                  className={`overflow-hidden rounded-[var(--radius-card)] border bg-white shadow-[var(--shadow-card)] ${
                    outOfStock ? 'border-border opacity-60' : 'border-border'
                  }`}
                >
                  <div className="aspect-[4/3] bg-surface-alt">
                    {image ? (
                      <img src={image} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-sm text-text-muted">No image</div>
                    )}
                  </div>
                  <div className="space-y-3 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-display font-semibold text-brand">{String(product.name)}</h3>
                      <StockBadge stock={stock} />
                    </div>
                    <p className="font-display text-lg font-bold text-brand">{formatPKR(Number(product.salePrice ?? product.price))}</p>
                    <Button
                      variant="accent"
                      size="sm"
                      className="w-full"
                      disabled={outOfStock}
                      onClick={() => addToCart(product)}
                    >
                      {outOfStock ? 'Out of Stock' : 'Add to Sale'}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {cart.length > 0 && (
        <div className="rounded-[var(--radius-card)] border border-border bg-white p-5 shadow-[var(--shadow-card)]">
          <h3 className="font-display font-semibold text-brand">Current Sale</h3>
          <ul className="mt-3 space-y-2">
            {cart.map((item) => (
              <li key={item.productId} className="flex items-center justify-between text-sm">
                <span>{item.name} × {item.quantity}</span>
                <span className="font-medium">{formatPKR(item.price * item.quantity)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
            <span className="font-display font-bold text-brand">{formatPKR(cartTotal)}</span>
            <Button variant="accent" loading={checkoutLoading} onClick={completeSale}>
              Complete Cash Sale
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Orders ──────────────────────────────────────────────────────────────────

function orderRowCustomer(r: Row): string {
  const user = r.user as { firstName?: string; lastName?: string } | undefined;
  if (user?.firstName) return `${user.firstName} ${user.lastName ?? ''}`.trim();
  if (r.customerName) return String(r.customerName);
  const walkIn = r.walkInCustomer as { name?: string } | undefined;
  return walkIn?.name ?? '—';
}

export function BranchOrdersPage() {
  const { toast } = useToast();
  const [orders, setOrders] = useState<Row[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [detail, setDetail] = useState<Row | null>(null);
  const [paymentModal, setPaymentModal] = useState<Row | null>(null);
  const [cargoModal, setCargoModal] = useState<Row | null>(null);
  const [invoiceModal, setInvoiceModal] = useState<Row | null>(null);
  const [invoiceData, setInvoiceData] = useState<import('../../types').InvoiceData | null>(null);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [cargoId, setCargoId] = useState('');
  const [saving, setSaving] = useState(false);

  const reload = useCallback(() => {
    const params: Record<string, string> = {};
    if (statusFilter) params.status = statusFilter;
    if (paymentFilter) params.paymentStatus = paymentFilter;
    if (typeFilter) params.type = typeFilter;
    branchApi.orders(params).then((r) => setOrders(r.data as unknown as Row[])).catch(console.error);
  }, [statusFilter, paymentFilter, typeFilter]);

  useEffect(() => { reload(); }, [reload]);

  async function handleApprove(approved: boolean) {
    if (!paymentModal) return;
    setSaving(true);
    try {
      await branchApi.approvePayment(Number(paymentModal.id), approved);
      toast(approved ? 'Payment approved' : 'Payment rejected', approved ? 'success' : 'error');
      setPaymentModal(null);
      reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleCargo(e: FormEvent) {
    e.preventDefault();
    if (!cargoModal || !cargoId.trim()) return;
    setSaving(true);
    try {
      await branchApi.setCargoTracking(Number(cargoModal.id), cargoId.trim());
      toast('Cargo tracking set — order marked delivered', 'success');
      setCargoModal(null);
      setCargoId('');
      reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function openInvoice(row: Row) {
    setInvoiceModal(row);
    setInvoiceLoading(true);
    setInvoiceData(null);
    try {
      const data = await branchApi.orderInvoice(Number(row.id));
      setInvoiceData(data);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to load invoice', 'error');
    } finally {
      setInvoiceLoading(false);
    }
  }

  const BASE = import.meta.env.VITE_API_URL?.replace('/api', '') ?? '';

  return (
    <div>
      <PageHeader title="Branch Orders" subtitle="Manage online and POS orders" />

      <div className="mb-4 grid grid-cols-1 gap-3 sm:flex sm:flex-wrap">
        <Select label="" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full sm:min-w-[140px] sm:w-auto">
          <option value="">All statuses</option>
          {ORDER_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </Select>
        <Select label="" value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value)} className="w-full sm:min-w-[140px] sm:w-auto">
          <option value="">All payments</option>
          <option value="PENDING">PENDING</option>
          <option value="APPROVED">APPROVED</option>
          <option value="PAID">PAID</option>
          <option value="REJECTED">REJECTED</option>
        </Select>
        <Select label="" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="w-full sm:min-w-[120px] sm:w-auto">
          <option value="">All types</option>
          <option value="ONLINE">ONLINE</option>
          <option value="POS">POS</option>
        </Select>
      </div>

      <DataTable
        columns={[
          { key: 'trackingId', header: 'Tracking', render: (r) => <span className="font-mono text-xs">{String(r.trackingId)}</span> },
          { key: 'customer', header: 'Customer', render: (r) => orderRowCustomer(r) },
          { key: 'status', header: 'Status', render: (r) => <StatusBadge status={String(r.status)} /> },
          { key: 'paymentStatus', header: 'Payment', render: (r) => <StatusBadge status={String(r.paymentStatus)} /> },
          { key: 'type', header: 'Type', render: (r) => <span className="text-xs font-medium">{String(r.type)}</span> },
          { key: 'total', header: 'Total', render: (r) => formatPKR(Number(r.total)) },
          {
            key: 'actions',
            header: '',
            render: (r) => (
              <div className="flex flex-wrap gap-1">
                <Button size="sm" variant="ghost" onClick={() => setDetail(r)}>View</Button>
                {r.paymentMethod === 'BANK_TRANSFER' && r.paymentStatus === 'PENDING' && (
                  <Button size="sm" variant="secondary" onClick={() => setPaymentModal(r)}>Verify</Button>
                )}
                {r.status === 'CONFIRMED' && (
                  <Button size="sm" variant="secondary" onClick={() => { setCargoModal(r); setCargoId(''); }}>Cargo</Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => openInvoice(r)}>Invoice</Button>
              </div>
            ),
          },
        ]}
        data={orders}
      />

      <Modal open={!!detail} onClose={() => setDetail(null)} title={`Order ${String(detail?.trackingId ?? '')}`} size="lg">
        {detail && (
          <div className="space-y-3 text-sm">
            <p><span className="text-text-muted">Customer:</span> {orderRowCustomer(detail)}</p>
            <p><span className="text-text-muted">Phone:</span> {String(detail.customerPhone ?? (detail.user as { phone?: string })?.phone ?? '—')}</p>
            <p><span className="text-text-muted">Address:</span> {String(detail.customerAddress ?? '—')}</p>
            <p><span className="text-text-muted">Status:</span> <StatusBadge status={String(detail.status)} /></p>
            <p><span className="text-text-muted">Payment:</span> {String(detail.paymentMethod)} — <StatusBadge status={String(detail.paymentStatus)} /></p>
            <p><span className="text-text-muted">Total:</span> {formatPKR(Number(detail.total))}</p>
            {detail.cargoTrackingId ? (
              <p><span className="text-text-muted">Cargo:</span> {String(detail.cargoTrackingId)}</p>
            ) : null}
          </div>
        )}
      </Modal>

      <Modal open={!!paymentModal} onClose={() => setPaymentModal(null)} title="Verify Payment" size="lg">
        {paymentModal && (
          <div className="space-y-4">
            <p className="text-sm">Customer: <strong>{orderRowCustomer(paymentModal)}</strong></p>
            <p className="text-sm">Total: <strong>{formatPKR(Number(paymentModal.total))}</strong></p>
            <p className="text-sm">TID: <strong className="font-mono">{String(paymentModal.paymentTransactionId ?? '—')}</strong></p>
            {paymentModal.bankTransferScreenshot ? (
              <img
                src={`${BASE}${String(paymentModal.bankTransferScreenshot)}`}
                alt="Payment screenshot"
                className="max-h-64 rounded-lg border border-border object-contain"
              />
            ) : null}
            <div className="flex gap-2">
              <Button variant="accent" loading={saving} onClick={() => handleApprove(true)}>Approve Payment</Button>
              <Button variant="danger" loading={saving} onClick={() => handleApprove(false)}>Reject</Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!cargoModal} onClose={() => setCargoModal(null)} title="Set Cargo Tracking ID">
        <form onSubmit={handleCargo} className="space-y-4">
          <p className="text-sm text-text-muted">
            Enter the cargo/courier tracking number (e.g. TCS, Leopard). Order will be marked as delivered.
          </p>
          <Input
            label="Cargo Tracking ID"
            value={cargoId}
            onChange={(e) => setCargoId(e.target.value)}
            placeholder="e.g. TCS-12345678"
            required
          />
          <FormActions onCancel={() => setCargoModal(null)} loading={saving} />
        </form>
      </Modal>

      <Modal open={!!invoiceModal} onClose={() => { setInvoiceModal(null); setInvoiceData(null); }} title="Sale Invoice" size="lg">
        <InvoiceModalContent loading={invoiceLoading} invoice={invoiceData} />
      </Modal>
    </div>
  );
}

// ─── Inventory ───────────────────────────────────────────────────────────────

export function BranchInventoryPage() {
  const branchId = useBranchId();
  const { toast } = useToast();
  const [items, setItems] = useState<Row[]>([]);
  const [editItem, setEditItem] = useState<Row | null>(null);
  const [saving, setSaving] = useState(false);

  const reload = useCallback(() => {
    if (branchId) branchApi.inventory(branchId).then((r) => setItems(r.data as unknown as Row[])).catch(console.error);
  }, [branchId]);

  useEffect(() => { reload(); }, [reload]);

  async function handleSetStock(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!branchId || !editItem) return;
    const fd = new FormData(e.currentTarget);
    const part = editItem.part as { id: number };
    setSaving(true);
    try {
      const mode = fd.get('mode');
      if (mode === 'set') {
        await branchApi.setStock(branchId, part.id, parseInt(String(fd.get('quantity')), 10));
      } else {
        await branchApi.adjustStock(branchId, {
          partId: part.id,
          quantityChange: parseInt(String(fd.get('quantityChange')), 10),
          reason: String(fd.get('reason')),
          notes: String(fd.get('notes') || '') || undefined,
        });
      }
      toast('Stock updated', 'success');
      setEditItem(null);
      reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader title="Inventory" subtitle="Branch stock quantities" />
      <DataTable
        columns={[
          { key: 'part', header: 'Part', render: (r) => (r.part as { name: string }).name },
          { key: 'code', header: 'Code', render: (r) => (r.part as { itemCode: string }).itemCode },
          { key: 'quantity', header: 'Qty', render: (r) => <span className="font-semibold">{String(r.quantity)}</span> },
          { key: 'alert', header: 'Alert', render: (r) => (r.part as { alertAt: number }).alertAt },
          { key: 'actions', header: '', render: (r) => <RowActions onEdit={() => setEditItem(r)} /> },
        ]}
        data={items}
      />
      <Modal open={!!editItem} onClose={() => setEditItem(null)} title="Update Stock">
        <form onSubmit={handleSetStock} className="space-y-4">
          <p className="text-sm font-medium">{(editItem?.part as { name: string })?.name}</p>
          <Select name="mode" label="Action" defaultValue="set">
            <option value="set">Set exact quantity</option>
            <option value="adjust">Adjust (+/-)</option>
          </Select>
          <Input name="quantity" label="Quantity (set mode)" type="number" min={0} defaultValue={String(editItem?.quantity ?? 0)} />
          <Input name="quantityChange" label="Change amount (adjust mode)" type="number" defaultValue="0" />
          <Select name="reason" label="Reason (adjust)" defaultValue="CORRECTION">
            {ADJUST_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
          </Select>
          <Input name="notes" label="Notes" />
          <FormActions onCancel={() => setEditItem(null)} loading={saving} />
        </form>
      </Modal>
    </div>
  );
}

// ─── Bikes Catalog ───────────────────────────────────────────────────────────

function parseBikeFormPrice(value: FormDataEntryValue | null, label: string): number {
  const raw = String(value ?? '').trim();
  if (!raw) throw new Error(`${label} is required`);
  const n = parseFloat(raw);
  if (!Number.isFinite(n) || n <= 0 || n >= 10_000_000_000) {
    throw new Error(`${label} must be a valid amount under 10 billion PKR`);
  }
  return n;
}

function parseOptionalBikePrice(value: FormDataEntryValue | null, label: string): number | undefined {
  const raw = String(value ?? '').trim();
  if (!raw) return undefined;
  return parseBikeFormPrice(value, label);
}

export function BranchBikesPage() {
  const branchId = useBranchId();
  const { toast } = useToast();
  const [bikes, setBikes] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<'create' | 'edit' | null>(null);
  const [edit, setEdit] = useState<Row | null>(null);
  const [saving, setSaving] = useState(false);
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const [existingImages, setExistingImages] = useState<ExistingImage[]>([]);
  const [primarySelection, setPrimarySelection] = useState<PrimarySelection | null>(null);
  const [stockModal, setStockModal] = useState<Row | null>(null);
  const [stockQty, setStockQty] = useState('0');
  const [stockSaving, setStockSaving] = useState(false);

  const bikeDelete = useDeleteConfirm<Row>(
    async (row) => {
      await adminApi.deleteProduct(String(row.id));
      toast('Bike removed', 'success');
      reload();
    },
    { message: (row) => `Remove "${String(row.name)}" from the catalog?` },
  );

  const reload = useCallback(() => {
    setLoading(true);
    adminApi
      .products({ type: 'BIKE' })
      .then((r) => setBikes(r.data as unknown as Row[]))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

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

  function openCreate() {
    resetImageState();
    setEdit(null);
    setModal('create');
  }

  function openEdit(row: Row) {
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
    primary: PrimarySelection | null,
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

  function openStockModal(row: Row) {
    setStockModal(row);
    setStockQty(String(row.stockAtBranch ?? 0));
  }

  async function saveStock(e: FormEvent) {
    e.preventDefault();
    if (!stockModal || !branchId) return;
    const quantity = parseInt(stockQty, 10);
    if (!Number.isFinite(quantity) || quantity < 0) {
      toast('Enter a valid stock quantity', 'error');
      return;
    }
    setStockSaving(true);
    try {
      await branchApi.setBikeStock(branchId, String(stockModal.id), quantity);
      toast('Stock updated', 'success');
      setStockModal(null);
      reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to update stock', 'error');
    } finally {
      setStockSaving(false);
    }
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    let body: Record<string, unknown>;
    try {
      const salePrice = parseOptionalBikePrice(fd.get('salePrice'), 'Sale price');
      body = {
        name: String(fd.get('name')).trim(),
        type: 'BIKE',
        price: parseBikeFormPrice(fd.get('price'), 'Price'),
        description: String(fd.get('description') || '').trim() || undefined,
        specs: parseEvSpecsFromForm(fd),
        ...(salePrice !== undefined && { salePrice }),
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
      const existingCount = modal === 'edit' ? existingImages.length : 0;
      if (pendingImages.length) {
        await attachImages(productId, pendingImages, existingCount, primarySelection);
      }
      if (primarySelection?.type === 'existing') {
        await applyPrimarySelection(productId, primarySelection);
      }
      toast(modal === 'edit' ? 'Bike updated' : 'Bike added', 'success');
      closeModal();
      reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Bikes Catalog"
        subtitle="Add electric bikes with EV specifications for your branch"
        action={<Button variant="accent" onClick={openCreate}>Add Bike</Button>}
      />

      {loading ? (
        <ProductGridSkeleton count={4} />
      ) : (
        <DataTable
          columns={[
            {
              key: 'image',
              header: 'Image',
              render: (r) => {
                const imgs = r.images as { url: string; isPrimary?: boolean }[] | undefined;
                const url = imgs?.find((i) => i.isPrimary)?.url ?? imgs?.[0]?.url;
                return url ? (
                  <img src={url} alt="" className="h-10 w-10 rounded-lg object-cover" />
                ) : (
                  <span className="text-xs text-text-muted">—</span>
                );
              },
            },
            { key: 'name', header: 'Name' },
            { key: 'price', header: 'Price', render: (r) => formatPKR(Number(r.price)) },
            {
              key: 'stock',
              header: 'Stock',
              render: (r) => {
                const stock = Number(r.stockAtBranch ?? 0);
                return <StockBadge stock={stock} />;
              },
            },
            {
              key: 'specs',
              header: 'Specs',
              render: (r) => {
                const specs = r.specs as Record<string, string> | null;
                const count = specs ? Object.keys(specs).length : 0;
                return count ? `${count} fields` : '—';
              },
            },
            { key: 'isActive', header: 'Status', render: (r) => <StatusBadge status={r.isActive ? 'CONFIRMED' : 'CANCELLED'} /> },
            {
              key: 'actions',
              header: '',
              align: 'right',
              className: 'w-28',
              render: (r) => (
                <div className="flex items-center justify-end gap-1">
                  <Button variant="secondary" size="sm" onClick={() => openStockModal(r)}>Set Stock</Button>
                  <RowActions
                    onEdit={() => openEdit(r)}
                    deleteLabel="Delete"
                    onDelete={() => bikeDelete.setTarget(r)}
                  />
                </div>
              ),
            },
          ]}
          data={bikes}
          emptyMessage="No bikes yet — add your first electric bike"
        />
      )}
      {bikeDelete.modal}

      <Modal open={!!stockModal} onClose={() => setStockModal(null)} title={`Set Stock — ${String(stockModal?.name ?? '')}`}>
        <form onSubmit={saveStock} className="space-y-4">
          <Input
            label="Quantity in stock"
            type="number"
            min={0}
            required
            value={stockQty}
            onChange={(e) => setStockQty(e.target.value)}
          />
          <FormActions onCancel={() => setStockModal(null)} loading={stockSaving} />
        </form>
      </Modal>

      <Modal
        open={!!modal}
        onClose={closeModal}
        title={modal === 'edit' ? 'Edit Bike' : 'New Bike'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="flex flex-col">
          <div className="space-y-4">
            <ProductImageUpload
              pending={pendingImages}
              existing={existingImages}
              primary={primarySelection}
              onPendingChange={setPendingImages}
              onPrimaryChange={setPrimarySelection}
              onRemoveExisting={modal === 'edit' ? removeExistingImage : undefined}
            />
            <Input name="name" label="Name" required defaultValue={String(edit?.name ?? '')} />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input name="price" label="Price (PKR)" type="number" step="0.01" required defaultValue={String(edit?.price ?? '')} />
              <Input name="salePrice" label="Sale Price (optional)" type="number" step="0.01" defaultValue={String(edit?.salePrice ?? '')} />
            </div>
            <Textarea name="description" label="Description" rows={3} defaultValue={String(edit?.description ?? '')} />
            <EvSpecsFields specs={edit?.specs as Record<string, string> | undefined} />
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

// ─── Bookings ────────────────────────────────────────────────────────────────

function bookingRowCustomer(r: Row): string {
  if (r.customerName) return String(r.customerName);
  const user = r.user as { firstName?: string; lastName?: string } | undefined;
  if (user?.firstName) return `${user.firstName} ${user.lastName ?? ''}`.trim();
  return '—';
}

export function BranchBookingsPage() {
  const branchId = useBranchId();
  const { toast } = useToast();
  const [bookings, setBookings] = useState<Row[]>([]);
  const [edit, setEdit] = useState<Row | null>(null);
  const [statusValue, setStatusValue] = useState('PENDING');
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);

  const reload = useCallback(() => {
    const params: Record<string, string> = {};
    if (statusFilter) params.status = statusFilter;
    branchApi.bookings(params).then((r) => setBookings(r.data as unknown as Row[])).catch(console.error);
  }, [statusFilter]);

  useEffect(() => { reload(); }, [reload]);

  const displayedBookings = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows = bookings;
    if (q) {
      rows = rows.filter((r) => {
        const customer = bookingRowCustomer(r).toLowerCase();
        const notes = String(r.notes ?? '').toLowerCase();
        return customer.includes(q) || notes.includes(q);
      });
    }
    return [...rows].sort((a, b) => {
      const statusDiff =
        (BOOKING_STATUS_ORDER[String(a.status)] ?? 9) - (BOOKING_STATUS_ORDER[String(b.status)] ?? 9);
      if (statusDiff !== 0) return statusDiff;
      return Number(b.id) - Number(a.id);
    });
  }, [bookings, search]);

  const bookingDelete = useDeleteConfirm<Row>(
    async (row) => {
      if (!branchId) return;
      await branchApi.deleteBooking(Number(row.id), branchId);
      toast('Booking deleted', 'success');
      reload();
    },
    { message: (row) => `Delete booking for ${bookingRowCustomer(row)}?` },
  );

  useEffect(() => {
    if (edit) setStatusValue(String(edit.status ?? 'PENDING'));
  }, [edit]);

  async function updateStatus(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!edit || !branchId) return;
    const fd = new FormData(e.currentTarget);
    const status = String(fd.get('status'));
    const confirmedTime = String(fd.get('confirmedTime') || '').trim() || undefined;
    const date = String(fd.get('date') || '').trim() || undefined;
    if (status === 'CONFIRMED' && (!date || !confirmedTime)) {
      toast('Please set visit date and time before confirming', 'error');
      return;
    }
    setSaving(true);
    try {
      await branchApi.updateBookingStatus(Number(edit.id), {
        branchId,
        status,
        ...(confirmedTime && { confirmedTime }),
        ...(date && { date }),
      });
      toast('Booking updated', 'success');
      setEdit(null);
      reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader title="Service Bookings" />

      <div className="mb-4 grid grid-cols-1 gap-3 sm:flex sm:flex-wrap sm:items-end">
        <Input
          label="Search"
          placeholder="Customer or notes…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:max-w-xs"
        />
        <Select
          label="Status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-full sm:min-w-[160px] sm:w-auto"
        >
          <option value="">All statuses</option>
          {BOOKING_STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </Select>
      </div>

      <DataTable
        columns={[
          { key: 'customer', header: 'Customer', render: (r) => bookingRowCustomer(r) },
          { key: 'notes', header: 'Notes', render: (r) => String(r.notes ?? '—').slice(0, 40) },
          { key: 'service', header: 'Service', render: (r) => (r.service as { name: string })?.name ?? '—' },
          {
            key: 'appointment',
            header: 'Visit Schedule',
            render: (r) => {
              if (r.date && r.confirmedTime) {
                return `${formatDate(String(r.date))} at ${formatTime(String(r.confirmedTime))}`;
              }
              if (r.confirmedTime) return formatTime(String(r.confirmedTime));
              return '—';
            },
          },
          { key: 'status', header: 'Status', render: (r) => <StatusBadge status={String(r.status)} /> },
          {
            key: 'actions',
            header: '',
            align: 'right',
            className: 'w-28',
            render: (r) => (
              <RowActions
                onEdit={() => setEdit(r)}
                deleteLabel="Delete"
                onDelete={() => bookingDelete.setTarget(r)}
              />
            ),
          },
        ]}
        data={displayedBookings}
        emptyMessage={search || statusFilter ? 'No bookings match your filters' : 'No bookings yet'}
      />
      {bookingDelete.modal}
      <Modal open={!!edit} onClose={() => setEdit(null)} title="Update Booking" size="lg">
        {edit && (
          <form onSubmit={updateStatus} className="space-y-4">
            <p className="text-sm"><span className="text-text-muted">Customer:</span> {bookingRowCustomer(edit)}</p>
            {edit.notes ? (
              <p className="rounded-lg bg-surface-alt p-3 text-sm"><span className="text-text-muted">Notes:</span> {String(edit.notes)}</p>
            ) : null}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label="Visit Date"
                name="date"
                type="date"
                defaultValue={edit.date ? String(edit.date).slice(0, 10) : ''}
              />
              <Input
                label="Visit Time"
                name="confirmedTime"
                type="time"
                defaultValue={String(edit.confirmedTime ?? '')}
              />
            </div>
            <p className="text-xs text-text-muted -mt-2">
              Set when the customer should come to the branch. Required when status is Confirmed.
            </p>
            <Select name="status" label="Status" value={statusValue} onChange={(e) => setStatusValue(e.target.value)}>
              {BOOKING_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
            <FormActions onCancel={() => setEdit(null)} loading={saving} />
          </form>
        )}
      </Modal>
    </div>
  );
}

// ─── Services ────────────────────────────────────────────────────────────────

export function BranchServicesPage() {
  const branchId = useBranchId();
  const { toast } = useToast();
  const [services, setServices] = useState<Row[]>([]);
  const [modal, setModal] = useState<'create' | 'edit' | null>(null);
  const [edit, setEdit] = useState<Row | null>(null);
  const [saving, setSaving] = useState(false);

  const reload = useCallback(() => {
    if (branchId) branchApi.services(branchId).then((r) => setServices(r as Row[])).catch(console.error);
  }, [branchId]);

  useEffect(() => { reload(); }, [reload]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!branchId) return;
    const fd = new FormData(e.currentTarget);
    const body = {
      name: String(fd.get('name')),
      description: String(fd.get('description') || '') || undefined,
      basePrice: parseFloat(String(fd.get('basePrice'))),
      duration: parseInt(String(fd.get('duration')), 10),
      ...(modal === 'edit' && { isActive: fd.get('isActive') === 'true' }),
    };
    setSaving(true);
    try {
      if (modal === 'edit' && edit) await branchApi.updateService(branchId, Number(edit.id), body);
      else await branchApi.createService(branchId, body);
      toast(modal === 'edit' ? 'Service updated' : 'Service created', 'success');
      setModal(null);
      reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function deactivate(id: number) {
    if (!branchId || !confirm('Deactivate this service?')) return;
    try {
      await branchApi.deleteService(branchId, id);
      toast('Service deactivated', 'success');
      reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed', 'error');
    }
  }

  return (
    <div>
      <PageHeader title="Services" subtitle="Branch service definitions" action={<Button variant="accent" onClick={() => { setEdit(null); setModal('create'); }}>Add Service</Button>} />
      <DataTable
        columns={[
          { key: 'name', header: 'Service' },
          { key: 'basePrice', header: 'Price', render: (r) => formatPKR(Number(r.basePrice)) },
          { key: 'duration', header: 'Duration', render: (r) => `${r.duration} min` },
          { key: 'isActive', header: 'Active', render: (r) => r.isActive ? 'Yes' : 'No' },
          {
            key: 'actions',
            header: '',
            render: (r) => (
              <RowActions
                onEdit={() => { setEdit(r); setModal('edit'); }}
                onDelete={() => deactivate(Number(r.id))}
              />
            ),
          },
        ]}
        data={services}
      />
      <Modal open={!!modal} onClose={() => setModal(null)} title={modal === 'edit' ? 'Edit Service' : 'New Service'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input name="name" label="Name" required defaultValue={String(edit?.name ?? '')} />
          <Textarea name="description" label="Description" rows={2} defaultValue={String(edit?.description ?? '')} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input name="basePrice" label="Base Price" type="number" step="0.01" required defaultValue={String(edit?.basePrice ?? '')} />
            <Input name="duration" label="Duration (min)" type="number" required defaultValue={String(edit?.duration ?? 60)} />
          </div>
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

// ─── Suppliers ───────────────────────────────────────────────────────────────

export function BranchSuppliersPage() {
  const branchId = useBranchId();
  const { toast } = useToast();
  const [suppliers, setSuppliers] = useState<Row[]>([]);
  const [modal, setModal] = useState<'create' | 'edit' | null>(null);
  const [edit, setEdit] = useState<Row | null>(null);
  const [saving, setSaving] = useState(false);

  const reload = useCallback(() => {
    if (branchId) branchApi.suppliers(branchId).then((r) => setSuppliers(r.data as unknown as Row[])).catch(console.error);
  }, [branchId]);

  useEffect(() => { reload(); }, [reload]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!branchId) return;
    const fd = new FormData(e.currentTarget);
    const body = {
      branchId,
      name: String(fd.get('name')),
      contactPerson: String(fd.get('contactPerson') || '') || undefined,
      phone: String(fd.get('phone') || '') || undefined,
      email: String(fd.get('email') || '') || undefined,
      address: String(fd.get('address') || '') || undefined,
    };
    setSaving(true);
    try {
      if (modal === 'edit' && edit) await branchApi.updateSupplier(Number(edit.id), { ...body, branchId });
      else await branchApi.createSupplier(body);
      toast(modal === 'edit' ? 'Supplier updated' : 'Supplier created', 'success');
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
      <PageHeader title="Suppliers" subtitle="Manage branch suppliers" action={<Button variant="accent" onClick={() => { setEdit(null); setModal('create'); }}>Add Supplier</Button>} />
      <DataTable
        columns={[
          { key: 'name', header: 'Name' },
          { key: 'contactPerson', header: 'Contact' },
          { key: 'phone', header: 'Phone' },
          { key: 'actions', header: '', render: (r) => <RowActions onEdit={() => { setEdit(r); setModal('edit'); }} /> },
        ]}
        data={suppliers}
      />
      <Modal open={!!modal} onClose={() => setModal(null)} title={modal === 'edit' ? 'Edit Supplier' : 'New Supplier'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input name="name" label="Name" required defaultValue={String(edit?.name ?? '')} />
          <Input name="contactPerson" label="Contact Person" defaultValue={String(edit?.contactPerson ?? '')} />
          <Input name="phone" label="Phone" defaultValue={String(edit?.phone ?? '')} />
          <Input name="email" label="Email" type="email" defaultValue={String(edit?.email ?? '')} />
          <Textarea name="address" label="Address" rows={2} defaultValue={String(edit?.address ?? '')} />
          <FormActions onCancel={() => setModal(null)} loading={saving} />
        </form>
      </Modal>
    </div>
  );
}

// ─── Purchases ───────────────────────────────────────────────────────────────

export function BranchPurchasesPage() {
  const branchId = useBranchId();
  const { toast } = useToast();
  const [purchases, setPurchases] = useState<Row[]>([]);
  const [suppliers, setSuppliers] = useState<Row[]>([]);
  const [parts, setParts] = useState<Row[]>([]);
  const [modal, setModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const reload = useCallback(() => {
    if (!branchId) return;
    branchApi.purchases(branchId).then((r) => setPurchases(r.data as unknown as Row[])).catch(console.error);
    branchApi.suppliers(branchId).then((r) => setSuppliers(r.data as unknown as Row[])).catch(console.error);
    branchApi.parts().then((r) => setParts(r.data as unknown as Row[])).catch(console.error);
  }, [branchId]);

  useEffect(() => { reload(); }, [reload]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!branchId) return;
    const fd = new FormData(e.currentTarget);
    setSaving(true);
    try {
      await branchApi.createPurchase({
        branchId,
        supplierId: parseInt(String(fd.get('supplierId')), 10),
        invoiceNumber: String(fd.get('invoiceNumber') || '') || undefined,
        notes: String(fd.get('notes') || '') || undefined,
        items: [{
          partId: parseInt(String(fd.get('partId')), 10),
          quantity: parseInt(String(fd.get('quantity')), 10),
          unitCost: parseFloat(String(fd.get('unitCost'))),
        }],
      });
      toast('Purchase recorded', 'success');
      setModal(false);
      reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader title="Purchases" subtitle="Record stock purchases from suppliers" action={<Button variant="accent" onClick={() => setModal(true)}>New Purchase</Button>} />
      <DataTable
        columns={[
          { key: 'id', header: 'ID' },
          { key: 'supplier', header: 'Supplier', render: (r) => (r.supplier as { name: string })?.name ?? '—' },
          { key: 'total', header: 'Total', render: (r) => formatPKR(Number(r.total ?? 0)) },
          { key: 'createdAt', header: 'Date', render: (r) => String(r.createdAt).slice(0, 10) },
        ]}
        data={purchases}
      />
      <Modal open={modal} onClose={() => setModal(false)} title="Record Purchase" size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Select name="supplierId" label="Supplier" required>
            <option value="">Select supplier</option>
            {suppliers.map((s) => <option key={String(s.id)} value={String(s.id)}>{String(s.name)}</option>)}
          </Select>
          <Select name="partId" label="Part" required>
            <option value="">Select part</option>
            {parts.map((p) => <option key={String(p.id)} value={String(p.id)}>{String(p.name)} ({String(p.itemCode)})</option>)}
          </Select>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input name="quantity" label="Quantity" type="number" min={1} required defaultValue="1" />
            <Input name="unitCost" label="Unit Cost" type="number" step="0.01" required />
          </div>
          <Input name="invoiceNumber" label="Invoice #" />
          <Input name="notes" label="Notes" />
          <FormActions onCancel={() => setModal(false)} loading={saving} />
        </form>
      </Modal>
    </div>
  );
}

// ─── Accounting ──────────────────────────────────────────────────────────────

export function BranchAccountingPage() {
  const branchId = useBranchId();
  const { toast } = useToast();
  const [tab, setTab] = useState<'accounts' | 'vouchers' | 'banks' | 'trial'>('accounts');
  const [accounts, setAccounts] = useState<Row[]>([]);
  const [vouchers, setVouchers] = useState<Row[]>([]);
  const [banks, setBanks] = useState<Row[]>([]);
  const [trial, setTrial] = useState<Row | null>(null);
  const [categories, setCategories] = useState<Row[]>([]);
  const [modal, setModal] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const reload = useCallback(() => {
    if (!branchId) return;
    branchApi.accounts(branchId).then((r) => setAccounts(r as Row[])).catch(console.error);
    branchApi.vouchers(branchId).then((r) => setVouchers(r as Row[])).catch(console.error);
    branchApi.banks(branchId).then((r) => setBanks(r as Row[])).catch(console.error);
    branchApi.accountingCategories(branchId).then((r) => setCategories(r as Row[])).catch(console.error);
    branchApi.trialBalance(branchId).then((r) => {
      const data = r as Row & { accounts?: Row[] };
      setTrial(Array.isArray(data) ? (data as unknown as Row) : data);
    }).catch(console.error);
  }, [branchId]);

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
      setModal(null);
      reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleVoucher(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!branchId) return;
    const fd = new FormData(e.currentTarget);
    setSaving(true);
    try {
      await branchApi.createVoucher(branchId, {
        type: String(fd.get('type')),
        debitAccountId: parseInt(String(fd.get('debitAccountId')), 10),
        creditAccountId: parseInt(String(fd.get('creditAccountId')), 10),
        amount: parseFloat(String(fd.get('amount'))),
        description: String(fd.get('description') || '') || undefined,
      });
      toast('Voucher created', 'success');
      setModal(null);
      reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleBank(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!branchId) return;
    const fd = new FormData(e.currentTarget);
    setSaving(true);
    try {
      await branchApi.createBank(branchId, {
        name: String(fd.get('name')),
        accountNumber: String(fd.get('accountNumber') || '') || undefined,
        openingBalance: parseFloat(String(fd.get('openingBalance') || '0')),
      });
      toast('Bank account created', 'success');
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

  const tabs = [
    { id: 'accounts' as const, label: 'Accounts' },
    { id: 'vouchers' as const, label: 'Vouchers' },
    { id: 'banks' as const, label: 'Banks' },
    { id: 'trial' as const, label: 'Trial Balance' },
  ];

  return (
    <div>
      <PageHeader title="Accounting" subtitle="Chart of accounts, vouchers, and trial balance" />
      <div className="mb-6 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <Button key={t.id} variant={tab === t.id ? 'accent' : 'secondary'} size="sm" onClick={() => setTab(t.id)}>{t.label}</Button>
        ))}
      </div>

      {tab === 'accounts' && (
        <>
          <div className="mb-4"><Button variant="accent" size="sm" onClick={() => setModal('account')}>Add Account</Button></div>
          <DataTable columns={[
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
              render: (r) => (
                <RowActions deleteLabel="Delete" onDelete={() => accountDelete.setTarget(r)} />
              ),
            },
          ]} data={accounts} />
          {accountDelete.modal}
        </>
      )}

      {tab === 'vouchers' && (
        <>
          <div className="mb-4"><Button variant="accent" size="sm" onClick={() => setModal('voucher')}>New Voucher</Button></div>
          <DataTable columns={[
            { key: 'type', header: 'Type' },
            { key: 'amount', header: 'Amount', render: (r) => formatPKR(Number(r.amount)) },
            { key: 'description', header: 'Description' },
            { key: 'createdAt', header: 'Date', render: (r) => String(r.createdAt).slice(0, 10) },
          ]} data={vouchers} />
        </>
      )}

      {tab === 'banks' && (
        <>
          <div className="mb-4"><Button variant="accent" size="sm" onClick={() => setModal('bank')}>Add Bank</Button></div>
          <DataTable columns={[
            { key: 'name', header: 'Bank' },
            { key: 'accountNumber', header: 'Account #' },
            { key: 'runningBalance', header: 'Balance', render: (r) => formatPKR(Number(r.runningBalance ?? 0)) },
          ]} data={banks} />
        </>
      )}

      {tab === 'trial' && trial && (
        <div className="rounded-xl border bg-white p-6">
          <pre className="text-sm overflow-auto">{JSON.stringify(trial, null, 2)}</pre>
        </div>
      )}

      <Modal open={modal === 'account'} onClose={() => setModal(null)} title="New Account">
        <form onSubmit={handleAccount} className="space-y-4">
          <Select name="categoryId" label="Category" required>
            <option value="">Select category</option>
            {categories.map((c) => <option key={String(c.id)} value={String(c.id)}>{String(c.name)}</option>)}
          </Select>
          <Input name="name" label="Account Name" required />
          <Input name="openingBalance" label="Opening Balance" type="number" step="0.01" min="0" defaultValue="0" />
          <FormActions onCancel={() => setModal(null)} loading={saving} />
        </form>
      </Modal>

      <Modal open={modal === 'voucher'} onClose={() => setModal(null)} title="New Voucher" size="lg">
        <form onSubmit={handleVoucher} className="space-y-4">
          <Select name="type" label="Type" required defaultValue="JOURNAL">
            {['PAYMENT', 'RECEIPT', 'JOURNAL'].map((t) => <option key={t} value={t}>{t}</option>)}
          </Select>
          <Select name="debitAccountId" label="Debit Account" required>
            <option value="">Select</option>
            {accounts.map((a) => <option key={String(a.id)} value={String(a.id)}>{String(a.name)}</option>)}
          </Select>
          <Select name="creditAccountId" label="Credit Account" required>
            <option value="">Select</option>
            {accounts.map((a) => <option key={String(a.id)} value={String(a.id)}>{String(a.name)}</option>)}
          </Select>
          <Input name="amount" label="Amount" type="number" step="0.01" required />
          <Input name="description" label="Description" />
          <FormActions onCancel={() => setModal(null)} loading={saving} />
        </form>
      </Modal>

      <Modal open={modal === 'bank'} onClose={() => setModal(null)} title="New Bank Account">
        <form onSubmit={handleBank} className="space-y-4">
          <Input name="name" label="Bank Name" required />
          <Input name="accountNumber" label="Account Number" />
          <Input name="openingBalance" label="Opening Balance" type="number" step="0.01" defaultValue="0" />
          <FormActions onCancel={() => setModal(null)} loading={saving} />
        </form>
      </Modal>
    </div>
  );
}

// ─── Reports ─────────────────────────────────────────────────────────────────

export function BranchReportsPage() {
  const branchId = useBranchId();
  const token = localStorage.getItem('token');

  async function download(href: string, name: string) {
    const res = await fetch(href, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    if (!res.ok) return;
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
  }

  return (
    <div>
      <PageHeader title="Branch Reports" subtitle="Export your branch data" />
      <div className="grid gap-4 sm:grid-cols-2">
        <button type="button" onClick={() => download('/api/reports/export/orders?format=csv', 'orders.csv')} className="rounded-xl border bg-white p-6 text-left hover:shadow-md transition-shadow">
          <p className="font-semibold text-brand">Orders CSV</p>
        </button>
        <button type="button" onClick={() => download(`/api/reports/export/inventory?format=csv&branchId=${branchId}`, 'inventory.csv')} className="rounded-xl border bg-white p-6 text-left hover:shadow-md transition-shadow">
          <p className="font-semibold text-brand">Inventory CSV</p>
        </button>
      </div>
    </div>
  );
}

// ─── Payments ────────────────────────────────────────────────────────────────

export function BranchPaymentsPage() {
  const branchId = useBranchId();
  const { toast } = useToast();
  const [channels, setChannels] = useState<Row[]>([]);
  const [orders, setOrders] = useState<Row[]>([]);
  const [channelModal, setChannelModal] = useState<'create' | 'edit' | null>(null);
  const [editChannel, setEditChannel] = useState<Row | null>(null);
  const [saving, setSaving] = useState(false);

  const reloadChannels = useCallback(() => {
    if (!branchId) return;
    branchApi.paymentChannels(branchId).then((r) => setChannels(r as unknown as Row[])).catch(console.error);
  }, [branchId]);

  useEffect(() => {
    branchApi.pendingPayments().then((r) => setOrders(r as unknown as Row[])).catch(console.error);
  }, []);

  useEffect(() => { reloadChannels(); }, [reloadChannels]);

  async function handleChannelSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!branchId) return;
    const fd = new FormData(e.currentTarget);
    const body = {
      type: String(fd.get('type')) as 'BANK' | 'WALLET',
      name: String(fd.get('name')),
      accountTitle: String(fd.get('accountTitle') || '') || undefined,
      accountNumber: String(fd.get('accountNumber')),
    };
    setSaving(true);
    try {
      if (channelModal === 'edit' && editChannel) {
        await branchApi.updatePaymentChannel(branchId, Number(editChannel.id), body);
        toast('Payment channel updated', 'success');
      } else {
        await branchApi.createPaymentChannel(branchId, body);
        toast('Payment channel added', 'success');
      }
      setChannelModal(null);
      reloadChannels();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteChannel(id: number) {
    if (!branchId || !confirm('Remove this payment channel?')) return;
    try {
      await branchApi.deletePaymentChannel(branchId, id);
      toast('Removed', 'success');
      reloadChannels();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed', 'error');
    }
  }

  async function handleApprove(id: number, approved: boolean) {
    try {
      await branchApi.approvePayment(id, approved);
      toast(approved ? 'Approved' : 'Rejected', approved ? 'success' : 'info');
      setOrders((o) => o.filter((x) => x.id !== id));
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed', 'error');
    }
  }

  return (
    <div className="space-y-10">
      <div>
        <PageHeader
          title="Payment Channels"
          subtitle="Bank accounts & wallets shown to customers at checkout"
          action={
            <Button variant="accent" onClick={() => { setEditChannel(null); setChannelModal('create'); }}>
              Add Payment Channel
            </Button>
          }
        />
        <DataTable
          columns={[
            { key: 'type', header: 'Type', render: (r) => String(r.type) },
            { key: 'name', header: 'Name' },
            { key: 'accountTitle', header: 'Account Title', render: (r) => String(r.accountTitle ?? '—') },
            { key: 'accountNumber', header: 'Account / Number', render: (r) => <span className="font-mono text-xs">{String(r.accountNumber)}</span> },
            {
              key: 'actions',
              header: '',
              render: (r) => (
                <RowActions
                  onEdit={() => { setEditChannel(r); setChannelModal('edit'); }}
                  onDelete={() => handleDeleteChannel(Number(r.id))}
                />
              ),
            },
          ]}
          data={channels}
          emptyMessage="No payment channels — add one for online checkout"
        />
      </div>

      <div>
        <PageHeader title="Pending Payments" subtitle="Approve bank transfer orders" />
        <DataTable
          columns={[
            { key: 'trackingId', header: 'Tracking' },
            { key: 'paymentTransactionId', header: 'TID', render: (r) => String(r.paymentTransactionId ?? '—') },
            { key: 'total', header: 'Amount', render: (r) => formatPKR(Number(r.total)) },
            {
              key: 'actions',
              header: 'Actions',
              render: (r) => (
                <div className="flex gap-2">
                  <Button size="sm" variant="accent" onClick={() => handleApprove(Number(r.id), true)}>Approve</Button>
                  <Button size="sm" variant="danger" onClick={() => handleApprove(Number(r.id), false)}>Reject</Button>
                </div>
              ),
            },
          ]}
          data={orders}
          emptyMessage="No pending payments"
        />
      </div>

      <Modal open={!!channelModal} onClose={() => setChannelModal(null)} title={channelModal === 'edit' ? 'Edit Payment Channel' : 'Add Payment Channel'}>
        <form onSubmit={handleChannelSubmit} className="space-y-4">
          <Select name="type" label="Type" defaultValue={String(editChannel?.type ?? 'BANK')} required>
            <option value="BANK">Bank</option>
            <option value="WALLET">Wallet (JazzCash, Easypaisa, etc.)</option>
          </Select>
          <Input name="name" label="Bank / Wallet Name" required placeholder="e.g. HBL, JazzCash" defaultValue={String(editChannel?.name ?? '')} />
          <Input name="accountTitle" label="Account Title" placeholder="Account holder name" defaultValue={String(editChannel?.accountTitle ?? '')} />
          <Input name="accountNumber" label="Account / Wallet Number" required defaultValue={String(editChannel?.accountNumber ?? '')} />
          <FormActions onCancel={() => setChannelModal(null)} loading={saving} />
        </form>
      </Modal>
    </div>
  );
}
