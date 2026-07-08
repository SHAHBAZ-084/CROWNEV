import { Suspense } from 'react';
import { lazyRetry } from './lib/lazyRetry';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { CartProvider } from './contexts/CartContext';
import { ToastProvider } from './contexts/ToastContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { InactivityWatcher } from './components/InactivityWatcher';
import { PublicLayout } from './components/layout/PublicLayout';
import { CustomerOrPublicWrap } from './components/layout/CustomerOrPublicWrap';
import { PageTransition, PageSuspense } from './components/layout/PageTransition';
import { ProtectedRoute, GuestRoute } from './components/ProtectedRoute';
import { ProductGridSkeleton } from './components/ui/Skeleton';
import LoginPage from './pages/public/LoginPage';
import RegisterPage from './pages/public/RegisterPage';
import ForgotPasswordPage from './pages/public/ForgotPasswordPage';

const lazy = lazyRetry;

const DashboardLayout = lazy(() =>
  import('./components/layout/DashboardLayout').then((m) => ({ default: m.DashboardLayout })),
);
const BranchWorkspaceLayout = lazy(() =>
  import('./components/layout/BranchWorkspaceLayout').then((m) => ({ default: m.BranchWorkspaceLayout })),
);

function LazyDashboardLayout({ role }: { role: 'ADMIN' | 'BRANCH_OWNER' | 'CUSTOMER' }) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-surface p-8"><ProductGridSkeleton count={4} /></div>}>
      <DashboardLayout role={role} />
    </Suspense>
  );
}

function LazyBranchWorkspaceLayout() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-surface p-8"><ProductGridSkeleton count={4} /></div>}>
      <BranchWorkspaceLayout />
    </Suspense>
  );
}

const lazyNamed = (loader: () => Promise<Record<string, unknown>>, name: string) =>
  lazy(() =>
    loader().then((m) => {
      const component = m[name];
      if (!component) {
        throw new Error(`Missing export "${name}" — stale deploy`);
      }
      return { default: component as React.ComponentType };
    }),
  );

const LandingPage = lazy(() => import('./pages/public/LandingPage'));
const ShopPage = lazy(() => import('./pages/public/ShopPage'));
const ModelComparisonPage = lazy(() => import('./pages/public/ModelComparisonPage'));
const ProductDetailPage = lazy(() => import('./pages/public/ProductDetailPage'));
const TrackOrderPage = lazy(() => import('./pages/public/TrackOrderPage'));
const ServiceTicketPage = lazy(() => import('./pages/public/ServiceTicketPage'));
const ContactPage = lazy(() => import('./pages/public/ContactPage'));
const CheckoutPage = lazy(() => import('./pages/public/CheckoutPage'));
const BookServicePage = lazy(() => import('./pages/public/BookServicePage'));
const AboutPage = lazyNamed(() => import('./pages/public/StaticPages'), 'AboutPage');
const PrivacyPage = lazyNamed(() => import('./pages/public/StaticPages'), 'PrivacyPage');
const TermsPage = lazyNamed(() => import('./pages/public/StaticPages'), 'TermsPage');
const NotFoundPage = lazyNamed(() => import('./pages/public/StaticPages'), 'NotFoundPage');
const UnauthorizedPage = lazyNamed(() => import('./pages/public/StaticPages'), 'UnauthorizedPage');

const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const AdminBranches = lazyNamed(() => import('./pages/admin/AdminPages'), 'AdminBranchesPage');
const AdminProducts = lazyNamed(() => import('./pages/admin/AdminPages'), 'AdminProductsPage');
const AdminItems = lazy(() => import('./pages/admin/AdminItemsPage'));
const AdminParts = lazyNamed(() => import('./pages/admin/AdminPages'), 'AdminPartsPage');
const AdminOrders = lazyNamed(() => import('./pages/admin/AdminPages'), 'AdminOrdersPage');
const AdminBookings = lazyNamed(() => import('./pages/admin/AdminPages'), 'AdminBookingsPage');
const AdminUsers = lazyNamed(() => import('./pages/admin/AdminPages'), 'AdminUsersPage');
const AdminReports = lazyNamed(() => import('./pages/admin/AdminPages'), 'AdminReportsPage');
const AdminTestimonials = lazyNamed(() => import('./pages/admin/AdminPages'), 'AdminTestimonialsPage');
const AdminCustomization = lazyNamed(() => import('./pages/admin/AdminPages'), 'AdminCustomizationPage');
const AdminProfile = lazyNamed(() => import('./pages/admin/AdminPages'), 'AdminProfilePage');

