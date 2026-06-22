import { type FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { customerApi } from '../../api/client';
import type { Booking, InvoiceData, Order } from '../../types';
import { PageHeader } from '../../components/layout/PageTransition';
import { DataTable, StatusBadge } from '../../components/ui/DataTable';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { FormActions } from '../../components/crud/CrudHelpers';
import { InvoiceModalContent } from '../../components/invoice/SaleInvoice';
import { OrderStatusTimeline, isInvoiceAvailable, orderItemsSummary } from '../../lib/orderHelpers';
import { formatPKR, formatDate, formatTime } from '../../lib/format';
import { downloadBookingReceipt } from '../../lib/receiptDownload';
import { useToast } from '../../contexts/ToastContext';

export function CustomerDashboard() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);

  useEffect(() => {
    Promise.all([customerApi.orders(), customerApi.bookings()])
      .then(([o, b]) => { setOrders(o.data); setBookings(b.data); })
      .catch(console.error);
  }, []);

  return (
    <div>
      <PageHeader
        title={`Welcome, ${user?.firstName}`}
        subtitle="Your orders and service bookings"
        action={
          <div className="flex gap-2">
            <Link to="/shop"><Button variant="secondary" size="sm">Shop</Button></Link>
            <Link to="/book-service"><Button variant="accent" size="sm">Book Service</Button></Link>
          </div>
        }
      />
      <div className="grid gap-8 lg:grid-cols-2">
        <div>
          <h2 className="font-display font-semibold text-brand mb-4">Recent Orders ({orders.length})</h2>
          <DataTable
            columns={[
              { key: 'trackingId', header: 'Tracking' },
              { key: 'status', header: 'Status', render: (r) => <StatusBadge status={String(r.status)} /> },
              { key: 'total', header: 'Total', render: (r) => formatPKR(Number(r.total)) },
            ]}
            data={orders.slice(0, 5) as unknown as Record<string, unknown>[]}
            emptyMessage="No orders yet"
          />
          {orders.length > 5 && <Link to="/customer/orders" className="text-sm text-brand-light mt-2 inline-block">View all →</Link>}
        </div>
        <div>
          <h2 className="font-display font-semibold text-brand mb-4">Service Bookings ({bookings.length})</h2>
          <DataTable
            columns={[
              { key: 'service', header: 'Service', render: (r) => (r.service as { name: string })?.name ?? '—' },
              { key: 'date', header: 'Date', render: (r) => formatDate(String(r.date)) },
              { key: 'status', header: 'Status', render: (r) => <StatusBadge status={String(r.status)} /> },
            ]}
            data={bookings.slice(0, 5) as unknown as Record<string, unknown>[]}
            emptyMessage="No bookings yet"
          />
        </div>
      </div>
    </div>
  );
}

