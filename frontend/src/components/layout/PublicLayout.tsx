import { type ComponentType, type ReactNode, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Menu, ShoppingCart, X, Mail, Phone, MapPin, ArrowUpRight, Calendar, ChevronUp } from 'lucide-react';
import { Logo } from '../brand/Logo';
import { FacebookIcon, InstagramIcon, TikTokIcon, WhatsAppIcon, YoutubeIcon } from '../icons/BrandIcons';
import { useAuth } from '../../contexts/AuthContext';
import { useCart } from '../../contexts/CartContext';
import { FOOTER_CONTACT } from '../../lib/placeholders';
import { CartDrawer } from '../cart/CartDrawer';
import { WhatsAppFloat } from '../public/WhatsAppFloat';
import { Button } from '../ui/Button';

const publicLinks = [
  { to: '/', label: 'Home' },
  { to: '/shop', label: 'Shop' },
  { to: '/book-service', label: 'Book Service' },
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

  const isHome = location.pathname === '/';
  const transparentNav = isHome && !scrolled;

  return (
    <>
      <motion.header
        initial={false}
        animate={{ y: 0, opacity: 1 }}
        className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${
          transparentNav
            ? 'border-b border-transparent bg-transparent'
            : 'border-b border-border/80 bg-surface-alt/95 shadow-sm backdrop-blur-md'
        }`}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-2 sm:py-3 lg:px-8">
          <Logo size="sm" linked className={transparentNav ? 'drop-shadow-md' : ''} />

          <nav className="hidden items-center gap-8 lg:flex">
            {publicLinks.map((l) => {
              const active = l.to === '/' ? location.pathname === '/' : location.pathname === l.to;
              return (
              <Link
                key={l.to}
                to={l.to}
                className={`text-sm font-medium transition-colors ${
                  transparentNav
                    ? active
                      ? 'text-brand drop-shadow-sm'
                      : 'text-white/90 drop-shadow-sm hover:text-brand-light'
                    : active
                      ? 'text-brand'
                      : 'text-white hover:text-brand-light'
                }`}
              >
                {l.label}
              </Link>
            );
            })}
          </nav>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setCartOpen(true)}
              aria-label={count > 0 ? `Open cart, ${count} items` : 'Open cart'}
              className={`relative flex min-h-11 min-w-11 items-center justify-center rounded-full transition-colors ${
                transparentNav
                  ? 'bg-white/15 text-white hover:bg-brand/25 hover:text-brand-light'
                  : 'bg-white/10 text-white hover:bg-brand/20 hover:text-brand-light'
              }`}
            >
              <ShoppingCart className="h-5 w-5" strokeWidth={2} aria-hidden />
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
                <button type="button" onClick={logout} className="text-sm text-white hover:text-brand-light">
                  Logout
                </button>
              </div>
            ) : (
              <div className="hidden items-center gap-2 sm:flex">
                <Link to="/login">
                  <Button
                    variant="ghost"
                    size="sm"
                    className={transparentNav ? 'text-white/90 hover:text-brand-light hover:bg-brand/10' : 'text-white hover:text-brand-light'}
                  >
                    Login
                  </Button>
                </Link>
                <Link to="/register"><Button variant="accent" size="sm">Register</Button></Link>
              </div>
            )}

            <button
              type="button"
              className={`min-h-11 min-w-11 rounded-xl p-2.5 transition-colors lg:hidden ${
                transparentNav ? 'text-white hover:text-brand-light' : 'text-white hover:text-brand-light'
              }`}
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}
            </button>
          </div>
        </div>

        {mobileOpen && (
          <motion.nav
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="border-t border-border bg-surface-alt px-4 py-4 lg:hidden"
          >
            {publicLinks.map((l) => (
              <Link key={l.to} to={l.to} className="block py-2 text-sm font-medium text-white hover:text-brand-light">{l.label}</Link>
            ))}
            {user ? (
              <div className="mt-4 space-y-2 border-t border-border pt-4">
                {dashLink && (
                  <Link to={dashLink} className="block">
                    <Button variant="secondary" size="sm" className="w-full">Dashboard</Button>
                  </Link>
                )}
                <button
                  type="button"
                  onClick={logout}
                  className="w-full rounded-lg border border-border py-2 text-sm font-medium text-white hover:bg-surface hover:text-brand-light"
                >
                  Logout
                </button>
              </div>
            ) : (
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

function SocialIcon({
  href,
  label,
  icon: Icon,
}: {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className="flex h-9 w-9 items-center justify-center rounded-full border border-border/70 bg-surface-alt text-text-muted shadow-sm transition-all hover:-translate-y-0.5 hover:border-accent hover:bg-accent hover:text-white hover:shadow-md"
    >
      <Icon className="h-4 w-4" />
    </a>
  );
}

function FooterContactIcon({ children }: { children: ReactNode }) {
  return (
    <span
      className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent transition-colors group-hover:bg-accent group-hover:text-white"
    >
      {children}
    </span>
  );
}

function FooterLink({ to, label }: { to: string; label: string }) {
  return (
    <li>
      <Link
        to={to}
        className="group inline-flex items-center gap-1.5 text-sm text-white transition-colors hover:text-brand-light"
      >
        <span>{label}</span>
        <ArrowUpRight className="h-3.5 w-3.5 opacity-0 transition-all group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
      </Link>
    </li>
  );
}

export function PublicFooter() {
  const { pathname } = useLocation();
  const isHome = pathname === '/';

  return (
    <footer className="relative overflow-hidden border-t border-border bg-surface-alt">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgb(249_115_22_/_6%)_0%,_transparent_50%)]" />

      {isHome && (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative border-b border-border bg-gradient-to-r from-brand via-brand-light to-accent"
      >
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-4 py-10 lg:flex-row lg:px-8">
          <div className="text-center lg:text-left">
            <p className="font-display text-xl font-bold text-white lg:text-2xl">Ready to ride electric?</p>
            <p className="mt-1 text-sm text-white/85">Browse bikes, book a service, or visit your nearest branch.</p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link to="/shop">
              <Button variant="secondary" size="sm" className="border-white bg-white font-semibold text-brand hover:bg-white/90 hover:text-brand">
                <ShoppingCart className="h-4 w-4" /> Shop Now
              </Button>
            </Link>
            <Link to="/book-service">
              <Button variant="ghost" size="sm" className="border border-white/40 text-white hover:bg-white/10">
                <Calendar className="h-4 w-4" /> Book Service
              </Button>
            </Link>
          </div>
        </div>
      </motion.div>
      )}

      <div className="relative mx-auto max-w-7xl px-4 pb-4 pt-14 lg:px-8 lg:pt-16 lg:pb-5">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-12 lg:gap-8">
          <div className="lg:col-span-4">
            <Logo size="lg" linked />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-white">
              Pakistan&apos;s premium electric mobility platform. Ride the future, branch by branch.
            </p>
            <div className="mt-5 flex gap-2.5">
              <SocialIcon href="https://facebook.com" label="Facebook" icon={FacebookIcon} />
              <SocialIcon href="https://instagram.com" label="Instagram" icon={InstagramIcon} />
              <SocialIcon href="https://youtube.com" label="YouTube" icon={YoutubeIcon} />
              <SocialIcon href="https://tiktok.com" label="TikTok" icon={TikTokIcon} />
            </div>
          </div>

          <div className="lg:col-span-2 lg:col-start-6">
            <p className="font-display text-sm font-semibold uppercase tracking-wide text-text-muted">Quick Links</p>
            <ul className="mt-4 space-y-3">
              <FooterLink to="/about" label="About Us" />
              <FooterLink to="/contact" label="Contact Us" />
              <FooterLink to="/shop" label="Shop" />
              <FooterLink to="/book-service" label="Book Service" />
            </ul>
          </div>

          <div className="lg:col-span-2">
            <p className="font-display text-sm font-semibold uppercase tracking-wide text-text-muted">Legal</p>
            <ul className="mt-4 space-y-3">
              <FooterLink to="/privacy" label="Privacy Policy" />
              <FooterLink to="/terms" label="Terms & Conditions" />
              <FooterLink to="/faq" label="FAQ" />
            </ul>
          </div>

          <div className="lg:col-span-3">
            <p className="font-display text-sm font-semibold uppercase tracking-wide text-text-muted">Contact</p>
            <ul className="mt-4 space-y-3.5">
              <li>
                <a
                  href={`mailto:${FOOTER_CONTACT.email}`}
                  className="group flex items-start gap-3 text-sm text-white transition-colors hover:text-brand-light"
                >
                  <FooterContactIcon>
                    <Mail className="h-4 w-4" strokeWidth={2} />
                  </FooterContactIcon>
                  <span className="pt-1.5 leading-snug">{FOOTER_CONTACT.email}</span>
                </a>
              </li>
              <li>
                <a
                  href={`tel:${FOOTER_CONTACT.phone.replace(/\s/g, '')}`}
                  className="group flex items-start gap-3 text-sm text-white transition-colors hover:text-brand-light"
                >
                  <FooterContactIcon>
                    <Phone className="h-4 w-4" strokeWidth={2} />
                  </FooterContactIcon>
                  <span className="pt-1.5 leading-snug">{FOOTER_CONTACT.phone}</span>
                </a>
              </li>
              <li>
                <a
                  href={`https://wa.me/${FOOTER_CONTACT.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(FOOTER_CONTACT.whatsappMessage)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-start gap-3 text-sm text-white transition-colors hover:text-brand-light"
                >
                  <FooterContactIcon>
                    <WhatsAppIcon className="h-4 w-4" />
                  </FooterContactIcon>
                  <span className="pt-1.5 leading-snug">WhatsApp: {FOOTER_CONTACT.phone}</span>
                </a>
              </li>
              <li className="flex items-start gap-3 text-sm text-white">
                <FooterContactIcon>
                  <MapPin className="h-4 w-4" strokeWidth={2} />
                </FooterContactIcon>
                <span className="pt-1.5 leading-relaxed">{FOOTER_CONTACT.address}</span>
              </li>
            </ul>
          </div>
        </div>

        <p className="mt-8 border-t border-border pt-3 text-center text-[11px] text-white/90">
          © {new Date().getFullYear()} All rights reserved @ Crown Ev Center
        </p>
      </div>
    </footer>
  );
}

export function ScrollToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 320);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (!visible) return null;

  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.85 }}
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label="Scroll to top"
      className="fixed bottom-5 left-5 z-50 flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface-alt text-accent shadow-[var(--shadow-card)] transition-colors hover:border-accent hover:bg-accent hover:text-white sm:bottom-5 sm:left-auto sm:right-5"
    >
      <ChevronUp className="h-5 w-5" />
    </motion.button>
  );
}

export function PublicLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const isHome = location.pathname === '/';

  return (
    <div className="min-h-screen flex flex-col bg-surface">
      <PublicNavbar />
      <main className={`flex-1 ${isHome ? 'pt-0' : 'pt-20 lg:pt-24'}`}>{children}</main>
      <PublicFooter />
      <WhatsAppFloat />
      <ScrollToTop />
    </div>
  );
}
