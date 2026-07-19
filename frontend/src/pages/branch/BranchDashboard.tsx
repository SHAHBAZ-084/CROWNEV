import { useEffect, useState } from 'react';
import { Calendar, DollarSign, Package, AlertTriangle, Monitor } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { branchApi } from '../../api/client';
import { PageHeader } from '../../components/layout/PageTransition';
import { openBranchWorkspace } from '../../components/layout/BranchWorkspaceLayout';
import { StatCard } from '../../components/ui/StatCard';
import { DataTable, StatusBadge } from '../../components/ui/DataTable';
import { TableSkeleton } from '../../components/ui/Skeleton';
import { Button } from '../../components/ui/Button';
import { orderListReference } from '../../lib/format';

export default function BranchDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [today, setToday] = useState<Record<string, unknown>[]>([]);
  const [inventorySummary, setInventorySummary] = useState<{
    bikeModels: { name: string; quantity: number }[];
    totalBikeUnits: number;
    totalPartUnits: number;
  } | null>(null);

  useEffect(() => {
    if (!user?.branchId) return;
    Promise.all([
      branchApi.dashboard(user.branchId),
      branchApi.todayBookings(user.branchId),
    ]).then(([d, t]) => { setData(d); setToday(t as unknown as Record<string, unknown>[]); }).catch(console.error);
    branchApi.inventorySummary(user.branchId).then(setInventorySummary).catch(console.error);
  }, [user?.branchId]);

  const recentOrders = (data?.recentOrders as Record<string, unknown>[]) ?? [];

  return (
    <div>
      <PageHeader
        title="Branch Dashboard"
        subtitle={`Branch #${user?.branchId}`}
        action={
          <Button variant="accent" onClick={() => openBranchWorkspace('/branch/workspace/pos')}>
            <Monitor className="h-4 w-4" />
            Open POS Workspace
          </Button>
        }
      />

      {!data ? (
        <TableSkeleton />
      ) : (
        <>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Branch Revenue" value={Number(data.revenue)} icon={DollarSign} prefix="PKR " />
            <StatCard label="Today's Bookings" value={Number(data.todayBookings)} icon={Calendar} />
            <StatCard label="Pending Orders" value={Number(data.pendingOrders)} icon={Package} />
            <StatCard label="Low Stock Alerts" value={Number(data.lowStockAlerts)} icon={AlertTriangle} />
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <div>
              <h3 className="mb-4 font-display font-semibold text-ink">Today&apos;s Appointments</h3>
              <DataTable
                columns={[
                  { key: 'time', header: 'Time' },
                  { key: 'service', header: 'Service', render: (r) => (r.service as { name: string })?.name ?? '' },
                  { key: 'status', header: 'Status', render: (r) => <StatusBadge status={String(r.status)} /> },
                ]}
                data={today}
                emptyMessage="No appointments today"
              />
            </div>
            <div>
              <h3 className="mb-4 font-display font-semibold text-ink">Recent Orders</h3>
              <DataTable
                columns={[
                  {
                    key: 'reference',
                    header: 'Reference',
                    render: (r) => (
                      <span className="font-mono text-xs">
                        {orderListReference({
                          type: String(r.type),
                          id: Number(r.id),
                          publicId: r.publicId as string | null | undefined,
                          saleReference: r.saleReference as string | null | undefined,
                        })}
                      </span>
                    ),
                  },
                  { key: 'status', header: 'Status', render: (r) => <StatusBadge status={String(r.status)} /> },
                  { key: 'total', header: 'Total', render: (r) => `PKR ${Number(r.total).toLocaleString()}` },
                ]}
                data={recentOrders}
              />
            </div>
          </div>

          {inventorySummary && (
            <div className="mt-8">
              <h3 className="mb-4 font-display font-semibold text-ink">Stock Summary</h3>
              <div className="rounded-[var(--radius-card)] border border-border-light bg-elevated p-6 shadow-[var(--shadow-elevated)]">
                <div className="mb-4 flex flex-wrap gap-2">
                  {inventorySummary.bikeModels.map((model) => (
                    <span
                      key={model.name}
                      className="inline-flex rounded-full bg-surface-alt px-2.5 py-0.5 text-xs font-semibold text-brand"
                    >
                      {model.name} · {model.quantity}
                    </span>
                  ))}
                  {inventorySummary.bikeModels.length === 0 && (
                    <span className="text-sm text-ink-muted">No bikes in stock</span>
                  )}
                </div>
                <p className="text-sm text-ink-muted">
                  Bike units: <strong className="text-ink">{inventorySummary.totalBikeUnits}</strong>
                  {' · '}
                  Part units: <strong className="text-ink">{inventorySummary.totalPartUnits}</strong>
                </p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
