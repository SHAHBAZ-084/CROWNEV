import { useEffect, useState } from 'react';
import { Building2, DollarSign, Package, AlertTriangle } from 'lucide-react';
import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { adminApi } from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';
import { PageHeader } from '../../components/layout/PageTransition';
import { StatCard } from '../../components/ui/StatCard';
import { DataTable, StatusBadge } from '../../components/ui/DataTable';
import { TableSkeleton } from '../../components/ui/Skeleton';
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

export default function AdminDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [revenue, setRevenue] = useState<{ date: string; revenue: number }[]>([]);
  const [revenueLoading, setRevenueLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [inventorySummary, setInventorySummary] = useState<{
    branches: {
      branchId: number;
      branchName: string;
      bikeModels: { name: string; quantity: number }[];
      totalBikeUnits: number;
      totalPartUnits: number;
    }[];
    grandTotalBikeUnits: number;
    grandTotalPartUnits: number;
  } | null>(null);

  useEffect(() => {
    if (!user || user.role !== 'ADMIN') return;

    setLoadError('');
    setRevenueLoading(true);
    adminApi.dashboard().then(setData).catch((err) => {
      console.error(err);
      setLoadError(err instanceof Error ? err.message : 'Failed to load dashboard');
    });
    adminApi
      .revenue(30)
      .then(setRevenue)
      .catch((err) => {
        console.error(err);
        setLoadError(err instanceof Error ? err.message : 'Failed to load revenue');
      })
      .finally(() => setRevenueLoading(false));
    adminApi.inventorySummary().then(setInventorySummary).catch(console.error);
  }, [user]);

  const recentOrders = (data?.recentOrders as Record<string, unknown>[]) ?? [];
  const branchComparison = (data?.branchComparison as { name: string; revenue: number; orderCount: number }[]) ?? [];

  return (
    <div>
      <PageHeader title="Admin Dashboard" subtitle="Global overview across all branches" />

      {loadError && (
        <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-warning">{loadError}</p>
      )}

      {!data ? (
        <TableSkeleton />
      ) : (
        <>
          <DashboardStagger className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <DashboardStaggerItem>
              <StatCard embedded label="Total Revenue" value={Number(data.totalRevenue)} icon={DollarSign} prefix="PKR " />
            </DashboardStaggerItem>
            <DashboardStaggerItem>
              <StatCard embedded label="Total Orders" value={Number(data.totalOrders)} icon={Package} />
            </DashboardStaggerItem>
            <DashboardStaggerItem>
              <StatCard embedded label="Active Branches" value={Number(data.totalBranches)} icon={Building2} />
            </DashboardStaggerItem>
            <DashboardStaggerItem>
              <StatCard embedded label="Low Stock Alerts" value={Number(data.lowStockAlerts)} icon={AlertTriangle} />
            </DashboardStaggerItem>
          </DashboardStagger>

          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <DashboardReveal>
              <div className={dashboardPanelClass}>
                <h3 className={`mb-4 ${dashboardSectionTitleClass}`}>Revenue Trend (30 days)</h3>
                {revenueLoading ? (
                  <div className="flex h-[240px] items-center justify-center text-sm text-ink-muted">Loading chart…</div>
                ) : (
                  <ResponsiveContainer width="100%" height={240}>
                    <LineChart data={revenue}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                      <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#737373' }} tickFormatter={(v) => v.slice(5)} />
                      <YAxis tick={{ fontSize: 11, fill: '#737373' }} />
                      <Tooltip formatter={(v) => [`PKR ${Number(v).toLocaleString()}`, 'Revenue']} />
                      <Line type="monotone" dataKey="revenue" stroke="#f97316" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </DashboardReveal>

            <DashboardReveal delay={0.08}>
              <div className={dashboardPanelClass}>
                <h3 className={`mb-4 ${dashboardSectionTitleClass}`}>Branch Comparison</h3>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={branchComparison}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#737373' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#737373' }} />
                    <Tooltip />
                    <Bar dataKey="revenue" fill="#f97316" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </DashboardReveal>
          </div>

          <DashboardReveal className="mt-8" delay={0.05}>
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
                  { key: 'branch', header: 'Branch', render: (r) => (r.branch as { name: string })?.name ?? '' },
                  { key: 'status', header: 'Status', render: (r) => <StatusBadge status={String(r.status)} /> },
                  { key: 'total', header: 'Total', render: (r) => `PKR ${Number(r.total).toLocaleString()}` },
                ]}
                data={recentOrders}
              />
            </div>
          </DashboardReveal>

          {inventorySummary && (
            <DashboardReveal className="mt-8">
              <h3 className={`mb-4 ${dashboardSectionTitleClass}`}>Stock Summary</h3>
              <div className="grid gap-4 lg:grid-cols-2">
                {inventorySummary.branches.map((branch, index) => (
                  <motion.div
                    key={branch.branchId}
                    initial="hidden"
                    whileInView="visible"
                    viewport={defaultViewport}
                    variants={fadeUp}
                    transition={{ ...motionTransition, delay: index * 0.06 }}
                    className={dashboardPanelClass}
                  >
                    <h4 className="mb-4 font-display font-semibold text-ink">{branch.branchName}</h4>
                    <motion.div
                      className="flex flex-wrap gap-2"
                      initial="hidden"
                      whileInView="visible"
                      viewport={defaultViewport}
                      variants={{
                        hidden: {},
                        visible: { transition: { staggerChildren: 0.05, delayChildren: 0.04 } },
                      }}
                    >
                      {branch.bikeModels.map((model) => (
                        <StockModelChip key={model.name} name={model.name} quantity={model.quantity} />
                      ))}
                      {branch.bikeModels.length === 0 && (
                        <span className="text-sm text-ink-muted">No bikes in stock</span>
                      )}
                    </motion.div>
                    <StockTotals bikeUnits={branch.totalBikeUnits} partUnits={branch.totalPartUnits} />
                  </motion.div>
                ))}
              </div>
              <motion.div
                initial="hidden"
                whileInView="visible"
                viewport={defaultViewport}
                variants={fadeUp}
                transition={{ ...motionTransition, delay: 0.12 }}
                className={`mt-4 ${dashboardPanelClass}`}
              >
                <h4 className="mb-4 font-display font-semibold text-ink">All Branches Total</h4>
                <StockTotals
                  bikeUnits={inventorySummary.grandTotalBikeUnits}
                  partUnits={inventorySummary.grandTotalPartUnits}
                />
              </motion.div>
            </DashboardReveal>
          )}
        </>
      )}
    </div>
  );
}
