import {
  Receipt,
  CreditCard,
  BookOpen,
  Search,
  Wallet,
  Users,
  FileText,
  ShoppingBag,
  ScrollText,
  BarChart3,
  Handshake,
  Wrench,
} from 'lucide-react';
import type { SidebarNavSection } from '../components/layout/DashboardSidebar';

export const posSections: SidebarNavSection[] = [
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
      { to: '/branch/workspace/invoices/service', label: 'Service Invoice', icon: Wrench },
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
