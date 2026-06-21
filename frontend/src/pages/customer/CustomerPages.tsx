import { type FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { customerApi } from '../../api/client';
import type { Order, Booking } from '../../types';
import { PageHeader } from '../../components/layout/PageTransition';
import { DataTable, StatusBadge } from '../../components/ui/DataTable';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { FormActions } from '../../components/crud/CrudHelpers';
import { formatPKR, formatDate } from '../../lib/format';
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

  useEffect(() => { customerApi.orders().then((r) => setOrders(r.data)).catch(console.error); }, []);

  async function viewOrder(id: number) {
    try {
      const order = await customerApi.order(id);
      setDetail(order);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to load order', 'error');
    }
  }

  return (
    <div>
      <PageHeader title="My Orders" action={<Link to="/shop"><Button variant="accent" size="sm">New Order</Button></Link>} />
      <DataTable
        columns={[
          { key: 'trackingId', header: 'Tracking ID' },
          { key: 'status', header: 'Status', render: (r) => <StatusBadge status={String(r.status)} /> },
          { key: 'paymentMethod', header: 'Payment' },
          { key: 'total', header: 'Total', render: (r) => formatPKR(Number(r.total)) },
          { key: 'createdAt', header: 'Date', render: (r) => formatDate(String(r.createdAt)) },
          {
            key: 'actions',
            header: '',
            render: (r) => <Button size="sm" variant="secondary" onClick={() => viewOrder(Number(r.id))}>View</Button>,
          },
        ]}
        data={orders as unknown as Record<string, unknown>[]}
      />
      <Modal open={!!detail} onClose={() => setDetail(null)} title={`Order ${detail?.trackingId}`} size="lg">
        {detail && (
          <div className="space-y-4 text-sm">
            <p><span className="text-text-muted">Status:</span> <StatusBadge status={String(detail.status)} /></p>
            <p><span className="text-text-muted">Total:</span> {formatPKR(Number(detail.total))}</p>
            <p><span className="text-text-muted">Payment:</span> {detail.paymentMethod} ({detail.paymentStatus})</p>
            {detail.items && (
              <div>
                <p className="font-medium mb-2">Items</p>
                <ul className="space-y-1">
                  {(detail.items as { product?: { name: string }; quantity: number; unitPrice: string }[]).map((item, i) => (
                    <li key={i} className="flex justify-between border-b py-1">
                      <span>{item.product?.name ?? 'Product'} ×{item.quantity}</span>
                      <span>{formatPKR(Number(item.unitPrice) * item.quantity)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

export function CustomerBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);

  useEffect(() => { customerApi.bookings().then((r) => setBookings(r.data)).catch(console.error); }, []);

  return (
    <div>
      <PageHeader title="My Bookings" action={<Link to="/book-service"><Button variant="accent" size="sm">New Booking</Button></Link>} />
      <DataTable
        columns={[
          { key: 'service', header: 'Service', render: (r) => (r.service as { name: string })?.name ?? '—' },
          { key: 'date', header: 'Date', render: (r) => formatDate(String(r.date)) },
          { key: 'time', header: 'Time' },
          { key: 'status', header: 'Status', render: (r) => <StatusBadge status={String(r.status)} /> },
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
