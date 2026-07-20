import { useEffect, useState } from 'react';
import { Calendar, DollarSign, Package, AlertTriangle, Monitor } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '../../contexts/AuthContext';
import { branchApi } from '../../api/client';
import { PageHeader } from '../../components/layout/PageTransition';
import { openBranchWorkspace } from '../../components/layout/BranchWorkspaceLayout';
import { StatCard } from '../../components/ui/StatCard';
import { DataTable, StatusBadge } from '../../components/ui/DataTable';
import { TableSkeleton } from '../../components/ui/Skeleton';
import { Button } from '../../components/ui/Button';
import { orderListReference } from '../../lib/format';
import {
  DashboardReveal,
  DashboardStagger,
  DashboardStaggerItem,
  StockModelChip,
  StockTotals,
  dashboardPanelClass,
  dashboardSectionTitleClass,
} from '../../components/dashboard/DashboardMotion';
import { defaultViewport, fadeUp, motionTransition } from '../../lib/publicMotion';

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

    const branchId = user.branchId;
    const loadDashboard = () => {
      Promise.all([
        branchApi.dashboard(branchId),
        branchApi.todayBookings(branchId),
      ])
        .then(([d, t]) => {
          setData(d);
          setToday(t as unknown as Record<string, unknown>[]);
        })
        .catch(console.error);
    };

    loadDashboard();

    const refresh = () => {
      if (document.visibilityState === 'visible') loadDashboard();
    };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [user?.branchId]);

  useEffect(() => {
    if (!user?.branchId) return;
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
          <DashboardStagger className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <DashboardStaggerItem>
              <StatCard embedded label="Branch Revenue" value={Number(data.revenue)} icon={DollarSign} prefix="PKR " />
            </DashboardStaggerItem>
            <DashboardStaggerItem>
              <StatCard embedded label="Today's Bookings" value={Number(data.todayBookings)} icon={Calendar} />
            </DashboardStaggerItem>
            <DashboardStaggerItem>
              <StatCard embedded label="Pending Orders" value={Number(data.pendingOrders)} icon={Package} />
            </DashboardStaggerItem>
            <DashboardStaggerItem>
              <StatCard embedded label="Low Stock Alerts" value={Number(data.lowStockAlerts)} icon={AlertTriangle} />
            </DashboardStaggerItem>
          </DashboardStagger>

          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <DashboardReveal>
              <h3 className={`mb-4 ${dashboardSectionTitleClass}`}>Today&apos;s Appointments</h3>
              <div className={dashboardPanelClass}>
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
            </DashboardReveal>

            <DashboardReveal delay={0.08}>
              <h3 className={`mb-4 ${dashboardSectionTitleClass}`}>Recent Orders</h3>
              <div className={dashboardPanelClass}>
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
            </DashboardReveal>
          </div>

          {inventorySummary && (
            <DashboardReveal className="mt-8">
              <h3 className={`mb-4 ${dashboardSectionTitleClass}`}>Stock Summary</h3>
              <motion.div
                initial="hidden"
                whileInView="visible"
                viewport={defaultViewport}
                variants={fadeUp}
                transition={motionTransition}
                className={dashboardPanelClass}
              >
                <motion.div
                  className="flex flex-wrap gap-2"
                  initial="hidden"
                  whileInView="visible"
                  viewport={defaultViewport}
                  variants={{
                    hidden: {},
                    visible: { transition: { staggerChildren: 0.05, delayChildren: 0.06 } },
                  }}
                >
                  {inventorySummary.bikeModels.map((model) => (
                    <StockModelChip key={model.name} name={model.name} quantity={model.quantity} />
                  ))}
                  {inventorySummary.bikeModels.length === 0 && (
                    <span className="text-sm text-ink-muted">No bikes in stock</span>
                  )}
                </motion.div>
                <StockTotals
                  bikeUnits={inventorySummary.totalBikeUnits}
                  partUnits={inventorySummary.totalPartUnits}
                />
              </motion.div>
            </DashboardReveal>
          )}
        </>
      )}
    </div>
  );
}
