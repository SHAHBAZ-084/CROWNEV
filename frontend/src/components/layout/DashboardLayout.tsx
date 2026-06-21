import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LayoutDashboard, Building2, Package, ShoppingCart, Users, BarChart3,
  Wrench, Boxes, Calendar, Calculator, LogOut, Zap, CreditCard, Truck,
  MessageSquare, Handshake,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import type { Role } from '../../types';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

const adminNav: NavItem[] = [
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

const branchNav: NavItem[] = [
  { to: '/branch', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/branch/pos', label: 'POS', icon: ShoppingCart },
  { to: '/branch/orders', label: 'Orders', icon: Truck },
  { to: '/branch/inventory', label: 'Inventory', icon: Boxes },
  { to: '/branch/bookings', label: 'Bookings', icon: Calendar },
  { to: '/branch/services', label: 'Services', icon: Wrench },
  { to: '/branch/suppliers', label: 'Suppliers', icon: Handshake },
  { to: '/branch/purchases', label: 'Purchases', icon: Package },
  { to: '/branch/payments', label: 'Payments', icon: CreditCard },
  { to: '/branch/accounting', label: 'Accounting', icon: Calculator },
  { to: '/branch/reports', label: 'Reports', icon: BarChart3 },
];

const customerNav: NavItem[] = [
  { to: '/customer', label: 'Overview', icon: LayoutDashboard },
  { to: '/customer/orders', label: 'My Orders', icon: ShoppingCart },
  { to: '/customer/bookings', label: 'My Bookings', icon: Calendar },
  { to: '/customer/profile', label: 'Profile', icon: Users },
];

const navByRole: Record<Role, NavItem[]> = {
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
      <aside className="fixed left-0 top-0 z-30 flex h-full w-64 flex-col border-r border-border bg-white">
        <div className="flex items-center gap-2 border-b border-border px-6 py-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand">
            <Zap className="h-4 w-4 text-accent-soft" />
          </div>
          <div>
            <p className="font-display text-sm font-bold text-brand">Crown Eve</p>
            <p className="text-xs text-text-muted capitalize">{role.replace('_', ' ').toLowerCase()}</p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-4 space-y-1">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/admin' || item.to === '/branch' || item.to === '/customer'}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'border-l-[3px] border-accent bg-accent/8 text-brand pl-[9px]'
                    : 'text-text-muted hover:bg-surface-alt hover:text-brand'
                }`
              }
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-border p-4">
          <p className="truncate text-sm font-medium text-brand">{user?.firstName} {user?.lastName}</p>
          <p className="truncate text-xs text-text-muted">{user?.email}</p>
          <button
            type="button"
            onClick={() => { logout(); navigate('/'); }}
            className="mt-3 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-text-muted hover:bg-surface-alt"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </aside>

      <div className="ml-64 flex-1">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="p-8"
        >
          <Outlet />
        </motion.div>
      </div>
    </div>
  );
}
