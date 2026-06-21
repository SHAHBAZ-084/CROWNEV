import { lazy, Suspense } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { CartProvider } from './contexts/CartContext';
import { ToastProvider } from './contexts/ToastContext';
import { PublicLayout } from './components/layout/PublicLayout';
import { DashboardLayout } from './components/layout/DashboardLayout';
import { PageTransition, PageSuspense } from './components/layout/PageTransition';
import { ProtectedRoute, GuestRoute } from './components/ProtectedRoute';
import { ProductGridSkeleton } from './components/ui/Skeleton';

const lazyNamed = (loader: () => Promise<Record<string, unknown>>, name: string) =>
  lazy(() => loader().then((m) => ({ default: m[name] as React.ComponentType })));

const LandingPage = lazy(() => import('./pages/public/LandingPage'));
const ShopPage = lazy(() => import('./pages/public/ShopPage'));
const ProductDetailPage = lazy(() => import('./pages/public/ProductDetailPage'));
const LoginPage = lazy(() => import('./pages/public/LoginPage'));
const RegisterPage = lazy(() => import('./pages/public/RegisterPage'));
const ForgotPasswordPage = lazy(() => import('./pages/public/ForgotPasswordPage'));
const TrackOrderPage = lazy(() => import('./pages/public/TrackOrderPage'));
const ContactPage = lazy(() => import('./pages/public/ContactPage'));
const CheckoutPage = lazy(() => import('./pages/public/CheckoutPage'));
const BookServicePage = lazy(() => import('./pages/public/BookServicePage'));
const AboutPage = lazyNamed(() => import('./pages/public/StaticPages'), 'AboutPage');
const PrivacyPage = lazyNamed(() => import('./pages/public/StaticPages'), 'PrivacyPage');
const TermsPage = lazyNamed(() => import('./pages/public/StaticPages'), 'TermsPage');
const FAQPage = lazyNamed(() => import('./pages/public/StaticPages'), 'FAQPage');
const NotFoundPage = lazyNamed(() => import('./pages/public/StaticPages'), 'NotFoundPage');
const UnauthorizedPage = lazyNamed(() => import('./pages/public/StaticPages'), 'UnauthorizedPage');

const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const AdminBranches = lazyNamed(() => import('./pages/admin/AdminPages'), 'AdminBranchesPage');
const AdminProducts = lazyNamed(() => import('./pages/admin/AdminPages'), 'AdminProductsPage');
const AdminParts = lazyNamed(() => import('./pages/admin/AdminPages'), 'AdminPartsPage');
const AdminOrders = lazyNamed(() => import('./pages/admin/AdminPages'), 'AdminOrdersPage');
const AdminBookings = lazyNamed(() => import('./pages/admin/AdminPages'), 'AdminBookingsPage');
const AdminUsers = lazyNamed(() => import('./pages/admin/AdminPages'), 'AdminUsersPage');
const AdminPayments = lazyNamed(() => import('./pages/admin/AdminPages'), 'AdminPaymentsPage');
const AdminReports = lazyNamed(() => import('./pages/admin/AdminPages'), 'AdminReportsPage');
const AdminTestimonials = lazyNamed(() => import('./pages/admin/AdminPages'), 'AdminTestimonialsPage');

const BranchDashboard = lazy(() => import('./pages/branch/BranchDashboard'));
const BranchPOS = lazyNamed(() => import('./pages/branch/BranchPages'), 'BranchPOSPage');
const BranchOrders = lazyNamed(() => import('./pages/branch/BranchPages'), 'BranchOrdersPage');
const BranchInventory = lazyNamed(() => import('./pages/branch/BranchPages'), 'BranchInventoryPage');
const BranchBookings = lazyNamed(() => import('./pages/branch/BranchPages'), 'BranchBookingsPage');
const BranchServices = lazyNamed(() => import('./pages/branch/BranchPages'), 'BranchServicesPage');
const BranchAccounting = lazyNamed(() => import('./pages/branch/BranchPages'), 'BranchAccountingPage');
const BranchReports = lazyNamed(() => import('./pages/branch/BranchPages'), 'BranchReportsPage');
const BranchSuppliers = lazyNamed(() => import('./pages/branch/BranchPages'), 'BranchSuppliersPage');
const BranchPurchases = lazyNamed(() => import('./pages/branch/BranchPages'), 'BranchPurchasesPage');
const BranchPayments = lazyNamed(() => import('./pages/branch/BranchPages'), 'BranchPaymentsPage');

const CustomerDashboard = lazyNamed(() => import('./pages/customer/CustomerPages'), 'CustomerDashboard');
const CustomerOrders = lazyNamed(() => import('./pages/customer/CustomerPages'), 'CustomerOrdersPage');
const CustomerBookings = lazyNamed(() => import('./pages/customer/CustomerPages'), 'CustomerBookingsPage');
const CustomerProfile = lazyNamed(() => import('./pages/customer/CustomerPages'), 'CustomerProfilePage');

