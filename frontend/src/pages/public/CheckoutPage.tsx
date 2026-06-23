import { type FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Upload } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useCart } from '../../contexts/CartContext';
import { useToast } from '../../contexts/ToastContext';
import { customerApi, publicApi } from '../../api/client';
import type { Branch, PaymentChannel } from '../../types';
import { formatPKR } from '../../lib/format';
import { getLoginUrl, defaultDashboardForRole } from '../../lib/authRedirect';
import { Button } from '../../components/ui/Button';
import { Input, Select, Textarea } from '../../components/ui/Input';
import { MotionSection } from '../../components/public/MotionSection';

const BASE = import.meta.env.VITE_API_URL?.replace('/api', '') ?? '';

export default function CheckoutPage() {
  const { user } = useAuth();
  const { items, total, branchId, setBranchId, clearCart } = useCart();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [branches, setBranches] = useState<Branch[]>([]);
  const [channels, setChannels] = useState<PaymentChannel[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [screenshotUrl, setScreenshotUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);

  const selectedBranch = branches.find((b) => b.id === branchId);
  const canSubmit = Boolean(screenshotUrl && transactionId.trim() && branchId && channels.length > 0);

  useEffect(() => {
    if (!user) { navigate(getLoginUrl('/checkout')); return; }
    if (user.role !== 'CUSTOMER') {
      navigate(defaultDashboardForRole(user.role), { replace: true });
      return;
    }
    if (items.length === 0) { navigate('/shop'); return; }
    publicApi.branches().then(setBranches).catch(console.error);
    setCustomerName(`${user.firstName} ${user.lastName}`.trim());
    setCustomerPhone(user.phone ?? '');
  }, [user, items, navigate]);

  useEffect(() => {
    if (!branchId) {
      setChannels([]);
      return;
    }
    publicApi.paymentChannels(branchId).then(setChannels).catch(() => setChannels([]));
  }, [branchId]);

  async function handleScreenshot(file: File | null) {
    if (!file) return;
    setUploading(true);
    try {
      const { url } = await customerApi.uploadPaymentScreenshot(file);
      setScreenshotUrl(url);
      toast('Screenshot uploaded', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Upload failed', 'error');
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!branchId) { toast('Please select a branch', 'error'); return; }
    if (!customerName.trim() || !customerPhone.trim()) {
      toast('Name and phone are required', 'error');
      return;
    }
    if (channels.length === 0) {
      toast('This branch has no payment accounts configured yet', 'error');
      return;
    }
    if (!transactionId.trim()) {
      toast('Please enter your payment transaction ID (TID)', 'error');
      return;
    }
    if (!screenshotUrl) {
      toast('Please upload your payment screenshot', 'error');
      return;
    }

    setLoading(true);
    try {
      await customerApi.checkout({
        branchId,
        paymentMethod: 'BANK_TRANSFER',
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        customerAddress: customerAddress.trim() || undefined,
        notes: notes.trim() || undefined,
        bankTransferScreenshot: screenshotUrl,
        paymentTransactionId: transactionId.trim(),
        items: items.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
          color: i.color,
        })),
      });
      clearCart();
      toast('Order placed successfully!', 'success');
      navigate('/customer/orders');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Checkout failed', 'error');
    } finally {
      setLoading(false);
    }
  }

  if (!user || items.length === 0) return null;

  return (
    <MotionSection as="div" className="mx-auto max-w-3xl px-4 py-12 lg:px-8">
      <h1 className="font-display text-3xl font-bold text-brand">Checkout</h1>
      <p className="mt-1 text-sm text-text-muted">Review your order and complete payment</p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-6">
        <section className="rounded-[var(--radius-card)] border border-border bg-white p-6 shadow-[var(--shadow-card)]">
          <h2 className="mb-4 font-semibold text-brand">1. Order Summary</h2>
          <ul className="space-y-3">
            {items.map((i) => (
              <li key={`${i.productId}-${i.color ?? ''}`} className="flex justify-between text-sm">
                <span>
                  {i.name} × {i.quantity}
                  {i.color && <span className="text-text-muted"> ({i.color})</span>}
                </span>
                <span className="tabular-nums">{formatPKR(i.price * i.quantity)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 border-t border-border pt-4 font-display text-xl font-bold text-brand tabular-nums">
            Total: {formatPKR(total)}
          </p>
        </section>

        <section className="rounded-[var(--radius-card)] border border-border bg-white p-6 shadow-[var(--shadow-card)]">
          <h2 className="mb-4 font-semibold text-brand">2. Select Branch</h2>
          <Select
            label="Fulfillment Branch"
            value={branchId ?? ''}
            onChange={(e) => setBranchId(parseInt(e.target.value, 10))}
            required
          >
            <option value="">Select branch</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}, {b.location}</option>
            ))}
          </Select>
          {selectedBranch && (
            <p className="mt-2 text-xs text-text-muted">Phone: {selectedBranch.phone}</p>
          )}
        </section>

        <section className="rounded-[var(--radius-card)] border border-border bg-white p-6 shadow-[var(--shadow-card)]">
          <h2 className="mb-4 font-semibold text-brand">3. Customer Details</h2>
          <div className="space-y-4">
            <Input label="Full Name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} required />
            <Input label="Phone" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} required />
            <Input label="Delivery Address" value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value)} placeholder="Street, city" />
          </div>
        </section>

        <section className="rounded-[var(--radius-card)] border border-border bg-white p-6 shadow-[var(--shadow-card)]">
          <h2 className="mb-4 font-semibold text-brand">4. Payment</h2>

          {!branchId ? (
            <p className="text-sm text-text-muted">Select a branch to see payment details.</p>
          ) : channels.length === 0 ? (
            <p className="text-sm text-warning">No payment accounts set up for this branch yet. Please choose another branch or contact the branch.</p>
          ) : (
            <div className="space-y-3 rounded-xl bg-surface-alt p-4 text-sm">
              <p className="font-medium text-brand">Pay {formatPKR(total)} to:</p>
              <ul className="space-y-2">
                {channels.map((ch) => (
                  <li key={ch.id} className="rounded-lg border border-border/60 bg-white px-3 py-2">
                    <span className="text-xs font-semibold uppercase text-text-muted">
                      {ch.type === 'WALLET' ? 'Wallet' : 'Bank'}
                    </span>
                    <p className="font-medium">{ch.name}</p>
                    {ch.accountTitle && <p className="text-text-muted">{ch.accountTitle}</p>}
                    <p className="font-mono text-brand">{ch.accountNumber}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-4 space-y-4">
            <Input
              label="Transaction ID (TID)"
              value={transactionId}
              onChange={(e) => setTransactionId(e.target.value)}
              placeholder="Paste your bank/wallet transaction ID"
              required
            />
            <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-brand">
              <Upload className="h-4 w-4" />
              Upload payment screenshot *
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                disabled={uploading}
                onChange={(e) => handleScreenshot(e.target.files?.[0] ?? null)}
              />
            </label>
            {uploading && <p className="text-xs text-text-muted">Uploading…</p>}
            {screenshotUrl && (
              <img
                src={`${BASE}${screenshotUrl}`}
                alt="Payment proof"
                className="max-h-36 rounded-lg border border-border object-contain"
              />
            )}
          </div>

          <p className="mt-3 text-xs text-text-muted italic">
            Cash only? Visit your nearest Crown EV branch to buy in person.
          </p>
        </section>

        <Textarea label="Order Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />

        <Button
          type="submit"
          variant="accent"
          size="lg"
          loading={loading}
          disabled={!canSubmit}
          className="w-full"
        >
          Place Order for {formatPKR(total)}
        </Button>
      </form>

      <p className="mt-4 text-center text-sm text-text-muted">
        <Link to="/shop" className="text-brand-light hover:underline">← Continue shopping</Link>
      </p>
    </MotionSection>
  );
}
