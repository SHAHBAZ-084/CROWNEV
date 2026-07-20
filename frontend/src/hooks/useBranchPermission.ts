import { useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import type { SidebarNavSection } from '../components/layout/DashboardSidebar';
import type { BranchPermission, Role } from '../types';

export const BRANCH_PERMISSION_RESTRICTED_MSG = 'Your permission is restricted by admin';

export function branchPermissionFlags(permission: BranchPermission, role?: Role) {
  const isAdmin = role === 'ADMIN';
  return {
    canUpdate: isAdmin || permission === 'WRITE_UPDATE' || permission === 'WRITE_UPDATE_DELETE',
    canDelete: isAdmin || permission === 'WRITE_UPDATE_DELETE',
    canViewReports: isAdmin || permission !== 'WRITE_ONLY',
    canManageFinancialYear: isAdmin || permission === 'WRITE_UPDATE_DELETE',
  };
}

export function filterPosSections(
  sections: SidebarNavSection[],
  permission: BranchPermission,
  role?: Role,
) {
  const { canViewReports, canManageFinancialYear } = branchPermissionFlags(permission, role);
  return sections.filter((section) => {
    if (section.title === 'Reports' && !canViewReports) return false;
    if (section.title === 'Financial Year' && !canManageFinancialYear) return false;
    return true;
  });
}

export function useBranchPermission() {
  const { user } = useAuth();
  const permission: BranchPermission = user?.branchPermission ?? 'WRITE_UPDATE_DELETE';
  const flags = useMemo(
    () => branchPermissionFlags(permission, user?.role),
    [permission, user?.role],
  );

  return {
    permission,
    ...flags,
    restrictedTitle: BRANCH_PERMISSION_RESTRICTED_MSG,
  };
}
