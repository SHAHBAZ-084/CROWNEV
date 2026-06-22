import { Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Building2, Package, ShoppingCart, Users, BarChart3,
  Calendar, CreditCard, MessageSquare, Truck, Boxes,
} from 'lucide-react';
import { DashboardSidebar, type SidebarNavItem } from './DashboardSidebar';
import { DashboardShell } from './DashboardShell';
import { useAuth } from '../../contexts/AuthContext';
import type { Role } from '../../types';

const adminNav: SidebarNavItem[] = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/admin/branches', label: 'Branches', icon: Building2 },
  { to: '/admin/products', label: 'Catalog', icon: Package },
  { to: '/admin/orders', label: 'Orders', icon: ShoppingCart },
  { to: '/admin/bookings', label: 'Bookings', icon: Calendar },
  { to: '/admin/users', label: 'Users', icon: Users },
  { to: '/admin/testimonials', label: 'Testimonials', icon: MessageSquare },
  { to: '/admin/reports', label: 'Reports', icon: BarChart3 },
];

const branchNav: SidebarNavItem[] = [
  { to: '/branch', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/branch/orders', label: 'Orders', icon: Truck },
  { to: '/branch/inventory', label: 'Stock', icon: Boxes },
  { to: '/branch/bookings', label: 'Service Booking', icon: Calendar },
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
    <DashboardShell
      sidebar={({ mobileOpen, onNavigate }) => (
        <DashboardSidebar
          nav={nav}
          role={role}
          userName={`${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim()}
          userEmail={user?.email}
          userMeta={role === 'BRANCH_OWNER' && user?.branchId ? `Branch #${user.branchId}` : undefined}
          mobileOpen={mobileOpen}
          onNavigate={onNavigate}
          onSignOut={() => {
            logout();
            navigate('/');
          }}
        />
      )}
    >
      <Outlet />
    </DashboardShell>
  );
}
