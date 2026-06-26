import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Upload } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useCart } from '../../contexts/CartContext';
import { useToast } from '../../contexts/ToastContext';
import { customerApi, publicApi } from '../../api/client';
import type { Branch, PaymentChannel, ShippingMethod } from '../../types';
import { formatPKR } from '../../lib/format';
import { getLoginUrl, defaultDashboardForRole } from '../../lib/authRedirect';
import { Button } from '../../components/ui/Button';
import { Input, Select, Textarea } from '../../components/ui/Input';
import { MotionSection } from '../../components/public/MotionSection';

const BASE = import.meta.env.VITE_API_URL?.replace('/api', '') ?? '';

const orderCard =
  'rounded-[var(--radius-card)] border border-slate-200 bg-white p-6 shadow-[var(--shadow-elevated)]';

const STEP_LABELS = ['Order', 'Details', 'Delivery', 'Finish', 'Confirm'] as const;

function PaymentAccounts({ channels, amount }: { channels: PaymentChannel[]; amount: number }) {
  if (channels.length === 0) {
    return (
      <p className="text-sm text-warning">No payment accounts set up for this branch yet. Please choose another branch or contact the branch.</p>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
      <p className="font-medium text-slate-900">Pay {formatPKR(amount)} to:</p>
      <ul className="space-y-2">
        {channels.map((ch) => (
          <li key={ch.id} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
            <span className="text-xs font-semibold uppercase text-slate-500">
              {ch.type === 'WALLET' ? 'Wallet' : 'Bank'}
            </span>
            <p className="font-medium text-slate-900">{ch.name}</p>
            {ch.accountTitle && <p className="text-slate-500">{ch.accountTitle}</p>}
            <p className="font-mono text-orange-500">{ch.accountNumber}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CheckoutStepper({ step, isSelfPickup }: { step: number; isSelfPickup: boolean }) {
  const labels: readonly string[] = isSelfPickup
    ? STEP_LABELS.slice(0, 4)
    : [...STEP_LABELS.slice(0, 3), 'Confirm'];

  return (
    <nav aria-label="Checkout progress" className="mb-8">
      <ol className="flex items-center justify-between gap-1">
        {labels.map((label, idx) => {
          const n = idx + 1;
          const done = step > n;
          const active = step === n;
          return (
            <li key={label} className="flex flex-1 flex-col items-center gap-2">
              <div className="flex w-full items-center">
                {idx > 0 && (
                  <div className={`h-0.5 flex-1 ${done ? 'bg-orange-500' : 'bg-slate-200'}`} />
                )}
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                    done ? 'bg-orange-500 text-white' : active ? 'bg-orange-500 text-white ring-4 ring-orange-500/20' : 'bg-slate-200 text-slate-500'
                  }`}
                >
                  {done ? '✓' : n}
                </div>
                {idx < labels.length - 1 && (
                  <div className={`h-0.5 flex-1 ${done ? 'bg-orange-500' : 'bg-slate-200'}`} />
                )}
              </div>
              <span className={`hidden text-center text-xs sm:block ${active ? 'font-semibold text-orange-600' : 'text-slate-500'}`}>
                {label}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="mt-3 text-center text-sm text-slate-500 sm:hidden">
        Step {step} of {labels.length}: <span className="font-medium text-slate-700">{labels[step - 1]}</span>
      </p>
    </nav>
  );
}

export default function CheckoutPage() {
  const { user } = useAuth();
  const { items, total, branchId, setBranchId, clearCart } = useCart();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [channels, setChannels] = useState<PaymentChannel[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [shippingMethod, setShippingMethod] = useState<ShippingMethod>('SELF');
  const [notes, setNotes] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [screenshotUrl, setScreenshotUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);

  const selectedBranch = branches.find((b) => b.id === branchId);
  const isSelfPickup = shippingMethod === 'SELF';
  const maxStep = 4;

  const canContinueStep2 = Boolean(
    branchId && customerName.trim() && customerPhone.trim() && customerAddress.trim(),
  );
  const canSubmitSelf = Boolean(
    canContinueStep2 && channels.length > 0 && screenshotUrl && transactionId.trim(),
  );

  const stepTitle = useMemo(() => {
    switch (step) {
      case 1: return 'Review your order';
      case 2: return 'Branch & contact details';
      case 3: return 'How will you receive your order?';
      case 4: return isSelfPickup ? 'Payment verification' : 'Confirm your order';
      default: return 'Checkout';
    }
  }, [step, isSelfPickup]);

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

  function goNext() {
    if (step === 2 && !canContinueStep2) {
      toast('Please fill in branch and all contact details', 'error');
      return;
    }
    if (step === 3 && isSelfPickup && channels.length === 0) {
      toast('This branch has no payment accounts configured yet', 'error');
      return;
    }
    setStep((s) => Math.min(s + 1, maxStep));
  }

  function goBack() {
    setStep((s) => Math.max(s - 1, 1));
  }

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
    if (step !== maxStep) {
      goNext();
      return;
    }

    if (!canContinueStep2) {
      toast('Please complete all required details', 'error');
      setStep(2);
      return;
    }

    if (isSelfPickup) {
      if (channels.length === 0) {
        toast('This branch has no payment accounts configured yet', 'error');
        return;
      }
      if (!transactionId.trim() || !screenshotUrl) {
        toast('TID and payment screenshot are required', 'error');
        return;
      }
    }

    setLoading(true);
    try {
      await customerApi.checkout({
        branchId: branchId!,
        shippingMethod,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        customerAddress: customerAddress.trim(),
        notes: notes.trim() || undefined,
        ...(isSelfPickup
          ? {
              bankTransferScreenshot: screenshotUrl,
              paymentTransactionId: transactionId.trim(),
            }
          : {}),
        items: items.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
          color: i.color,
        })),
      });
      clearCart();
      toast(
        isSelfPickup
          ? 'Order placed — payment submitted for verification'
          : 'Order placed — we will notify you when bilty charges are ready',
        'success',
      );
      navigate('/customer/orders');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Checkout failed', 'error');
    } finally {
      setLoading(false);
    }
  }

  if (!user || items.length === 0) return null;

  return (
    <div className="min-h-full w-full bg-slate-50">
      <MotionSection as="div" className="mx-auto max-w-3xl px-4 py-12 lg:px-8">
        <h1 className="font-display text-3xl font-bold text-slate-900">Checkout</h1>
        <p className="mt-1 text-sm text-slate-500">Complete your order in a few simple steps</p>

        <CheckoutStepper step={step} isSelfPickup={isSelfPickup} />

        <form onSubmit={handleSubmit} className="space-y-6">
          <section className={orderCard}>
            <h2 className="mb-4 font-display text-lg font-semibold text-slate-900">{stepTitle}</h2>

            {step === 1 && (
              <>
                <ul className="space-y-3">
                  {items.map((i) => (
                    <li key={`${i.productId}-${i.color ?? ''}`} className="flex justify-between text-sm text-slate-700">
                      <span>
                        {i.name} × {i.quantity}
                        {i.color && <span className="text-slate-500"> ({i.color})</span>}
                      </span>
                      <span className="tabular-nums text-slate-900">{formatPKR(i.price * i.quantity)}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-4 border-t border-slate-200 pt-4 font-display text-xl font-bold tabular-nums text-slate-900">
                  Product total: {formatPKR(total)}
                </p>
              </>
            )}

            {step === 2 && (
              <div className="space-y-4">
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
                  <p className="text-xs text-slate-500">Phone: {selectedBranch.phone}</p>
                )}
                <Input label="Full Name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} required />
                <Input label="Phone" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} required />
                <Input
                  label="Delivery Location / Address"
                  value={customerAddress}
                  onChange={(e) => setCustomerAddress(e.target.value)}
                  placeholder="Street, city"
                  required
                />
              </div>
            )}

            {step === 3 && (
              <div className="space-y-3">
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-4 has-[:checked]:border-orange-400 has-[:checked]:bg-orange-50/40">
                  <input
                    type="radio"
                    name="shippingMethod"
                    value="SELF"
                    checked={shippingMethod === 'SELF'}
                    onChange={() => setShippingMethod('SELF')}
                    className="mt-1"
                  />
                  <span>
                    <span className="font-medium text-slate-900">By Yourself (self pickup)</span>
                    <span className="mt-1 block text-sm text-slate-500">Pay now and collect your bike/part from the branch with your sale invoice.</span>
                  </span>
                </label>
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-4 has-[:checked]:border-orange-400 has-[:checked]:bg-orange-50/40">
                  <input
                    type="radio"
                    name="shippingMethod"
                    value="BILTY"
                    checked={shippingMethod === 'BILTY'}
                    onChange={() => setShippingMethod('BILTY')}
                    className="mt-1"
                  />
                  <span>
                    <span className="font-medium text-slate-900">By Bilty (shipping via courier)</span>
                    <span className="mt-1 block text-sm text-slate-500">We will calculate shipping charges first. Payment is requested after charges are confirmed.</span>
                  </span>
                </label>
              </div>
            )}

            {step === 4 && isSelfPickup && (
              <div className="space-y-4">
                <p className="text-sm text-slate-600">
                  Please make payment and bring your sale invoice to the branch to receive your bike/part.
                </p>
                <PaymentAccounts channels={channels} amount={total} />
                <Input
                  label="Transaction ID (TID)"
                  value={transactionId}
                  onChange={(e) => setTransactionId(e.target.value)}
                  placeholder="Paste your bank/wallet transaction ID"
                  required
                />
                <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-orange-500 hover:text-orange-600">
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
                {uploading && <p className="text-xs text-slate-500">Uploading…</p>}
                {screenshotUrl && (
                  <img
                    src={`${BASE}${screenshotUrl}`}
                    alt="Payment proof"
                    className="max-h-36 rounded-lg border border-slate-200 object-contain"
                  />
                )}
                <Textarea label="Order Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
              </div>
            )}

            {step === 4 && !isSelfPickup && (
              <div className="space-y-4">
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  Please wait while we calculate your bilty (shipping) charges. You will be notified once charges are ready on your orders page.
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                  <p><span className="text-slate-500">Branch:</span> {selectedBranch?.name}</p>
                  <p><span className="text-slate-500">Product total:</span> {formatPKR(total)}</p>
                  <p className="mt-2 text-xs italic text-slate-500">No payment is required at this step.</p>
                </div>
                <Textarea label="Order Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
              </div>
            )}
          </section>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
            {step > 1 ? (
              <Button type="button" variant="secondary" onClick={goBack} disabled={loading}>
                Back
              </Button>
            ) : (
              <Link to="/shop" className="inline-flex items-center justify-center text-sm text-slate-500 hover:text-orange-600">
                ← Continue shopping
              </Link>
            )}

            {step < maxStep ? (
              <Button
                type="button"
                variant="accent"
                onClick={goNext}
                disabled={step === 2 && !canContinueStep2}
                className="sm:ml-auto"
              >
                Continue
              </Button>
            ) : (
              <Button
                type="submit"
                variant="accent"
                loading={loading}
                disabled={isSelfPickup ? !canSubmitSelf : !canContinueStep2}
                className="sm:ml-auto"
              >
                {isSelfPickup ? `Place Order (${formatPKR(total)})` : 'Submit Order'}
              </Button>
            )}
          </div>
        </form>
      </MotionSection>
    </div>
  );
}
