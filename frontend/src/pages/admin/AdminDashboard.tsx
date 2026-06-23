import { useEffect, useState } from 'react';
import { Building2, DollarSign, Package, AlertTriangle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { adminApi } from '../../api/client';
import { PageHeader } from '../../components/layout/PageTransition';
import { StatCard } from '../../components/ui/StatCard';
import { DataTable, StatusBadge } from '../../components/ui/DataTable';
import { TableSkeleton } from '../../components/ui/Skeleton';
import { orderListReference } from '../../lib/format';

export default function AdminDashboard() {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [revenue, setRevenue] = useState<{ date: string; revenue: number }[]>([]);

  useEffect(() => {
    Promise.all([adminApi.dashboard(), adminApi.revenue(30)])
      .then(([d, r]) => { setData(d); setRevenue(r); })
      .catch(console.error);
  }, []);

  const recentOrders = (data?.recentOrders as Record<string, unknown>[]) ?? [];
  const branchComparison = (data?.branchComparison as { name: string; revenue: number; orderCount: number }[]) ?? [];

  return (
    <div>
      <PageHeader title="Admin Dashboard" subtitle="Global overview across all branches" />

      {!data ? (
        <TableSkeleton />
      ) : (
        <>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Total Revenue" value={Number(data.totalRevenue)} icon={DollarSign} prefix="PKR " />
            <StatCard label="Total Orders" value={Number(data.totalOrders)} icon={Package} />
            <StatCard label="Active Branches" value={Number(data.totalBranches)} icon={Building2} />
            <StatCard label="Low Stock Alerts" value={Number(data.lowStockAlerts)} icon={AlertTriangle} />
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <div className="rounded-[var(--radius-card)] border border-border-light bg-elevated p-6 shadow-[var(--shadow-elevated)]">
              <h3 className="mb-4 font-display font-semibold text-ink">Revenue Trend (30 days)</h3>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={revenue}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#737373' }} tickFormatter={(v) => v.slice(5)} />
                  <YAxis tick={{ fontSize: 11, fill: '#737373' }} />
                  <Tooltip formatter={(v) => [`PKR ${Number(v).toLocaleString()}`, 'Revenue']} />
                  <Line type="monotone" dataKey="revenue" stroke="#f97316" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="rounded-[var(--radius-card)] border border-border-light bg-elevated p-6 shadow-[var(--shadow-elevated)]">
              <h3 className="mb-4 font-display font-semibold text-ink">Branch Comparison</h3>
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
          </div>

          <div className="mt-8">
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
                        saleReference: r.saleReference as string | null | undefined,
                        trackingId: r.trackingId as string | null | undefined,
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
        </>
      )}
    </div>
  );
}
