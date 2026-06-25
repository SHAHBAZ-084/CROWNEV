import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Menu, ShoppingCart, X } from 'lucide-react';
import type { User } from '../../types';
import { Logo } from '../brand/Logo';
import { useAuth } from '../../contexts/AuthContext';
import { useCart } from '../../contexts/CartContext';
import { defaultDashboardForRole } from '../../lib/authRedirect';
import { PUBLIC_NAV_LINKS, isPublicNavLinkActive, type PublicNavLinkItem } from '../../lib/publicNavLinks';
import { publicNavLinkClass, navbarCartButtonClass, navbarGhostButtonClass, navbarMenuToggleClass, navbarTextActionClass } from '../../lib/publicNavStyles';
import { useScrollPast } from '../../hooks/useScrollPast';
import { CartDrawer } from '../cart/CartDrawer';
import { Button } from '../ui/Button';

function PublicNavLink({
  link,
  variant,
  transparentNav,
  active,
  onNavigate,
}: {
  link: PublicNavLinkItem;
  variant: 'desktop' | 'mobile';
  transparentNav: boolean;
  active: boolean;
  onNavigate?: () => void;
}) {
  const { to, label, shortLabel } = link;

  return (
    <Link
      to={to}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={publicNavLinkClass(variant, transparentNav, active)}
    >
      {shortLabel && variant === 'desktop' ? (
        <>
          <span className="xl:hidden">{shortLabel}</span>
          <span className="hidden xl:inline">{label}</span>
        </>
      ) : (
        label
      )}
    </Link>
  );
}

function NavbarCartButton({
  count,
  transparentNav,
  onOpen,
}: {
  count: number;
  transparentNav: boolean;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={count > 0 ? `Open cart, ${count} items` : 'Open cart'}
      className={navbarCartButtonClass(transparentNav)}
    >
      <ShoppingCart className="h-[1.125rem] w-[1.125rem]" strokeWidth={2} aria-hidden />
      {count > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-white">
          {count}
        </span>
      )}
    </button>
  );
}

function NavbarAuthActions({
  variant,
  transparentNav,
  user,
  onLogout,
}: {
  variant: 'desktop' | 'mobile';
  transparentNav: boolean;
  user: User | null;
  onLogout: () => void;
}) {
  const isDesktop = variant === 'desktop';
  const dashLink = user ? defaultDashboardForRole(user.role) : null;

  if (user) {
    return (
      <div
        className={
          isDesktop
            ? 'hidden items-center gap-2 lg:flex'
            : 'mt-4 space-y-2 border-t border-border pt-4'
        }
      >
        <Link to={dashLink!} className={isDesktop ? undefined : 'block'}>
          <Button variant="secondary" size="sm" className={isDesktop ? undefined : 'w-full'}>
            Dashboard
          </Button>
        </Link>
        <button
          type="button"
          onClick={onLogout}
          className={
            isDesktop
              ? navbarTextActionClass()
              : 'w-full rounded-lg border border-border py-2 text-sm font-medium text-white transition-colors duration-200 hover:bg-brand/15 hover:text-brand'
          }
        >
          Logout
        </button>
      </div>
    );
  }

  return (
    <div className={isDesktop ? 'hidden items-center gap-2 lg:flex' : 'mt-4 flex gap-2'}>
      <Link to="/login" className={isDesktop ? undefined : 'flex-1'}>
        <Button
          variant={isDesktop ? 'ghost' : 'secondary'}
          size="sm"
          className={
            isDesktop
              ? `text-white/90 ${navbarGhostButtonClass()}`
              : 'w-full'
          }
        >
          Login
        </Button>
      </Link>
      <Link to="/register" className={isDesktop ? undefined : 'flex-1'}>
        <Button variant="accent" size="sm" className={isDesktop ? 'hover:bg-brand-light' : 'w-full'}>
          Register
        </Button>
      </Link>
    </div>
  );
}

export function PublicNavbar() {
  const { user, logout } = useAuth();
  const { count } = useCart();
  const location = useLocation();
  const scrolled = useScrollPast(20);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
    if (!location.hash) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [location.pathname, location.hash]);

  const transparentNav = location.pathname === '/' && !scrolled;

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
        <div className="mx-auto flex h-[4.25rem] max-w-7xl items-center gap-3 px-4 lg:h-20 lg:gap-4 lg:px-8">
          <div className="shrink-0">
            <Logo size="nav" linked className={transparentNav ? 'drop-shadow-md' : ''} />
          </div>

          <nav
            className="hidden min-w-0 flex-1 items-center justify-center gap-5 lg:flex xl:gap-7"
            aria-label="Main navigation"
          >
            {PUBLIC_NAV_LINKS.map((link) => (
              <PublicNavLink
                key={link.to}
                link={link}
                variant="desktop"
                transparentNav={transparentNav}
                active={isPublicNavLinkActive(location.pathname, link.to)}
              />
            ))}
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-2.5">
            <NavbarCartButton
              count={count}
              transparentNav={transparentNav}
              onOpen={() => setCartOpen(true)}
            />

            <NavbarAuthActions
              variant="desktop"
              transparentNav={transparentNav}
              user={user}
              onLogout={logout}
            />

            <button
              type="button"
              className={`${navbarMenuToggleClass()} lg:hidden`}
              onClick={() => setMobileOpen((open) => !open)}
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
            exit={{ opacity: 0, height: 0 }}
            className="border-t border-border/80 bg-surface-alt px-4 py-3 lg:hidden"
            aria-label="Mobile navigation"
          >
            {PUBLIC_NAV_LINKS.map((link) => (
              <PublicNavLink
                key={link.to}
                link={link}
                variant="mobile"
                transparentNav={false}
                active={isPublicNavLinkActive(location.pathname, link.to)}
                onNavigate={() => setMobileOpen(false)}
              />
            ))}
            <NavbarAuthActions
              variant="mobile"
              transparentNav={false}
              user={user}
              onLogout={logout}
            />
          </motion.nav>
        )}
      </motion.header>

      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
    </>
  );
}
