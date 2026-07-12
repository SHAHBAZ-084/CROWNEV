import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useCart } from '../../contexts/CartContext';
import { useToast } from '../../contexts/ToastContext';
import { customerApi, publicApi } from '../../api/client';
import type { PaymentChannel } from '../../types';
import { formatPKR } from '../../lib/format';
import { getLoginUrl, defaultDashboardForRole } from '../../lib/authRedirect';
import { Button } from '../../components/ui/Button';
import { Input, Select, Textarea } from '../../components/ui/Input';
import { ScreenshotUpload } from '../../components/ui/ScreenshotUpload';
import { MotionSection } from '../../components/public/MotionSection';

const BASE = import.meta.env.VITE_API_URL?.replace('/api', '') ?? '';

const orderCard =
  'rounded-[var(--radius-card)] border border-slate-200 bg-white p-6 shadow-[var(--shadow-elevated)]';

const STEP_LABELS = ['Order', 'Details', 'Confirm'] as const;
const MAX_STEP = 3;

function PaymentAccounts({ channels, amount }: { channels: PaymentChannel[]; amount: number }) {
  if (channels.length === 0) {
    return (
      <p className="text-sm text-warning">No payment accounts set up for this branch yet. Please try again later.</p>
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

function CheckoutStepper({ step }: { step: number }) {
  return (
    <nav aria-label="Checkout progress" className="mb-8">
      <ol className="flex items-center justify-between gap-1">
        {STEP_LABELS.map((label, idx) => {
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
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold sm:h-9 sm:w-9 sm:text-sm ${
                    done ? 'bg-orange-500 text-white' : active ? 'bg-orange-500 text-white ring-4 ring-orange-500/20' : 'bg-slate-200 text-slate-500'
                  }`}
                >
                  {done ? '✓' : n}
                </div>
                {idx < STEP_LABELS.length - 1 && (
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
        Step {step} of {STEP_LABELS.length}: <span className="font-medium text-slate-700">{STEP_LABELS[step - 1]}</span>
      </p>
    </nav>
  );
}

export default function CheckoutPage() {
  const { user } = useAuth();
  const { items, total, branchId, setBranchId, updateItemColor, clearCart } = useCart();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [channels, setChannels] = useState<PaymentChannel[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerWhatsapp, setCustomerWhatsapp] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [screenshotUrl, setScreenshotUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);

  const [partsBranchId, setPartsBranchId] = useState<number | null>(null);
  const [partsSettingLoaded, setPartsSettingLoaded] = useState(false);
  const [bikeColors, setBikeColors] = useState<Record<string, string[]>>({});

  const bikeItems = useMemo(() => items.filter((i) => i.productType === 'BIKE'), [items]);

  const canContinueStep1 = useMemo(() => {
    return bikeItems.every((item) => {
      const colors = bikeColors[item.productId];
      if (!colors || colors.length === 0) return true;
      return Boolean(item.color?.trim());
    });
  }, [bikeItems, bikeColors]);

  const canContinueStep2 = Boolean(
    branchId
      && customerName.trim()
      && customerPhone.trim()
      && customerWhatsapp.trim()
      && customerAddress.trim(),
  );
  const canSubmit = Boolean(
    canContinueStep2 && channels.length > 0 && screenshotUrl && transactionId.trim(),
  );

  const stepTitle = useMemo(() => {
    switch (step) {
      case 1: return 'Review your order';
      case 2: return 'Contact details';
      case 3: return 'Confirm your order';
      default: return 'Checkout';
    }
  }, [step]);

  const loadBikeColors = useCallback(async (bikes: typeof bikeItems) => {
    const entries = await Promise.all(
      bikes.map(async (item) => {
        try {
          const colors = await publicApi.availableBikeColors(item.productId);
          return [item.productId, colors] as const;
        } catch {
          return [item.productId, []] as const;
        }
      }),
    );
    setBikeColors(Object.fromEntries(entries));
  }, []);

  useEffect(() => {
    if (!user) { navigate(getLoginUrl('/checkout')); return; }
    if (user.role !== 'CUSTOMER') {
      navigate(defaultDashboardForRole(user.role), { replace: true });
      return;
    }
    if (items.length === 0) { navigate('/shop'); return; }
    publicApi.partsFulfillmentBranch()
      .then((s) => setPartsBranchId(s.branchId))
      .finally(() => setPartsSettingLoaded(true));
    setCustomerName(`${user.firstName} ${user.lastName}`.trim());
    setCustomerPhone(user.phone ?? '');
    setCustomerWhatsapp(user.phone ?? '');
  }, [user, items, navigate]);

  useEffect(() => {
    if (partsBranchId) {
      setBranchId(partsBranchId);
    }
  }, [partsBranchId, setBranchId]);

  useEffect(() => {
    if (!partsBranchId || bikeItems.length === 0) {
      setBikeColors({});
      return;
    }
    loadBikeColors(bikeItems);
  }, [bikeItems, loadBikeColors]);

  useEffect(() => {
    if (!branchId) {
      setChannels([]);
      return;
    }
    publicApi.paymentChannels(branchId).then(setChannels).catch(() => setChannels([]));
  }, [branchId]);

  function goNext() {
    if (step === 1 && !canContinueStep1) {
      toast('Please select a color for each bike in your order', 'error');
      return;
    }
    if (step === 2 && !canContinueStep2) {
      toast('Please fill in all contact details', 'error');
      return;
    }
    if (step === 2 && channels.length === 0) {
      toast('Payment accounts are not configured yet. Please try again later.', 'error');
      return;
    }
    setStep((s) => Math.min(s + 1, MAX_STEP));
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
    if (step !== MAX_STEP) {
      goNext();
      return;
    }

    if (!canContinueStep2) {
      toast('Please complete all required details', 'error');
      setStep(2);
      return;
    }

    if (channels.length === 0) {
      toast('Payment accounts are not configured yet. Please try again later.', 'error');
      return;
    }
    if (!transactionId.trim() || !screenshotUrl) {
      toast('TID and payment screenshot are required', 'error');
      return;
    }

    setLoading(true);
    try {
      await customerApi.checkout({
        branchId: branchId!,
        shippingMethod: 'SELF',
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        customerWhatsapp: customerWhatsapp.trim(),
        customerAddress: customerAddress.trim(),
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
      toast("Order placed. We'll confirm once payment is received.", 'success');
      navigate('/customer/orders');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Checkout failed', 'error');
    } finally {
      setLoading(false);
    }
  }

  if (!user || items.length === 0) return null;

  if (partsSettingLoaded && !partsBranchId) {
    return (
      <div className="min-h-full w-full bg-slate-50 flex items-center justify-center px-4 py-16">
        <div className="max-w-md w-full rounded-2xl border border-orange-200 bg-orange-50 p-6 text-center text-sm text-orange-950 shadow-sm space-y-4">
          <p className="font-semibold text-base text-orange-800">Online Ordering Unavailable</p>
          <p className="text-orange-900/90 leading-relaxed">
            Online ordering is temporarily unavailable. Please try again later.
          </p>
          <Link to="/shop" className="inline-block px-4 py-2 bg-orange-600 text-white rounded-lg text-xs font-semibold hover:bg-orange-700 transition-colors">
            Go to Shop
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full w-full bg-slate-50">
      <MotionSection as="div" className="mx-auto max-w-3xl px-4 py-12 lg:px-8">
        <h1 className="font-display text-3xl font-bold text-slate-900">Checkout</h1>
        <p className="mt-1 text-sm text-slate-500">Complete your order in a few simple steps</p>

        <CheckoutStepper step={step} />

        <form onSubmit={handleSubmit} className="space-y-6">
          <section className={orderCard}>
            <h2 className="mb-4 font-display text-lg font-semibold text-slate-900">{stepTitle}</h2>

            {step === 1 && (
              <>
                <ul className="space-y-4">
                  {items.map((i) => (
                    <li key={`${i.productId}-${i.color ?? ''}`} className="space-y-2 text-sm text-slate-700">
                      <div className="flex justify-between">
                        <span>
                          {i.name} × {i.quantity}
                          {i.color && i.productType !== 'BIKE' && (
                            <span className="text-slate-500"> ({i.color})</span>
                          )}
                        </span>
                        <span className="tabular-nums text-slate-900">{formatPKR(i.price * i.quantity)}</span>
                      </div>
                      {i.productType === 'BIKE' && (
                        <div>
                          {(bikeColors[i.productId]?.length ?? 0) > 0 ? (
                            <Select
                              label="Color"
                              value={i.color ?? ''}
                              onChange={(e) => updateItemColor(i.productId, e.target.value)}
                              required
                            >
                              <option value="">Select color</option>
                              {bikeColors[i.productId].map((color) => (
                                <option key={color} value={color}>{color}</option>
                              ))}
                            </Select>
                          ) : (
                            <p className="text-xs text-amber-700">No colors currently in stock for this model.</p>
                          )}
                        </div>
                      )}
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
                <Input label="Full Name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} required />
                <Input label="Phone" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} required />
                <Input label="WhatsApp Number" value={customerWhatsapp} onChange={(e) => setCustomerWhatsapp(e.target.value)} required />
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
              <div className="space-y-4">
                <p className="text-sm text-slate-600">
                  Please arrange payment using one of the accounts below. Once we confirm receipt, your order will be
                  approved and you&apos;ll get a confirmation email.
                </p>
                <PaymentAccounts channels={channels} amount={total} />
                <Input
                  label="Transaction ID (TID)"
                  value={transactionId}
                  onChange={(e) => setTransactionId(e.target.value)}
                  placeholder="Paste your bank/wallet transaction ID"
                  required
                />
                <ScreenshotUpload
                  label="Upload payment screenshot"
                  imageUrl={screenshotUrl}
                  uploading={uploading}
                  onSelect={handleScreenshot}
                  baseUrl={BASE}
                />
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

            {step < MAX_STEP ? (
              <Button
                type="button"
                variant="accent"
                onClick={goNext}
                disabled={(step === 1 && !canContinueStep1) || (step === 2 && !canContinueStep2)}
                className="sm:ml-auto"
              >
                Continue
              </Button>
            ) : (
              <Button
                type="submit"
                variant="accent"
                loading={loading}
                disabled={!canSubmit}
                className="sm:ml-auto"
              >
                {`Place Order (${formatPKR(total)})`}
              </Button>
            )}
          </div>
        </form>
      </MotionSection>
    </div>
  );
}
