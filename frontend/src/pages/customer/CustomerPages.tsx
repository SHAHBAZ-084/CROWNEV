import { type FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FileText, KeyRound, Mail, MapPin, Pencil, Phone, Shield, Trash2, User } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { customerApi } from '../../api/client';
import type { Booking, InvoiceData, Order } from '../../types';
import { PageHeader } from '../../components/layout/PageTransition';
import { UserAvatar } from '../../components/layout/DashboardSidebar';
import { DataTable, StatusBadge } from '../../components/ui/DataTable';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { FormActions } from '../../components/crud/CrudHelpers';
import { InvoiceModalContent } from '../../components/invoice/SaleInvoice';
import { OrderStatusTimeline, isInvoiceAvailable, isAwaitingPaymentVerification, needsCustomerPayment, orderItemsSummary, orderReference, PaymentStatusBadge } from '../../lib/orderHelpers';
import { formatPKR, formatDate, formatTime } from '../../lib/format';
import { downloadBookingReceipt } from '../../lib/receiptDownload';
import { useToast } from '../../contexts/ToastContext';

export function CustomerDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  useEffect(() => {
    Promise.all([customerApi.orders(), customerApi.bookings()])
      .then(([o, b]) => { setOrders(o.data); setBookings(b.data); })
      .catch(console.error);
  }, []);

  async function handleDownloadTicket(id: number) {
    setDownloadingId(id);
    try {
      const receipt = await customerApi.bookingReceipt(id);
      downloadBookingReceipt(receipt);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to load ticket', 'error');
    } finally {
      setDownloadingId(null);
    }
  }

  const scheduledBookings = bookings.filter((b) => b.date && b.confirmedTime);

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

      {scheduledBookings.length > 0 && (
        <div className="mb-6 rounded-[var(--radius-card)] border border-accent/25 bg-gradient-to-r from-accent/10 to-brand/5 px-4 py-4 sm:px-5">
          <p className="text-sm text-text">
            <strong className="text-brand">Visit confirmed.</strong>
            {' '}
            We emailed your appointment time and branch details. Download your visit ticket below or from{' '}
            <Link to="/customer/bookings" className="font-medium text-orange-500 hover:text-orange-600 hover:underline">
              My Bookings
            </Link>
            .
          </p>
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-2">
        <div>
          <h2 className="mb-4 font-display font-semibold text-slate-900">Recent Orders ({orders.length})</h2>
          <DataTable
            columns={[
              { key: 'product', header: 'Product', render: (r) => orderItemsSummary(r as unknown as Order) || '—' },
              { key: 'status', header: 'Status', render: (r) => <StatusBadge status={String(r.status)} /> },
              { key: 'total', header: 'Total', render: (r) => formatPKR(Number(r.total)) },
            ]}
            data={orders.slice(0, 5) as unknown as Record<string, unknown>[]}
            emptyMessage="No orders yet"
          />
          {orders.length > 5 && <Link to="/customer/orders" className="mt-2 inline-block text-sm text-orange-500 hover:text-orange-600">View all →</Link>}
        </div>
        <div>
          <h2 className="mb-4 font-display font-semibold text-slate-900">Service Bookings ({bookings.length})</h2>
          <DataTable
            columns={[
              { key: 'service', header: 'Service', render: (r) => (r.service as { name: string })?.name ?? 'Service request' },
              {
                key: 'appointment',
                header: 'Visit',
                render: (r) => {
                  const b = r as unknown as Booking;
                  if (b.date && b.confirmedTime) {
                    return `${formatDate(String(b.date))} · ${formatTime(b.confirmedTime)}`;
                  }
                  return <span className="text-text-muted">Awaiting branch</span>;
                },
              },
              { key: 'status', header: 'Status', render: (r) => <StatusBadge status={String(r.status)} /> },
              {
                key: 'ticket',
                header: 'Ticket',
                render: (r) => {
                  const b = r as unknown as Booking;
                  if (!b.date || !b.confirmedTime) {
                    return <span className="text-xs text-text-muted">—</span>;
                  }
                  return (
                    <Button
                      size="sm"
                      variant="accent"
                      loading={downloadingId === Number(r.id)}
                      onClick={() => handleDownloadTicket(Number(r.id))}
                    >
                      Download
                    </Button>
                  );
                },
              },
            ]}
            data={bookings.slice(0, 5) as unknown as Record<string, unknown>[]}
            emptyMessage="No bookings yet"
          />
          {bookings.length > 5 && (
            <Link to="/customer/bookings" className="mt-2 inline-block text-sm text-orange-500 hover:text-orange-600">
              View all bookings →
            </Link>
          )}
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
  const [paymentTid, setPaymentTid] = useState('');
  const [paymentScreenshot, setPaymentScreenshot] = useState('');
  const [uploading, setUploading] = useState(false);
  const [submittingPayment, setSubmittingPayment] = useState(false);

  const BASE = import.meta.env.VITE_API_URL?.replace('/api', '') ?? '';

  function reload() {
    customerApi.orders().then((r) => setOrders(r.data)).catch(console.error);
  }

  useEffect(() => {
    reload();
  }, []);

  async function viewOrder(id: number) {
    try {
      const order = await customerApi.order(id);
      setDetail(order);
      setPaymentTid('');
      setPaymentScreenshot('');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to load order', 'error');
    }
  }

  async function handlePaymentScreenshot(file: File | null) {
    if (!file) return;
    setUploading(true);
    try {
      const { url } = await customerApi.uploadPaymentScreenshot(file);
      setPaymentScreenshot(url);
      toast('Screenshot uploaded', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Upload failed', 'error');
    } finally {
      setUploading(false);
    }
  }

  async function submitPayment(e: FormEvent) {
    e.preventDefault();
    if (!detail) return;
    if (!paymentTid.trim() || !paymentScreenshot) {
      toast('TID and payment screenshot are required', 'error');
      return;
    }
    setSubmittingPayment(true);
    try {
      const updated = await customerApi.submitOrderPayment(detail.id, {
        paymentTransactionId: paymentTid.trim(),
        bankTransferScreenshot: paymentScreenshot,
      });
      setDetail(updated);
      reload();
      toast('Payment submitted for verification', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to submit payment', 'error');
    } finally {
      setSubmittingPayment(false);
    }
  }

  async function openInvoice(id: number) {
    if (!isInvoiceAvailable(orders.find((o) => o.id === id) ?? ({} as Order))) {
      toast('Invoice available once payment is verified and order is confirmed', 'error');
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
          { key: 'id', header: 'Order', render: (r) => <span className="font-mono text-xs">{orderReference(r as unknown as Order)}</span> },
          { key: 'items', header: 'Items', render: (r) => orderItemsSummary(r as unknown as Order) },
          { key: 'branch', header: 'Branch', render: (r) => (r.branch as { name?: string })?.name ?? '' },
          { key: 'status', header: 'Status', render: (r) => <StatusBadge status={String(r.status)} /> },
          { key: 'paymentStatus', header: 'Payment', render: (r) => <PaymentStatusBadge order={r as unknown as Order} /> },
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
                    title={canInvoice ? 'Download invoice' : 'Invoice pending confirmation'}
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

      <Modal open={!!detail} onClose={() => setDetail(null)} title={`Order ${detail ? orderReference(detail) : ''}`} size="lg">
        {detail && (
          <div className="space-y-5 text-sm text-slate-700">
            <p className="font-mono text-lg font-bold text-slate-900">{orderReference(detail)}</p>
            <OrderStatusTimeline status={detail.status} shippingMethod={detail.shippingMethod} />

            {detail.status === 'AWAITING_BILTY_CHARGES' && detail.shippingMethod === 'BILTY' && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                Please wait while we calculate your bilty (shipping) charges. You will be notified here once charges are ready.
              </div>
            )}

            {detail.biltyCharges != null && Number(detail.biltyCharges) > 0 && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase text-slate-500">Order total</p>
                <p><span className="text-slate-500">Product price:</span> {formatPKR(Number(detail.subtotal ?? detail.total))}</p>
                <p><span className="text-slate-500">Bilty charges:</span> {formatPKR(Number(detail.biltyCharges))}</p>
                <p className="mt-2 font-semibold text-slate-900">Total: {formatPKR(Number(detail.total))}</p>
              </div>
            )}

            {isAwaitingPaymentVerification(detail) && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                Your payment has been submitted. A branch admin will verify it before your order is confirmed.
              </div>
            )}

            {needsCustomerPayment(detail) && (
              <form onSubmit={submitPayment} className="space-y-4 rounded-xl border border-orange-200 bg-orange-50/50 p-4">
                <p className="font-medium text-slate-900">
                  Please make payment of {formatPKR(Number(detail.total))} and submit your TID.
                </p>
                <Input
                  label="Transaction ID (TID)"
                  value={paymentTid}
                  onChange={(e) => setPaymentTid(e.target.value)}
                  required
                />
                <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-orange-500">
                  Upload payment screenshot *
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    disabled={uploading}
                    onChange={(e) => handlePaymentScreenshot(e.target.files?.[0] ?? null)}
                  />
                </label>
                {paymentScreenshot && (
                  <img src={`${BASE}${paymentScreenshot}`} alt="Payment proof" className="max-h-36 rounded-lg border object-contain" />
                )}
                <Button type="submit" variant="accent" loading={submittingPayment} disabled={!paymentTid.trim() || !paymentScreenshot}>
                  Submit Payment
                </Button>
              </form>
            )}

            {detail.biltyId && (
              <div className="rounded-xl border border-orange-200 bg-orange-50 p-4">
                <p className="text-xs font-semibold uppercase text-orange-600">Your bilty ID</p>
                <p className="mt-1 font-mono text-lg font-bold text-slate-900">{detail.biltyId}</p>
                <p className="mt-1 text-xs text-slate-500">Use this number to track your shipment with the courier.</p>
              </div>
            )}
            <div className="grid gap-2 sm:grid-cols-2">
              <p><span className="text-slate-500">Shipping:</span> {detail.shippingMethod === 'BILTY' ? 'By Bilty' : detail.shippingMethod === 'SELF' ? 'Self pickup' : '—'}</p>
              <p><span className="text-slate-500">Payment:</span> {detail.paymentMethod} <PaymentStatusBadge order={detail} /></p>
              {detail.paymentTransactionId && (
                <p><span className="text-slate-500">TID:</span> <span className="font-mono">{detail.paymentTransactionId}</span></p>
              )}
              <p><span className="text-slate-500">Total:</span> {formatPKR(Number(detail.total))}</p>
              {detail.branch && (
                <>
                  <p><span className="text-slate-500">Branch:</span> {detail.branch.name}</p>
                  <p><span className="text-slate-500">Phone:</span> {detail.branch.phone ?? ''}</p>
                </>
              )}
            </div>
            {detail.items && (
              <div>
                <p className="mb-2 font-medium text-slate-900">Items</p>
                <ul className="space-y-2">
                  {detail.items.map((item, i) => (
                    <li key={i} className="flex justify-between border-b border-slate-200 py-2">
                      <span>
                        {item.product?.name ?? 'Product'} ×{item.quantity}
                        {item.chassisNumber && <span className="block text-xs text-slate-500">Chassis number: {item.chassisNumber}</span>}
                        {item.engineNumber && <span className="block text-xs text-slate-500">Engine number: {item.engineNumber}</span>}
                        {item.motorNumber && <span className="block text-xs text-slate-500">Motor number: {item.motorNumber}</span>}
                      </span>
                      <span className="tabular-nums text-slate-900">{formatPKR(Number(item.total))}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal open={invoiceModal !== null} onClose={() => { setInvoiceModal(null); setInvoiceData(null); }} title="Sale Invoice" size="lg" tallContent>
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

      <p className="mb-6 rounded-[var(--radius-card)] border border-border bg-surface-alt/50 px-4 py-3 text-sm text-text-muted">
        When your branch sets a visit date and time, we email you the appointment details and branch location.
        Download your printable visit ticket here anytime using <strong className="text-brand">Download Ticket</strong>.
      </p>

      <DataTable
        columns={[
          { key: 'branch', header: 'Branch', render: (r) => (r.branch as { name: string })?.name ?? '' },
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
            header: 'Ticket',
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
                  Download Ticket
                </Button>
              ) : (
                <span className="text-xs text-text-muted">Pending schedule</span>
              );
            },
          },
        ]}
        data={bookings as unknown as Record<string, unknown>[]}
      />
    </div>
  );
}

function ProfileField({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Mail;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-4 rounded-xl border border-border/70 bg-white/80 p-4 transition-shadow hover:shadow-[var(--shadow-card)]">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-accent/15 to-brand/10">
        <Icon className="h-5 w-5 text-accent" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium uppercase tracking-wide text-text-muted">{label}</p>
        <p className="mt-1 font-medium text-text break-words">{value}</p>
      </div>
    </div>
  );
}

export function CustomerProfilePage() {
  const { user, setUser, logout } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

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

  async function handlePasswordSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const currentPassword = String(fd.get('currentPassword'));
    const newPassword = String(fd.get('newPassword'));
    const confirmPassword = String(fd.get('confirmPassword'));

    if (newPassword.length < 8) {
      toast('New password must be at least 8 characters', 'error');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast('New passwords do not match', 'error');
      return;
    }

    setChangingPassword(true);
    try {
      await customerApi.changePassword(currentPassword, newPassword);
      toast('Password updated successfully', 'success');
      setPasswordOpen(false);
      e.currentTarget.reset();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to update password', 'error');
    } finally {
      setChangingPassword(false);
    }
  }

  async function handleDeleteAccount(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setDeletingAccount(true);
    try {
      if (user?.hasPassword !== false) {
        await customerApi.deleteAccount({ currentPassword: String(fd.get('currentPassword')) });
      } else {
        await customerApi.deleteAccount({ confirmEmail: String(fd.get('confirmEmail')) });
      }
      toast('Your account has been deleted', 'success');
      setDeleteOpen(false);
      logout();
      navigate('/', { replace: true });
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to delete account', 'error');
    } finally {
      setDeletingAccount(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Profile"
        subtitle="Manage your personal information and account security"
      />

      {editing ? (
        <div className="overflow-hidden rounded-[var(--radius-card)] border border-border bg-white shadow-[var(--shadow-card)]">
          <div className="border-b border-border/80 bg-gradient-to-r from-[#fff8f3] to-white px-6 py-5 sm:px-8">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10">
                <Pencil className="h-5 w-5 text-accent" />
              </div>
              <div>
                <h2 className="font-display text-lg font-semibold text-slate-900">Edit Profile</h2>
                <p className="text-sm text-text-muted">Update your contact details below</p>
              </div>
            </div>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4 p-6 sm:p-8">
            <div className="grid gap-4 sm:grid-cols-2">
              <Input name="firstName" label="First Name" required defaultValue={user?.firstName ?? ''} />
              <Input name="lastName" label="Last Name" required defaultValue={user?.lastName ?? ''} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input name="phone" label="Phone" defaultValue={user?.phone ?? ''} />
              <Input name="city" label="City" defaultValue={user?.city ?? ''} />
            </div>
            <div className="rounded-xl border border-border/70 bg-surface-alt/60 px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Email</p>
              <p className="mt-1 text-sm font-medium text-text">{user?.email}</p>
              <p className="mt-1 text-xs text-text-muted">Email cannot be changed from here</p>
            </div>
            <FormActions onCancel={() => setEditing(false)} loading={saving} />
          </form>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="relative overflow-hidden rounded-[var(--radius-card)] border border-border bg-gradient-to-br from-white via-[#fffcf9] to-[#fff0e6] p-6 shadow-[var(--shadow-card)] sm:p-8">
            <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-accent/10 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-20 -left-10 h-40 w-40 rounded-full bg-brand/5 blur-3xl" />

            <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-5">
                <div className="scale-125 origin-left sm:scale-[1.35]">
                  <UserAvatar name={`${user?.firstName ?? ''} ${user?.lastName ?? ''}`} />
                </div>
                <div className="min-w-0">
                  <h2 className="font-display text-2xl font-bold text-slate-900 sm:text-3xl">
                    {user?.firstName} {user?.lastName}
                  </h2>
                  <p className="mt-1 flex items-center gap-2 text-sm text-text-muted sm:text-base">
                    <Mail className="h-4 w-4 shrink-0 text-accent/80" />
                    <span className="truncate">{user?.email}</span>
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 lg:justify-end">
                {user?.hasPassword !== false && (
                  <Button variant="secondary" size="sm" onClick={() => setPasswordOpen(true)}>
                    <KeyRound className="h-4 w-4" />
                    Change Password
                  </Button>
                )}
                <Button variant="accent" size="sm" onClick={() => setEditing(true)}>
                  <Pencil className="h-4 w-4" />
                  Edit Profile
                </Button>
              </div>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-5">
            <section className="lg:col-span-3 rounded-[var(--radius-card)] border border-border bg-white p-6 shadow-[var(--shadow-card)] sm:p-7">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10">
                  <User className="h-5 w-5 text-accent" />
                </div>
                <div>
                  <h3 className="font-display text-lg font-semibold text-slate-900">Personal Information</h3>
                  <p className="text-sm text-text-muted">Your contact and location details</p>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <ProfileField
                  icon={User}
                  label="Full Name"
                  value={`${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim() || ''}
                />
                <ProfileField icon={Mail} label="Email Address" value={user?.email ?? ''} />
                <ProfileField icon={Phone} label="Phone Number" value={user?.phone ?? ''} />
                <ProfileField icon={MapPin} label="City" value={user?.city ?? ''} />
              </div>
            </section>

            <section className="lg:col-span-2 rounded-[var(--radius-card)] border border-border bg-white p-6 shadow-[var(--shadow-card)] sm:p-7">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10">
                  <Shield className="h-5 w-5 text-accent" />
                </div>
                <div>
                  <h3 className="font-display text-lg font-semibold text-slate-900">Account Security</h3>
                  <p className="text-sm text-text-muted">Keep your account protected</p>
                </div>
              </div>

              <div className="space-y-4">
                {user?.hasPassword !== false && (
                  <div className="rounded-xl border border-dashed border-accent/30 bg-gradient-to-br from-accent/5 to-transparent p-5">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm">
                        <KeyRound className="h-5 w-5 text-accent" />
                      </div>
                      <div>
                        <p className="font-medium text-text">Password</p>
                        <p className="mt-1 text-sm text-text-muted">
                          Use a strong password and update it regularly.
                        </p>
                        <Button
                          variant="accent"
                          size="sm"
                          className="mt-4"
                          onClick={() => setPasswordOpen(true)}
                        >
                          Change Password
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                <div className="rounded-xl border border-dashed border-red-200 bg-red-50/40 p-5">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm">
                      <Trash2 className="h-5 w-5 text-red-600" />
                    </div>
                    <div>
                      <p className="font-medium text-text">Delete account</p>
                      <p className="mt-1 text-sm text-text-muted">
                        Permanently deactivate your Crown Ev account. You will not be able to sign in again.
                      </p>
                      <Button
                        variant="danger"
                        size="sm"
                        className="mt-4"
                        onClick={() => setDeleteOpen(true)}
                      >
                        Delete Account
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      )}

      <Modal open={passwordOpen} onClose={() => setPasswordOpen(false)} title="Change Password">
        <form onSubmit={handlePasswordSubmit} className="space-y-4">
          <Input
            name="currentPassword"
            label="Current Password"
            type="password"
            required
            autoComplete="current-password"
          />
          <Input
            name="newPassword"
            label="New Password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
          />
          <Input
            name="confirmPassword"
            label="Confirm New Password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
          />
          <p className="text-xs text-text-muted">
            Forgot your current password?{' '}
            <Link to="/forgot-password" className="text-brand-light hover:underline">
              Reset via email
            </Link>
          </p>
          <FormActions onCancel={() => setPasswordOpen(false)} loading={changingPassword} />
        </form>
      </Modal>

      <Modal open={deleteOpen} onClose={() => setDeleteOpen(false)} title="Delete Account">
        <form onSubmit={handleDeleteAccount} className="space-y-4">
          <p className="text-sm leading-relaxed text-text-muted">
            This will deactivate your account immediately. You will be signed out and will not be able to log in again.
            Your order history is kept for branch records.
          </p>
          {user?.hasPassword === false ? (
            <Input
              name="confirmEmail"
              label="Confirm your email address"
              type="email"
              required
              autoComplete="email"
              placeholder={user?.email ?? ''}
            />
          ) : (
            <Input
              name="currentPassword"
              label="Current Password"
              type="password"
              required
              autoComplete="current-password"
            />
          )}
          <div className="flex flex-wrap justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="danger" loading={deletingAccount}>
              Delete Account
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
