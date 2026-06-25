/** Shared orange hover tokens for the public navbar */
export const navbarHoverText = 'hover:text-brand';
export const navbarHoverSurface = 'hover:bg-brand/15';

const NAV_LINK_BASE =
  'text-sm font-medium no-underline outline-none transition-colors duration-200 focus:outline-none focus-visible:outline-none';

export function publicNavLinkClass(
  variant: 'desktop' | 'mobile',
  transparentNav = false,
  active = false,
) {
  const layout =
    variant === 'desktop'
      ? 'shrink-0 rounded-lg px-2.5 py-1.5'
      : 'block rounded-lg px-3 py-2.5';

  const textColor = active ? 'text-brand font-semibold' : variant === 'desktop' ? 'text-white/90' : 'text-white';
  const shadow = variant === 'desktop' && transparentNav ? 'drop-shadow-sm' : '';

  return [NAV_LINK_BASE, textColor, navbarHoverText, navbarHoverSurface, layout, shadow].join(' ');
}

export function navbarCartButtonClass(transparentNav: boolean) {
  return [
    'relative flex h-10 w-10 items-center justify-center rounded-full transition-colors duration-200',
    navbarHoverText,
    transparentNav
      ? 'bg-white/15 text-white hover:bg-brand/25'
      : 'border border-white/10 bg-white/10 text-white hover:border-brand/40 hover:bg-brand/25',
  ].join(' ');
}

export function navbarTextActionClass() {
  return `text-sm text-white/90 transition-colors duration-200 ${navbarHoverText}`;
}

export function navbarMenuToggleClass() {
  return [
    'flex h-10 w-10 items-center justify-center rounded-lg text-white transition-colors duration-200',
    navbarHoverText,
    navbarHoverSurface,
  ].join(' ');
}

export function navbarGhostButtonClass() {
  return `${navbarHoverText} ${navbarHoverSurface}`;
}
