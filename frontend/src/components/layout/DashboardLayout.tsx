import { Outlet, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LayoutDashboard, Building2, Package, ShoppingCart, Users, BarChart3,
  Calendar, CreditCard, MessageSquare, Truck, Boxes, Wrench, Handshake,
} from 'lucide-react';
import { DashboardSidebar, type SidebarNavItem } from './DashboardSidebar';
import { DASHBOARD_SIDEBAR_WIDTH } from './dashboardConstants';
import { useAuth } from '../../contexts/AuthContext';
import type { Role } from '../../types';

const adminNav: SidebarNavItem[] = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/admin/branches', label: 'Branches', icon: Building2 },
  { to: '/admin/products', label: 'Catalog', icon: Package },
  { to: '/admin/orders', label: 'Orders', icon: ShoppingCart },
  { to: '/admin/bookings', label: 'Bookings', icon: Calendar },
  { to: '/admin/users', label: 'Users', icon: Users },
  { to: '/admin/payments', label: 'Payments', icon: CreditCard },
  { to: '/admin/testimonials', label: 'Testimonials', icon: MessageSquare },
  { to: '/admin/reports', label: 'Reports', icon: BarChart3 },
];

const branchNav: SidebarNavItem[] = [
  { to: '/branch', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/branch/orders', label: 'Orders', icon: Truck },
  { to: '/branch/inventory', label: 'Inventory', icon: Boxes },
  { to: '/branch/bikes', label: 'Bikes', icon: Package },
  { to: '/branch/bookings', label: 'Bookings', icon: Calendar },
  { to: '/branch/services', label: 'Services', icon: Wrench },
  { to: '/branch/suppliers', label: 'Suppliers', icon: Handshake },
  { to: '/branch/purchases', label: 'Purchases', icon: Package },
  { to: '/branch/payments', label: 'Payments', icon: CreditCard },
  { to: '/branch/reports', label: 'Reports', icon: BarChart3 },
];

const customerNav: SidebarNavItem[] = [
  { to: '/customer', label: 'Overview', icon: LayoutDashboard },
  { to: '/customer/orders', label: 'My Orders', icon: ShoppingCart },
  { to: '/customer/bookings', label: 'My Bookings', icon: Calendar },
  { to: '/customer/profile', label: 'Profile', icon: Users },
];

const navByRole: Record<Role, SidebarNavItem[]> = {
  ADMIN: adminNav,
  BRANCH_OWNER: branchNav,
  CUSTOMER: customerNav,
};

export function DashboardLayout({ role }: { role: Role }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const nav = navByRole[role];

  return (
    <div className="flex min-h-screen bg-surface-alt">
      <DashboardSidebar
        nav={nav}
        role={role}
        userName={`${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim()}
        userEmail={user?.email}
        userMeta={role === 'BRANCH_OWNER' && user?.branchId ? `Branch #${user.branchId}` : undefined}
        onSignOut={() => {
          logout();
          navigate('/');
        }}
      />

      <div className="flex-1" style={{ marginLeft: DASHBOARD_SIDEBAR_WIDTH }}>
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="p-6 lg:p-8"
        >
          <Outlet />
        </motion.div>
      </div>
    </div>
  );
}
