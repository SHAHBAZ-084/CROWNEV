import { Outlet, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import {
  LayoutDashboard, Building2, Package, ShoppingCart, Users, BarChart3,
  Calendar, CreditCard, MessageSquare, Truck, Boxes, Store, Wrench, SlidersHorizontal,
} from 'lucide-react';
import { DashboardSidebar, type SidebarNavItem } from './DashboardSidebar';
import { DashboardShell } from './DashboardShell';
import { CartDrawer } from '../cart/CartDrawer';
import { useAuth } from '../../contexts/AuthContext';
import { useCart } from '../../contexts/CartContext';
import type { Role } from '../../types';

const adminNav: SidebarNavItem[] = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/admin/branches', label: 'Branches', icon: Building2 },
  { to: '/admin/products', label: 'Catalog', icon: Package },
  { to: '/admin/orders', label: 'Orders', icon: ShoppingCart },
  { to: '/admin/bookings', label: 'Bookings', icon: Calendar },
  { to: '/admin/users', label: 'Users', icon: Users },
  { to: '/admin/testimonials', label: 'Testimonials', icon: MessageSquare },
  { to: '/admin/customization', label: 'Customization', icon: SlidersHorizontal },
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
  {
    to: '/shop',
    label: 'Shop',
    icon: Store,
    match: (pathname) =>
      pathname === '/shop' ||
      pathname.startsWith('/shop/') ||
      pathname === '/checkout',
  },
  {
    to: '/book-service',
    label: 'Book Service',
    icon: Wrench,
    match: (pathname) => pathname === '/book-service',
  },
  { to: '/customer/orders', label: 'My Orders', icon: ShoppingCart },
  { to: '/customer/bookings', label: 'My Bookings', icon: Calendar },
  { to: '/customer/profile', label: 'Profile', icon: Users },
];

const navByRole: Record<Role, SidebarNavItem[]> = {
  ADMIN: adminNav,
  BRANCH_OWNER: branchNav,
  CUSTOMER: customerNav,
};

export function DashboardLayout({ role, children }: { role: Role; children?: React.ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const nav = navByRole[role];

  return (
    <DashboardShell
      headerActions={role === 'CUSTOMER' ? <CustomerCartButton /> : undefined}
      sidebar={({ mobileOpen, onNavigate }) => (
        <DashboardSidebar
          nav={nav}
          role={role}
          logoTo={role === 'CUSTOMER' ? '/customer' : '/'}
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
      {children ?? <Outlet />}
    </DashboardShell>
  );
}

function CustomerCartButton() {
  const { count } = useCart();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={count > 0 ? `Open cart, ${count} items` : 'Open cart'}
        className="relative flex min-h-10 min-w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-orange-500 transition-colors hover:border-orange-300 hover:bg-orange-50"
      >
        <ShoppingCart className="h-5 w-5" strokeWidth={2} aria-hidden />
        {count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-white">
            {count}
          </span>
        )}
      </button>
      <CartDrawer open={open} onClose={() => setOpen(false)} />
    </>
  );
}
