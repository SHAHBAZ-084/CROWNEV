import { type FormEvent, useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { branchApi, publicApi } from '../../api/client';
import { useToast } from '../../contexts/ToastContext';
import type { Product } from '../../types';
import { PageHeader } from '../../components/layout/PageTransition';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Input, Select, Textarea } from '../../components/ui/Input';
import { DataTable, StatusBadge } from '../../components/ui/DataTable';
import { FormActions, RowActions } from '../../components/crud/CrudHelpers';
import { formatPKR } from '../../lib/format';
import { ProductGridSkeleton } from '../../components/ui/Skeleton';

type Row = Record<string, unknown>;

const ORDER_STATUSES = ['PENDING', 'CONFIRMED', 'DELIVERED', 'CANCELLED'];
const BOOKING_STATUSES = ['PENDING', 'CONFIRMED', 'DONE', 'CANCELLED'];
const ADJUST_REASONS = ['CORRECTION', 'DAMAGE', 'THEFT', 'RETURN', 'OTHER'];

function useBranchId() {
  const { user } = useAuth();
  return user?.branchId ?? null;
}

// ─── POS ─────────────────────────────────────────────────────────────────────

export function BranchPOSPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<{ productId: string; name: string; price: number; qty: number }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    publicApi.shop().then((r) => setProducts(r.data)).catch(console.error);
  }, []);

  function addToCart(p: Product) {
    const price = Number(p.salePrice ?? p.price);
    setCart((c) => {
      const existing = c.find((i) => i.productId === p.id);
      if (existing) return c.map((i) => i.productId === p.id ? { ...i, qty: i.qty + 1 } : i);
      return [...c, { productId: p.id, name: p.name, price, qty: 1 }];
    });
  }

  const total = cart.reduce((s, i) => s + i.price * i.qty, 0);

  async function completeSale() {
    if (!user?.branchId || cart.length === 0) return;
    setLoading(true);
    try {
      const order = await branchApi.posOrder({
        branchId: user.branchId,
        paymentMethod: 'CASH',
        items: cart.map((i) => ({ productId: i.productId, quantity: i.qty })),
        isPaid: true,
      });
      setCart([]);
      toast(`Sale complete! ${order.trackingId}`, 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'POS failed', 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <PageHeader title="Point of Sale" subtitle="Create walk-in counter orders" />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {products.length === 0 ? <ProductGridSkeleton count={6} /> : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {products.map((p) => (
                <button key={p.id} type="button" onClick={() => addToCart(p)} className="rounded-xl border border-border bg-white p-4 text-left shadow-sm hover:shadow-md transition-shadow">
                  <p className="font-medium text-brand text-sm">{p.name}</p>
                  <p className="text-brand-light font-semibold mt-1">{formatPKR(Number(p.salePrice ?? p.price))}</p>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="rounded-[var(--radius-card)] border border-border bg-white p-6 shadow-[var(--shadow-card)] h-fit sticky top-8">
          <h3 className="font-display font-semibold text-brand">Current Sale</h3>
          <ul className="mt-4 space-y-2 max-h-64 overflow-y-auto">
            {cart.map((i) => (
              <li key={i.productId} className="flex justify-between text-sm">
                <span>{i.name} ×{i.qty}</span>
                <span>{formatPKR(i.price * i.qty)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 border-t border-border pt-4 font-display text-xl font-bold text-brand">{formatPKR(total)}</p>
          <Button variant="accent" className="w-full mt-4" size="lg" onClick={completeSale} loading={loading} disabled={cart.length === 0}>
            Complete Sale
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Orders ──────────────────────────────────────────────────────────────────

export function BranchOrdersPage() {
  const { toast } = useToast();
  const [orders, setOrders] = useState<Row[]>([]);
  const [statusModal, setStatusModal] = useState<Row | null>(null);
  const [saving, setSaving] = useState(false);

  const reload = useCallback(() => {
    branchApi.orders().then((r) => setOrders(r.data as unknown as Row[])).catch(console.error);
  }, []);

  useEffect(() => { reload(); }, [reload]);

  async function updateStatus(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!statusModal) return;
    setSaving(true);
    try {
      await branchApi.updateOrderStatus(Number(statusModal.id), String(new FormData(e.currentTarget).get('status')));
      toast('Order updated', 'success');
      setStatusModal(null);
      reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader title="Branch Orders" />
      <DataTable
        columns={[
          { key: 'trackingId', header: 'Tracking' },
          { key: 'status', header: 'Status', render: (r) => <StatusBadge status={String(r.status)} /> },
          { key: 'type', header: 'Type' },
          { key: 'total', header: 'Total', render: (r) => formatPKR(Number(r.total)) },
          { key: 'actions', header: '', render: (r) => <RowActions onEdit={() => setStatusModal(r)} /> },
        ]}
        data={orders}
      />
      <Modal open={!!statusModal} onClose={() => setStatusModal(null)} title="Update Order Status">
        <form onSubmit={updateStatus} className="space-y-4">
          <Select name="status" label="Status" defaultValue={String(statusModal?.status ?? 'PENDING')}>
            {ORDER_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </Select>
          <FormActions onCancel={() => setStatusModal(null)} loading={saving} />
        </form>
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

// ─── Bookings ────────────────────────────────────────────────────────────────

export function BranchBookingsPage() {
  const branchId = useBranchId();
  const { toast } = useToast();
  const [bookings, setBookings] = useState<Row[]>([]);
  const [edit, setEdit] = useState<Row | null>(null);
  const [saving, setSaving] = useState(false);

  const reload = useCallback(() => {
    branchApi.bookings().then((r) => setBookings(r.data as unknown as Row[])).catch(console.error);
  }, []);

  useEffect(() => { reload(); }, [reload]);

  async function updateStatus(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!edit || !branchId) return;
    setSaving(true);
    try {
      await branchApi.updateBookingStatus(Number(edit.id), {
        branchId,
        status: String(new FormData(e.currentTarget).get('status')),
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
      <DataTable
        columns={[
          { key: 'service', header: 'Service', render: (r) => (r.service as { name: string })?.name ?? '—' },
          { key: 'date', header: 'Date', render: (r) => String(r.date).slice(0, 10) },
          { key: 'time', header: 'Time' },
          { key: 'status', header: 'Status', render: (r) => <StatusBadge status={String(r.status)} /> },
          { key: 'actions', header: '', render: (r) => <RowActions onEdit={() => setEdit(r)} /> },
        ]}
        data={bookings}
      />
      <Modal open={!!edit} onClose={() => setEdit(null)} title="Update Booking">
        <form onSubmit={updateStatus} className="space-y-4">
          <Select name="status" label="Status" defaultValue={String(edit?.status ?? 'PENDING')}>
            {BOOKING_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </Select>
          <FormActions onCancel={() => setEdit(null)} loading={saving} />
        </form>
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
          <div className="grid grid-cols-2 gap-4">
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
          <div className="grid grid-cols-2 gap-4">
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
    branchApi.trialBalance(branchId).then((r) => setTrial(r as Row)).catch(console.error);
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
        code: String(fd.get('code')),
        type: String(fd.get('type')),
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
            { key: 'balance', header: 'Balance', render: (r) => formatPKR(Number(r.balance ?? 0)) },
          ]} data={accounts} />
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
          <Input name="code" label="Account Code" required />
          <Input name="name" label="Account Name" required />
          <Select name="type" label="Type" required>
            {['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'].map((t) => <option key={t} value={t}>{t}</option>)}
          </Select>
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
            {accounts.map((a) => <option key={String(a.id)} value={String(a.id)}>{String(a.code)} — {String(a.name)}</option>)}
          </Select>
          <Select name="creditAccountId" label="Credit Account" required>
            <option value="">Select</option>
            {accounts.map((a) => <option key={String(a.id)} value={String(a.id)}>{String(a.code)} — {String(a.name)}</option>)}
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
  const { toast } = useToast();
  const [orders, setOrders] = useState<Row[]>([]);

  useEffect(() => {
    branchApi.pendingPayments().then((r) => setOrders(r as unknown as Row[])).catch(console.error);
  }, []);

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
    <div>
      <PageHeader title="Pending Payments" subtitle="Approve bank transfer orders" />
      <DataTable
        columns={[
          { key: 'trackingId', header: 'Tracking' },
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
  );
}
