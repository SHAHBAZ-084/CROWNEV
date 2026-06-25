import { useAuth } from '../contexts/AuthContext';
import type { BranchPermission } from '../types';

export const BRANCH_PERMISSION_RESTRICTED_MSG = 'Your permission is restricted by admin';

export function useBranchPermission() {
  const { user } = useAuth();
  const perm: BranchPermission = user?.branchPermission ?? 'WRITE_UPDATE_DELETE';
  return {
    canUpdate: perm === 'WRITE_UPDATE' || perm === 'WRITE_UPDATE_DELETE',
    canDelete: perm === 'WRITE_UPDATE_DELETE',
    restrictedTitle: BRANCH_PERMISSION_RESTRICTED_MSG,
  };
}
