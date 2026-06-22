import { type FormEvent, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Search } from 'lucide-react';
import { publicApi } from '../../api/client';
import type { Order } from '../../types';
import { formatPKR, formatDate } from '../../lib/format';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { StatusBadge } from '../../components/ui/DataTable';
import { PageHero } from '../../components/public/PageHero';

export default function TrackOrderPage() {
  const [searchParams] = useSearchParams();
  const [trackingId, setTrackingId] = useState(searchParams.get('id') ?? '');
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setOrder(null);
    try {
      const result = await publicApi.trackOrder(trackingId.trim());
      setOrder(result);
    } catch {
      setError('Order not found. Check your tracking ID.');
    }
  }

  return (
    <div>
      <PageHero
        page="trackOrder"
        title="Track Order"
        subtitle="No login required — enter your tracking ID"
      >
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            placeholder="e.g. CE-XXXXX-XXXX"
            value={trackingId}
            onChange={(e) => setTrackingId(e.target.value)}
            required
            className="flex-1"
          />
          <Button type="submit" variant="accent"><Search className="h-4 w-4" /></Button>
        </form>
        {error && <p className="mt-4 text-sm text-warning">{error}</p>}
      </PageHero>

      <div className="mx-auto max-w-lg px-4 pb-16 pt-8">
        {order && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-[var(--radius-card)] border border-border bg-white p-6 shadow-[var(--shadow-card)]"
          >
            <div className="flex items-center justify-between">
              <p className="font-mono text-sm text-brand-light">{order.trackingId}</p>
              <StatusBadge status={order.status} />
            </div>
            <p className="mt-4 font-display text-2xl font-bold tabular-nums text-brand">{formatPKR(order.total)}</p>
            <p className="text-sm text-text-muted mt-1">Placed {formatDate(order.createdAt)}</p>
            {order.branch && <p className="text-sm text-text-muted mt-1">Branch: {order.branch.name}</p>}
          </motion.div>
        )}
      </div>
    </div>
  );
}
