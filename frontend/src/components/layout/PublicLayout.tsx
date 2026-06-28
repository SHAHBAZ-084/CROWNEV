import { lazy, Suspense, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { scrollToHash } from '../../lib/scrollToHash';
import { PublicFooter, ScrollToTop } from './PublicFooter';
import { PublicNavbar } from './PublicNavbar';

export { PublicNavbar, PublicFooter, ScrollToTop };

const LazyWhatsAppFloat = lazy(() =>
  import('../public/WhatsAppFloat').then((m) => ({ default: m.WhatsAppFloat })),
);

export function PublicLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const isHome = location.pathname === '/';

  useEffect(() => {
    if (!location.hash) return;
    return scrollToHash(location.hash);
  }, [location.pathname, location.hash]);

  return (
    <div className="min-h-screen flex flex-col bg-surface">
      <PublicNavbar />
      <main className={`flex-1 ${isHome ? 'pt-0' : 'pt-14 lg:pt-20'}`}>{children}</main>
      <PublicFooter />
      <Suspense fallback={null}>
        <LazyWhatsAppFloat />
      </Suspense>
      <ScrollToTop />
    </div>
  );
}
