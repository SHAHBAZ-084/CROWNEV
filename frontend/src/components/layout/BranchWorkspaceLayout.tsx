import { Outlet } from 'react-router-dom';
import {
  ExternalLink, Receipt, CreditCard, BookOpen, Search,
  Wallet, Users, FileText, ShoppingBag, ScrollText, BarChart3, Handshake,
} from 'lucide-react';
import { DashboardSidebar, type SidebarNavSection } from './DashboardSidebar';
import { DashboardShell } from './DashboardShell';
import { useAuth } from '../../contexts/AuthContext';

const posSections: SidebarNavSection[] = [
  {
    title: 'Vouchers',
    items: [
      { to: '/branch/workspace/vouchers/receipt', label: 'Receipt Voucher', icon: Receipt },
      { to: '/branch/workspace/vouchers/payment', label: 'Payment Voucher', icon: CreditCard },
      { to: '/branch/workspace/vouchers/journal', label: 'Journal Voucher', icon: BookOpen },
      { to: '/branch/workspace/vouchers/view', label: 'View Voucher', icon: Search },
    ],
  },
  {
    title: 'Master',
    items: [
      { to: '/branch/workspace/accounts', label: 'Accounts', icon: Wallet },
      { to: '/branch/workspace/customers', label: 'Customers', icon: Users },
      { to: '/branch/workspace/suppliers', label: 'Suppliers', icon: Handshake },
    ],
  },
  {
    title: 'Invoices',
    items: [
      { to: '/branch/workspace/invoices/sale', label: 'Sale Invoice', icon: FileText },
      { to: '/branch/workspace/invoices/purchase', label: 'Purchase Invoice', icon: ShoppingBag },
    ],
  },
  {
    title: 'Reports',
    items: [
      { to: '/branch/workspace/reports/ledger', label: 'Account Ledger', icon: ScrollText },
      { to: '/branch/workspace/reports/trial-balance', label: 'Detail Trial Balance', icon: BarChart3 },
    ],
  },
];

export function openBranchWorkspace(path = '/branch/workspace/pos') {
  const url = `${window.location.origin}${path}`;
  window.open(
    url,
    'crown-ev-branch-workspace',
    'noopener,noreferrer,width=1440,height=920,menubar=no,toolbar=no,location=no,status=no'
  );
}

export function BranchWorkspaceLayout() {
  const { user, logout } = useAuth();

  return (
    <DashboardShell
      sidebar={({ mobileOpen, onNavigate }) => (
        <DashboardSidebar
          sections={posSections}
          role="BRANCH_OWNER"
          showBadge={false}
          userName={`${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim()}
          userEmail={user?.email}
          userMeta={user?.branchId ? `Branch #${user.branchId}` : undefined}
          mobileOpen={mobileOpen}
          onNavigate={onNavigate}
          onSignOut={() => logout()}
          footerExtra={
            <a
              href="/branch"
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-text-muted transition-colors hover:bg-accent/5 hover:text-brand"
            >
              <ExternalLink className="h-4 w-4 shrink-0" />
              Main dashboard
            </a>
          }
        />
      )}
    >
      <Outlet />
    </DashboardShell>
  );
}
