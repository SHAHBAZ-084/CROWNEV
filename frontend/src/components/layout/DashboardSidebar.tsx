import { Link, NavLink, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { LogOut, X } from 'lucide-react';
import { Logo } from '../brand/Logo';
import type { Role } from '../../types';

export interface SidebarNavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  match?: (pathname: string) => boolean;
}

const roleLabels: Record<Role, string> = {
  ADMIN: 'Head Office',
  BRANCH_OWNER: 'Branch Owner',
  CUSTOMER: 'Customer Account',
};

function navEndPaths(role: Role): string[] {
  if (role === 'ADMIN') return ['/admin'];
  if (role === 'BRANCH_OWNER') return ['/branch'];
  return ['/customer'];
}

function UserAvatar({ name }: { name: string }) {
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-50 text-sm font-bold text-orange-500">
      {initials || '?'}
    </div>
  );
}

function SidebarNavLink({
  item,
  end,
  onNavigate,
}: {
  item: SidebarNavItem;
  end?: boolean;
  onNavigate?: () => void;
}) {
  const location = useLocation();
  const activeClass =
    'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors border-l-2 border-orange-500 bg-slate-200 text-slate-900';
  const inactiveClass =
    'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors text-slate-900 hover:bg-slate-100 hover:text-orange-500';

  const content = (
    <>
      <item.icon className="h-4 w-4 shrink-0 text-orange-500 transition-colors group-hover:text-orange-600" />
      <span className="truncate">{item.label}</span>
    </>
  );

  if (item.match) {
    const isActive = item.match(location.pathname);
    return (
      <Link
        to={item.to}
        onClick={onNavigate}
        aria-current={isActive ? 'page' : undefined}
        className={isActive ? activeClass : inactiveClass}
      >
        {content}
      </Link>
    );
  }

  return (
    <NavLink
      to={item.to}
      end={end}
      onClick={onNavigate}
      className={({ isActive }) => (isActive ? activeClass : inactiveClass)}
    >
      {content}
    </NavLink>
  );
}

export interface SidebarNavSection {
  title?: string;
  items: SidebarNavItem[];
}

type DashboardSidebarProps = {
  nav?: SidebarNavItem[];
  sections?: SidebarNavSection[];
  role: Role;
  userName?: string;
  userEmail?: string;
  userMeta?: string;
  onSignOut: () => void;
  subtitle?: string;
  /** Set false to hide the role badge under the logo */
  showBadge?: boolean;
  footerExtra?: ReactNode;
  /** Override which routes use NavLink `end` (exact match) */
  endPaths?: string[];
  /** Logo link target when linked */
  logoTo?: string;
  mobileOpen?: boolean;
  onNavigate?: () => void;
};

export function DashboardSidebar({
  nav,
  sections,
  role,
  userName,
  userEmail,
  userMeta,
  onSignOut,
  subtitle,
  showBadge = true,
  footerExtra,
  endPaths: endPathsOverride,
  logoTo = '/',
  mobileOpen = false,
  onNavigate,
}: DashboardSidebarProps) {
  const endPaths = endPathsOverride ?? navEndPaths(role);
  const navSections: SidebarNavSection[] = sections ?? [{ items: nav ?? [] }];

  return (
    <aside
      className={`dashboard-sidebar fixed left-0 top-0 z-50 flex h-full w-[17.5rem] flex-col border-r border-slate-200 bg-white transition-transform duration-300 ease-in-out lg:z-30 lg:translate-x-0 ${
        mobileOpen ? 'translate-x-0' : '-translate-x-full'
      }`}
    >
      <div className="relative flex flex-col items-center border-b border-slate-200 bg-white px-5 pb-6 pt-7 text-center">
        <button
          type="button"
          onClick={onNavigate}
          className="absolute right-3 top-3 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-orange-500 lg:hidden"
          aria-label="Close menu"
        >
          <X className="h-5 w-5" />
        </button>
        <Logo size="md" linked centered to={logoTo} />
        {showBadge && (
          <span className="mt-3 inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-600">
            {subtitle ?? roleLabels[role]}
          </span>
        )}
      </div>

      <nav className="dashboard-sidebar-nav flex-1 space-y-4 overflow-y-auto bg-slate-50 px-3 py-4">
        {navSections.map((section, si) => (
          <div key={section.title ?? `section-${si}`}>
            {section.title && (
              <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                {section.title}
              </p>
            )}
            {!section.title && si === 0 && navSections.length === 1 && !sections && (
              <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                Menu
              </p>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => (
                <SidebarNavLink
                  key={item.to}
                  item={item}
                  end={endPaths.includes(item.to)}
                  onNavigate={onNavigate}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-slate-200 bg-white px-4 py-4">
        <div className="rounded-xl bg-slate-100 p-3">
          <div className="flex items-center gap-3">
            <UserAvatar name={userName ?? 'User'} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-900">{userName ?? 'User'}</p>
              {userEmail && (
                <p className="truncate text-[11px] text-slate-500">{userEmail}</p>
              )}
              {userMeta && (
                <p className="truncate text-[11px] text-slate-500">{userMeta}</p>
              )}
            </div>
          </div>

          {footerExtra && <div className="mt-3">{footerExtra}</div>}

          <button
            type="button"
            onClick={onSignOut}
            className="mt-3 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-white hover:text-orange-500"
          >
            <LogOut className="h-4 w-4 text-orange-500" />
            Sign out
          </button>
        </div>
      </div>
    </aside>
  );
}

export { SidebarNavLink, UserAvatar, roleLabels };
