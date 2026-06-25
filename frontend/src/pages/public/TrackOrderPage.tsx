import { type FormEvent, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Package, Search } from 'lucide-react';
import { publicApi } from '../../api/client';
import type { Order } from '../../types';
import { formatPKR, formatDate } from '../../lib/format';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { StatusBadge } from '../../components/ui/DataTable';
import { PageHero } from '../../components/public/PageHero';
import { OrderStatusTimeline } from '../../lib/orderHelpers';

export default function TrackOrderPage() {
  const [searchParams] = useSearchParams();
  const [trackingId, setTrackingId] = useState(searchParams.get('id') ?? '');
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function fetchOrder(id: string) {
    setError('');
    setOrder(null);
    setLoading(true);
    try {
      const result = await publicApi.trackOrder(id.trim());
      setOrder(result);
    } catch {
      setError('Order not found. Check your tracking ID.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const id = searchParams.get('id');
    if (id) fetchOrder(id);
  }, [searchParams]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    fetchOrder(trackingId);
  }

  return (
    <div className="bg-slate-50">
      <PageHero
        page="trackOrder"
        title="Track Order"
        subtitle="No login required. Enter your tracking ID"
      >
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            placeholder="e.g. CE-XXXXX-XXXX"
            value={trackingId}
            onChange={(e) => setTrackingId(e.target.value)}
            required
            className="flex-1"
          />
          <Button type="submit" variant="accent" loading={loading}><Search className="h-4 w-4" /></Button>
        </form>
        {error && <p className="mt-4 text-sm text-warning">{error}</p>}
      </PageHero>

      <div className="mx-auto max-w-lg px-4 pb-16 pt-8">
        {order && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="space-y-6 rounded-[var(--radius-card)] border border-slate-200 bg-white p-6 shadow-[var(--shadow-elevated)]"
          >
            <div className="flex items-center justify-between">
              <p className="font-mono text-sm text-orange-500">{order.trackingId}</p>
              <StatusBadge status={order.status} />
            </div>

            <OrderStatusTimeline status={order.status} />

            {order.biltyTrackingId && (
              <div className="rounded-xl border border-orange-200 bg-orange-50 p-4">
                <div className="flex items-center gap-2 text-orange-600">
                  <Package className="h-5 w-5" />
                  <span className="font-semibold">Bilty Tracking</span>
                </div>
                <p className="mt-2 font-mono text-lg font-bold text-slate-900">{order.biltyTrackingId}</p>
                <p className="mt-1 text-xs text-slate-500">
                  Use this number to track your shipment with the courier.
                </p>
              </div>
            )}

            <p className="font-display text-2xl font-bold tabular-nums text-slate-900">{formatPKR(Number(order.total))}</p>
            <p className="text-sm text-slate-500">Placed {formatDate(order.createdAt)}</p>

            {order.branch && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                <p className="font-medium text-slate-900">{order.branch.name}</p>
                <p className="text-slate-500">{order.branch.location}</p>
                <p className="text-slate-500">Phone: {order.branch.phone}</p>
              </div>
            )}

            {order.items && order.items.length > 0 && (
              <div>
                <p className="mb-2 text-sm font-medium text-slate-900">Items</p>
                <ul className="space-y-1 text-sm">
                  {order.items.map((item, i) => (
                    <li key={i} className="flex justify-between border-b border-slate-200 py-1 text-slate-700">
                      <span>{item.product?.name ?? 'Item'} ×{item.quantity}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}
