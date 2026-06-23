import type { Role } from '../types';

/** Paths only customers may return to after login/register. */
const CUSTOMER_RETURN_PATHS = ['/checkout', '/book-service'];

/** Only allow same-origin relative paths (prevents open redirects). */
export function sanitizeRedirect(path: string | null | undefined): string | null {
  if (!path || !path.startsWith('/') || path.startsWith('//')) return null;
  return path;
}

function isCustomerReturnPath(path: string): boolean {
  if (path === '/customer' || path.startsWith('/customer/')) return true;
  return CUSTOMER_RETURN_PATHS.some((p) => path === p || path.startsWith(`${p}/`));
}

export function getLoginUrl(returnTo: string): string {
  return `/login?redirect=${encodeURIComponent(returnTo)}`;
}

export function getRegisterUrl(returnTo?: string): string {
  const safe = sanitizeRedirect(returnTo);
  if (!safe) return '/register';
  return `/register?redirect=${encodeURIComponent(safe)}`;
}

export function defaultDashboardForRole(role: Role): string {
  if (role === 'ADMIN') return '/admin';
  if (role === 'BRANCH_OWNER') return '/branch';
  return '/customer';
}

export function resolvePostAuthRedirect(
  redirectParam: string | null | undefined,
  role: Role
): string {
  const redirect = sanitizeRedirect(redirectParam);
  if (role === 'CUSTOMER' && redirect && isCustomerReturnPath(redirect)) {
    return redirect;
  }
  if (redirect && role !== 'CUSTOMER' && redirect.startsWith('/customer')) {
    return defaultDashboardForRole(role);
  }
  return defaultDashboardForRole(role);
}
