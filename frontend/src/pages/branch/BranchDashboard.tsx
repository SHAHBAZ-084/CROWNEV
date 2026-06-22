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

export default function BranchDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [today, setToday] = useState<Record<string, unknown>[]>([]);

  useEffect(() => {
    if (!user?.branchId) return;
    Promise.all([
      branchApi.dashboard(user.branchId),
      branchApi.todayBookings(user.branchId),
    ]).then(([d, t]) => { setData(d); setToday(t as unknown as Record<string, unknown>[]); }).catch(console.error);
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
              <h3 className="font-display font-semibold text-brand mb-4">Today&apos;s Appointments</h3>
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
              <h3 className="font-display font-semibold text-brand mb-4">Recent Orders</h3>
              <DataTable
                columns={[
                  { key: 'trackingId', header: 'Tracking' },
                  { key: 'status', header: 'Status', render: (r) => <StatusBadge status={String(r.status)} /> },
                  { key: 'total', header: 'Total', render: (r) => `PKR ${Number(r.total).toLocaleString()}` },
                ]}
                data={recentOrders}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
