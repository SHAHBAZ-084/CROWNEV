import { Suspense } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { DashboardLayout } from './DashboardLayout';
import { PublicLayout } from './PublicLayout';
import { PageTransition } from './PageTransition';
import { ErrorBoundary } from '../ErrorBoundary';
import { ProductGridSkeleton } from '../ui/Skeleton';

function PageSuspense({ children }: { children: React.ReactNode }) {
  return (
    <PageTransition>
      <ErrorBoundary scope="Page">{children}</ErrorBoundary>
    </PageTransition>
  );
}

export function CustomerOrPublicWrap({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-surface p-8">
        <ProductGridSkeleton count={4} />
      </div>
    );
  }

  if (user?.role === 'CUSTOMER') {
    return (
      <DashboardLayout role="CUSTOMER">
        <Suspense fallback={<div className="p-4"><ProductGridSkeleton count={4} /></div>}>
          <PageSuspense>{children}</PageSuspense>
        </Suspense>
      </DashboardLayout>
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