function PublicWrap({ children }: { children: React.ReactNode }) {
  return (
    <PublicLayout>
      <PageTransition>
        <Suspense fallback={<div className="p-8"><ProductGridSkeleton count={4} /></div>}>
          {children}
        </Suspense>
      </PageTransition>
    </PublicLayout>
  );
}

function DashWrap({ children }: { children: React.ReactNode }) {
  return (
    <PageSuspense>
      <PageTransition>{children}</PageTransition>
    </PageSuspense>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <ToastProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<PublicWrap><LandingPage /></PublicWrap>} />
              <Route path="/shop" element={<PublicWrap><ShopPage /></PublicWrap>} />
              <Route path="/shop/:id" element={<PublicWrap><ProductDetailPage /></PublicWrap>} />
              <Route path="/track" element={<PublicWrap><TrackOrderPage /></PublicWrap>} />
              <Route path="/contact" element={<PublicWrap><ContactPage /></PublicWrap>} />
              <Route path="/about" element={<PublicWrap><AboutPage /></PublicWrap>} />
              <Route path="/privacy" element={<PublicWrap><PrivacyPage /></PublicWrap>} />
              <Route path="/terms" element={<PublicWrap><TermsPage /></PublicWrap>} />
              <Route path="/faq" element={<PublicWrap><FAQPage /></PublicWrap>} />
              <Route path="/book-service" element={<PublicWrap><BookServicePage /></PublicWrap>} />
              <Route path="/checkout" element={<PublicWrap><CheckoutPage /></PublicWrap>} />

              <Route element={<GuestRoute />}>
                <Route path="/login" element={<PublicWrap><LoginPage /></PublicWrap>} />
                <Route path="/register" element={<PublicWrap><RegisterPage /></PublicWrap>} />
                <Route path="/forgot-password" element={<PublicWrap><ForgotPasswordPage /></PublicWrap>} />
              </Route>

              <Route element={<ProtectedRoute roles={['ADMIN']} />}>
                <Route element={<DashboardLayout role="ADMIN" />}>
                  <Route path="/admin" element={<DashWrap><AdminDashboard /></DashWrap>} />
                  <Route path="/admin/branches" element={<DashWrap><AdminBranches /></DashWrap>} />
                  <Route path="/admin/products" element={<DashWrap><AdminProducts /></DashWrap>} />
                  <Route path="/admin/parts" element={<DashWrap><AdminParts /></DashWrap>} />
                  <Route path="/admin/orders" element={<DashWrap><AdminOrders /></DashWrap>} />
                  <Route path="/admin/bookings" element={<DashWrap><AdminBookings /></DashWrap>} />
                  <Route path="/admin/users" element={<DashWrap><AdminUsers /></DashWrap>} />
                  <Route path="/admin/payments" element={<DashWrap><AdminPayments /></DashWrap>} />
                  <Route path="/admin/testimonials" element={<DashWrap><AdminTestimonials /></DashWrap>} />
                  <Route path="/admin/reports" element={<DashWrap><AdminReports /></DashWrap>} />
                </Route>
              </Route>

              <Route element={<ProtectedRoute roles={['BRANCH_OWNER']} />}>
                <Route element={<DashboardLayout role="BRANCH_OWNER" />}>
                  <Route path="/branch" element={<DashWrap><BranchDashboard /></DashWrap>} />
                  <Route path="/branch/pos" element={<DashWrap><BranchPOS /></DashWrap>} />
                  <Route path="/branch/orders" element={<DashWrap><BranchOrders /></DashWrap>} />
                  <Route path="/branch/inventory" element={<DashWrap><BranchInventory /></DashWrap>} />
                  <Route path="/branch/bookings" element={<DashWrap><BranchBookings /></DashWrap>} />
                  <Route path="/branch/services" element={<DashWrap><BranchServices /></DashWrap>} />
                  <Route path="/branch/suppliers" element={<DashWrap><BranchSuppliers /></DashWrap>} />
                  <Route path="/branch/purchases" element={<DashWrap><BranchPurchases /></DashWrap>} />
                  <Route path="/branch/payments" element={<DashWrap><BranchPayments /></DashWrap>} />
                  <Route path="/branch/accounting" element={<DashWrap><BranchAccounting /></DashWrap>} />
                  <Route path="/branch/reports" element={<DashWrap><BranchReports /></DashWrap>} />
                </Route>
              </Route>

              <Route element={<ProtectedRoute roles={['CUSTOMER']} />}>
                <Route element={<DashboardLayout role="CUSTOMER" />}>
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
  );
}
