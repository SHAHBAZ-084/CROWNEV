import { type FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useCart } from '../../contexts/CartContext';
import { useToast } from '../../contexts/ToastContext';
import { customerApi, publicApi } from '../../api/client';
import { formatPKR } from '../../lib/format';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Input';

export default function CheckoutPage() {
  const { user } = useAuth();
  const { items, total, branchId, setBranchId, clearCart } = useCart();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [branches, setBranches] = useState<{ id: number; name: string }[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'BANK_TRANSFER'>('CASH');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) { navigate('/login?redirect=/checkout'); return; }
    if (items.length === 0) { navigate('/shop'); return; }
    publicApi.branches().then(setBranches).catch(console.error);
  }, [user, items, navigate]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!branchId) { toast('Please select a branch', 'error'); return; }
    setLoading(true);
    try {
      const order = await customerApi.checkout({
        branchId,
        paymentMethod,
        items: items.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
          color: i.color,
        })),
      });
      clearCart();
      toast('Order placed successfully!', 'success');
      navigate(`/track?id=${order.trackingId}`);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Checkout failed', 'error');
    } finally {
      setLoading(false);
    }
  }

  if (!user || items.length === 0) return null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 lg:px-8">
      <h1 className="font-display text-3xl font-bold text-brand">Checkout</h1>

      <form onSubmit={handleSubmit} className="mt-8 space-y-8">
        <div className="rounded-[var(--radius-card)] border border-border bg-white p-6 shadow-[var(--shadow-card)]">
          <h2 className="font-semibold text-brand mb-4">Order Summary</h2>
          <ul className="space-y-3">
            {items.map((i) => (
              <li key={i.productId} className="flex justify-between text-sm">
                <span>{i.name} × {i.quantity}</span>
                <span className="tabular-nums">{formatPKR(i.price * i.quantity)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 border-t border-border pt-4 font-display text-xl font-bold text-brand tabular-nums">
            Total: {formatPKR(total)}
          </p>
        </div>

        <Select
          label="Pickup / Fulfillment Branch"
          value={branchId ?? ''}
          onChange={(e) => setBranchId(parseInt(e.target.value, 10))}
          required
        >
          <option value="">Select branch</option>
          {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </Select>

        <Select
          label="Payment Method"
          value={paymentMethod}
          onChange={(e) => setPaymentMethod(e.target.value as 'CASH' | 'BANK_TRANSFER')}
        >
          <option value="CASH">Cash on Delivery</option>
          <option value="BANK_TRANSFER">Bank Transfer</option>
        </Select>

        {paymentMethod === 'BANK_TRANSFER' && (
          <p className="text-sm text-text-muted rounded-xl bg-surface-alt p-4">
            Transfer to our branch account and upload screenshot after placing order. Admin will verify payment.
          </p>
        )}

        <Button type="submit" variant="accent" size="lg" loading={loading} className="w-full">
          Place Order — {formatPKR(total)}
        </Button>
      </form>

      <p className="mt-4 text-center text-sm text-text-muted">
        <Link to="/shop" className="text-brand-light hover:underline">← Continue shopping</Link>
      </p>
    </div>
  );
}
