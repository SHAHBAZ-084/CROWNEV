import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { branchApi } from '../../api/client';
import { useToast } from '../../contexts/ToastContext';
import { Receipt, ShoppingCart, Users, AlertTriangle, Bike, Package, Boxes } from 'lucide-react';
import { PageHeader } from '../../components/layout/PageTransition';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Input, Select, Textarea } from '../../components/ui/Input';
import { DataTable, StatusBadge } from '../../components/ui/DataTable';
import { FormActions, RowActions, useDeleteConfirm } from '../../components/crud/CrudHelpers';
import { InvoiceModalContent } from '../../components/invoice/SaleInvoice';
import type { Order } from '../../types';
import { isAwaitingPaymentVerification, PaymentStatusBadge } from '../../lib/orderHelpers';
import { formatPKR, formatLedgerBalance, formatDate, formatTime, orderListReference } from '../../lib/format';
import { filterManualAccountCategories } from '../../lib/accountingCategories';
import { StatCard } from '../../components/ui/StatCard';
import { ProductGridSkeleton } from '../../components/ui/Skeleton';
import { useDebounce } from '../../hooks/useDebounce';
import { useBranchPermission } from '../../hooks/useBranchPermission';
import { PosNavGrid } from '../../components/layout/PosNavGrid';
import {
  exportSalesSummaryPdf,
  exportToPdf,
  INVENTORY_EXPORT_COLUMNS,
  ORDER_EXPORT_COLUMNS,
  type InventoryExportRow,
  type OrderExportRow,
} from '../../lib/reportExport';

type Row = Record<string, unknown>;

const ORDER_STATUSES = ['AWAITING_BILTY_CHARGES', 'AWAITING_PAYMENT', 'PAYMENT_SUBMITTED', 'CONFIRMED', 'CANCELLED'];
const BOOKING_STATUSES = ['PENDING', 'SCHEDULED'];
const BOOKING_STATUS_ORDER: Record<string, number> = {
  PENDING: 0,
  SCHEDULED: 1,
};
function useBranchId() {
  const { user } = useAuth();
  return user?.branchId ?? null;
}

// ─── POS ─────────────────────────────────────────────────────────────────────

function StockBadge({ stock, alertAt = 3 }: { stock: number; alertAt?: number }) {
  if (stock <= 0) {
    return <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-500">Out of Stock</span>;
  }
  if (stock <= alertAt) {
    return <span className="inline-flex rounded-full bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-700">Low Stock: {stock} left</span>;
  }
  return <span className="inline-flex rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">In Stock: {stock}</span>;
}

export function BranchPOSPage() {
  const branchId = useBranchId();
  const [todayVouchers, setTodayVouchers] = useState(0);
  const [todayCustomers, setTodayCustomers] = useState(0);
  const [todaySales, setTodaySales] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!branchId) return;
    setLoading(true);
    branchApi.posStats(branchId)
      .then((stats) => {
        setTodayVouchers(stats.todayVouchers);
        setTodayCustomers(stats.todayCustomers);
        setTodaySales(stats.todaySales);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [branchId]);

  return (
    <div className="space-y-8">
      <PageHeader title="Point of Sale" subtitle="Today's activity for your branch" />
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
        <h2 className="mb-4 font-display text-sm font-bold text-slate-900">Workspace</h2>
        <PosNavGrid />
      </div>
    </div>
  );
}

// ─── Orders ──────────────────────────────────────────────────────────────────

function orderRowCustomer(r: Row): string {
  const user = r.user as { firstName?: string; lastName?: string } | undefined;
  if (user?.firstName) return `${user.firstName} ${user.lastName ?? ''}`.trim();
  if (r.customerName) return String(r.customerName);
  const walkIn = r.customer as { name?: string } | undefined;
  return walkIn?.name ?? '';
}