export function CustomerOrdersPage() {
  const { toast } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [detail, setDetail] = useState<Order | null>(null);
  const [invoiceModal, setInvoiceModal] = useState<number | null>(null);
  const [invoiceData, setInvoiceData] = useState<InvoiceData | null>(null);
  const [invoiceLoading, setInvoiceLoading] = useState(false);

  useEffect(() => {
    customerApi.orders().then((r) => setOrders(r.data)).catch(console.error);
  }, []);

  async function viewOrder(id: number) {
    try {
      const order = await customerApi.order(id);
      setDetail(order);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to load order', 'error');
    }
  }

  async function openInvoice(id: number) {
    if (!isInvoiceAvailable(orders.find((o) => o.id === id) ?? ({} as Order))) {
      toast('Invoice available once order is delivered and payment verified', 'error');
      return;
    }
    setInvoiceModal(id);
    setInvoiceLoading(true);
    setInvoiceData(null);
    try {
      const data = await customerApi.orderInvoice(id);
      setInvoiceData(data);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to load invoice', 'error');
    } finally {
      setInvoiceLoading(false);
    }
  }

  return (
    <div>
      <PageHeader title="My Orders" action={<Link to="/shop"><Button variant="accent" size="sm">New Order</Button></Link>} />
      <DataTable
        columns={[
          { key: 'trackingId', header: 'Tracking', render: (r) => <span className="font-mono text-xs">{String(r.trackingId)}</span> },
          { key: 'items', header: 'Items', render: (r) => orderItemsSummary(r as unknown as Order) },
          { key: 'branch', header: 'Branch', render: (r) => (r.branch as { name?: string })?.name ?? '—' },
          { key: 'status', header: 'Status', render: (r) => <StatusBadge status={String(r.status)} /> },
          { key: 'paymentStatus', header: 'Payment', render: (r) => <StatusBadge status={String(r.paymentStatus)} /> },
          { key: 'total', header: 'Total', render: (r) => formatPKR(Number(r.total)) },
          { key: 'createdAt', header: 'Date', render: (r) => formatDate(String(r.createdAt)) },
          {
            key: 'actions',
            header: '',
            render: (r) => {
              const order = r as unknown as Order;
              const canInvoice = isInvoiceAvailable(order);
              return (
                <div className="flex gap-1">
                  <Button size="sm" variant="secondary" onClick={() => viewOrder(Number(r.id))}>View</Button>
                  <Button
                    size="sm"
                    variant={canInvoice ? 'accent' : 'ghost'}
                    disabled={!canInvoice}
                    title={canInvoice ? 'Download invoice' : 'Invoice pending verification/delivery'}
                    onClick={() => openInvoice(Number(r.id))}
                  >
                    <FileText className="h-3.5 w-3.5" />
                  </Button>
                </div>
              );
            },
          },
        ]}
        data={orders as unknown as Record<string, unknown>[]}
      />

      <Modal open={!!detail} onClose={() => setDetail(null)} title={`Order ${detail?.trackingId}`} size="lg">
        {detail && (
          <div className="space-y-5 text-sm">
            <p className="font-mono text-lg font-bold text-brand">{detail.trackingId}</p>
            <OrderStatusTimeline status={detail.status} />
            {detail.cargoTrackingId && (
              <div className="rounded-xl border border-accent/30 bg-accent/5 p-4">
                <p className="text-xs font-semibold uppercase text-accent">Your cargo tracking</p>
                <p className="mt-1 font-mono text-lg font-bold">{detail.cargoTrackingId}</p>
                <p className="mt-1 text-xs text-text-muted">Use this number to track your shipment with the courier.</p>
              </div>
            )}
            <div className="grid gap-2 sm:grid-cols-2">
              <p><span className="text-text-muted">Payment:</span> {detail.paymentMethod} ({detail.paymentStatus})</p>
              {detail.paymentTransactionId && (
                <p><span className="text-text-muted">TID:</span> <span className="font-mono">{detail.paymentTransactionId}</span></p>
              )}
              <p><span className="text-text-muted">Total:</span> {formatPKR(Number(detail.total))}</p>
              {detail.branch && (
                <>
                  <p><span className="text-text-muted">Branch:</span> {detail.branch.name}</p>
                  <p><span className="text-text-muted">Phone:</span> {detail.branch.phone ?? '—'}</p>
                </>
              )}
            </div>
            {detail.items && (
              <div>
                <p className="mb-2 font-medium">Items</p>
                <ul className="space-y-2">
                  {detail.items.map((item, i) => (
                    <li key={i} className="flex justify-between border-b border-border/40 py-2">
                      <span>
                        {item.product?.name ?? 'Product'} ×{item.quantity}
                        {item.chassisNumber && <span className="block text-xs text-text-muted">Chassis: {item.chassisNumber}</span>}
                      </span>
                      <span>{formatPKR(Number(item.total))}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal open={invoiceModal !== null} onClose={() => { setInvoiceModal(null); setInvoiceData(null); }} title="Sale Invoice" size="lg">
        <InvoiceModalContent loading={invoiceLoading} invoice={invoiceData} />
      </Modal>
    </div>
  );
}

export function CustomerBookingsPage() {
  const { toast } = useToast();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  useEffect(() => { customerApi.bookings().then((r) => setBookings(r.data)).catch(console.error); }, []);

  async function handleDownloadReceipt(id: number) {
    setDownloadingId(id);
    try {
      const receipt = await customerApi.bookingReceipt(id);
      downloadBookingReceipt(receipt);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to load receipt', 'error');
    } finally {
      setDownloadingId(null);
    }
  }

  return (
    <div>
      <PageHeader title="My Bookings" action={<Link to="/book-service"><Button variant="accent" size="sm">New Booking</Button></Link>} />
      <DataTable
        columns={[
          { key: 'branch', header: 'Branch', render: (r) => (r.branch as { name: string })?.name ?? '—' },
          {
            key: 'appointment',
            header: 'Appointment',
            render: (r) => {
              const b = r as unknown as Booking;
              if (b.date && b.confirmedTime) {
                return `${formatDate(String(b.date))} at ${formatTime(b.confirmedTime)}`;
              }
              if (b.confirmedTime) return formatTime(b.confirmedTime);
              return <span className="text-text-muted">Awaiting branch</span>;
            },
          },
          { key: 'status', header: 'Status', render: (r) => <StatusBadge status={String(r.status)} /> },
          {
            key: 'receipt',
            header: 'Receipt',
            render: (r) => {
              const b = r as unknown as Booking;
              const canDownload = Boolean(b.date && b.confirmedTime);
              return canDownload ? (
                <Button
                  size="sm"
                  variant="accent"
                  loading={downloadingId === Number(r.id)}
                  onClick={() => handleDownloadReceipt(Number(r.id))}
                >
                  Download Receipt
                </Button>
              ) : (
                <span className="text-xs text-text-muted">—</span>
              );
            },
          },
        ]}
        data={bookings as unknown as Record<string, unknown>[]}
      />
    </div>
  );
}

export function CustomerProfilePage() {
  const { user, setUser } = useAuth();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setSaving(true);
    try {
      const updated = await customerApi.updateProfile({
        firstName: String(fd.get('firstName')),
        lastName: String(fd.get('lastName')),
        phone: String(fd.get('phone') || '') || undefined,
        city: String(fd.get('city') || '') || undefined,
      });
      setUser({ ...user!, ...updated });
      toast('Profile updated', 'success');
      setEditing(false);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Profile"
        action={<Button variant={editing ? 'secondary' : 'accent'} size="sm" onClick={() => setEditing(!editing)}>{editing ? 'Cancel' : 'Edit Profile'}</Button>}
      />
      {editing ? (
        <form onSubmit={handleSubmit} className="rounded-[var(--radius-card)] border border-border bg-white p-6 max-w-md shadow-[var(--shadow-card)] space-y-4">
          <Input name="firstName" label="First Name" required defaultValue={user?.firstName ?? ''} />
          <Input name="lastName" label="Last Name" required defaultValue={user?.lastName ?? ''} />
          <Input name="phone" label="Phone" defaultValue={user?.phone ?? ''} />
          <Input name="city" label="City" defaultValue={user?.city ?? ''} />
          <p className="text-xs text-text-muted">Email: {user?.email} (cannot be changed)</p>
          <FormActions onCancel={() => setEditing(false)} loading={saving} />
        </form>
      ) : (
        <div className="rounded-[var(--radius-card)] border border-border bg-white p-6 max-w-md shadow-[var(--shadow-card)]">
          <dl className="space-y-4">
            <div><dt className="text-xs text-text-muted">Name</dt><dd className="font-medium">{user?.firstName} {user?.lastName}</dd></div>
            <div><dt className="text-xs text-text-muted">Email</dt><dd className="font-medium">{user?.email}</dd></div>
            <div><dt className="text-xs text-text-muted">Phone</dt><dd className="font-medium">{user?.phone ?? '—'}</dd></div>
            <div><dt className="text-xs text-text-muted">City</dt><dd className="font-medium">{user?.city ?? '—'}</dd></div>
            <div><dt className="text-xs text-text-muted">Role</dt><dd className="font-medium">{user?.role}</dd></div>
          </dl>
        </div>
      )}
    </div>
  );
}
