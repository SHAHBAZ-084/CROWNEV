import { NavLink } from 'react-router-dom';
import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { LogOut } from 'lucide-react';
import { Logo } from '../brand/Logo';
import type { Role } from '../../types';

export interface SidebarNavItem {
  to: string;
  label: string;
  icon: LucideIcon;
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
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-brand text-sm font-bold text-white shadow-md shadow-accent/20">
      {initials || '?'}
    </div>
  );
}

function SidebarNavLink({
  item,
  end,
}: {
  item: SidebarNavItem;
  end?: boolean;
}) {
  return (
    <NavLink
      to={item.to}
      end={end}
      className={({ isActive }) =>
        `group flex items-center gap-3 rounded-xl px-2.5 py-2 text-sm font-medium transition-all duration-200 ${
          isActive
            ? 'bg-gradient-to-r from-accent/18 via-accent/10 to-transparent text-brand shadow-sm'
            : 'text-text-muted hover:bg-white/80 hover:text-brand hover:shadow-sm'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-all duration-200 ${
              isActive
                ? 'border-accent/40 bg-accent text-white shadow-md shadow-accent/25'
                : 'border-border/70 bg-white text-text-muted group-hover:border-accent/25 group-hover:text-accent'
            }`}
          >
            <item.icon className="h-4 w-4" />
          </span>
          <span className="truncate">{item.label}</span>
        </>
      )}
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
}: DashboardSidebarProps) {
  const endPaths = endPathsOverride ?? navEndPaths(role);
  const navSections: SidebarNavSection[] = sections ?? [{ items: nav ?? [] }];

  return (
    <aside className="dashboard-sidebar fixed left-0 top-0 z-30 flex h-full w-[17.5rem] flex-col border-r border-border/80 bg-gradient-to-b from-white via-[#fffcf9] to-[#fff4ec] shadow-[4px_0_28px_rgb(179_71_0/7%)]">
      <div className="flex flex-col items-center border-b border-border/60 px-5 pb-5 pt-6 text-center">
        <Logo size="md" linked centered />
        {showBadge && (
          <span className="mt-3 inline-flex rounded-full border border-accent/20 bg-accent/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-accent">
            {subtitle ?? roleLabels[role]}
          </span>
        )}
      </div>

      <nav className="dashboard-sidebar-nav flex-1 space-y-4 overflow-y-auto px-3 py-4">
        {navSections.map((section, si) => (
          <div key={section.title ?? `section-${si}`}>
            {section.title && (
              <p className="mb-2 px-2.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted/70">
                {section.title}
              </p>
            )}
            {!section.title && si === 0 && navSections.length === 1 && !sections && (
              <p className="mb-2 px-2.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted/70">
                Menu
              </p>
            )}
            <div className="space-y-1">
              {section.items.map((item) => (
                <SidebarNavLink key={item.to} item={item} end={endPaths.includes(item.to)} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-border/60 px-4 py-4">
        <div className="flex items-center gap-3 px-1">
          <UserAvatar name={userName ?? 'User'} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-brand">{userName ?? 'User'}</p>
            {userEmail && (
              <p className="truncate text-[11px] text-text-muted">{userEmail}</p>
            )}
            {userMeta && (
              <p className="truncate text-[11px] text-accent/80">{userMeta}</p>
            )}
          </div>
        </div>

        {footerExtra && <div className="mt-3 px-1">{footerExtra}</div>}

        <button
          type="button"
          onClick={onSignOut}
          className="mt-3 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium text-text-muted transition-colors hover:bg-white/60 hover:text-brand"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </aside>
  );
}

export { SidebarNavLink, UserAvatar, roleLabels };