export function BranchOrdersPage() {
  const { toast } = useToast();
  const { canUpdate, restrictedTitle } = useBranchPermission();
  const [orders, setOrders] = useState<Row[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('');
  const [detail, setDetail] = useState<Row | null>(null);
  const [paymentModal, setPaymentModal] = useState<Row | null>(null);
  const [biltyChargesModal, setBiltyChargesModal] = useState<Row | null>(null);
  const [invoiceModal, setInvoiceModal] = useState<Row | null>(null);
  const [invoiceData, setInvoiceData] = useState<import('../../types').InvoiceData | null>(null);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [biltyId, setBiltyId] = useState('');
  const [biltyCharges, setBiltyCharges] = useState('');
  const [saving, setSaving] = useState(false);

  const reload = useCallback(() => {
    const params: Record<string, string> = { type: 'ONLINE' };
    if (statusFilter) params.status = statusFilter;
    if (paymentFilter) params.paymentStatus = paymentFilter;
    branchApi.orders(params).then((r) => setOrders(r.data as unknown as Row[])).catch(console.error);
  }, [statusFilter, paymentFilter]);

  useEffect(() => { reload(); }, [reload]);

  async function handleApprove(approved: boolean) {
    if (!paymentModal) return;
    if (approved && paymentModal.shippingMethod === 'BILTY' && !biltyId.trim()) {
      toast('Bilty ID is required for bilty shipping orders', 'error');
      return;
    }
    setSaving(true);
    try {
      await branchApi.approvePayment(Number(paymentModal.id), approved, approved ? biltyId.trim() : undefined);
      toast(approved ? 'Payment verified — order confirmed' : 'Payment rejected', approved ? 'success' : 'error');
      setPaymentModal(null);
      setBiltyId('');
      reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleBiltyCharges(e: FormEvent) {
    e.preventDefault();
    if (!biltyChargesModal) return;
    const amount = parseFloat(biltyCharges);
    if (!Number.isFinite(amount) || amount < 0) {
      toast('Enter a valid bilty charges amount', 'error');
      return;
    }
    setSaving(true);
    try {
      await branchApi.setBiltyCharges(Number(biltyChargesModal.id), amount);
      toast('Bilty charges set — customer can now pay', 'success');
      setBiltyChargesModal(null);
      setBiltyCharges('');
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
      <PageHeader title="Branch Orders" subtitle="Online orders — set bilty charges, verify payment, assign bilty ID" />

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
      </div>

      <DataTable
        columns={[
          { key: 'id', header: 'Order', render: (r) => <span className="font-mono text-xs">{orderListReference(r as { id: number; publicId?: string; saleReference?: string; type?: string })}</span> },
          { key: 'shippingMethod', header: 'Shipping', render: (r) => (r.shippingMethod === 'BILTY' ? 'Bilty' : r.shippingMethod === 'SELF' ? 'Self' : '—') },
          { key: 'customer', header: 'Customer', render: (r) => orderRowCustomer(r) },
          { key: 'status', header: 'Status', render: (r) => <StatusBadge status={String(r.status)} /> },
          { key: 'paymentStatus', header: 'Payment', render: (r) => <PaymentStatusBadge order={r as unknown as Order} /> },
          { key: 'total', header: 'Total', render: (r) => formatPKR(Number(r.total)) },
          {
            key: 'actions',
            header: '',
            render: (r) => (
              <div className="flex flex-wrap gap-1">
                <Button size="sm" variant="ghost" onClick={() => setDetail(r)}>View</Button>
                {r.status === 'AWAITING_BILTY_CHARGES' && (
                  <Button size="sm" variant="secondary" disabled={!canUpdate} title={!canUpdate ? restrictedTitle : undefined} onClick={() => { setBiltyChargesModal(r); setBiltyCharges(''); }}>Bilty charges</Button>
                )}
                {r.status === 'PAYMENT_SUBMITTED' && r.paymentStatus === 'PENDING' && (
                  <Button size="sm" variant="secondary" disabled={!canUpdate} title={!canUpdate ? restrictedTitle : undefined} onClick={() => { setPaymentModal(r); setBiltyId(''); }}>Verify</Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => openInvoice(r)}>Invoice</Button>
              </div>
            ),
          },
        ]}
        data={orders}
        emptyMessage="No online orders yet"
      />

      <Modal open={!!detail} onClose={() => setDetail(null)} title={`Order ${detail ? orderListReference(detail as { id: number; publicId?: string; saleReference?: string; type?: string }) : ''}`} size="lg">
        {detail && (
          <div className="space-y-3 text-sm text-slate-700">
            <p><span className="text-slate-500">Customer:</span> {orderRowCustomer(detail)}</p>
            <p><span className="text-slate-500">Phone:</span> {String(detail.customerPhone ?? (detail.user as { phone?: string })?.phone ?? '')}</p>
            <p><span className="text-slate-500">Address:</span> {String(detail.customerAddress ?? '')}</p>
            <p><span className="text-slate-500">Shipping:</span> {String(detail.shippingMethod ?? '—')}</p>
            <p><span className="text-slate-500">Status:</span> <StatusBadge status={String(detail.status)} /></p>
            <p><span className="text-slate-500">Payment:</span> {String(detail.paymentMethod)} <PaymentStatusBadge order={detail as unknown as Order} /></p>
            {isAwaitingPaymentVerification(detail as unknown as Order) && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                Payment proof submitted — use Verify to approve or reject after checking TID and screenshot.
              </div>
            )}
            <p><span className="text-slate-500">Subtotal:</span> {formatPKR(Number(detail.subtotal ?? detail.total))}</p>
            {detail.biltyCharges != null && (
              <p><span className="text-slate-500">Bilty charges:</span> {formatPKR(Number(detail.biltyCharges))}</p>
            )}
            <p><span className="text-slate-500">Total:</span> {formatPKR(Number(detail.total))}</p>
            {detail.biltyId ? (
              <p><span className="text-slate-500">Bilty ID:</span> {String(detail.biltyId)}</p>
            ) : null}
          </div>
        )}
      </Modal>

      <Modal open={!!biltyChargesModal} onClose={() => setBiltyChargesModal(null)} title="Set Bilty Charges">
        <form onSubmit={handleBiltyCharges} className="space-y-4">
          <p className="text-sm text-slate-500">
            Enter shipping (bilty) charges. The customer will be prompted to pay product price + bilty charges.
          </p>
          <Input
            label="Bilty charges (PKR)"
            type="number"
            min="0"
            step="any"
            value={biltyCharges}
            onChange={(e) => setBiltyCharges(e.target.value)}
            required
          />
          {biltyChargesModal && (
            <p className="text-sm text-slate-600">
              Total after charges:{' '}
              <strong>
                {formatPKR(Number(biltyChargesModal.subtotal ?? biltyChargesModal.total) + (parseFloat(biltyCharges) || 0))}
              </strong>
            </p>
          )}
          <FormActions onCancel={() => setBiltyChargesModal(null)} loading={saving} submitDisabled={!canUpdate} submitTitle={!canUpdate ? restrictedTitle : undefined} />
        </form>
      </Modal>

      <Modal open={!!paymentModal} onClose={() => { setPaymentModal(null); setBiltyId(''); }} title="Verify Payment" size="lg">
        {paymentModal && (
          <div className="space-y-4 text-sm text-slate-700">
            <p>Customer: <strong className="text-slate-900">{orderRowCustomer(paymentModal)}</strong></p>
            <p>Total: <strong className="text-slate-900">{formatPKR(Number(paymentModal.total))}</strong></p>
            <p>TID: <strong className="font-mono text-slate-900">{String(paymentModal.paymentTransactionId ?? '')}</strong></p>
            {paymentModal.bankTransferScreenshot ? (
              <img
                src={`${BASE}${String(paymentModal.bankTransferScreenshot)}`}
                alt="Payment screenshot"
                className="max-h-64 rounded-lg border border-slate-200 object-contain"
              />
            ) : null}
            {paymentModal.shippingMethod === 'BILTY' && (
              <Input
                label="Bilty ID (required for bilty orders)"
                value={biltyId}
                onChange={(e) => setBiltyId(e.target.value)}
                placeholder="e.g. TCS-12345678"
                required
              />
            )}
            <div className="flex gap-2">
              <Button variant="accent" loading={saving} disabled={!canUpdate} title={!canUpdate ? restrictedTitle : undefined} onClick={() => handleApprove(true)}>Verify Payment</Button>
              <Button variant="danger" loading={saving} disabled={!canUpdate} title={!canUpdate ? restrictedTitle : undefined} onClick={() => handleApprove(false)}>Reject</Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!invoiceModal} onClose={() => { setInvoiceModal(null); setInvoiceData(null); }} title="Sale Invoice" size="lg" tallContent>
        <InvoiceModalContent loading={invoiceLoading} invoice={invoiceData} />
      </Modal>
    </div>
  );
}

// ─── Stock (bikes + parts) ───────────────────────────────────────────────────

type StockRow = {
  type: 'BIKE' | 'PART';
  source: 'PRODUCT' | 'SERVICE_PART';
  id: string | number;
  name: string;
  code: string;
  quantity: number;
  alertAt: number;
  isLowStock: boolean;
  isSelected: boolean;
};

type StockFilter = 'ALL' | 'BIKE' | 'PART' | 'LOW';

export function BranchInventoryPage() {
  const branchId = useBranchId();
  const { toast } = useToast();
  const { canDelete, restrictedTitle } = useBranchPermission();
  const [items, setItems] = useState<StockRow[]>([]);
  const [lowStock, setLowStock] = useState<StockRow[]>([]);
  const [filter, setFilter] = useState<StockFilter>('ALL');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [selectingId, setSelectingId] = useState<string | null>(null);
  const [chassisModalItem, setChassisModalItem] = useState<StockRow | null>(null);
  const [chassisList, setChassisList] = useState<{ id: number; chassisNumber: string }[]>([]);
  const [chassisLoading, setChassisLoading] = useState(false);

  const reload = useCallback(() => {
    if (!branchId) return;
    setLoading(true);
    branchApi
      .branchStock(branchId)
      .then((data) => {
        setItems(data.items);
        setLowStock(data.lowStock);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [branchId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const selectedItems = useMemo(() => items.filter((r) => r.isSelected), [items]);

  const stockSummary = useMemo(
    () => ({
      bikes: selectedItems.filter((r) => r.type === 'BIKE').length,
      parts: selectedItems.filter((r) => r.type === 'PART').length,
      units: selectedItems.reduce((sum, r) => sum + r.quantity, 0),
      lowStockCount: selectedItems.filter((r) => r.isLowStock).length,
    }),
    [selectedItems],
  );

  const catalogMatches = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    if (!q) return [];
    return items
      .filter(
        (r) =>
          !r.isSelected &&
          (r.name.toLowerCase().includes(q) || r.code.toLowerCase().includes(q)),
      )
      .slice(0, 10);
  }, [items, debouncedSearch]);

  const displayed = useMemo(() => {
    let rows = selectedItems;
    if (filter === 'BIKE') rows = rows.filter((r) => r.type === 'BIKE');
    if (filter === 'PART') rows = rows.filter((r) => r.type === 'PART');
    if (filter === 'LOW') rows = rows.filter((r) => r.isLowStock);
    return rows;
  }, [selectedItems, filter]);

  async function openChassisView(row: StockRow) {
    if (!branchId || row.type !== 'BIKE' || row.source !== 'PRODUCT') return;
    setChassisModalItem(row);
    setChassisList([]);
    setChassisLoading(true);
    try {
      const list = await branchApi.availableChassis(branchId, String(row.id));
      setChassisList(list);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to load chassis numbers', 'error');
      setChassisModalItem(null);
    } finally {
      setChassisLoading(false);
    }
  }

  async function handleToggleSelect(row: StockRow) {
    if (!branchId) return;
    const key = `${row.source}-${row.id}`;
    setTogglingId(key);
    try {
      if (row.source === 'PRODUCT') {
        await branchApi.setProductListed(branchId, String(row.id), !row.isSelected);
      } else if (row.isSelected) {
        await branchApi.removePartFromBranch(branchId, Number(row.id));
      } else {
        await branchApi.setStock(branchId, Number(row.id), 0);
      }
      toast(row.isSelected ? 'Removed from branch stock' : 'Added to branch stock', 'success');
      reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed', 'error');
    } finally {
      setTogglingId(null);
    }
  }

  async function handleSelectFromCatalog(row: StockRow) {
    if (!branchId) return;
    const key = `${row.source}-${row.id}`;
    setSelectingId(key);
    try {
      if (row.source === 'PRODUCT') {
        await branchApi.setProductListed(branchId, String(row.id), true);
      } else {
        await branchApi.setStock(branchId, Number(row.id), 0);
      }
      toast(`"${row.name}" added to your branch stock`, 'success');
      setSearch('');
      reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to select', 'error');
    } finally {
      setSelectingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Stock"
        subtitle="View branch inventory — add items from the catalog; quantities update via purchase invoices"
      />

      <p className="rounded-[var(--radius-card)] border border-border bg-surface-alt/60 px-4 py-3 text-sm text-text-muted">
        Admin adds all bikes and parts to the catalog. You choose which ones your branch carries.
        Stock quantities are updated through POS supplier purchase invoices, not from this page.
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Bikes" value={stockSummary.bikes} icon={Bike} />
        <StatCard label="Parts" value={stockSummary.parts} icon={Package} />
        <StatCard label="Units in Stock" value={stockSummary.units} icon={Boxes} />
        <StatCard label="Low Stock Items" value={stockSummary.lowStockCount} icon={AlertTriangle} />
      </div>

      {lowStock.length > 0 && (
        <div className="rounded-[var(--radius-card)] border border-orange-200 bg-orange-50/80 p-4 sm:p-5">
          <h3 className="flex items-center gap-2 font-display font-semibold text-orange-800">
            <AlertTriangle className="h-5 w-5" />
            Low stock alert ({lowStock.length})
          </h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {lowStock.slice(0, 12).map((item) => (
              <span
                key={`${item.type}-${item.id}`}
                className="rounded-full border border-orange-200 bg-white px-3 py-1 text-xs font-medium text-orange-900"
              >
                {item.name} ({item.quantity}/{item.alertAt})
              </span>
            ))}
            {lowStock.length > 12 && (
              <span className="self-center text-xs text-orange-700">+{lowStock.length - 12} more</span>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="w-full sm:max-w-md space-y-2">
          <Input
            label="Select from catalog"
            placeholder="Search bikes or parts by name or code…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {debouncedSearch.trim() && (
            <div className="rounded-[var(--radius-card)] border border-border bg-white shadow-[var(--shadow-card)] overflow-hidden">
              <p className="px-4 py-2 text-xs font-medium text-text-muted border-b border-border bg-surface-alt/40">
                Catalog: click Select to add to your branch stock
              </p>
              {catalogMatches.length === 0 ? (
                <p className="px-4 py-3 text-sm text-text-muted">No matching bikes or parts in the catalog</p>
              ) : (
                <ul className="divide-y divide-border">
                  {catalogMatches.map((row) => {
                    const key = `${row.source}-${row.id}`;
                    return (
                      <li key={key} className="flex items-center justify-between gap-3 px-4 py-3">
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{row.name}</p>
                          <p className="text-xs text-text-muted font-mono truncate">{row.code}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                              row.type === 'BIKE' ? 'bg-brand/10 text-brand' : 'bg-accent/10 text-accent'
                            }`}
                          >
                            {row.type}
                          </span>
                          <Button
                            variant="accent"
                            size="sm"
                            loading={selectingId === key}
                            onClick={() => handleSelectFromCatalog(row)}
                          >
                            Select
                          </Button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </div>
        <Select
          label="Your stock"
          value={filter}
          onChange={(e) => setFilter(e.target.value as StockFilter)}
          className="w-full sm:min-w-[160px] sm:w-auto"
        >
          <option value="ALL">All in stock</option>
          <option value="BIKE">Bikes only</option>
          <option value="PART">Parts only</option>
          <option value="LOW">Low stock only</option>
        </Select>
      </div>

      {loading ? (
        <ProductGridSkeleton count={3} />
      ) : (
        <DataTable
          columns={[
            {
              key: 'type',
              header: 'Type',
              render: (r) => (
                <span
                  className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                    r.type === 'BIKE' ? 'bg-brand/10 text-brand' : 'bg-accent/10 text-accent'
                  }`}
                >
                  {String(r.type)}
                </span>
              ),
            },
            { key: 'name', header: 'Name', render: (r) => String(r.name) },
            { key: 'code', header: 'Code', render: (r) => <span className="font-mono text-xs">{String(r.code)}</span> },
            {
              key: 'quantity',
              header: 'Qty',
              render: (r) => {
                const qty = Number(r.quantity);
                return (
                  <span className={qty <= Number(r.alertAt) ? 'font-semibold text-orange-700' : 'font-semibold'}>
                    {qty}
                  </span>
                );
              },
            },
            { key: 'alert', header: 'Alert at', render: (r) => String(r.alertAt) },
            {
              key: 'status',
              header: 'Status',
              render: (r) => <StockBadge stock={Number(r.quantity)} alertAt={Number(r.alertAt)} />,
            },
            {
              key: 'actions',
              header: '',
              align: 'right',
              render: (r) => {
                const row = r as unknown as StockRow;
                const key = `${row.source}-${row.id}`;
                return (
                  <div className="flex flex-wrap items-center justify-end gap-1">
                    {row.type === 'BIKE' && row.source === 'PRODUCT' && (
                      <Button variant="ghost" size="sm" onClick={() => openChassisView(row)}>
                        View Chassis
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={!canDelete}
                      title={!canDelete ? restrictedTitle : undefined}
                      loading={togglingId === key}
                      onClick={() => handleToggleSelect(row)}
                    >
                      Remove
                    </Button>
                  </div>
                );
              },
            },
          ]}
          data={displayed as unknown as Row[]}
          emptyMessage="No bikes or parts selected yet. Search the catalog above to select items for your branch"
        />
      )}

      <Modal
        open={!!chassisModalItem}
        onClose={() => { setChassisModalItem(null); setChassisList([]); }}
        title={`Chassis numbers — ${chassisModalItem?.name ?? ''}`}
      >
        {chassisLoading ? (
          <p className="py-6 text-center text-sm text-text-muted">Loading chassis numbers…</p>
        ) : chassisList.length === 0 ? (
          <p className="py-6 text-center text-sm text-text-muted">
            No chassis numbers in stock for this model. Add units via a purchase invoice.
          </p>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-text-muted">
              {chassisList.length} unit{chassisList.length === 1 ? '' : 's'} in stock
            </p>
            <ul className="max-h-80 divide-y divide-border overflow-y-auto rounded-xl border border-border">
              {chassisList.map((c) => (
                <li key={c.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="font-mono text-sm font-medium text-slate-900">{c.chassisNumber}</span>
                  <span className="ml-auto inline-flex rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
                    In stock
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Modal>
    </div>
  );
}

// ─── Bikes Catalog (legacy route → Stock) ────────────────────────────────────

export function BranchBikesPage() {
  return <Navigate to="/branch/inventory" replace />;
}

// ─── Bookings ────────────────────────────────────────────────────────────────

function bookingRowCustomer(r: Row): string {
  if (r.customerName) return String(r.customerName);
  const user = r.user as { firstName?: string; lastName?: string } | undefined;
  if (user?.firstName) return `${user.firstName} ${user.lastName ?? ''}`.trim();
  return '';
}

export function BranchBookingsPage() {
  const branchId = useBranchId();
  const { toast } = useToast();
  const { canUpdate, canDelete, restrictedTitle } = useBranchPermission();
  const [bookings, setBookings] = useState<Row[]>([]);
  const [edit, setEdit] = useState<Row | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [saving, setSaving] = useState(false);

  const reload = useCallback(() => {
    const params: Record<string, string> = {};
    if (statusFilter) params.status = statusFilter;
    branchApi.bookings(params).then((r) => setBookings(r.data as unknown as Row[])).catch(console.error);
  }, [statusFilter]);

  useEffect(() => { reload(); }, [reload]);

  const displayedBookings = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
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
  }, [bookings, debouncedSearch]);

  const bookingDelete = useDeleteConfirm<Row>(
    async (row) => {
      if (!branchId) return;
      await branchApi.deleteBooking(Number(row.id), branchId);
      toast('Booking deleted', 'success');
      reload();
    },
    { message: (row) => `Delete booking for ${bookingRowCustomer(row)}?` },
  );

  async function updateStatus(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!edit || !branchId) return;
    const fd = new FormData(e.currentTarget);
    const confirmedTime = String(fd.get('confirmedTime') || '').trim();
    const date = String(fd.get('date') || '').trim();
    const status = date && confirmedTime ? 'SCHEDULED' : 'PENDING';
    setSaving(true);
    try {
      await branchApi.updateBookingStatus(Number(edit.id), {
        branchId,
        status,
        ...(confirmedTime && { confirmedTime }),
        ...(date && { date }),
      });
      toast(status === 'SCHEDULED' ? 'Visit scheduled' : 'Booking set to pending', 'success');
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
            <option key={s} value={s}>{s === 'SCHEDULED' ? 'Scheduled' : 'Pending'}</option>
          ))}
        </Select>
      </div>

      <DataTable
        columns={[
          { key: 'customer', header: 'Customer', render: (r) => bookingRowCustomer(r) },
          { key: 'notes', header: 'Notes', render: (r) => String(r.notes ?? '').slice(0, 40) },
          { key: 'service', header: 'Service', render: (r) => (r.service as { name: string })?.name ?? '' },
          {
            key: 'appointment',
            header: 'Visit Schedule',
            render: (r) => {
              if (r.date && r.confirmedTime) {
                return `${formatDate(String(r.date))} at ${formatTime(String(r.confirmedTime))}`;
              }
              if (r.confirmedTime) return formatTime(String(r.confirmedTime));
              return '';
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
                editDisabled={!canUpdate}
                onDelete={() => bookingDelete.setTarget(r)}
                deleteDisabled={!canDelete}
                disabledTitle={restrictedTitle}
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
              Fill both visit date and time to mark the booking as <strong>Scheduled</strong>. Leave them empty to keep it <strong>Pending</strong>.
            </p>
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
  const { canUpdate, canDelete, restrictedTitle } = useBranchPermission();
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
                editDisabled={!canUpdate}
                onDelete={() => deactivate(Number(r.id))}
                deleteDisabled={!canDelete}
                disabledTitle={restrictedTitle}
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
  const { canUpdate, restrictedTitle } = useBranchPermission();
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
          { key: 'actions', header: '', render: (r) => (
            <RowActions
              onEdit={() => { setEdit(r); setModal('edit'); }}
              editDisabled={!canUpdate}
              disabledTitle={restrictedTitle}
            />
          ) },
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
          { key: 'supplier', header: 'Supplier', render: (r) => (r.supplier as { name: string })?.name ?? '' },
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
  const { canDelete, restrictedTitle } = useBranchPermission();
  const [tab, setTab] = useState<'accounts' | 'vouchers' | 'banks' | 'trial'>('accounts');
  const [accounts, setAccounts] = useState<Row[]>([]);
  const [vouchers, setVouchers] = useState<Row[]>([]);
  const [banks, setBanks] = useState<Row[]>([]);
  const [trial, setTrial] = useState<Row | null>(null);
  const [categories, setCategories] = useState<Row[]>([]);
  const [modal, setModal] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const manualAccountCategories = useMemo(
    () => filterManualAccountCategories(categories),
    [categories],
  );

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
                <RowActions
                  deleteLabel="Delete"
                  onDelete={() => accountDelete.setTarget(r)}
                  deleteDisabled={!canDelete}
                  disabledTitle={restrictedTitle}
                />
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
            {manualAccountCategories.map((c) => <option key={String(c.id)} value={String(c.id)}>{String(c.name)}</option>)}
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

type ReportPeriod = 'daily' | 'weekly' | 'monthly' | 'yearly';

const PERIOD_OPTIONS: { id: ReportPeriod; label: string }[] = [
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

export function BranchReportsPage() {
  const branchId = useBranchId();
  const { toast } = useToast();
  const token = localStorage.getItem('token');
  const [period, setPeriod] = useState<ReportPeriod>('monthly');
  const [summary, setSummary] = useState<SalesSummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    setLoadingSummary(true);
    branchApi
      .salesSummary(period)
      .then(setSummary)
      .catch((err) => {
        toast(err instanceof Error ? err.message : 'Failed to load sales summary', 'error');
        setSummary(null);
      })
      .finally(() => setLoadingSummary(false));
  }, [period, toast]);

  const periodSubtitle = summary
    ? `${summary.label} · ${formatDate(summary.from)} – ${formatDate(summary.to)}`
    : '';

  async function downloadCsv(href: string, name: string) {
    setDownloading(`csv-${name}`);
    try {
      const res = await fetch(href, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
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

  function periodQuery() {
    if (!summary) return '';
    const params = new URLSearchParams({
      from: summary.from.slice(0, 10),
      to: summary.to.slice(0, 10),
    });
    return `&${params.toString()}`;
  }

  async function downloadOrdersPdf() {
    if (!summary) return;
    setDownloading('pdf-orders');
    try {
      const data = await branchApi.exportOrders({
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

  async function downloadInventoryPdf() {
    setDownloading('pdf-inventory');
    try {
      const data = await branchApi.exportInventory();
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
        subtitle: formatDate(new Date()),
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
        { metric: 'Walk-in sales (POS + service)', value: `${formatPKR(summary.walkInSales)} (${summary.walkInOrders} POS + ${summary.serviceInvoices} service)` },
        { metric: 'POS product sales', value: formatPKR(summary.posSales) },
        { metric: 'Service invoice sales', value: formatPKR(summary.serviceSales) },
      ];
      await exportSalesSummaryPdf(`sales_summary_${period}`, rows, {
        title: 'Branch Sales Summary',
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
      <PageHeader title="Branch Reports" subtitle="Sales overview and exports for your branch" />

      <div className="mb-6 flex flex-wrap gap-2">
        {PERIOD_OPTIONS.map((opt) => (
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
            <StatCard
              label="Total sales"
              value={summary.totalSales}
              icon={ShoppingCart}
              prefix="PKR "
            />
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
          <p className="mt-1 text-sm text-text-muted">Totals for selected period</p>
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
              onClick={() =>
                downloadCsv(
                  `/api/reports/export/orders?format=csv${periodQuery()}`,
                  `orders_${period}.csv`,
                )
              }
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
          <p className="font-semibold text-slate-900">Inventory</p>
          <p className="mt-1 text-sm text-text-muted">Current part stock levels</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              variant="secondary"
              size="sm"
              loading={downloading === 'csv-inventory.csv'}
              onClick={() =>
                downloadCsv(
                  `/api/reports/export/inventory?format=csv&branchId=${branchId ?? ''}`,
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

// ─── Payments ────────────────────────────────────────────────────────────────

export function BranchPaymentsPage() {
  const branchId = useBranchId();
  const { toast } = useToast();
  const { canUpdate, canDelete, restrictedTitle } = useBranchPermission();
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
            { key: 'accountTitle', header: 'Account Title', render: (r) => String(r.accountTitle ?? '') },
            { key: 'accountNumber', header: 'Account / Number', render: (r) => <span className="font-mono text-xs">{String(r.accountNumber)}</span> },
            {
              key: 'actions',
              header: '',
              render: (r) => (
                <RowActions
                  onEdit={() => { setEditChannel(r); setChannelModal('edit'); }}
                  editDisabled={!canUpdate}
                  onDelete={() => handleDeleteChannel(Number(r.id))}
                  deleteDisabled={!canDelete}
                  disabledTitle={restrictedTitle}
                />
              ),
            },
          ]}
          data={channels}
          emptyMessage="No payment channels. Add one for online checkout"
        />
      </div>

      <div>
        <PageHeader title="Pending Payments" subtitle="Approve bank transfer orders" />
        <DataTable
          columns={[
            { key: 'id', header: 'Order', render: (r) => <span className="font-mono text-xs">{orderListReference(r as { id: number; publicId?: string; saleReference?: string; type?: string })}</span> },
            { key: 'paymentTransactionId', header: 'TID', render: (r) => String(r.paymentTransactionId ?? '') },
            { key: 'total', header: 'Amount', render: (r) => formatPKR(Number(r.total)) },
            {
              key: 'actions',
              header: 'Actions',
              render: (r) => (
                <div className="flex gap-2">
                  <Button size="sm" variant="accent" disabled={!canUpdate} title={!canUpdate ? restrictedTitle : undefined} onClick={() => handleApprove(Number(r.id), true)}>Approve</Button>
                  <Button size="sm" variant="danger" disabled={!canUpdate} title={!canUpdate ? restrictedTitle : undefined} onClick={() => handleApprove(Number(r.id), false)}>Reject</Button>
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