const BranchDashboard = lazy(() => import('./pages/branch/BranchDashboard'));
const BranchPOS = lazyNamed(() => import('./pages/branch/BranchPages'), 'BranchPOSPage');
const BranchOrders = lazyNamed(() => import('./pages/branch/BranchPages'), 'BranchOrdersPage');
const BranchInventory = lazyNamed(() => import('./pages/branch/BranchPages'), 'BranchInventoryPage');
const BranchBikes = lazyNamed(() => import('./pages/branch/BranchPages'), 'BranchBikesPage');
const BranchBookings = lazyNamed(() => import('./pages/branch/BranchPages'), 'BranchBookingsPage');
const BranchReports = lazyNamed(() => import('./pages/branch/BranchPages'), 'BranchReportsPage');
const BranchPurchases = lazyNamed(() => import('./pages/branch/BranchPages'), 'BranchPurchasesPage');
const BranchPayments = lazyNamed(() => import('./pages/branch/BranchPages'), 'BranchPaymentsPage');

const PosReceiptVoucher = lazyNamed(() => import('./pages/branch/PosPages'), 'PosReceiptVoucherPage');
const PosPaymentVoucher = lazyNamed(() => import('./pages/branch/PosPages'), 'PosPaymentVoucherPage');
const PosJournalVoucher = lazyNamed(() => import('./pages/branch/PosPages'), 'PosJournalVoucherPage');
const PosViewVoucher = lazyNamed(() => import('./pages/branch/PosPages'), 'PosViewVoucherPage');
const PosAccounts = lazyNamed(() => import('./pages/branch/PosPages'), 'PosAccountsPage');
const PosCustomers = lazyNamed(() => import('./pages/branch/PosPages'), 'PosCustomersPage');
const PosSuppliers = lazyNamed(() => import('./pages/branch/PosPages'), 'PosSuppliersPage');
const PosSaleInvoice = lazyNamed(() => import('./pages/branch/PosPages'), 'PosSaleInvoicePage');
const PosPurchaseInvoice = lazyNamed(() => import('./pages/branch/PosPages'), 'PosPurchaseInvoicePage');
const PosServiceInvoice = lazyNamed(() => import('./pages/branch/PosPages'), 'PosServiceInvoicePage');
const PosAccountLedger = lazyNamed(() => import('./pages/branch/PosPages'), 'PosAccountLedgerPage');
const PosDetailTrialBalance = lazyNamed(() => import('./pages/branch/PosPages'), 'PosDetailTrialBalancePage');
const PosBikeDocumentsPage = lazy(() => import('./pages/branch/PosBikeDocumentsPage'));


const CustomerDashboard = lazyNamed(() => import('./pages/customer/CustomerPages'), 'CustomerDashboard');
const CustomerOrders = lazyNamed(() => import('./pages/customer/CustomerPages'), 'CustomerOrdersPage');
const CustomerBookings = lazyNamed(() => import('./pages/customer/CustomerPages'), 'CustomerBookingsPage');
const CustomerProfile = lazyNamed(() => import('./pages/customer/CustomerPages'), 'CustomerProfilePage');

function PublicWrap({ children }: { children: React.ReactNode }) {
  return (
    <PublicLayout>
      <PageTransition>
        <Suspense fallback={<div className="p-8"><ProductGridSkeleton count={4} /></div>}>
          <ErrorBoundary scope="Page">{children}</ErrorBoundary>
        </Suspense>
      </PageTransition>
    </PublicLayout>
  );
}

