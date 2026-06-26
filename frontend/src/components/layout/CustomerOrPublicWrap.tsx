import { lazy, Suspense } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { PublicLayout } from './PublicLayout';
import { PageTransition } from './PageTransition';
import { ErrorBoundary } from '../ErrorBoundary';
import { ProductGridSkeleton } from '../ui/Skeleton';

const DashboardLayout = lazy(() =>
  import('./DashboardLayout').then((m) => ({ default: m.DashboardLayout })),
);

function PageSuspense({ children }: { children: React.ReactNode }) {
  return (
    <PageTransition>
      <ErrorBoundary scope="Page">{children}</ErrorBoundary>
    </PageTransition>
  );
}

export function CustomerOrPublicWrap({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null;
  const resolvingAuth = Boolean(token && loading && !user);

  if (resolvingAuth) {
    return (
      <div className="min-h-screen bg-surface p-8">
        <ProductGridSkeleton count={4} />
      </div>
    );
  }

  if (user?.role === 'CUSTOMER') {
    return (
      <Suspense fallback={<div className="min-h-screen bg-surface p-8"><ProductGridSkeleton count={4} /></div>}>
        <DashboardLayout role="CUSTOMER">
          <Suspense fallback={<div className="p-4"><ProductGridSkeleton count={4} /></div>}>
            <PageSuspense>{children}</PageSuspense>
          </Suspense>
        </DashboardLayout>
      </Suspense>
    );
  }

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
