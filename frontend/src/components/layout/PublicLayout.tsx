import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Menu, ShoppingBag, X, Zap } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useCart } from '../../contexts/CartContext';
import { publicApi } from '../../api/client';
import { FOOTER_CONTACT } from '../../lib/placeholders';
import { CartDrawer } from '../cart/CartDrawer';
import { Button } from '../ui/Button';

const publicLinks = [
  { to: '/shop', label: 'Shop' },
  { to: '/book-service', label: 'Book Service' },
  { to: '/track', label: 'Track Order' },
  { to: '/about', label: 'About' },
  { to: '/contact', label: 'Contact' },
];

export function PublicNavbar() {
  const { user, logout } = useAuth();
  const { count } = useCart();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [location.pathname]);

  const dashLink =
    user?.role === 'ADMIN' ? '/admin' :
    user?.role === 'BRANCH_OWNER' ? '/branch' :
    user?.role === 'CUSTOMER' ? '/customer' : null;

  return (
    <>
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${
          scrolled ? 'bg-white/92 backdrop-blur-md shadow-sm border-b border-border' : 'bg-white/80 backdrop-blur-sm'
        }`}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 lg:px-8">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand">
              <Zap className="h-5 w-5 text-accent-soft" />
            </div>
            <span className="font-display text-lg font-bold text-brand">Crown Eve</span>
          </Link>

          <nav className="hidden items-center gap-8 lg:flex">
            {publicLinks.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                className={`text-sm font-medium transition-colors hover:text-accent ${location.pathname === l.to ? 'text-accent' : 'text-text-muted'}`}
              >
                {l.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setCartOpen(true)} className="relative rounded-xl p-2 hover:bg-surface-alt">
              <ShoppingBag className="h-5 w-5 text-brand" />
              {count > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-white">
                  {count}
                </span>
              )}
            </button>

            {user ? (
              <div className="hidden items-center gap-3 sm:flex">
                {dashLink && (
                  <Link to={dashLink}>
                    <Button variant="secondary" size="sm">Dashboard</Button>
                  </Link>
                )}
                <button type="button" onClick={logout} className="text-sm text-text-muted hover:text-brand">
                  Logout
                </button>
              </div>
            ) : (
              <div className="hidden items-center gap-2 sm:flex">
                <Link to="/login"><Button variant="ghost" size="sm">Login</Button></Link>
                <Link to="/register"><Button variant="accent" size="sm">Register</Button></Link>
              </div>
            )}

            <button type="button" className="lg:hidden rounded-xl p-2" onClick={() => setMobileOpen(!mobileOpen)}>
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {mobileOpen && (
          <motion.nav
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="border-t border-border bg-white px-4 py-4 lg:hidden"
          >
            {publicLinks.map((l) => (
              <Link key={l.to} to={l.to} className="block py-2 text-sm font-medium text-text-muted hover:text-accent">{l.label}</Link>
            ))}
            {!user && (
              <div className="mt-4 flex gap-2">
                <Link to="/login" className="flex-1"><Button variant="secondary" size="sm" className="w-full">Login</Button></Link>
                <Link to="/register" className="flex-1"><Button variant="accent" size="sm" className="w-full">Register</Button></Link>
              </div>
            )}
          </motion.nav>
        )}
      </motion.header>

      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
    </>
  );
}

function SocialIcon({ href, label, children }: { href: string; label: string; children: React.ReactNode }) {
  return (
    <a href={href} aria-label={label} className="flex h-9 w-9 items-center justify-center rounded-full bg-white border border-border text-xs font-bold text-brand hover:bg-accent hover:text-white hover:border-accent transition-colors">
      {children}
    </a>
  );
}

export function PublicFooter() {
  const [branchCount, setBranchCount] = useState(0);

  useEffect(() => {
    publicApi.branches().then((b) => setBranchCount(b.length)).catch(() => {});
  }, []);

  return (
    <footer className="border-t border-border bg-surface-alt">
      <div className="mx-auto max-w-7xl px-4 py-16 lg:px-8 lg:py-20">
        <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand">
                <Zap className="h-4 w-4 text-accent-soft" />
              </div>
              <p className="font-display text-lg font-bold text-brand">Crown Eve Bikes</p>
            </div>
            <p className="mt-3 text-sm text-text-muted leading-relaxed">Pakistan&apos;s premium electric mobility platform — ride the future, branch by branch.</p>
            <div className="mt-4 flex gap-2">
              <SocialIcon href="https://facebook.com" label="Facebook">FB</SocialIcon>
              <SocialIcon href="https://instagram.com" label="Instagram">IG</SocialIcon>
              <SocialIcon href="https://youtube.com" label="YouTube">YT</SocialIcon>
              <SocialIcon href="https://tiktok.com" label="TikTok">TT</SocialIcon>
            </div>
          </div>
          <div>
            <p className="font-semibold text-brand">Quick Links</p>
            <ul className="mt-3 space-y-2 text-sm text-text-muted">
              <li><Link to="/about" className="hover:text-accent transition-colors">About Us</Link></li>
              <li><Link to="/contact" className="hover:text-accent transition-colors">Contact Us</Link></li>
              <li><Link to="/shop" className="hover:text-accent transition-colors">Shop</Link></li>
              <li><Link to="/track" className="hover:text-accent transition-colors">Track Order</Link></li>
            </ul>
          </div>
          <div>
            <p className="font-semibold text-brand">Legal</p>
            <ul className="mt-3 space-y-2 text-sm text-text-muted">
              <li><Link to="/privacy" className="hover:text-accent transition-colors">Privacy Policy</Link></li>
              <li><Link to="/terms" className="hover:text-accent transition-colors">Terms &amp; Conditions</Link></li>
              <li><Link to="/faq" className="hover:text-accent transition-colors">FAQ</Link></li>
            </ul>
          </div>
          <div>
            <p className="font-semibold text-brand">Contact</p>
            <ul className="mt-3 space-y-2 text-sm text-text-muted">
              <li><a href={`mailto:${FOOTER_CONTACT.email}`} className="hover:text-accent">{FOOTER_CONTACT.email}</a></li>
              <li><a href={`tel:${FOOTER_CONTACT.phone.replace(/\s/g, '')}`} className="hover:text-accent">{FOOTER_CONTACT.phone}</a></li>
              <li>{FOOTER_CONTACT.address}</li>
            </ul>
          </div>
        </div>
        <div className="mt-12 flex flex-col items-center justify-between gap-2 border-t border-border pt-8 text-center text-sm text-text-muted sm:flex-row sm:text-left">
          <p>© {new Date().getFullYear()} Crown Eve Bikes. All prices in PKR.</p>
          {branchCount > 0 && (
            <p>{branchCount} branch{branchCount !== 1 ? 'es' : ''} across Pakistan</p>
          )}
        </div>
      </div>
    </footer>
  );
}

export function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <PublicNavbar />
      <main className="flex-1 pt-[72px]">{children}</main>
      <PublicFooter />
    </div>
  );
}
