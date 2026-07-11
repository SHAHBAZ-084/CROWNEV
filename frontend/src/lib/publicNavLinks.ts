export type PublicNavLinkItem = {
  to: string;
  label: string;
  shortLabel?: string;
};

export const PUBLIC_NAV_LINKS: PublicNavLinkItem[] = [
  { to: '/', label: 'Home' },
  { to: '/shop', label: 'Shop' },
  { to: '/compare', label: 'Compare Models', shortLabel: 'Compare' },
  { to: '/search-parts-by-model', label: 'Parts by Model', shortLabel: 'Parts' },
  { to: '/book-service', label: 'Book Service', shortLabel: 'Service' },
  { to: '/about', label: 'About' },
  { to: '/contact', label: 'Contact' },
];

export function isPublicNavLinkActive(pathname: string, to: string): boolean {
  if (to === '/') return pathname === '/';
  if (to === '/shop') return pathname === '/shop' || pathname.startsWith('/shop/');
  return pathname === to || pathname.startsWith(`${to}/`);
}
