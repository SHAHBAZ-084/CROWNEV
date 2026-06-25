import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { WhatsAppFloat } from '../public/WhatsAppFloat';
import { scrollToHash } from '../../lib/scrollToHash';
import { PublicFooter, ScrollToTop } from './PublicFooter';
import { PublicNavbar } from './PublicNavbar';

export { PublicNavbar, PublicFooter, ScrollToTop };

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
      <main className={`flex-1 ${isHome ? 'pt-0' : 'pt-[4.75rem] lg:pt-24'}`}>{children}</main>
      <PublicFooter />
      <WhatsAppFloat />
      <ScrollToTop />
    </div>
  );
}