function DashWrap({ children }: { children: React.ReactNode }) {
  return (
    <PageSuspense>
      <PageTransition>
        <ErrorBoundary scope="Page">{children}</ErrorBoundary>
      </PageTransition>
    </PageSuspense>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <CartProvider>
          <ToastProvider>
            <BrowserRouter>
              <InactivityWatcher />
              <Routes>
              <Route path="/" element={<PublicWrap><LandingPage /></PublicWrap>} />
              <Route path="/shop" element={<CustomerOrPublicWrap><ShopPage /></CustomerOrPublicWrap>} />
              <Route path="/compare" element={<CustomerOrPublicWrap><ModelComparisonPage /></CustomerOrPublicWrap>} />
              <Route path="/shop/:id" element={<CustomerOrPublicWrap><ProductDetailPage /></CustomerOrPublicWrap>} />
              <Route path="/track" element={<PublicWrap><TrackOrderPage /></PublicWrap>} />
              <Route path="/service-ticket/:id" element={<PublicWrap><ServiceTicketPage /></PublicWrap>} />
              <Route path="/contact" element={<PublicWrap><ContactPage /></PublicWrap>} />
              <Route path="/about" element={<PublicWrap><AboutPage /></PublicWrap>} />
              <Route path="/privacy" element={<PublicWrap><PrivacyPage /></PublicWrap>} />
              <Route path="/terms" element={<PublicWrap><TermsPage /></PublicWrap>} />
              <Route path="/faq" element={<Navigate to={{ pathname: '/', hash: '#faqs' }} replace />} />
              <Route path="/book-service" element={<CustomerOrPublicWrap><BookServicePage /></CustomerOrPublicWrap>} />
              <Route path="/checkout" element={<CustomerOrPublicWrap><CheckoutPage /></CustomerOrPublicWrap>} />

              <Route element={<GuestRoute />}>
                <Route path="/login" element={<PublicWrap><LoginPage /></PublicWrap>} />
                <Route path="/register" element={<PublicWrap><RegisterPage /></PublicWrap>} />
                <Route path="/forgot-password" element={<PublicWrap><ForgotPasswordPage /></PublicWrap>} />
              </Route>

              <Route element={<ProtectedRoute roles={['ADMIN']} />}>
                <Route element={<LazyDashboardLayout role="ADMIN" />}>
                  <Route path="/admin" element={<DashWrap><AdminDashboard /></DashWrap>} />
                  <Route path="/admin/branches" element={<DashWrap><AdminBranches /></DashWrap>} />
                  <Route path="/admin/products" element={<DashWrap><AdminProducts /></DashWrap>} />
                  <Route path="/admin/items" element={<DashWrap><AdminItems /></DashWrap>} />
                  <Route path="/admin/parts" element={<DashWrap><AdminParts /></DashWrap>} />
                  <Route path="/admin/orders" element={<DashWrap><AdminOrders /></DashWrap>} />
                  <Route path="/admin/bookings" element={<DashWrap><AdminBookings /></DashWrap>} />
                  <Route path="/admin/users" element={<DashWrap><AdminUsers /></DashWrap>} />
                  <Route path="/admin/testimonials" element={<DashWrap><AdminTestimonials /></DashWrap>} />
                  <Route path="/admin/customization" element={<DashWrap><AdminCustomization /></DashWrap>} />
                  <Route path="/admin/bike-documents" element={<DashWrap><PosBikeDocumentsPage /></DashWrap>} />

                  <Route path="/admin/reports" element={<DashWrap><AdminReports /></DashWrap>} />
                  <Route path="/admin/profile" element={<DashWrap><AdminProfile /></DashWrap>} />
                </Route>
              </Route>

              <Route element={<ProtectedRoute roles={['BRANCH_OWNER']} />}>
                <Route element={<LazyDashboardLayout role="BRANCH_OWNER" />}>
                  <Route path="/branch" element={<DashWrap><BranchDashboard /></DashWrap>} />
                  <Route path="/branch/orders" element={<DashWrap><BranchOrders /></DashWrap>} />
                  <Route path="/branch/inventory" element={<DashWrap><BranchInventory /></DashWrap>} />
                  <Route path="/branch/bikes" element={<DashWrap><BranchBikes /></DashWrap>} />
                  <Route path="/branch/bookings" element={<DashWrap><BranchBookings /></DashWrap>} />
                  <Route path="/branch/services" element={<Navigate to="/branch/bookings" replace />} />
                  <Route path="/branch/suppliers" element={<Navigate to="/branch/workspace/suppliers" replace />} />
                  <Route path="/branch/purchases" element={<DashWrap><BranchPurchases /></DashWrap>} />
                  <Route path="/branch/payments" element={<DashWrap><BranchPayments /></DashWrap>} />
                  <Route path="/branch/bike-documents" element={<DashWrap><PosBikeDocumentsPage /></DashWrap>} />
                  <Route path="/branch/reports" element={<DashWrap><BranchReports /></DashWrap>} />
                </Route>
                <Route element={<LazyBranchWorkspaceLayout />}>
                  <Route path="/branch/workspace" element={<Navigate to="/branch/workspace/pos" replace />} />
                  <Route path="/branch/workspace/pos" element={<DashWrap><BranchPOS /></DashWrap>} />
                  <Route path="/branch/workspace/vouchers/receipt" element={<DashWrap><PosReceiptVoucher /></DashWrap>} />
                  <Route path="/branch/workspace/vouchers/payment" element={<DashWrap><PosPaymentVoucher /></DashWrap>} />
                  <Route path="/branch/workspace/vouchers/journal" element={<DashWrap><PosJournalVoucher /></DashWrap>} />
                  <Route path="/branch/workspace/vouchers/view" element={<DashWrap><PosViewVoucher /></DashWrap>} />
                  <Route path="/branch/workspace/accounts" element={<DashWrap><PosAccounts /></DashWrap>} />
                  <Route path="/branch/workspace/customers" element={<DashWrap><PosCustomers /></DashWrap>} />
                  <Route path="/branch/workspace/suppliers" element={<DashWrap><PosSuppliers /></DashWrap>} />
                  <Route path="/branch/workspace/invoices/sale" element={<DashWrap><PosSaleInvoice /></DashWrap>} />
                  <Route path="/branch/workspace/invoices/purchase" element={<DashWrap><PosPurchaseInvoice /></DashWrap>} />
                  <Route path="/branch/workspace/invoices/service" element={<DashWrap><PosServiceInvoice /></DashWrap>} />
                  <Route path="/branch/workspace/reports/ledger" element={<DashWrap><PosAccountLedger /></DashWrap>} />
                  <Route path="/branch/workspace/reports/trial-balance" element={<DashWrap><PosDetailTrialBalance /></DashWrap>} />
                </Route>
                <Route path="/branch/pos" element={<Navigate to="/branch/workspace/pos" replace />} />
                <Route path="/branch/workspace/orders" element={<Navigate to="/branch/orders" replace />} />
                <Route path="/branch/workspace/inventory" element={<Navigate to="/branch/inventory" replace />} />
                <Route path="/branch/workspace/bikes" element={<Navigate to="/branch/bikes" replace />} />
                <Route path="/branch/workspace/bookings" element={<Navigate to="/branch/bookings" replace />} />
                <Route path="/branch/workspace/services" element={<Navigate to="/branch/bookings" replace />} />
                <Route path="/branch/workspace/purchases" element={<Navigate to="/branch/purchases" replace />} />
                <Route path="/branch/workspace/payments" element={<Navigate to="/branch/payments" replace />} />
                <Route path="/branch/workspace/reports" element={<Navigate to="/branch/reports" replace />} />
                <Route path="/branch/workspace/accounting" element={<Navigate to="/branch" replace />} />
                <Route path="/branch/accounting" element={<Navigate to="/branch" replace />} />
              </Route>

              <Route element={<ProtectedRoute roles={['CUSTOMER']} />}>
                <Route element={<LazyDashboardLayout role="CUSTOMER" />}>
                  <Route path="/customer" element={<DashWrap><CustomerDashboard /></DashWrap>} />
                  <Route path="/customer/orders" element={<DashWrap><CustomerOrders /></DashWrap>} />
                  <Route path="/customer/bookings" element={<DashWrap><CustomerBookings /></DashWrap>} />
                  <Route path="/customer/profile" element={<DashWrap><CustomerProfile /></DashWrap>} />
                </Route>
              </Route>

              <Route path="/unauthorized" element={<PublicWrap><UnauthorizedPage /></PublicWrap>} />
              <Route path="*" element={<PublicWrap><NotFoundPage /></PublicWrap>} />
              </Routes>
            </BrowserRouter>
          </ToastProvider>
        </CartProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
