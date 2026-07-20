import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useBranchPermission } from '../hooks/useBranchPermission';

export function RequireBranchPermission({
  reports,
  financialYear,
}: {
  reports?: boolean;
  financialYear?: boolean;
}) {
  const { user } = useAuth();
  const { canViewReports, canManageFinancialYear } = useBranchPermission();

  if (user?.role === 'ADMIN') return <Outlet />;

  if (reports && !canViewReports) {
    return <Navigate to="/branch/workspace/pos" replace />;
  }

  if (financialYear && !canManageFinancialYear) {
    return <Navigate to="/branch/workspace/pos" replace />;
  }

  return <Outlet />;
}
